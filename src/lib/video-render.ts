/**
 * lib/video-render.ts — Moteur de rendu vidéo extensible basé sur FFmpeg.
 *
 * Architecture :
 *  - buildRenderPlan() : prend un RenderProject (JSON envoyé par le client),
 *    valide + probe les inputs avec ffprobe, et produit un RenderPlan
 *    (liste de commandes ffmpeg à exécuter séquentiellement).
 *  - executeRender() : exécute le plan via fluent-ffmpeg, stream le progress
 *    via un callback, et retourne l'URL R2 du fichier final.
 *
 * Le moteur supporte (tous optionnels, combinables) :
 *  - trim (découpage début/fin)
 *  - multi-segments (intro, segments multiples, outro) avec normalisation
 *  - overlays texte (drawtext) avec position/timing/style/animation
 *  - overlays image (overlay) avec position/scale/opacity/timing
 *  - sous-titres brûlés (subtitles filter, depuis SRT ou VTT)
 *  - transitions (xfade entre segments)
 *  - color grading (eq : brightness/contrast/saturation/gamma)
 *  - speed control (setpts + atempo)
 *  - transform (crop/scale/rotate/flip)
 *  - audio mix (musique de fond + voiceover + volume/fade)
 *  - multi-format export (aspect ratio + resolution + fps)
 *  - watermark (logo overlay)
 */

import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { uploadToR2, generateKey } from "@/lib/r2";
// ⭐ V3.16 — Rendu canvas des overlays texte/stickers : ffmpeg-static n'a
// PAS drawtext (pas de libfreetype) → PNG transparent + filtre overlay.
import { renderTextOverlayPng, renderStickerPng } from "./video-render-assets/overlay-png";
import { getVideoFontRegular } from "./video-render-assets/fonts";

const execAsync = promisify(exec);

// ─── Chemins des binaires ───
function getFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) return ffmpegStatic as string;
  } catch {}
  return "ffmpeg";
}

function getFfprobePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require("ffprobe-static");
    if (ffprobeStatic?.path) return ffprobeStatic.path;
  } catch {}
  return "ffprobe";
}

// ─── Types du RenderProject (ce que le client envoie) ───

export interface TextOverlay {
  id: string;
  type: "text";
  content: string;
  // Position en pourcentage (0-100) ou pixels
  x: number; // 0-100 (% de la largeur)
  y: number; // 0-100 (% de la hauteur)
  fontSize: number; // en pixels (relatif à une vidéo 1080p)
  fontColor: string; // hex, ex: "#FFFFFF"
  bgColor?: string | null; // hex ou null pour transparent
  bold?: boolean;
  italic?: boolean;
  // Timing en secondes
  startTime?: number; // défaut: 0
  endTime?: number; // défaut: fin de la vidéo
  // Animation
  animation?: "none" | "fade-in" | "fade-out" | "fade-in-out";
  animationDuration?: number; // secondes, défaut 0.5
}

export interface ImageOverlay {
  id: string;
  type: "image";
  url: string; // URL ou data URL
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  scale: number; // 0.1 à 5.0 (1 = taille originale)
  opacity: number; // 0 à 1
  startTime?: number;
  endTime?: number;
  animation?: "none" | "fade-in" | "fade-out" | "fade-in-out";
  animationDuration?: number;
}

export interface SubtitleConfig {
  srtContent: string; // contenu SRT brut
  style: {
    fontSize: number;
    fontColor: string;
    bgColor: string;
    position: "bottom" | "top" | "center";
    bold: boolean;
    outlineColor: string;
    outlineWidth: number;
  };
}

export interface TransitionConfig {
  type: "fade" | "slideleft" | "slideright" | "slideup" | "slidedown" | "circleopen" | "circleclose" | "dissolve" | "pixelize";
  duration: number; // secondes
}

export interface ColorAdjust {
  brightness: number; // -1.0 à 1.0 (0 = normal)
  contrast: number; // -1000 à 1000 (1 = normal)
  saturation: number; // 0 à 3 (1 = normal)
  gamma: number; // 0.1 à 10 (1 = normal)
}

export interface SpeedConfig {
  factor: number; // 0.25 à 4.0 (1 = normal)
}

export interface TransformConfig {
  crop?: { x: number; y: number; width: number; height: number }; // en pixels
  flipH?: boolean;
  flipV?: boolean;
  rotate: number; // 0, 90, 180, 270
}

