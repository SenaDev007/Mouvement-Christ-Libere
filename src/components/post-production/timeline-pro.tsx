"use client";

/**
 * ⭐ V3.61 — TIMELINE PRO MULTI-PISTES (style CapCut / Premiere Pro).
 * ============================================================================
 * Réponse à la demande pasteur : « la timeline ne ressemble pas à CapCut ou
 * Premiere Pro… on devrait avoir une piste audio, une piste pour les images,
 * une piste pour les transitions ».
 *
 * Structure (comme un NLE) :
 *   ┌──────┬────────────────────────────────────────────────┐
 *   │ V1   │ clips vidéo (réordonnables, poignées de trim)  │
 *   │      │ + badges TRANSITIONS entre clips               │
 *   │ TX   │ textes superposés (fenêtre temporelle)          │
 *   │ IMG  │ images / stickers pro (fenêtre temporelle)      │
 *   │ A1.. │ pistes audio (une voie par piste, déplaçable)   │
 *   └──────┴────────────────────────────────────────────────┘
 *
 * Interactions :
 *   - règle temporelle + tête de lecture draggable (scrub) ;
 *   - zoom (pixels/seconde) + bouton « Ajuster » ;
 *   - glisser un CLIP vidéo horizontalement → réordonner ;
 *   - poignées de bord → trim (clips) / fenêtre (overlays) ;
 *   - glisser un bloc AUDIO / TEXTE / IMAGE → déplacer dans le temps
 *     (startTime honoré AUSSI à l'export V3.61 — adelay ffmpeg) ;
 *   - badges transitions → clic → ouvre l'onglet Transitions ;
 *   - DROP depuis la Bibliothèque (V3.59) : son/musique → piste audio,
 *     vidéo → piste V1 (dataTransfer application/x-pp-audio|video).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Film, Type, ImageIcon, Music2, Trash2, Plus, ZoomIn, ZoomOut,
  Maximize2, GripVertical, ArrowLeftRight, Volume2, Layers,
} from "lucide-react";
import type { AudioTrack, Overlay, TransitionConfig, ImageOverlay, TextOverlay, StickerOverlay } from "./types";

// ─── Types locaux (structurellement compatibles avec post-production.tsx) ───

export interface ClipTimeline {
  id: string;
  type: "intro" | "main" | "outro" | "clip";
  label: string;
  duration: number;
  src?: string;
  color: string;
  trimStart?: number;
  trimEnd?: number;
  url?: string;
}

export interface DropAudioData {
  url: string;
  name: string;
  volume?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
}

export interface DropVideoData {
  url: string;
  name: string;
  duration?: number;
}

interface TimelineProProps {
  clips: ClipTimeline[];
  overlays: Overlay[];
  audioTracks: AudioTrack[];
  transitions: TransitionConfig[];
  currentTime: number;
  totalDuration: number;
  trimStart: number;
  trimEnd: number;
  selectedOverlayId?: string | null;
  onSeek: (t: number) => void;
  onReorderClip: (fromIndex: number, toIndex: number) => void;
  onUpdateClipTrim: (id: string, trimStart: number | undefined, trimEnd: number | undefined) => void;
  onSetMainTrim: (start: number, end: number) => void;
  onDeleteClip: (id: string) => void;
  onUpdateAudio: (id: string, patch: Partial<AudioTrack>) => void;
  onDeleteAudio: (id: string) => void;
  onUpdateOverlayTime: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  onDeleteOverlay: (id: string) => void;
  onSelectOverlay: (id: string) => void;
  onOpenTransitions: () => void;
  onDropAudio: (data: DropAudioData, startTime: number) => void;
  onDropVideo: (data: DropVideoData, atSeconds: number) => void;
}

// ─── Utilitaires ───

function formaterTemps(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formaterTempsFin(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const d = Math.floor((t % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${d}`;
}

/** Pas de graduation adapté au zoom (≥ 64 px entre graduations). */
function pasRuler(pxParSec: number): number {
  const candidats = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const c of candidats) if (c * pxParSec >= 64) return c;
  return 900;
}

const HAUTEURS = { ruler: 26, v1: 54, tx: 26, img: 26, audio: 34 };
const GOUTTERE = 108;

