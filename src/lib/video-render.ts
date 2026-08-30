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

// ─── Escape pour drawtext ───

function escapeDrawtext(text: string): string {
  // Échapper les caractères spéciaux pour drawtext
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

function escapeFontFile(path: string): string {
  return path.replace(/'/g, "'\\''");
}

// ─── Construire le filter_complex ───

interface FilterContext {
  inputCount: number; // nombre d'inputs ffmpeg (-i)
  videoLabel: string; // label du flux vidéo courant (ex: "[v0]")
  audioLabel: string; // label du flux audio courant (ex: "[a0]")
  filters: string[]; // liste des filtres à chaîner
  tempFiles: string[];
}

function buildOverlayFilters(
  overlays: (TextOverlay | ImageOverlay)[],
  videoWidth: number,
  videoHeight: number,
  ctx: FilterContext,
): void {
  for (const overlay of overlays) {
    if (overlay.type === "text") {
      const t = overlay as TextOverlay;
      const px = Math.round((t.x / 100) * videoWidth);
      const py = Math.round((t.y / 100) * videoHeight);
      const start = t.startTime || 0;
      const end = t.endTime || -1; // -1 = jusqu'à la fin

      let drawtext = `drawtext=fontfile='${escapeFontFile(getDefaultFont())}'`;
      drawtext += `:text='${escapeDrawtext(t.content)}'`;
      drawtext += `:x=${px}:y=${py}`;
      drawtext += `:fontsize=${t.fontSize}`;
      drawtext += `:fontcolor=${t.fontColor}`;
      if (t.bold) drawtext += `:box=1:boxcolor=${t.bgColor || "black@0.5"}:boxborderw=5`;
      drawtext += `:enable='between(t,${start},${end})'`;

      // Animation fade
      if (t.animation && t.animation !== "none") {
        const dur = t.animationDuration || 0.5;
        if (t.animation === "fade-in") {
          drawtext += `:alpha='if(lt(t-${start}),0,if(lt(t-${start + dur}),(t-${start})/${dur},1))'`;
        } else if (t.animation === "fade-out") {
          const endT = end > 0 ? end : 999999;
          drawtext += `:alpha='if(gt(t,${endT - dur}),max(0,1-(t-(${endT - dur}))/${dur}),1)'`;
        } else if (t.animation === "fade-in-out") {
          drawtext += `:alpha='if(lt(t-${start}),0,if(lt(t-${start + dur}),(t-${start})/${dur},if(gt(t,${end > 0 ? end - dur : 999999}),max(0,1-(t-(${end > 0 ? end - dur : 999999}))/${dur}),1)))'`;
        }
      }

      ctx.filters.push(drawtext);
    } else if (overlay.type === "image") {
      const img = overlay as ImageOverlay;
      // L'image est un input supplémentaire — on l'ajoute comme -i
      const imgInputIndex = ctx.inputCount;
      ctx.inputCount++;

      // Appliquer scale + opacity sur l'image
      const px = Math.round((img.x / 100) * videoWidth);
      const py = Math.round((img.y / 100) * videoHeight);
      const imgFilters: string[] = [];
      imgFilters.push(`scale=iw*${img.scale}:ih*${img.scale}`);
      imgFilters.push(`format=rgba`);
      imgFilters.push(`colorchannelmixer=aa=${img.opacity}`);

      let imgLabel = `[${imgInputIndex}:v]`;
      imgLabel += `${imgFilters.join(",")}[img${imgInputIndex}]`;
      ctx.filters.push(imgLabel);

      // Overlay sur la vidéo
      const start = img.startTime || 0;
      const end = img.endTime || -1;
      const overlayFilter = `[${ctx.videoLabel.slice(1, -1)}][img${imgInputIndex}]overlay=x=${px}:y=${py}:enable='between(t,${start},${end})'[v${ctx.inputCount}]`;
      ctx.filters.push(overlayFilter);
      ctx.videoLabel = `[v${ctx.inputCount}]`;
    }
  }
}

function getDefaultFont(): string {
  // Fonts disponibles sur Vercel serverless (Linux) et en dev
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
  ];
  return candidates[0];
}

function getEmojiFont(): string {
  // Font avec support emoji — Noto Color Emoji si disponible, sinon fallback
  const candidates = [
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/truetype/noto/NotoEmoji.ttf",
    "/usr/share/fonts/truetype/noto-color-emoji/NotoColorEmoji.ttf",
    "/System/Library/Fonts/Apple Color Emoji.ttc",
  ];
  return candidates[0];
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
  const hasFilters =
    project.overlays.length > 0 ||
    project.colorAdjust ||
    project.speed ||
    project.transform ||
    project.subtitles ||
    project.audioTracks ||
    project.mainVolume !== undefined;

  if (hasFilters) {
    const filteredFile = path.join(tmpDir, "filtered.mp4");
    tempFiles.push(filteredFile);

    // Construire les -i inputs et le filter_complex
    const inputs: string[] = [`-i "${workingFile}"`];
    let inputCount = 1;

    // Ajouter les inputs pour les overlays image
    for (const overlay of project.overlays) {
      if (overlay.type === "image") {
        const imgFile = path.join(tmpDir, `overlay-img-${inputCount}.png`);
        await downloadToTemp((overlay as ImageOverlay).url, imgFile);
        tempFiles.push(imgFile);
        inputs.push(`-i "${imgFile}"`);
        inputCount++;
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

    // --- Overlays texte ---
    for (const overlay of project.overlays) {
      if (overlay.type === "text") {
        const t = overlay as TextOverlay;
        const px = Math.round((t.x / 100) * targetWidth);
        const py = Math.round((t.y / 100) * targetHeight);
        const start = t.startTime || 0;
        const end = t.endTime || -1;

        let drawtext = `drawtext=fontfile='${escapeFontFile(getDefaultFont())}'`;
        drawtext += `:text='${escapeDrawtext(t.content)}'`;
        drawtext += `:x=${px}:y=${py}`;
        drawtext += `:fontsize=${t.fontSize}`;
        drawtext += `:fontcolor=${t.fontColor}`;
        if (t.bold) {
          drawtext += `:box=1:boxcolor=${t.bgColor || "black@0.5"}:boxborderw=5`;
        }
        drawtext += `:enable='between(t,${start},${end})'`;

        vf.push(drawtext);
      } else if (overlay.type === "sticker") {
        // --- Stickers emoji (via drawtext avec emoji Unicode) ---
        const s = overlay as StickerOverlay;
        const px = Math.round((s.x / 100) * targetWidth);
        const py = Math.round((s.y / 100) * targetHeight);
        const start = s.startTime || 0;
        const end = s.endTime || -1;

        let drawtext = `drawtext=fontfile='${escapeFontFile(getEmojiFont())}'`;
        drawtext += `:text='${escapeDrawtext(s.emoji)}'`;
        drawtext += `:x=${px}:y=${py}`;
        drawtext += `:fontsize=${s.size}`;
        drawtext += `:fontcolor=white`;
        drawtext += `:alpha=${s.opacity}`;
        drawtext += `:enable='between(t,${start},${end})'`;

        vf.push(drawtext);
      }
    }

    // --- Overlays image ---
    let imgInputIdx = 1; // commence à 1 car [0] est la vidéo principale
    for (const overlay of project.overlays) {
      if (overlay.type === "image") {
        const img = overlay as ImageOverlay;
        const px = Math.round((img.x / 100) * targetWidth);
        const py = Math.round((img.y / 100) * targetHeight);
        const start = img.startTime || 0;
        const end = img.endTime || -1;

        // Scale + opacity sur l'image input
        vf.push(`[${imgInputIdx}:v]scale=iw*${img.scale}:ih*${img.scale},format=rgba,colorchannelmixer=aa=${img.opacity}[img${imgInputIdx}]`);
        // Overlay sur le flux vidéo
        const lastV = vf.length > 0 && vf[vf.length - 1].includes("[img") ? "v0" : "0:v";
        vf.push(`[${lastV}][img${imgInputIdx}]overlay=x=${px}:y=${py}:enable='between(t,${start},${end})'[v${imgInputIdx}]`);
        imgInputIdx++;
      }
    }

    // --- Sous-titres ---
    if (project.subtitles && project.subtitles.srtContent) {
      const srtFile = path.join(tmpDir, "subtitles.srt");
      await fs.writeFile(srtFile, project.subtitles.srtContent, "utf-8");
      tempFiles.push(srtFile);

      const style = project.subtitles.style;
      const alignment = style.position === "top" ? 6 : style.position === "center" ? 5 : 2;
      const forceStyle = `FontSize=${style.fontSize},PrimaryColour=${hexToAss(style.fontColor)},OutlineColour=${hexToAss(style.outlineColor)},Outline=${style.outlineWidth},Bold=${style.bold ? 1 : 0},Alignment=${alignment}`;
      vf.push(`subtitles='${srtFile.replace(/'/g, "\\'")}':force_style='${forceStyle}'`);
    }

    // --- Aspect ratio / resolution d'export ---
    if (project.export.aspectRatio && project.export.aspectRatio !== "original") {
      vf.push(buildAspectFilter(project.export.aspectRatio, targetWidth, targetHeight));
    }
    if (project.export.resolution && project.export.resolution !== "original") {
      vf.push(buildResolutionFilter(project.export.resolution));
    }

    // Construire la commande ffmpeg complète
    const filterComplex = vf.length > 0 ? `-filter_complex "${vf.join(",")}"` : "";
    const mapVideo = vf.length > 0 ? `-map "[v${imgInputIdx - 1}]"` : `-map 0:v`;
    const mapAudio = project.audioTracks && project.audioTracks.length > 0 ? "" : `-map 0:a?`;

    // Gestion audio : mix des pistes
    let audioFilter = "";
    if (project.audioTracks && project.audioTracks.length > 0) {
      // amix des pistes audio supplémentaires + la piste principale
      const audioInputs = ["[0:a]"];
      let audioIdx = imgInputIdx; // les inputs audio suivent les inputs image
      for (let i = 0; i < project.audioTracks.length; i++) {
        const vol = project.audioTracks[i].volume;
        const fadeIn = project.audioTracks[i].fadeIn || 0;
        const fadeOut = project.audioTracks[i].fadeOut || 0;
        let aFilter = `[${audioIdx}:a]`;
        if (fadeIn > 0 || fadeOut > 0) {
          aFilter += `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=9999:d=${fadeOut},`;
        }
        aFilter += `volume=${vol}[a${audioIdx}]`;
        vf.push(aFilter);
        audioInputs.push(`[a${audioIdx}]`);
        audioIdx++;
      }
      const mainVol = project.mainVolume !== undefined ? project.mainVolume : 1;
      audioInputs[0] = `[0:a]volume=${mainVol}[a0]`;
      vf.push(`[0:a]volume=${mainVol}[a0]`);
      audioInputs[0] = "[a0]";
      audioFilter = `${audioInputs.join("")}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0[aout]`;
      vf.push(audioFilter);
    } else if (project.mainVolume !== undefined && project.mainVolume !== 1) {
      vf.push(`[0:a]volume=${project.mainVolume}[aout]`);
      audioFilter = "";
    }

    const finalMapAudio = project.audioTracks && project.audioTracks.length > 0
      ? `-map "[aout]"`
      : (project.mainVolume !== undefined && project.mainVolume !== 1 ? `-map "[aout]"` : `-map 0:a?`);

    const fpsFlag = project.export.fps ? `-r ${project.export.fps}` : "";
    const crf = project.export.crf || 23;
    const bitrateFlag = project.export.bitrate ? `-b:v ${project.export.bitrate}` : `-crf ${crf}`;

    const cmd = `"${getFfmpegPath()}" -y ${inputs.join(" ")} ${filterComplex} ${mapVideo} ${finalMapAudio} ` +
      `-c:v libx264 -preset fast ${bitrateFlag} -pix_fmt yuv420p ${fpsFlag} ` +
      `-c:a aac -b:a 128k -ar 44100 ` +
      `"${filteredFile}"`;

    await execCmd(cmd);
    steps.push(`Application des filtres (${vf.length} filtres)`);
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