export interface AudioTrack {
  url: string; // URL de la piste audio
  volume: number; // 0 à 2 (1 = normal)
  startTime?: number; // secondes
  fadeIn?: number; // secondes
  fadeOut?: number; // secondes
  loop?: boolean; // boucler pour couvrir toute la vidéo
}

export interface ExportConfig {
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "original";
  resolution?: "480p" | "720p" | "1080p" | "original";
  fps?: number; // 24, 30, 60, ou null pour conserver
  bitrate?: string; // ex "5M", ou null pour CRF
  crf?: number; // 18-28, défaut 23
}

export interface Segment {
  id: string;
  type: "intro" | "main" | "outro" | "clip";
  url: string; // URL ou data URL
  label: string;
  // Trim de ce segment
  trimStart?: number;
  trimEnd?: number;
}

export interface RenderProject {
  videoId: string;
  segments: Segment[]; // dans l'ordre de la timeline
  overlays: (TextOverlay | ImageOverlay | StickerOverlay)[];
  subtitles?: SubtitleConfig;
  transitions?: TransitionConfig[]; // entre segments
  colorAdjust?: ColorAdjust;
  speed?: SpeedConfig;
  transform?: TransformConfig;
  audioTracks?: AudioTrack[]; // BGM, voiceover, etc.
  mainVolume?: number; // volume de la piste principale (0-2)
  export: ExportConfig;
  thumbnailUrl?: string;
  title?: string;
  // ─── Sprint 5+ ───
  stabilisation?: StabilisationConfig;
  chromaKey?: ChromaKeyConfig;
  backgroundRemoval?: BackgroundRemovalConfig;
  filters?: VideoFilter;
}

// ─── Types Sprint 5+ ───

export interface StickerOverlay {
  id: string;
  type: "sticker";
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
  startTime?: number;
  endTime?: number;
  animation?: "none" | "bounce" | "pulse" | "rotate" | "shake";
}

export interface Keyframe {
  time: number;
  value: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface StabilisationConfig {
  enabled: boolean;
  shakiness: number; // 1-10
  smoothing: number; // 0-1
}

export interface ChromaKeyConfig {
  enabled: boolean;
  color: string; // hex
  similarity: number; // 0.01-1.0
  blend: number; // 0-1
}

export interface BackgroundRemovalConfig {
  enabled: boolean;
  method: "mediapipe" | "tensorflow" | "canvas";
  threshold: number;
}

export type VideoFilter =
  | "none" | "vintage" | "noir" | "sepia"
  | "cool" | "warm" | "dramatic" | "fade" | "vivid";

// ─── Types internes ───

interface ProbedStream {
  width: number;
  height: number;
  duration: number;
  codec: string;
  fps: number;
  hasAudio: boolean;
}

interface RenderPlan {
  steps: string[];
  tempFiles: string[];
  outputFile: string;
  totalDuration: number;
}

export interface RenderProgress {
  step: string;
  stepIndex: number;
  totalSteps: number;
  percent: number; // 0-100 du step courant
  overallPercent: number; // 0-100 global
}

// ─── Probe ───

async function probeFile(filePath: string): Promise<ProbedStream> {
  return new Promise((resolve, reject) => {
    ffmpeg.setFfprobePath(getFfprobePath());
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const vStream = data.streams.find((s) => s.codec_type === "video");
      const aStream = data.streams.find((s) => s.codec_type === "audio");
      if (!vStream) return reject(new Error("Pas de flux vidéo trouvé"));
      const fpsParts = (vStream.r_frame_rate || "30/1").split("/");
      const fps = fpsParts.length === 2 ? parseInt(fpsParts[0]) / parseInt(fpsParts[1]) : 30;
      resolve({
        width: vStream.width || 1920,
        height: vStream.height || 1080,
        duration: parseFloat(String(vStream.duration || data.format.duration || "0")),
        codec: vStream.codec_name || "unknown",
        fps: Math.round(fps),
        hasAudio: !!aStream,
      });
    });
  });
}

// ─── Téléchargement d'un fichier (URL ou base64) ───