type DragInterne =
  | { genre: "scrub" }
  | { genre: "clip"; index: number }
  | { genre: "audio"; id: string; deltaX: number }
  | { genre: "overlay"; id: string; deltaX: number; longueur: number }
  | null;

// ─── Composant ───

export function TimelinePro(props: TimelineProProps) {
  const {
    clips, overlays, audioTracks, transitions, currentTime, totalDuration,
    trimStart, trimEnd, selectedOverlayId,
    onSeek, onReorderClip, onUpdateClipTrim, onSetMainTrim, onDeleteClip,
    onUpdateAudio, onDeleteAudio, onUpdateOverlayTime, onDeleteOverlay,
    onSelectOverlay, onOpenTransitions, onDropAudio, onDropVideo,
  } = props;

  const conteneurRef = useRef<HTMLDivElement>(null);
  // ⭐ V3.62 — 0 = « pas encore mesuré » : le premier auto-fit doit attendre
  // la LARGEUR RÉELLE du conteneur (ResizeObserver) et non un placeholder
  // (avant : 900 → zoom initial faux dès le montage).
  const [largeur, setLargeur] = useState(0);
  const [pxParSec, setPxParSec] = useState(40);
  const [drag, setDrag] = useState<DragInterne>(null);
  const [dropCible, setDropCible] = useState<"audio" | "video" | null>(null);
  const [ghostX, setGhostX] = useState(0);
  const ghostXRef = useRef(0);
  const dragRef = useRef<DragInterne>(null);
  dragRef.current = drag;

  // Largeur du conteneur (pour « Ajuster »)
  useLayoutEffect(() => {
    const el = conteneurRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setLargeur(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Durée totale visible : clips + audio + overlays (marge 8 s)
  const dureeAffichee = useMemo(() => {
    let fin = totalDuration || 10;
    for (const a of audioTracks) fin = Math.max(fin, (a.startTime || 0) + (a.duration || 12));
    for (const o of overlays) {
      const s = "startTime" in o ? o.startTime : undefined;
      const e = "endTime" in o ? o.endTime : undefined;
      fin = Math.max(fin, e || (s !== undefined ? s + 4 : 0));
    }
    return Math.max(fin + 8, 15);
  }, [totalDuration, clips, audioTracks, overlays]);

  // ⭐ V3.62 — ANTI « ÉCRAN QUI S'ÉLARGIT » (zoom) : l'auto-fit doit se
  // caler sur la largeur RÉELLE (mesurée) ET se RECALER quand la durée réelle
  // de la vidéo arrive (métadonnées). Avant : ajuster() tournait UNE fois au
  // montage avec la largeur placeholder 900 et une durée ~18 s (métadonnées
  // pas encore chargées) → 43 px/s ; quand les ~443 s réelles arrivaient,
  // RIEN ne se recalait → contenu de 19 049 px. Désormais : l'utilisateur
  // qui touche le zoom prend la main (plus aucun auto-fit), et l'auto-fit
  // se relance si la durée change fortement (jamais pendant un glisser).
  const zoomManuelRef = useRef(false);   // l'utilisateur a pris la main
  const ajustementsAutoRef = useRef(0);  // borne les auto-fits (max 3)
  const dureeAjusteeRef = useRef<number | null>(null);

  const ajuster = useCallback(() => {
    if (largeur < 200) return; // pas encore de mesure réelle → ne rien casser
    const utile = Math.max(1, largeur - GOUTTERE - 24);
    setPxParSec(Math.max(2, Math.min(400, utile / dureeAffichee)));
  }, [largeur, dureeAffichee]);

  /** Zoom modifié PAR L'UTILISATEUR → stoppe tout auto-fit futur. */
  const zoomer = useCallback((v: number) => {
    zoomManuelRef.current = true;
    setPxParSec(Math.max(2, Math.min(400, Number.isFinite(v) ? v : 40)));
  }, []);

  // ① premier ajustement dès que la largeur RÉELLE est mesurée
  const premiereMesureRef = useRef(false);
  useEffect(() => {
    if (premiereMesureRef.current || largeur < 200) return;
    premiereMesureRef.current = true;
    if (!zoomManuelRef.current) ajuster();
  }, [largeur, ajuster]);

  // ② recalage quand la durée affichée change fortement (métadonnées vidéo,
  // drop d'un clip long…) — jamais pendant un glisser, jamais après un zoom
  // manuel, max 3 fois (le bouton « Ajuster » reste toujours disponible).
  useEffect(() => {
    if (zoomManuelRef.current || dragRef.current) return;
    if (ajustementsAutoRef.current >= 3) return;
    if (dureeAjusteeRef.current === null) { dureeAjusteeRef.current = dureeAffichee; return; }
    const prec = dureeAjusteeRef.current;
    if (Math.abs(dureeAffichee - prec) / Math.max(1, prec) < 0.2) return;
    dureeAjusteeRef.current = dureeAffichee;
    ajustementsAutoRef.current += 1;
    if (premiereMesureRef.current) ajuster();
  }, [dureeAffichee, ajuster]);

  const largeurContenu = Math.max(dureeAffichee * pxParSec, 320);

  // Offsets cumulés des clips V1
  const offsetsClips = useMemo(() => {
    const acc: number[] = [];
    let t = 0;
    for (const c of clips) { acc.push(t); t += c.duration; }
    return acc;
  }, [clips]);

  // ─── Conversion pixel ↔ temps (via le scroller) ───
  const xVersTemps = useCallback((clientX: number) => {
    const sc = conteneurRef.current?.querySelector("[data-scroller]") as HTMLElement | null;
    if (!sc) return 0;
    const rect = sc.getBoundingClientRect();
    const x = clientX - rect.left + sc.scrollLeft;
    return Math.max(0, x / Math.max(1, pxParSec));
  }, [pxParSec]);

  // ─── Interactions pointeur globales ───
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.genre === "scrub") {
        onSeek(xVersTemps(e.clientX));
        return;
      }
      if (d.genre === "clip") {
        ghostXRef.current = (ghostXRef.current || 0) + e.movementX;
        setGhostX(ghostXRef.current);
        return;
      }
      if (d.genre === "audio") {
        const t = xVersTemps(e.clientX) - d.deltaX;
        onUpdateAudio(d.id, { startTime: Math.max(0, t) });
        return;
      }
      if (d.genre === "overlay") {
        const t = Math.max(0, xVersTemps(e.clientX) - d.deltaX);
        // déplacer la FENÊTRE ENTIÈRE (préserver la longueur)
        onUpdateOverlayTime(d.id, { startTime: t, endTime: t + d.longueur });
        return;
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, onSeek, onUpdateAudio, onUpdateOverlayTime, xVersTemps]);

  // Réordonnancement : à la relâche, calculer l'index de destination
  const terminerReordre = useCallback((indexOrigine: number, clientX: number) => {
    const t = xVersTemps(clientX);
    let dest = 0;
    for (let i = 0; i < clips.length; i++) {
      const centre = offsetsClips[i] + clips[i].duration / 2;
      if (t > centre) dest = i + 1;
    }
    if (dest > indexOrigine) dest -= 1; // compensation du retrait
    if (dest !== indexOrigine) onReorderClip(indexOrigine, dest);
  }, [clips, offsetsClips, onReorderClip, xVersTemps]);

  // ─── Graduations de la règle ───
  const graduations = useMemo(() => {
    const pas = pasRuler(pxParSec);
    const out: number[] = [];
    for (let t = 0; t <= dureeAffichee; t += pas) out.push(t);
    return out;
  }, [pxParSec, dureeAffichee]);

  // ─── Overlays groupés par type ───
  const textes = overlays.filter((o): o is TextOverlay => o.type === "text");
  const imagesStickers = overlays.filter((o): o is ImageOverlay | StickerOverlay => o.type === "image" || o.type === "sticker");

  // Fenêtre temporelle effective d'un overlay
  const fenetreOverlay = (o: Overlay): { debut: number; fin: number } => {
    const s = ("startTime" in o ? o.startTime : undefined) ?? 0;
    const e = ("endTime" in o ? o.endTime : undefined) ?? Math.max(totalDuration || 10, s + 4);
    return { debut: s, fin: Math.max(s + 0.2, e) };
  };

  // ─── Drop depuis la Bibliothèque (HTML5 DnD) ───
  const lireDrop = <T,>(e: React.DragEvent, mime: string): T | null => {
    const raw = e.dataTransfer.getData(mime);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  };

  const surDropAudio = (e: React.DragEvent) => {
    e.preventDefault();
    setDropCible(null);
    const data = lireDrop<DropAudioData>(e, "application/x-pp-audio");
    if (data?.url) onDropAudio(data, xVersTemps(e.clientX));
  };

  const surDropVideo = (e: React.DragEvent) => {
    e.preventDefault();
    setDropCible(null);
    const data = lireDrop<DropVideoData>(e, "application/x-pp-video");
    if (data?.url) onDropVideo(data, xVersTemps(e.clientX));
  };

  const surDragOverAudio = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-pp-audio")) {
      e.preventDefault(); setDropCible("audio");
    }
  };
  const surDragOverVideo = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-pp-video")) {
      e.preventDefault(); setDropCible("video");
    }
  };

  // ─── Rendu ───

  return (
    <div className="bg-white rounded-xl p-3 border border-[#8A8378]/15">
      {/* ─── Barre d'outils ─── */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Layers className="w-4 h-4 text-[#C9A227]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#1E0F2B]">Timeline multi-pistes</span>
        <span className="text-[10px] text-[#8A8378] truncate">
          {clips.length} clip(s) · {overlays.length} élément(s) · {audioTracks.length} piste(s) audio
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => zoomer(pxParSec / 1.35)}
            className="p-1.5 rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10" title="Zoom arrière">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range" min={2} max={400} step={1} value={Math.round(pxParSec)}
            onChange={(e) => zoomer(parseFloat(e.target.value))}
            className="w-24 accent-[#C9A227]" title="Zoom (pixels/seconde)"
          />
          <button onClick={() => zoomer(pxParSec * 1.35)}
            className="p-1.5 rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10" title="Zoom avant">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { zoomManuelRef.current = true; ajuster(); }}
            className="p-1.5 rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10" title="Ajuster à la fenêtre">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Corps : gouttière + pistes scrollables ─── */}
      <div ref={conteneurRef} className="relative rounded-lg border border-[#8A8378]/15 bg-[#FAF8F4] overflow-hidden">
        <div className="flex">
          {/* Gouttière (en-têtes de pistes) — fixe, ne défile pas */}
          <div className="bg-[#F3F0E8] border-r border-[#8A8378]/20 flex-shrink-0 select-none" style={{ width: GOUTTERE }}>
            <div className="flex items-center px-2 border-b border-[#8A8378]/15 text-[9px] font-bold text-[#8A8378] tabular-nums" style={{ height: HAUTEURS.ruler }}>
              {formaterTempsFin(currentTime)}
            </div>
            <div className="flex items-center gap-1.5 px-2 border-b border-[#8A8378]/15" style={{ height: HAUTEURS.v1 }}>
              <Film className="w-3.5 h-3.5 text-[#2A0E3D]" />
              <div className="min-w-0">
                <p className="text-[10px] font-black text-[#1E0F2B] leading-tight">V1 · Vidéo</p>
                <p className="text-[8px] text-[#8A8378] leading-tight truncate">clips + transitions</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 border-b border-[#8A8378]/15" style={{ height: HAUTEURS.tx }}>
              <Type className="w-3 h-3 text-[#7C3AED]" />
              <p className="text-[10px] font-bold text-[#1E0F2B]">TX · Textes</p>
              <span className="text-[8px] text-[#8A8378] ml-auto">{textes.length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 border-b border-[#8A8378]/15" style={{ height: HAUTEURS.img }}>
              <ImageIcon className="w-3 h-3 text-[#0D9488]" />
              <p className="text-[10px] font-bold text-[#1E0F2B]">IMG · Images</p>
              <span className="text-[8px] text-[#8A8378] ml-auto">{imagesStickers.length}</span>
            </div>
            {(audioTracks.length === 0 ? [null] : audioTracks).map((t, i) => (
              <div key={t?.id || "vide"} className="flex items-center gap-1.5 px-2 border-b border-[#8A8378]/15" style={{ height: HAUTEURS.audio }}>
                <Volume2 className={`w-3 h-3 flex-shrink-0 ${t && t.volume === 0 ? "text-red-400" : "text-[#15803D]"}`} />
                <p className="text-[10px] font-bold text-[#1E0F2B] flex-shrink-0">A{i + 1}</p>
                {t ? (
                  <>
                    <span className="text-[8px] text-[#8A8378] truncate flex-1">{t.name}</span>
                    <button onClick={() => onUpdateAudio(t.id, { volume: t.volume > 0 ? 0 : 1 })}
                      className={`p-0.5 rounded flex-shrink-0 ${t.volume > 0 ? "text-[#15803D] hover:bg-[#15803D]/10" : "text-red-500 hover:bg-red-500/10"}`}
                      title={t.volume > 0 ? "Rendre muette (volume 0)" : "Rétablir le volume"}>
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-[8px] text-[#8A8378] truncate flex-1">— vide —</span>
                )}
              </div>
            ))}
          </div>

          {/* Zone scrollable des pistes */}
          {/* ⭐ V3.62 — min-w-0 : le scroller doit RÉTRÉCIR à la place
              restante (flex-1) et laisser le contenu défiler à l'intérieur ;
              sans lui son min-content (largeur explicite du contenu) pouvait
              dilater le conteneur flex lui-même. */}
          <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden" data-scroller>
            <div style={{ width: largeurContenu, position: "relative" }}>
              {/* Règle temporelle (scrub) */}
              <div
                className="relative bg-[#F3F0E8] border-b border-[#8A8378]/15 cursor-ew-resize select-none"
                style={{ height: HAUTEURS.ruler }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  onSeek(xVersTemps(e.clientX));
                  setDrag({ genre: "scrub" });
                }}
              >
                {graduations.map((t) => (
                  <div key={t} className="absolute top-0 bottom-0" style={{ left: t * pxParSec }}>
                    <div className="absolute top-0 w-px h-2 bg-[#8A8378]/50" />
                    <span className="absolute top-2 left-1 text-[8px] font-bold text-[#8A8378] tabular-nums">
                      {formaterTemps(t)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Piste V1 — vidéo */}
              <div className="relative" style={{ height: HAUTEURS.v1 }}>
                <div
                  className="absolute inset-0"
                  onDragOver={surDragOverVideo}
                  onDragLeave={() => setDropCible(null)}
                  onDrop={surDropVideo}
                />
                {dropCible === "video" && (
                  <div className="absolute inset-0 bg-[#C9A227]/12 ring-1 ring-[#C9A227] ring-inset rounded-md pointer-events-none z-20 flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-full bg-[#C9A227] text-white text-[10px] font-bold shadow-lg flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Déposer la vidéo ici
                    </span>
                  </div>
                )}
                {clips.map((clip, i) => {
                  const gauche = offsetsClips[i] * pxParSec;
                  const largeur = Math.max(34, clip.duration * pxParSec);
                  const enDrag = drag?.genre === "clip" && drag.index === i;
                  // zones de trim (rouge hachuré) pour le clip principal
                  const trimG = clip.type === "main" ? trimStart * pxParSec : (clip.trimStart || 0) * pxParSec;
                  const trimD = clip.type === "main"
                    ? Math.max(0, (clip.duration - trimEnd)) * pxParSec
                    : Math.max(0, (clip.duration - (clip.trimEnd ?? clip.duration))) * pxParSec;
                  return (
                    <div key={clip.id}>
                      {/* Badge transition AVANT ce clip (sauf premier) */}
                      {i > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenTransitions(); }}
                          title={`Transition « ${transitions[i - 1]?.type || "aucune"} » entre « ${clips[i - 1].label} » et « ${clip.label} » — cliquer pour la régler`}
                          className="absolute z-30 flex items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-110"
                          style={{
                            left: gauche - 11, top: HAUTEURS.v1 / 2 - 11,
                            width: 22, height: 22,
                            background: transitions[i - 1] ? "#C9A227" : "#ffffff",
                            borderColor: transitions[i - 1] ? "#A3821C" : "#8A8378",
                          }}
                        >
                          <ArrowLeftRight className="w-3 h-3" style={{ color: transitions[i - 1] ? "#fff" : "#8A8378" }} />
                        </button>
                      )}
                      {/* Bloc clip */}
                      <div
                        className={`absolute top-1 bottom-1 rounded-md overflow-hidden select-none group ${enDrag ? "opacity-50" : ""}`}
                        style={{
                          left: gauche + (enDrag ? ghostX : 0), width: largeur,
                          background: `linear-gradient(180deg, ${clip.color}, ${clip.color}CC)`,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
                          zIndex: 5, cursor: "grab",
                        }}
                        onPointerDown={(e) => {
                          if (e.button !== 0 || largeur < 60) return;
                          e.stopPropagation();
                          ghostXRef.current = 0; setGhostX(0);
                          setDrag({ genre: "clip", index: i });
                          const onUpOnce = (ev: PointerEvent) => {
                            window.removeEventListener("pointerup", onUpOnce);
                            const deplacement = ghostXRef.current;
                            if (Math.abs(deplacement) > 30) terminerReordre(i, ev.clientX);
                            ghostXRef.current = 0; setGhostX(0);
                            setDrag(null);
                          };
                          window.addEventListener("pointerup", onUpOnce);
                        }}
                        title={`${clip.label} — glisser pour réordonner, poignées pour rogner`}
                      >
                        {/* zones rognées (hachures rouges, comme l'ancienne timeline) */}
                        {trimG > 1 && (
                          <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{
                            width: trimG,
                            backgroundImage: "repeating-linear-gradient(45deg, rgba(153,27,27,.55) 0 4px, rgba(153,27,27,.15) 4px 8px)",
                          }} />
                        )}
                        {trimD > 1 && (
                          <div className="absolute right-0 top-0 bottom-0 pointer-events-none" style={{
                            width: Math.min(trimD, largeur - trimG - 2),
                            backgroundImage: "repeating-linear-gradient(45deg, rgba(153,27,27,.55) 0 4px, rgba(153,27,27,.15) 4px 8px)",
                          }} />
                        )}
                        <div className="h-full flex flex-col items-center justify-center px-2 pointer-events-none">
                          <span className="text-[10px] font-bold text-white truncate w-full text-center">{clip.label}</span>
                          <span className="text-[8px] text-white/70">{formaterTemps(clip.duration)}</span>
                          {clip.type !== "main" && (
                            <span className="text-[7px] font-bold text-white/60 uppercase">{clip.type}</span>
                          )}
                        </div>
                        {/* poignée de trim gauche */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center z-10"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const depart = xVersTemps(e.clientX);
                            const trimDep = clip.type === "main" ? trimStart : (clip.trimStart || 0);
                            const onMoveTrim = (ev: PointerEvent) => {
                              const nv = Math.max(0, trimDep + (xVersTemps(ev.clientX) - depart));
                              if (clip.type === "main") {
                                onSetMainTrim(Math.min(nv, trimEnd - 0.5), trimEnd);
                              } else {
                                const fin = clip.trimEnd ?? clip.duration;
                                onUpdateClipTrim(clip.id, Math.min(nv, fin - 0.5), clip.trimEnd);
                              }
                            };
                            const onUpTrim = () => {
                              window.removeEventListener("pointermove", onMoveTrim);
                              window.removeEventListener("pointerup", onUpTrim);
                            };
                            window.addEventListener("pointermove", onMoveTrim);
                            window.addEventListener("pointerup", onUpTrim);
                          }}
                          title="Rogner le début"
                        ><GripVertical className="w-2.5 h-2.5 text-white/80" /></div>
                        {/* poignée de trim droite */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center z-10"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const depart = xVersTemps(e.clientX);
                            const trimDep = clip.type === "main" ? trimEnd : (clip.trimEnd ?? clip.duration);
                            const onMoveTrim = (ev: PointerEvent) => {
                              const nv = Math.max(0.5, trimDep + (xVersTemps(ev.clientX) - depart));
                              if (clip.type === "main") {
                                onSetMainTrim(trimStart, Math.min(nv, totalDuration));
                              } else {
                                onUpdateClipTrim(clip.id, clip.trimStart, nv);
                              }
                            };
                            const onUpTrim = () => {
                              window.removeEventListener("pointermove", onMoveTrim);
                              window.removeEventListener("pointerup", onUpTrim);
                            };
                            window.addEventListener("pointermove", onMoveTrim);
                            window.addEventListener("pointerup", onUpTrim);
                          }}
                          title="Rogner la fin"
                        ><GripVertical className="w-2.5 h-2.5 text-white/80" /></div>
                        {/* supprimer */}
                        {clip.type !== "main" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteClip(clip.id); }}
                            className="absolute top-0.5 right-1 p-0.5 rounded bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Supprimer ce clip"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Piste TX — textes */}
              <div className="relative border-b border-[#8A8378]/15 bg-[#FAF8F4]" style={{ height: HAUTEURS.tx }}>
                {textes.map((t) => {
                  const { debut, fin } = fenetreOverlay(t);
                  const sel = selectedOverlayId === t.id;
                  return (
                    <div key={t.id}
                      className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 overflow-hidden cursor-grab active:cursor-grabbing group select-none"
                      style={{
                        left: debut * pxParSec, width: Math.max(30, (fin - debut) * pxParSec),
                        background: "linear-gradient(180deg,#8B5CF6,#7C3AED)",
                        outline: sel ? "2px solid #C9A227" : undefined,
                        zIndex: 4,
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        onSelectOverlay(t.id);
                        setDrag({ genre: "overlay", id: t.id, deltaX: xVersTemps(e.clientX) - debut, longueur: fin - debut });
                      }}
                      title={`« ${t.content} » — glisser pour déplacer, poignées pour la fenêtre d'apparition`}
                    >
                      <Type className="w-2.5 h-2.5 text-white/90 flex-shrink-0" />
                      <span className="text-[9px] font-bold text-white truncate ml-1">{t.content}</span>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteOverlay(t.id); }}
                        className="absolute top-0 right-0 p-0.5 bg-black/30 rounded-bl text-white opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-2 h-2" />
                      </button>
                      <PoigneesOverlay id={t.id} debut={debut} fin={fin} onUpdate={onUpdateOverlayTime} xVersTemps={xVersTemps} />
                    </div>
                  );
                })}
              </div>

              {/* Piste IMG — images & stickers */}
              <div className="relative border-b border-[#8A8378]/15 bg-[#FAF8F4]" style={{ height: HAUTEURS.img }}>
                {imagesStickers.map((o) => {
                  const { debut, fin } = fenetreOverlay(o);
                  const sel = selectedOverlayId === o.id;
                  const estStickerPro = o.type === "image" && o.id.startsWith("stickerpro-");
                  return (
                    <div key={o.id}
                      className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 overflow-hidden cursor-grab active:cursor-grabbing group select-none"
                      style={{
                        left: debut * pxParSec, width: Math.max(30, (fin - debut) * pxParSec),
                        background: "linear-gradient(180deg,#2DD4BF,#0D9488)",
                        outline: sel ? "2px solid #C9A227" : undefined,
                        zIndex: 4,
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        onSelectOverlay(o.id);
                        setDrag({ genre: "overlay", id: o.id, deltaX: xVersTemps(e.clientX) - debut, longueur: fin - debut });
                      }}
                      title={`${o.type === "sticker" ? "Sticker" : estStickerPro ? "Sticker pro" : "Image"} — glisser pour déplacer, poignées pour la fenêtre`}
                    >
                      <ImageIcon className="w-2.5 h-2.5 text-white/90 flex-shrink-0" />
                      <span className="text-[9px] font-bold text-white truncate ml-1">
                        {o.type === "sticker" ? (o as StickerOverlay).emoji : estStickerPro ? "Sticker pro" : "Image"}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteOverlay(o.id); }}
                        className="absolute top-0 right-0 p-0.5 bg-black/30 rounded-bl text-white opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-2 h-2" />
                      </button>
                      <PoigneesOverlay id={o.id} debut={debut} fin={fin} onUpdate={onUpdateOverlayTime} xVersTemps={xVersTemps} />
                    </div>
                  );
                })}
              </div>

              {/* Pistes audio A1.. (une voie par piste) */}
              {audioTracks.length === 0 ? (
                <div className="relative border-b border-[#8A8378]/15" style={{ height: HAUTEURS.audio }}>
                  <div
                    className={`absolute inset-0 rounded-md transition-colors flex items-center justify-center gap-1.5 ${dropCible === "audio" ? "bg-[#C9A227]/15 ring-1 ring-[#C9A227] ring-inset" : "bg-[#15803D]/5"}`}
                    onDragOver={surDragOverAudio}
                    onDragLeave={() => setDropCible(null)}
                    onDrop={surDropAudio}
                  >
                    <Music2 className="w-3 h-3 text-[#15803D]" />
                    <span className="text-[9px] text-[#8A8378]">
                      Glisser ici une musique ou un son depuis la <strong>Bibliothèque</strong>
                    </span>
                  </div>
                </div>
              ) : audioTracks.map((track, i) => {
                const debut = Math.max(0, track.startTime || 0);
                const duree = track.duration || 12;
                const largeur = Math.max(28, duree * pxParSec);
                const muet = track.volume === 0;
                return (
                  <div key={track.id} className="relative border-b border-[#8A8378]/15" style={{ height: HAUTEURS.audio }}>
                    <div
                      className={`absolute inset-0 rounded-md transition-colors ${dropCible === "audio" ? "bg-[#C9A227]/15 ring-1 ring-[#C9A227] ring-inset" : ""}`}
                      onDragOver={surDragOverAudio}
                      onDragLeave={() => setDropCible(null)}
                      onDrop={surDropAudio}
                    />
                    <div
                      className="absolute top-1 bottom-1 rounded-md overflow-hidden select-none cursor-grab active:cursor-grabbing group"
                      style={{
                        left: debut * pxParSec, width: largeur,
                        background: muet
                          ? "linear-gradient(180deg,#9CA3AF,#6B7280)"
                          : "linear-gradient(180deg, #22c55e, #15803d)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)",
                        opacity: muet ? 0.75 : 1,
                        zIndex: 2,
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        setDrag({ genre: "audio", id: track.id, deltaX: xVersTemps(e.clientX) - debut });
                      }}
                      title={`${track.name} — glisser pour déplacer dans le temps (position respectée à l'export)`}
                    >
                      {/* motif « forme d'onde » décoratif */}
                      <div
                        className="absolute inset-x-1 bottom-0.5 top-4 opacity-40 pointer-events-none"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 2px, transparent 2px 5px, rgba(255,255,255,.55) 5px 6px, transparent 6px 11px)",
                          backgroundSize: "22px 100%",
                        }}
                      />
                      <div className="relative flex items-center gap-1 px-1.5 h-4">
                        <Music2 className="w-2.5 h-2.5 text-white/90 flex-shrink-0" />
                        <span className="text-[9px] font-bold text-white truncate flex-1">{track.name}</span>
                      </div>
                      <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-white/85">
                        {formaterTemps(duree)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteAudio(track.id); }}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/35 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer cette piste audio"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                      {track.fadeIn ? <span className="absolute top-1 left-0 h-2.5 w-2.5 rounded-sm bg-white/40" title={`Fondu entrée ${track.fadeOut}s`} /> : null}
                    </div>
                  </div>
                );
              })}

              {/* Tête de lecture */}
              <div
                className="absolute top-0 pointer-events-none z-30"
                style={{ left: currentTime * pxParSec, height: "100%" }}
              >
                <div className="w-0.5 h-full bg-[#C9A227]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#C9A227] rounded-sm shadow" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Légende interactions */}
      <p className="text-[9px] text-[#8A8378] leading-relaxed mt-2">
        ⭐ Glisser les blocs pour les déplacer · poignées <GripVertical className="w-2.5 h-2.5 inline" /> pour rogner ·
        badges <ArrowLeftRight className="w-2.5 h-2.5 inline" /> pour les transitions · glisser sons / musiques / vidéos
        depuis la <strong>Bibliothèque</strong> directement sur les pistes. La position des pistes audio est désormais
        respectée à l&apos;export (décalage réel).
      </p>
    </div>
  );
}

// ─── Poignées de fenêtre temporelle pour les overlays ───

function PoigneesOverlay({
  id, debut, fin, onUpdate, xVersTemps,
}: {
  id: string;
  debut: number;
  fin: number;
  onUpdate: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  xVersTemps: (x: number) => number;
}) {
  const pointer = (bord: "gauche" | "droite") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      const onMove = (ev: PointerEvent) => {
        const t = xVersTemps(ev.clientX);
        if (bord === "gauche") {
          onUpdate(id, { startTime: Math.max(0, Math.min(t, fin - 0.2)) });
        } else {
          onUpdate(id, { endTime: Math.max(debut + 0.2, t) });
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
  });
  return (
    <>
      <div
        {...pointer("gauche")}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100 z-10"
        title="Début d'apparition"
      />
      <div
        {...pointer("droite")}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100 z-10"
        title="Fin d'apparition"
      />
    </>
  );
}