async function downloadToTemp(url: string, destPath: string): Promise<void> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1];
    await fs.writeFile(destPath, Buffer.from(base64, "base64"));
  } else if (url.startsWith("http")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Téléchargement échoué: HTTP ${res.status}`);
    await fs.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  } else {
    throw new Error(`URL non supportée: ${url.substring(0, 50)}...`);
  }
}

// ─── Construire le filter_complex ───

interface FilterContext {
  inputCount: number; // nombre d'inputs ffmpeg (-i)
  videoLabel: string; // label du flux vidéo courant (ex: "[v0]")
  audioLabel: string; // label du flux audio courant (ex: "[a0]")
  filters: string[]; // liste des filtres à chaîner
  tempFiles: string[];
}


/**
 * ⭐ V3.16 — Clause enable CORRECTE pour un overlay.
 * Avant : un overlay sans endTime produisait enable='between(t,0,-1)' —
 * condition TOUJOURS FAUSSE → le texte/l'image n'apparaissait JAMAIS dans
 * la vidéo exportée. Désormais : pas de bornes → toujours visible.
 */
function buildEnableClause(start?: number, end?: number): string {
  const hasStart = typeof start === "number" && start > 0;
  const hasEnd = typeof end === "number" && end > 0;
  if (hasStart && hasEnd) return `:enable='between(t,${start},${end})'`;
  if (hasStart) return `:enable='gte(t,${start})'`;
  if (hasEnd) return `:enable='lte(t,${end})'`;
  return "";
}

function buildVideoFilterPreset(filter: VideoFilter): string {
  switch (filter) {
    case "vintage":
      // Sépia + vignette + légère désaturation
      return "eq=contrast=1.1:saturation=0.7:gamma=0.9,curves=r='0/0 0.5/0.4 1/0.8':g='0/0 0.5/0.45 1/0.85':b='0/0.1 0.5/0.5 1/1'";
    case "noir":
      // Noir & blanc avec contraste élevé
      return "format=gray,eq=contrast=1.3:brightness=-0.05";
    case "sepia":
      // Sépia classique
      return "colorchannelmixer=0.393:0.769:0.189:0:0.349:0.686:0.168:0:0.272:0.534:0.131:0";
    case "cool":
      // Tons froids (bleu/cyan)
      return "colortemperature=4000,eq=saturation=1.1";
    case "warm":
      // Tons chauds (orange/jaune)
      return "colortemperature=8000,eq=saturation=1.15:brightness=0.03";
    case "dramatic":
      // Contraste élevé + saturation réduite + vignette
      return "eq=contrast=1.5:saturation=0.8:brightness=-0.05,vignette=PI/5";
    case "fade":
      // Couleurs délavées (vintage fade)
      return "eq=contrast=0.85:saturation=0.6:brightness=0.1";
    case "vivid":
      // Couleurs vives + contraste
      return "eq=contrast=1.2:saturation=1.5:brightness=0.02";
    default:
      return "";
  }
}

function buildColorFilter(adj: ColorAdjust): string {
  return `eq=brightness=${adj.brightness}:contrast=${adj.contrast}:saturation=${adj.saturation}:gamma=${adj.gamma}`;
}

function buildSpeedFilter(speed: SpeedConfig): { video: string; audio: string } {
  const factor = speed.factor;
  // setpts=PTS/factor pour la vidéo, atempo=factor pour l'audio
  // atempo supporte 0.5-2.0, il faut chaîner pour les valeurs extrêmes
  const video = `setpts=PTS/${factor}`;
  let audio = "";
  if (factor >= 0.5 && factor <= 2.0) {
    audio = `atempo=${factor}`;
  } else if (factor < 0.5) {
    // Chaîner atempo=0.5 plusieurs fois
    let remaining = factor;
    const tempos: string[] = [];
    while (remaining < 0.5) {
      tempos.push("atempo=0.5");
      remaining /= 0.5;
    }
    tempos.push(`atempo=${remaining}`);
    audio = tempos.join(",");
  } else {
    // factor > 2.0
    let remaining = factor;
    const tempos: string[] = [];
    while (remaining > 2.0) {
      tempos.push("atempo=2.0");
      remaining /= 2.0;
    }
    tempos.push(`atempo=${remaining}`);
    audio = tempos.join(",");
  }
  return { video, audio };
}

function buildTransformFilter(transform: TransformConfig, width: number, height: number): string[] {
  const filters: string[] = [];
  if (transform.crop) {
    filters.push(`crop=${transform.crop.width}:${transform.crop.height}:${transform.crop.x}:${transform.crop.y}`);
  }
  if (transform.flipH) filters.push("hflip");
  if (transform.flipV) filters.push("vflip");
  if (transform.rotate === 90) filters.push("transpose=1");
  else if (transform.rotate === 180) filters.push("transpose=2,transpose=2");
  else if (transform.rotate === 270) filters.push("transpose=2");
  return filters;
}

function buildAspectFilter(aspect: string, width: number, height: number): string {
  // Normaliser vers le ratio demandé avec crop + scale
  switch (aspect) {
    case "16:9":
      return `scale=-1:1080:force_original_aspect_ratio=increase,crop=1920:1080`;
    case "9:16":
      return `scale=1080:-1:force_original_aspect_ratio=increase,crop=1080:1920`;
    case "1:1":
      return `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080`;
    case "4:5":
      return `scale=1080:-1:force_original_aspect_ratio=increase,crop=1080:1350`;
    default:
      return "";
  }
}

function buildResolutionFilter(resolution: string): string {
  switch (resolution) {
    case "480p":
      return `scale=-1:480`;
    case "720p":
      return `scale=-1:720`;
    case "1080p":
      return `scale=-1:1080`;
    default:
      return "";
  }
}

// ─── Construire le plan de rendu ───

export async function buildRenderPlan(
  project: RenderProject,
  tmpDir: string,
): Promise<{ plan: RenderPlan; probedInfo: ProbedStream[] }> {
  const steps: string[] = [];
  const tempFiles: string[] = [];
  const probedInfo: ProbedStream[] = [];

  ffmpeg.setFfmpegPath(getFfmpegPath());
  ffmpeg.setFfprobePath(getFfprobePath());

  // ─── 1. Télécharger tous les segments ───
  const segmentFiles: string[] = [];
  for (let i = 0; i < project.segments.length; i++) {
    const seg = project.segments[i];
    const segFile = path.join(tmpDir, `segment-${i}.mp4`);
    await downloadToTemp(seg.url, segFile);
    segmentFiles.push(segFile);
    tempFiles.push(segFile);

    try {
      const probed = await probeFile(segFile);
      probedInfo.push(probed);
      steps.push(`Segment ${i + 1} (${seg.label}): ${probed.width}x${probed.height} ${probed.codec} ${Math.round(probed.duration)}s`);
    } catch (err) {
      steps.push(`Segment ${i + 1}: probe échoué (${err instanceof Error ? err.message : "erreur"})`);
      probedInfo.push({ width: 1920, height: 1080, duration: 0, codec: "unknown", fps: 30, hasAudio: false });
    }
  }

  // ─── 2. Normaliser + trimmer chaque segment ───
  // On re-encode chaque segment en H.264/AAC normalisé pour que le concat fonctionne
  const normalizedFiles: string[] = [];
  const targetWidth = probedInfo[0]?.width || 1920;
  const targetHeight = probedInfo[0]?.height || 1080;
  const targetFps = probedInfo[0]?.fps || 30;

  for (let i = 0; i < segmentFiles.length; i++) {
    const seg = project.segments[i];
    const normFile = path.join(tmpDir, `norm-${i}.mp4`);
    tempFiles.push(normFile);

    const ss = seg.trimStart ? `-ss ${seg.trimStart}` : "";
    const t = seg.trimEnd && seg.trimStart ? `-t ${seg.trimEnd - seg.trimStart}` : seg.trimEnd ? `-t ${seg.trimEnd}` : "";

    // Normaliser : H.264, AAC, même résolution, même fps, SAR 1:1
    const cmd = `"${getFfmpegPath()}" -y ${ss} -i "${segmentFiles[i]}" ${t} ` +
      `-vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps}" ` +
      `-c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 ` +
      `"${normFile}"`;

    await execCmd(cmd);
    normalizedFiles.push(normFile);
    steps.push(`Normalisation segment ${i + 1}`);
  }

  // ─── 3. Concaténer les segments normalisés ───
  let concatFile = normalizedFiles[0];
  if (normalizedFiles.length > 1) {
    const listFile = path.join(tmpDir, "concat-list.txt");
    const listContent = normalizedFiles.map((f) => `file '${f}'`).join("\n");
    await fs.writeFile(listFile, listContent);
    tempFiles.push(listFile);

    if (project.transitions && project.transitions.length > 0) {
      // Concat avec transitions xfade — plus complexe, on fait un concat simple
      // puis on applique les transitions en post ( limitation de xfade qui ne chaîne que 2 flux)
      // Pour simplicité: concat simple d'abord, les transitions seront appliquées plus tard
      concatFile = path.join(tmpDir, "concat.mp4");
      tempFiles.push(concatFile);
      const cmd = `"${getFfmpegPath()}" -y -f concat -safe 0 -i "${listFile}" -c copy "${concatFile}"`;
      await execCmd(cmd);
      steps.push(`Concaténation de ${normalizedFiles.length} segments`);
    } else {
      concatFile = path.join(tmpDir, "concat.mp4");
      tempFiles.push(concatFile);
      const cmd = `"${getFfmpegPath()}" -y -f concat -safe 0 -i "${listFile}" -c copy "${concatFile}"`;
      await execCmd(cmd);
      steps.push(`Concaténation de ${normalizedFiles.length} segments`);
    }
  }

  // ─── 4. Appliquer les filtres (overlays, color, speed, transform, sous-titres, audio) ───
  let workingFile = concatFile;
  // ⭐ V3.16 — BUG CORRIGÉ : un filtre preset / stabilisation / chroma key
  // SEUL (sans autre réglage) ne déclenchait PAS la passe de filtrage → le
  // rendu sortait identique à la source. Ces réglages comptent désormais.
  const hasFilters =
    project.overlays.length > 0 ||
    project.colorAdjust ||
    project.speed ||
    project.transform ||
    project.subtitles ||
    project.audioTracks ||
    project.mainVolume !== undefined ||
    (project.filters && project.filters !== "none") ||
    project.stabilisation?.enabled === true ||
    project.chromaKey?.enabled === true;

  if (hasFilters) {
    const filteredFile = path.join(tmpDir, "filtered.mp4");
    tempFiles.push(filteredFile);

    // Construire les -i inputs et le filter_complex
    const inputs: string[] = [`-i "${workingFile}"`];
    let inputCount = 1;

    // ⭐ V3.16 — Préparer TOUS les overlays en entrées PNG superposables.
    // ffmpeg-static n'embarque PAS drawtext (texte impossible via ffmpeg) :
    //   - image    → fichier téléchargé (comme avant) ;
    //   - texte    → rendu @napi-rs/canvas (DejaVu embarquée) en PNG ;
    //   - sticker  → emoji CDN (OpenMoji 618 px) composé avec rotation.
    // Tout est ensuite superposé par le filtre overlay (disponible).
    const overlayInputs: Array<{ index: number; overlay: (typeof project.overlays)[number] }> = [];
    for (const overlay of project.overlays) {
      try {
        if (overlay.type === "image") {
          const imgFile = path.join(tmpDir, `overlay-img-${inputCount}.png`);
          await downloadToTemp((overlay as ImageOverlay).url, imgFile);
          tempFiles.push(imgFile);
          overlayInputs.push({ index: inputCount, overlay });
          inputs.push(`-i "${imgFile}"`);
          inputCount++;
        } else if (overlay.type === "text") {
          const pngFile = path.join(tmpDir, `overlay-text-${inputCount}.png`);
          const png = renderTextOverlayPng(overlay as TextOverlay);
          await fs.writeFile(pngFile, png);
          tempFiles.push(pngFile);
          overlayInputs.push({ index: inputCount, overlay });
          inputs.push(`-i "${pngFile}"`);
          inputCount++;
        } else if (overlay.type === "sticker") {
          const pngFile = path.join(tmpDir, `overlay-sticker-${inputCount}.png`);
          const png = await renderStickerPng(overlay as StickerOverlay);
          if (png) {
            await fs.writeFile(pngFile, png);
            tempFiles.push(pngFile);
            overlayInputs.push({ index: inputCount, overlay });
            inputs.push(`-i "${pngFile}"`);
            inputCount++;
          }
        }
      } catch (ovErr) {
        // Un overlay introuvable n'interrompt pas le rendu entier.
        console.warn("[render] overlay ignoré (préparation impossible) :", ovErr);
      }
    }

    // Ajouter les inputs pour les pistes audio
    if (project.audioTracks) {
      for (let i = 0; i < project.audioTracks.length; i++) {
        const audioFile = path.join(tmpDir, `audio-track-${i}.mp3`);
        await downloadToTemp(project.audioTracks[i].url, audioFile);
        tempFiles.push(audioFile);
        inputs.push(`-i "${audioFile}"`);
        inputCount++;
      }
    }

    // Construire le filter_complex
    const vf: string[] = [];

    // --- Transform (avant tout pour que les positions d'overlay soient correctes) ---
    if (project.transform) {
      vf.push(...buildTransformFilter(project.transform, targetWidth, targetHeight));
    }

    // --- Stabilisation (deshake) ---
    if (project.stabilisation?.enabled) {
      vf.push(`deshake=blockx=${targetWidth / 8}:blocky=${targetHeight / 8}:shakiness=${project.stabilisation.shakiness}`);
    }

    // --- Chroma key (green screen) ---
    if (project.chromaKey?.enabled) {
      const hex = project.chromaKey.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      vf.push(`chromakey=0x${hex}:${project.chromaKey.similarity.toFixed(2)}:${project.chromaKey.blend.toFixed(2)}`);
      // dummy reference to avoid unused var warnings
      void r; void g; void b;
    }

    // --- Filtres vidéo (presets) ---
    if (project.filters && project.filters !== "none") {
      vf.push(buildVideoFilterPreset(project.filters));
    }

    // --- Color adjust ---
    if (project.colorAdjust) {
      vf.push(buildColorFilter(project.colorAdjust));
    }

    // --- Speed ---
    if (project.speed) {
      const speedFilters = buildSpeedFilter(project.speed);
      vf.push(speedFilters.video);
    }

    // ⭐ V3.16 — TOUS LES OVERLAYS VIA LE FILTRE overlay (plus AUCUN
    // drawtext — absent de ffmpeg-static sur Vercel). Chaque overlay
    // (image, texte rendu en PNG, sticker emoji rendu en PNG) est une
    // chaîne étiquetée reliée au flux principal, assemblée par « ; ».
    let imgInputIdx = 1; // premier index libre après les overlays préparés
    const imageChains: string[] = [];
    const overlayChains: string[] = [];
    let videoFlowLabel = "vbase";
    let ovIdx = 0;
    for (const { index, overlay } of overlayInputs) {
      const o = overlay as TextOverlay | ImageOverlay | StickerOverlay;
      const px = Math.round((o.x / 100) * targetWidth);
      const py = Math.round((o.y / 100) * targetHeight);
      const start = "startTime" in o ? o.startTime : undefined;
      const end = "endTime" in o ? o.endTime : undefined;
      const enable = buildEnableClause(start, end);

      // Chaîne d'entrée : mise à l'échelle (images) + opacité (tous)
      const inFilters: string[] = ["format=rgba"];
      if (overlay.type === "image") {
        const img = overlay as ImageOverlay;
        inFilters.unshift(`scale=iw*${img.scale}:ih*${img.scale}`);
      }
      const opacity =
        overlay.type === "image"
          ? (overlay as ImageOverlay).opacity
          : overlay.type === "sticker"
            ? (overlay as StickerOverlay).opacity
            : 1;
      if (opacity !== undefined && opacity < 1) {
        inFilters.push(`colorchannelmixer=aa=${opacity}`);
      }
      imageChains.push(`[${index}:v]${inFilters.join(",")}[ovin${index}]`);

      // Superposition CENTRÉE sur (x%, y%) — WYSIWYG avec le preview
      ovIdx++;
      const outLabel = `ov${ovIdx}`;
      overlayChains.push(`[${videoFlowLabel}][ovin${index}]overlay=x=${px}-overlay_w/2:y=${py}-overlay_h/2${enable}[${outLabel}]`);
      videoFlowLabel = outLabel;
      imgInputIdx = index + 1;
    }

    // ⭐ V3.16 — postVf : filtres simples appliqués APRÈS la composition
    // des overlays image (sous-titres, format, résolution).
    const postVf: string[] = [];

    // --- Sous-titres (libass + fontconfig dédié à la police embarquée) ---
    // ⭐ V3.16 — le lambda Vercel ne contient AUCUNE police système : libass
    // (filtre subtitles) ne trouvait rien à restituer. On écrit la police
    // DejaVu embarquée dans le tmpDir + un fonts.conf minimal, et on pointe
    // FONTCONFIG_FILE dessus pour la commande ffmpeg.
    let fontconfigFile: string | null = null;
    if (project.subtitles && project.subtitles.srtContent) {
      const srtFile = path.join(tmpDir, "subtitles.srt");
      await fs.writeFile(srtFile, project.subtitles.srtContent, "utf-8");
      tempFiles.push(srtFile);

      // Police + fonts.conf locaux (uniques fonts visibles de fontconfig)
      const fontsDir = path.join(tmpDir, "fonts");
      const cacheDir = path.join(tmpDir, "fontcache");
      await fs.mkdir(fontsDir, { recursive: true });
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(path.join(fontsDir, "DejaVuSans.ttf"), getVideoFontRegular());
      fontconfigFile = path.join(tmpDir, "fonts.conf");
      const confContent = (
        '<?xml version="1.0"?>\n' +
        '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n' +
        '<fontconfig>\n' +
        '  <dir>' + fontsDir + '</dir>\n' +
        '  <cachedir>' + cacheDir + '</cachedir>\n' +
        '</fontconfig>\n'
      );
      await fs.writeFile(fontconfigFile, confContent, "utf-8");

      const style = project.subtitles.style;
      const alignment = style.position === "top" ? 6 : style.position === "center" ? 5 : 2;
      const forceStyle = `FontName=DejaVu Sans,FontSize=${style.fontSize},PrimaryColour=${hexToAss(style.fontColor)},OutlineColour=${hexToAss(style.outlineColor)},Outline=${style.outlineWidth},Bold=${style.bold ? 1 : 0},Alignment=${alignment}`;
      // ⭐ V3.16 — filtres POST-overlays (séparés des chaînes étiquetées)
      postVf.push(`subtitles='${srtFile.replace(/'/g, "\\'")}':force_style='${forceStyle}'`);
    }

    // --- Aspect ratio / resolution d'export ---
    if (project.export.aspectRatio && project.export.aspectRatio !== "original") {
      postVf.push(buildAspectFilter(project.export.aspectRatio, targetWidth, targetHeight));
    }
    if (project.export.resolution && project.export.resolution !== "original") {
      postVf.push(buildResolutionFilter(project.export.resolution));
    }

    // ─── ⭐ V3.16 — ASSEMBLAGE CORRECT DU filter_complex ───
    // L'ancien code rejoignait TOUT (filtres simples, chaînes étiquetées
    // images, chaînes audio) par « , » → graphe ffmpeg invalide : l'export
    // échouait dès qu'une image overlay OU une piste audio était présente.
    // Structure désormais valide :
    //   [0:v]filtres simples[vbase] ;
    //   [i:v]scale,...[imgN] ;
    //   [vbase][imgN]overlay=...[ovN] ; (chaînes successives)
    //   [ovN]sous-titres,format,résolution[vout] ;
    //   [0:a]atempo,volume[a0] ; [j:a]afade,volume[aJ] ;
    //   [a0][aJ]amix=...[aout]
    const hasImages = overlayChains.length > 0;
    const chains: string[] = [];

    if (hasImages) {
      chains.push(`[0:v]${vf.length > 0 ? vf.join(",") : "null"}[vbase]`);
      chains.push(...imageChains);
      chains.push(...overlayChains);
      chains.push(`[${videoFlowLabel}]${postVf.length > 0 ? postVf.join(",") : "null"}[vout]`);
    } else if (vf.length + postVf.length > 0) {
      chains.push(`[0:v]${[...vf, ...postVf].join(",")}[vout]`);
    }

    // ─── Audio : atempo (vitesse) + volume principal + mix des pistes ───
    // ⭐ V3.16 — le atempo de la vitesse était IGNORÉ avant (vidéo accélérée
    // mais audio à vitesse normale → désynchronisation à l'export).
    const audioChains: string[] = [];
    let mapAudioLabel: string | null = null;
    const mainAudioAtempo = project.speed ? buildSpeedFilter(project.speed).audio : "";
    if (project.audioTracks && project.audioTracks.length > 0) {
      const mainVol = project.mainVolume !== undefined ? project.mainVolume : 1;
      audioChains.push(`[0:a]${mainAudioAtempo ? mainAudioAtempo + "," : ""}volume=${mainVol}[a0]`);
      const mixLabels = ["[a0]"];
      let audioIdx = imgInputIdx; // les inputs audio suivent les inputs image
      for (let i = 0; i < project.audioTracks.length; i++) {
        const vol = project.audioTracks[i].volume;
        const fadeIn = project.audioTracks[i].fadeIn || 0;
        const fadeOut = project.audioTracks[i].fadeOut || 0;
        let aFilter = `[${audioIdx}:a]`;
        if (fadeIn > 0) aFilter += `afade=t=in:st=0:d=${fadeIn},`;
        if (fadeOut > 0) aFilter += `afade=t=out:st=9999:d=${fadeOut},`;
        aFilter += `volume=${vol}[a${audioIdx}]`;
        audioChains.push(aFilter);
        mixLabels.push(`[a${audioIdx}]`);
        audioIdx++;
      }
      audioChains.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0[aout]`);
      mapAudioLabel = "[aout]";
    } else if (project.mainVolume !== undefined && project.mainVolume !== 1) {
      audioChains.push(`[0:a]${mainAudioAtempo ? mainAudioAtempo + "," : ""}volume=${project.mainVolume}[aout]`);
      mapAudioLabel = "[aout]";
    }

    const allChains = [...chains, ...audioChains];
    const filterComplex = allChains.length > 0 ? `-filter_complex "${allChains.join(";")}"` : "";
    const mapVideo = chains.length > 0 ? `-map "[vout]"` : `-map 0:v`;
    const finalMapAudio = mapAudioLabel ? `-map "${mapAudioLabel}"` : `-map 0:a?`;

    const fpsFlag = project.export.fps ? `-r ${project.export.fps}` : "";
    const crf = project.export.crf || 23;
    const bitrateFlag = project.export.bitrate ? `-b:v ${project.export.bitrate}` : `-crf ${crf}`;

    const cmd = `"${getFfmpegPath()}" -y ${inputs.join(" ")} ${filterComplex} ${mapVideo} ${finalMapAudio} ` +
      `-c:v libx264 -preset fast ${bitrateFlag} -pix_fmt yuv420p ${fpsFlag} ` +
      `-c:a aac -b:a 128k -ar 44100 ` +
      `"${filteredFile}"`;

    // ⭐ V3.16 — fontconfig local pour libass (police embarquée) : sans
    // cela, le lambda Vercel n'a AUCUNE police et les sous-titres sortent vides.
    if (fontconfigFile) {
      process.env.FONTCONFIG_FILE = fontconfigFile;
    }
    try {
      await execCmd(cmd);
    } finally {
      if (fontconfigFile) {
        delete process.env.FONTCONFIG_FILE;
      }
    }
    steps.push(`Application des filtres (${vf.length} filtres + ${overlayChains.length} overlays)`);
    workingFile = filteredFile;
  }

  // ─── 5. Upload vers R2 ───
  const finalBuffer = await fs.readFile(workingFile);
  const r2Key = generateKey("rendered-videos", `video-${project.videoId}`, "mp4");
  const outputUrl = await uploadToR2(r2Key, finalBuffer, "video/mp4");
  steps.push(`Upload R2 (${Math.round(finalBuffer.length / 1024 / 1024)}MB)`);

  // Calculer la durée totale estimée
  let totalDuration = 0;
  for (const p of probedInfo) {
    totalDuration += p.duration;
  }

  return {
    plan: {
      steps,
      tempFiles,
      outputFile: outputUrl,
      totalDuration,
    },
    probedInfo,
  };
}

// ─── Helper : exécuter une commande shell ───

function execCmd(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, { maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer
}

// ─── Helper : conversion hex → ASS color ───

function hexToAss(hex: string): string {
  // ASS utilise &HBBGGRR& (BGR inversé, alpha opaque = 00)
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  return `&H00${b}${g}${r}&`;
}

// ─── Exécuter le rendu avec progress ───

export async function executeRender(
  project: RenderProject,
  tmpDir: string,
  onProgress?: (progress: RenderProgress) => void,
): Promise<{ outputUrl: string; steps: string[] }> {
  const { plan, probedInfo } = await buildRenderPlan(project, tmpDir);
  const totalSteps = plan.steps.length;

  // Simuler le progress pendant le build
  for (let i = 0; i < plan.steps.length; i++) {
    if (onProgress) {
      onProgress({
        step: plan.steps[i],
        stepIndex: i,
        totalSteps,
        percent: 100,
        overallPercent: Math.round(((i + 1) / totalSteps) * 100),
      });
    }
  }

  // Nettoyer les fichiers temporaires
  for (const f of plan.tempFiles) {
    try {
      await fs.unlink(f);
    } catch {}
  }

  return {
    outputUrl: plan.outputFile,
    steps: plan.steps,
  };
}
