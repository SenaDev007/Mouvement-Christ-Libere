"use client";

/**
 * ⭐ V3.61 → V3.63 — TIMELINE PRO MULTI-PISTES (style CapCut / Premiere Pro).
 * ============================================================================
 * Réponse à la demande pasteur : « la timeline ne ressemble pas à CapCut ou
 * Premiere Pro… on devrait avoir une piste audio, une piste pour les images,
 * une piste pour les transitions » (V3.61), puis « je voudrais DEUX pistes
 * vidéo, DEUX pistes texte, DEUX pistes audio, et qu'on puisse GLISSER les
 * éléments sur les pistes en question » (V3.63).
 *
 * Structure (V3.63 — comme un NLE) :
 *   ┌──────┬────────────────────────────────────────────────┐
 *   │ règle │ graduations + tête de lecture (scrub)          │
 *   │ V1   │ clips vidéo séquence (réordonnables, trim)      │
 *   │ V2   │ 2ᵉ piste vidéo : incrustations à position libre │
 *   │ TX1  │ textes — piste 1                                │
 *   │ TX2  │ textes — piste 2 (superposée AU-DESSUS de TX1)  │
 *   │ IMG  │ images / stickers pro (fenêtre temporelle)      │
 *   │ A1   │ audio — voie 1                                  │
 *   │ A2   │ audio — voie 2                                  │
 *   └──────┴────────────────────────────────────────────────┘
 *
 * Interactions :
 *  - règle temporelle + tête de lecture draggable (scrub) ;
 *  - zoom (pixels/seconde) + bouton « Ajuster » (auto-fit V3.62) ;
 *  - glisser un CLIP V1 horizontalement → réordonner ;
 *  - glisser un CLIP V1 VERTICALEMENT sur V2 → incrustation à position
 *    libre (glisser horizontalement ensuite = déplacer dans le temps ;
 *    glisser V2 → V1 → retour dans la séquence) ;
 *  - glisser un TEXTE verticalement TX1 ↔ TX2 (live) ;
 *  - glisser une piste AUDIO verticalement A1 ↔ A2 (live) ;
 *  - poignées de bord → trim (clips) / fenêtre (overlays) ;
 *  - badges TRANSITIONS entre clips V1 → clic → onglet Transitions ;
 *  - DROP depuis la Bibliothèque : son/musique → A1 ou A2 selon la voie
 *    visée, vidéo → V1 (séquence) ou V2 (incrustation) selon la piste visée.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Film, Type, ImageIcon, Music2, Trash2, Plus, ZoomIn, ZoomOut,
  Maximize2, GripVertical, ArrowLeftRight, Volume2, Layers, VolumeX,
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
  /** ⭐ V3.61 — durée SOURCE complète (avant rognage). */
  dureeSource?: number;
  /** ⭐ V3.63 — piste VIDÉO : 1 = V1 séquence principale (défaut),
   *  2 = V2 incrustation à position libre. */
  piste?: 1 | 2;
  /** ⭐ V3.63 — position (s) du clip sur la piste V2 (position libre,
   *  comme un overlay). Ignoré sur V1 (la séquence se suit). */
  startTime?: number;
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
  /** ⭐ V3.63 — réordonnancement par IDENTIFIANTS (place `idDeplace` juste
   *  après `idCible` ; null = tout au début) dans la séquence V1. */
  onReorderClip: (idDeplace: string, idCible: string | null) => void;
  onUpdateClipTrim: (id: string, trimStart: number | undefined, trimEnd: number | undefined) => void;
  onSetMainTrim: (start: number, end: number) => void;
  onDeleteClip: (id: string) => void;
  /** ⭐ V3.63 — changement de piste d'un clip (V1 ↔ V2). */
  onMoveClipTrack: (id: string, piste: 1 | 2, startTime: number) => void;
  /** ⭐ V3.63 — position libre d'un clip V2 (glisser horizontal, live). */
  onUpdateClipStart: (id: string, startTime: number) => void;
  onUpdateAudio: (id: string, patch: Partial<AudioTrack>) => void;
  onDeleteAudio: (id: string) => void;
  /** ⭐ V3.63 — changement de voie audio (A1 ↔ A2). */
  onMoveAudioLane: (id: string, lane: 1 | 2) => void;
  onUpdateOverlayTime: (id: string, patch: { startTime?: number; endTime?: number }) => void;
  onDeleteOverlay: (id: string) => void;
  onSelectOverlay: (id: string) => void;
  /** ⭐ V3.63 — changement de piste d'un TEXTE (TX1 ↔ TX2). */
  onMoveTextTrack: (id: string, track: 1 | 2) => void;
  onOpenTransitions: () => void;
  /** ⭐ V3.63 — la voie visée (A1/A2) est transmise au dépôt. */
  onDropAudio: (data: DropAudioData, startTime: number, lane: 1 | 2) => void;
  /** ⭐ V3.63 — la piste visée (V1 séquence / V2 incrustation) au dépôt. */
  onDropVideo: (data: DropVideoData, atSeconds: number, piste: 1 | 2) => void;
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

// ⭐ V3.63 — RANGÉES DE LA TIMELINE (gouttière + zone scrollable).
// L'ordre définit l'empilement visuel (comme un NLE) : V1 en bas de la
// vidéo, V2 au-dessus, puis textes, images, audio en dessous.
const HAUTEURS = { ruler: 26, v1: 56, v2: 44, tx: 30, img: 30, audio: 34 };
const GOUTTERE = 108;

const RANGEES: { id: string; h: number }[] = [
  { id: "ruler", h: HAUTEURS.ruler },
  { id: "v1", h: HAUTEURS.v1 },
  { id: "v2", h: HAUTEURS.v2 },
  { id: "tx1", h: HAUTEURS.tx },
  { id: "tx2", h: HAUTEURS.tx },
  { id: "img", h: HAUTEURS.img },
  { id: "a1", h: HAUTEURS.audio },
  { id: "a2", h: HAUTEURS.audio },
];
const OFFSETS_RANGEES: number[] = (() => {
  const acc: number[] = [];
  let y = 0;
  for (const r of RANGEES) { acc.push(y); y += r.h; }
  return acc;
})();
const HAUTEUR_TOTALE = RANGEES.reduce((s, r) => s + r.h, 0);

type IdRangee = "ruler" | "v1" | "v2" | "tx1" | "tx2" | "img" | "a1" | "a2";

type DragInterne =
  | { genre: "scrub" }
  | { genre: "clip"; id: string; indexV1: number; piste: 1 | 2; departY: number; deltaX: number }
  | { genre: "audio"; id: string; deltaX: number; departY: number; lane: 1 | 2 }
  | { genre: "overlay"; id: string; deltaX: number; longueur: number; departY: number; nature: "texte" | "image" }
  | null;

/** Pistes valides selon ce qu'on traîne (pour le surlignage + le dépôt). */
function ciblesPourGenre(d: DragInterne): IdRangee[] {
  if (!d) return [];
  switch (d.genre) {
    case "clip": return d.piste === 1 ? ["v1", "v2"] : ["v2", "v1"];
    case "overlay": return d.nature === "texte" ? ["tx1", "tx2"] : ["img"];
    case "audio": return ["a1", "a2"];
    default: return [];
  }
}

// ─── Composant ───

export function TimelinePro(props: TimelineProProps) {
  const {
    clips, overlays, audioTracks, transitions, currentTime, totalDuration,
    trimStart, trimEnd, selectedOverlayId,
    onSeek, onReorderClip, onUpdateClipTrim, onSetMainTrim, onDeleteClip,
    onMoveClipTrack, onUpdateClipStart, onUpdateAudio, onDeleteAudio, onMoveAudioLane,
    onUpdateOverlayTime, onDeleteOverlay, onSelectOverlay, onMoveTextTrack,
    onOpenTransitions, onDropAudio, onDropVideo,
  } = props;

  const conteneurRef = useRef<HTMLDivElement>(null);
  // ⭐ V3.62 — 0 = « pas encore mesuré » : le premier auto-fit doit attendre
  // la LARGEUR RÉELLE du conteneur (ResizeObserver) et non un placeholder.
  const [largeur, setLargeur] = useState(0);
  const [pxParSec, setPxParSec] = useState(40);
  const [drag, setDrag] = useState<DragInterne>(null);
  const [dropCible, setDropCible] = useState<"audio1" | "audio2" | "video1" | "video2" | null>(null);
  const [ghostX, setGhostX] = useState(0);
  const ghostXRef = useRef(0);
  const dragRef = useRef<DragInterne>(null);
  dragRef.current = drag;
  // ⭐ V3.63 — décalage vertical du bloc traîné + rangée survolée.
  const [dyDrag, setDyDrag] = useState(0);
  const [rangeeSurvolee, setRangeeSurvolee] = useState<IdRangee | null>(null);
  const rangeeRef = useRef<IdRangee | null>(null);
  rangeeRef.current = rangeeSurvolee;

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

  // ─── Clips par piste (⭐ V3.63) ───
  const clipsV1 = useMemo(() => clips.filter((c) => (c.piste || 1) === 1), [clips]);
  const clipsV2 = useMemo(() => clips.filter((c) => c.piste === 2), [clips]);

  // Durée totale visible : séquence V1 + incrustations V2 + audio + overlays
  const dureeAffichee = useMemo(() => {
    let fin = totalDuration || 10;
    for (const c of clipsV2) fin = Math.max(fin, (c.startTime || 0) + c.duration);
    for (const a of audioTracks) fin = Math.max(fin, (a.startTime || 0) + (a.duration || 12));
    for (const o of overlays) {
      const s = "startTime" in o ? o.startTime : undefined;
      const e = "endTime" in o ? o.endTime : undefined;
      fin = Math.max(fin, e || (s !== undefined ? s + 4 : 0));
    }
    return Math.max(fin + 8, 15);
  }, [totalDuration, clipsV2, audioTracks, overlays]);

  // ⭐ V3.62 — ANTI « ÉCRAN QUI S'ÉLARGIT » (zoom) : l'auto-fit doit se
  // caler sur la largeur RÉELLE (mesurée) ET se RECALER quand la durée réelle
  // de la vidéo arrive (métadonnées). L'utilisateur qui touche le zoom prend
  // la main (plus aucun auto-fit), et l'auto-fit se relance si la durée
  // change fortement (jamais pendant un glisser).
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

  // Offsets cumulés des clips V1 (séquence)
  const offsetsV1 = useMemo(() => {
    const acc: number[] = [];
    let t = 0;
    for (const c of clipsV1) { acc.push(t); t += c.duration; }
    return acc;
  }, [clipsV1]);

  // ─── Conversion pixel ↔ temps (via le scroller) ───
  const xVersTemps = useCallback((clientX: number) => {
    const sc = conteneurRef.current?.querySelector("[data-scroller]") as HTMLElement | null;
    if (!sc) return 0;
    const rect = sc.getBoundingClientRect();
    const x = clientX - rect.left + sc.scrollLeft;
    return Math.max(0, x / Math.max(1, pxParSec));
  }, [pxParSec]);

  // ─── ⭐ V3.63 — Rangée sous le pointeur (pour le glisser entre pistes) ───
  const rangeeSousPointeur = useCallback((clientY: number): IdRangee | null => {
    const sc = conteneurRef.current?.querySelector("[data-scroller]") as HTMLElement | null;
    if (!sc) return null;
    const rect = sc.getBoundingClientRect();
    const y = clientY - rect.top + sc.scrollTop;
    if (y < 0 || y > HAUTEUR_TOTALE) return null;
    for (let i = RANGEES.length - 1; i >= 0; i--) {
      if (y >= OFFSETS_RANGEES[i]) return RANGEES[i].id as IdRangee;
    }
    return null;
  }, []);

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
      // ⭐ V3.63 — suivi vertical + rangée survolée (cibles valides seules)
      const cibles = ciblesPourGenre(d);
      const r = rangeeSousPointeur(e.clientY);
      const valide = cibles.includes(r as IdRangee) ? (r as IdRangee) : null;
      if (rangeeRef.current !== valide) setRangeeSurvolee(valide);

      if (d.genre === "clip") {
        if (d.piste === 1) {
          // V1 : fantôme de réordonnancement horizontal
          ghostXRef.current = (ghostXRef.current || 0) + e.movementX;
          setGhostX(ghostXRef.current);
        } else {
          // V2 : position libre LIVE dans le temps
          const t = Math.max(0, xVersTemps(e.clientX) - d.deltaX);
          onUpdateClipStart(d.id, t);
        }
        setDyDrag(e.clientY - d.departY);
        return;
      }
      if (d.genre === "audio") {
        const t = xVersTemps(e.clientX) - d.deltaX;
        onUpdateAudio(d.id, { startTime: Math.max(0, t) });
        // ⭐ V3.63 — changement de voie LIVE (A1 ↔ A2) : le bloc suit le doigt
        if ((valide === "a1" || valide === "a2") && valide !== `a${d.lane}`) {
          onMoveAudioLane(d.id, valide === "a1" ? 1 : 2);
          d.lane = valide === "a1" ? 1 : 2;
          d.departY = e.clientY; // la base a bougé → recaler le décalage
          setDyDrag(0);
          return;
        }
        setDyDrag(e.clientY - d.departY);
        return;
      }
      if (d.genre === "overlay") {
        const t = Math.max(0, xVersTemps(e.clientX) - d.deltaX);
        // déplacer la FENÊTRE ENTIÈRE (préserver la longueur)
        onUpdateOverlayTime(d.id, { startTime: t, endTime: t + d.longueur });
        // ⭐ V3.63 — changement de piste TEXTE LIVE (TX1 ↔ TX2)
        if (d.nature === "texte" && (valide === "tx1" || valide === "tx2")) {
          const pisteTxt = valide === "tx1" ? 1 : 2;
          onMoveTextTrack(d.id, pisteTxt as 1 | 2);
        }
        setDyDrag(d.nature === "texte" ? e.clientY - d.departY : 0);
        return;
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && d.genre === "clip") {
        const cible = rangeeRef.current;
        if (d.piste === 1 && cible === "v2") {
          // ⭐ V3.63 — V1 → V2 : incrustation à la position du lâcher
          const t = Math.max(0, xVersTemps(e.clientX) - (d.deltaX || 0));
          onMoveClipTrack(d.id, 2, t);
        } else if (d.piste === 2 && cible === "v1") {
          // ⭐ V3.63 — V2 → V1 : retour dans la séquence
          const t = Math.max(0, xVersTemps(e.clientX) - d.deltaX);
          onMoveClipTrack(d.id, 1, t);
        } else if (d.piste === 1 && Math.abs(ghostXRef.current) > 30) {
          terminerReordre(d.id, e.clientX);
        }
      }
      ghostXRef.current = 0; setGhostX(0);
      setDyDrag(0); setRangeeSurvolee(null);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, onSeek, onUpdateAudio, onUpdateOverlayTime, onUpdateClipStart, onMoveClipTrack, onMoveAudioLane, onMoveTextTrack, xVersTemps, rangeeSousPointeur, onReorderClip]);

  // Réordonnancement V1 : à la relâche, trouver le clip V1 de destination
  const terminerReordre = useCallback((idDeplace: string, clientX: number) => {
    const t = xVersTemps(clientX);
    let idCible: string | null = null;
    let meilleur = Infinity;
    for (let i = 0; i < clipsV1.length; i++) {
      if (clipsV1[i].id === idDeplace) continue;
      const centre = offsetsV1[i] + clipsV1[i].duration / 2;
      const dist = Math.abs(t - centre);
      if (t > centre && dist < meilleur) { meilleur = dist; idCible = clipsV1[i].id; }
    }
    onReorderClip(idDeplace, idCible);
  }, [clipsV1, offsetsV1, onReorderClip, xVersTemps]);

  // ─── Graduations de la règle ───
  const graduations = useMemo(() => {
    const pas = pasRuler(pxParSec);
    const out: number[] = [];
    for (let t = 0; t <= dureeAffichee; t += pas) out.push(t);
    return out;
  }, [pxParSec, dureeAffichee]);

  // ─── Overlays groupés par type / piste / voie (⭐ V3.63) ───
  const imagesStickers = overlays.filter((o): o is ImageOverlay | StickerOverlay => o.type === "image" || o.type === "sticker");
  const textesPiste = useCallback((p: 1 | 2) => overlays.filter((o): o is TextOverlay => o.type === "text" && (o.track || 1) === p), [overlays]);
  const audioVoie = useCallback((l: 1 | 2) => audioTracks.filter((t) => (t.lane || 1) === l), [audioTracks]);

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

  const surDropAudio = (e: React.DragEvent, voie: 1 | 2) => {
    e.preventDefault();
    setDropCible(null);
    const data = lireDrop<DropAudioData>(e, "application/x-pp-audio");
    if (data?.url) onDropAudio(data, xVersTemps(e.clientX), voie);
  };
  const surDropVideo = (e: React.DragEvent, piste: 1 | 2) => {
    e.preventDefault();
    setDropCible(null);
    const data = lireDrop<DropVideoData>(e, "application/x-pp-video");
    if (data?.url) onDropVideo(data, xVersTemps(e.clientX), piste);
  };
  const surDragOverAudio = (e: React.DragEvent, voie: 1 | 2) => {
    if (e.dataTransfer.types.includes("application/x-pp-audio")) {
      e.preventDefault(); setDropCible(voie === 1 ? "audio1" : "audio2");
    }
  };
  const surDragOverVideo = (e: React.DragEvent, piste: 1 | 2) => {
    if (e.dataTransfer.types.includes("application/x-pp-video")) {
      e.preventDefault(); setDropCible(piste === 1 ? "video1" : "video2");
    }
  };

  // ─── Rendu ───

  const nbTextesT1 = textesPiste(1).length;
  const nbTextesT2 = textesPiste(2).length;
  const nbAudioA1 = audioVoie(1).length;
  const nbAudioA2 = audioVoie(2).length;

  // Bloc LIBELLÉ de la gouttière (une rangée)
  const libelleRangee = (icon: React.ReactNode, titre: string, sousTitre: string, accent: string) => (
    <div className="flex items-center gap-1.5 px-2 border-b border-[#8A8378]/15 min-w-0">
      {icon}
      <div className="min-w-0">
        <p className="text-[10px] font-black text-[#1E0F2B] leading-tight truncate" style={{ color: accent }}>{titre}</p>
        <p className="text-[8px] text-[#8A8378] leading-tight truncate">{sousTitre}</p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl p-3 border border-[#8A8378]/15">
      {/* ─── Barre d'outils ─── */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Layers className="w-4 h-4 text-[#C9A227]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#1E0F2B]">Timeline multi-pistes</span>
        <span className="text-[10px] text-[#8A8378] truncate">
          V1 {clipsV1.length} clip(s) · V2 {clipsV2.length} incrust. · TX {nbTextesT1 + nbTextesT2} · A {audioTracks.length}
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
            <div style={{ height: HAUTEURS.v1 }}>
              {libelleRangee(<Film className="w-3.5 h-3.5 text-[#2A0E3D] flex-shrink-0" />, "V1 · Vidéo", `séquence · ${clipsV1.length} clip(s)`, "#1E0F2B")}
            </div>
            <div style={{ height: HAUTEURS.v2 }}>
              {libelleRangee(<Film className="w-3 h-3 text-[#7C3AED] flex-shrink-0" />, "V2 · Incrustation", `calque vidéo · ${clipsV2.length}`, "#7C3AED")}
            </div>
            <div style={{ height: HAUTEURS.tx }}>
              {libelleRangee(<Type className="w-3 h-3 text-[#7C3AED] flex-shrink-0" />, "TX1 · Texte", `piste 1 · ${nbTextesT1}`, "#6D28D9")}
            </div>
            <div style={{ height: HAUTEURS.tx }}>
              {libelleRangee(<Type className="w-3 h-3 text-[#A78BFA] flex-shrink-0" />, "TX2 · Texte", `piste 2 (dessus) · ${nbTextesT2}`, "#8B5CF6")}
            </div>
            <div style={{ height: HAUTEURS.img }}>
              {libelleRangee(<ImageIcon className="w-3 h-3 text-[#0D9488] flex-shrink-0" />, "IMG · Images", `images & stickers · ${imagesStickers.length}`, "#0D9488")}
            </div>
            <div style={{ height: HAUTEURS.audio }}>
              {libelleRangee(<Music2 className="w-3 h-3 text-[#15803D] flex-shrink-0" />, "A1 · Audio", `voie 1 · ${nbAudioA1}`, "#15803D")}
            </div>
            <div style={{ height: HAUTEURS.audio }}>
              {libelleRangee(<Music2 className="w-3 h-3 text-[#4ADE80] flex-shrink-0" />, "A2 · Audio", `voie 2 · ${nbAudioA2}`, "#16A34A")}
            </div>
          </div>

          {/* Zone scrollable des pistes */}
          {/* ⭐ V3.62 — min-w-0 : le scroller doit RÉTRÉCIR à la place
              restante (flex-1) et laisser le contenu défiler à l'intérieur. */}
          <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden" data-scroller>
            <div style={{ width: largeurContenu, position: "relative", height: HAUTEUR_TOTALE }} data-contenu>
              {/* ── Règle temporelle (scrub) ── */}
              <div
                className="absolute top-0 left-0 right-0 bg-[#F3F0E8] border-b border-[#8A8378]/15 cursor-ew-resize select-none"
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

              {/* ── Piste V1 — séquence vidéo principale ── */}
              <div className="absolute left-0 right-0" style={{ top: OFFSETS_RANGEES[1], height: HAUTEURS.v1 }}>
                <div
                  className="absolute inset-0"
                  onDragOver={(e) => surDragOverVideo(e, 1)}
                  onDragLeave={() => setDropCible(null)}
                  onDrop={(e) => surDropVideo(e, 1)}
                />
                {dropCible === "video1" && (
                  <div className="absolute inset-0 bg-[#C9A227]/12 ring-1 ring-[#C9A227] ring-inset rounded-md pointer-events-none z-20 flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-full bg-[#C9A227] text-white text-[10px] font-bold shadow-lg flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Ajouter à la séquence V1
                    </span>
                  </div>
                )}
                {clipsV1.map((clip, i) => {
                  const gauche = offsetsV1[i] * pxParSec;
                  const largeur = Math.max(34, clip.duration * pxParSec);
                  const enDrag = drag?.genre === "clip" && drag.id === clip.id;
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
                          title={`Transition « ${transitions[i - 1]?.type || "aucune"} » entre « ${clipsV1[i - 1].label} » et « ${clip.label} » — cliquer pour la régler`}
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
                        className={`absolute top-1 bottom-1 rounded-md overflow-hidden select-none group ${enDrag ? "opacity-60 ring-2 ring-[#7C3AED]" : ""}`}
                        style={{
                          left: gauche + (enDrag && drag?.genre === "clip" && drag.piste === 1 ? ghostX : 0), width: largeur,
                          transform: enDrag && dyDrag ? `translateY(${dyDrag}px)` : undefined,
                          background: `linear-gradient(180deg, ${clip.color}, ${clip.color}CC)`,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
                          zIndex: enDrag ? 25 : 5, cursor: "grab",
                        }}
                        onPointerDown={(e) => {
                          if (e.button !== 0 || largeur < 60) return;
                          e.stopPropagation();
                          ghostXRef.current = 0; setGhostX(0);
                          setDyDrag(0);
                          setDrag({ genre: "clip", id: clip.id, indexV1: i, piste: 1, departY: e.clientY, deltaX: xVersTemps(e.clientX) - gauche });
                        }}
                        title={`${clip.label} — glisser horizontalement pour réordonner · glisser VERTICALEMENT sur V2 pour en faire une incrustation`}
                      >
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

              {/* ── Piste V2 — incrustations vidéo à position libre ── */}
              <div className="absolute left-0 right-0 border-t border-b border-[#8A8378]/10" style={{ top: OFFSETS_RANGEES[2], height: HAUTEURS.v2, background: "rgba(124,58,237,0.04)" }}>
                <div
                  className="absolute inset-0"
                  onDragOver={(e) => surDragOverVideo(e, 2)}
                  onDragLeave={() => setDropCible(null)}
                  onDrop={(e) => surDropVideo(e, 2)}
                />
                {dropCible === "video2" && (
                  <div className="absolute inset-0 bg-[#7C3AED]/12 ring-1 ring-[#7C3AED] ring-inset rounded-md pointer-events-none z-20 flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold shadow-lg flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Incrustation sur V2
                    </span>
                  </div>
                )}
                {audioTracks.length === 0 && clipsV2.length === 0 && textesPiste(1).length === 0 && textesPiste(2).length === 0 && imagesStickers.length === 0 && clipsV1.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-[#8A8378]/70 italic">Glisser un clip V1 ici (ou déposer une vidéo) → incrustation par-dessus</span>
                  </div>
                )}
                {clipsV2.map((clip) => {
                  const debut = Math.max(0, clip.startTime || 0);
                  const gauche = debut * pxParSec;
                  const largeur = Math.max(34, clip.duration * pxParSec);
                  const enDrag = drag?.genre === "clip" && drag.id === clip.id;
                  const trimG = (clip.trimStart || 0) * pxParSec;
                  const trimD = Math.max(0, (clip.duration - (clip.trimEnd ?? clip.duration))) * pxParSec;
                  return (
                    <div
                      key={clip.id}
                      className={`absolute top-0.5 bottom-0.5 rounded-md overflow-hidden select-none group ${enDrag ? "opacity-60 ring-2 ring-[#C9A227]" : ""}`}
                      style={{
                        left: gauche, width: largeur,
                        transform: enDrag && dyDrag ? `translateY(${dyDrag}px)` : undefined,
                        background: "linear-gradient(180deg,#7C3AED,#5B21B6)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
                        zIndex: enDrag ? 25 : 5, cursor: "grab",
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 || largeur < 40) return;
                        e.stopPropagation();
                        setDyDrag(0);
                        setDrag({ genre: "clip", id: clip.id, indexV1: -1, piste: 2, departY: e.clientY, deltaX: xVersTemps(e.clientX) - debut });
                      }}
                      title={`${clip.label} — incrustation V2 · glisser horizontalement pour la position · VERTICALEMENT sur V1 pour la remettre dans la séquence`}
                    >
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
                      <div className="h-full flex items-center justify-center px-2 pointer-events-none gap-1.5">
                        <Film className="w-3 h-3 text-white/80 flex-shrink-0" />
                        <span className="text-[10px] font-bold text-white truncate">{clip.label}</span>
                        <span className="text-[8px] text-white/70 flex-shrink-0">{formaterTemps(clip.duration)}</span>
                      </div>
                      {/* poignées de trim V2 */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center z-10"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const depart = xVersTemps(e.clientX);
                          const trimDep = clip.trimStart || 0;
                          const onMoveTrim = (ev: PointerEvent) => {
                            const nv = Math.max(0, trimDep + (xVersTemps(ev.clientX) - depart));
                            const fin = clip.trimEnd ?? clip.duration;
                            onUpdateClipTrim(clip.id, Math.min(nv, fin - 0.5), clip.trimEnd);
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
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center z-10"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const depart = xVersTemps(e.clientX);
                          const trimDep = clip.trimEnd ?? clip.duration;
                          const onMoveTrim = (ev: PointerEvent) => {
                            const nv = Math.max(0.5, trimDep + (xVersTemps(ev.clientX) - depart));
                            onUpdateClipTrim(clip.id, clip.trimStart, nv);
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
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteClip(clip.id); }}
                        className="absolute top-0.5 right-1 p-0.5 rounded bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Supprimer cette incrustation"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* ── Pistes TX1 / TX2 — textes (⭐ V3.63 : glisser entre pistes) ── */}
              {([1, 2] as const).map((pisteTx) => (
                <div key={`tx${pisteTx}`} className="absolute left-0 right-0 border-b border-[#8A8378]/15" style={{ top: pisteTx === 1 ? OFFSETS_RANGEES[3] : OFFSETS_RANGEES[4], height: HAUTEURS.tx, background: pisteTx === 2 ? "rgba(139,92,246,0.05)" : "#FAF8F4" }}>
                  {textesPiste(pisteTx).map((t) => {
                    const { debut, fin } = fenetreOverlay(t);
                    const sel = selectedOverlayId === t.id;
                    const enDrag = drag?.genre === "overlay" && drag.id === t.id;
                    return (
                      <div key={t.id}
                        className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 overflow-hidden cursor-grab active:cursor-grabbing group select-none"
                        style={{
                          left: debut * pxParSec, width: Math.max(30, (fin - debut) * pxParSec),
                          transform: enDrag && dyDrag ? `translateY(${dyDrag}px)` : undefined,
                          background: pisteTx === 1 ? "linear-gradient(180deg,#8B5CF6,#7C3AED)" : "linear-gradient(180deg,#A78BFA,#8B5CF6)",
                          outline: sel ? "2px solid #C9A227" : undefined,
                          zIndex: enDrag ? 25 : 4,
                        }}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          onSelectOverlay(t.id);
                          setDyDrag(0);
                          setDrag({ genre: "overlay", id: t.id, deltaX: xVersTemps(e.clientX) - debut, longueur: fin - debut, departY: e.clientY, nature: "texte" });
                        }}
                        title={`« ${t.content} » — glisser pour déplacer · VERTICALEMENT vers TX${pisteTx === 1 ? "2" : "1"} pour changer de piste`}
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
              ))}

              {/* ── Piste IMG — images & stickers ── */}
              <div className="absolute left-0 right-0 border-b border-[#8A8378]/15 bg-[#FAF8F4]" style={{ top: OFFSETS_RANGEES[5], height: HAUTEURS.img }}>
                {imagesStickers.map((o) => {
                  const { debut, fin } = fenetreOverlay(o);
                  const sel = selectedOverlayId === o.id;
                  const estStickerPro = o.type === "image" && o.id.startsWith("stickerpro-");
                  const enDrag = drag?.genre === "overlay" && drag.id === o.id;
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
                        setDrag({ genre: "overlay", id: o.id, deltaX: xVersTemps(e.clientX) - debut, longueur: fin - debut, departY: e.clientY, nature: "image" });
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

              {/* ── Pistes A1 / A2 — audio (⭐ V3.63 : voies fixes, glisser A1↔A2) ── */}
              {([1, 2] as const).map((voie) => {
                const pistesVoie = audioVoie(voie);
                return (
                  <div key={`a${voie}`} className="absolute left-0 right-0 border-b border-[#8A8378]/15" style={{ top: voie === 1 ? OFFSETS_RANGEES[6] : OFFSETS_RANGEES[7], height: HAUTEURS.audio }}>
                    <div
                      className={`absolute inset-0 rounded-md transition-colors ${dropCible === (voie === 1 ? "audio1" : "audio2") ? "bg-[#C9A227]/15 ring-1 ring-[#C9A227] ring-inset" : ""}`}
                      onDragOver={(e) => surDragOverAudio(e, voie)}
                      onDragLeave={() => setDropCible(null)}
                      onDrop={(e) => surDropAudio(e, voie)}
                    />
                    {pistesVoie.length === 0 && audioTracks.length === 0 && voie === 1 && (
                      <div className="absolute inset-0 rounded-md bg-[#15803D]/5 flex items-center justify-center gap-1.5">
                        <Music2 className="w-3 h-3 text-[#15803D]" />
                        <span className="text-[9px] text-[#8A8378]">
                          Glisser ici une musique ou un son depuis la <strong>Bibliothèque</strong>
                        </span>
                      </div>
                    )}
                    {pistesVoie.map((track) => {
                      const debut = Math.max(0, track.startTime || 0);
                      const duree = track.duration || 12;
                      const largeur = Math.max(28, duree * pxParSec);
                      const muet = track.volume === 0;
                      const enDrag = drag?.genre === "audio" && drag.id === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`absolute top-1 bottom-1 rounded-md overflow-hidden select-none cursor-grab active:cursor-grabbing group ${enDrag ? "ring-2 ring-[#C9A227]" : ""}`}
                          style={{
                            left: debut * pxParSec, width: largeur,
                            transform: enDrag && dyDrag ? `translateY(${dyDrag}px)` : undefined,
                            background: muet
                              ? "linear-gradient(180deg,#9CA3AF,#6B7280)"
                              : voie === 1
                                ? "linear-gradient(180deg, #22c55e, #15803d)"
                                : "linear-gradient(180deg, #4ade80, #16a34a)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)",
                            opacity: muet ? 0.75 : 1,
                            zIndex: enDrag ? 25 : 2,
                          }}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            setDyDrag(0);
                            setDrag({ genre: "audio", id: track.id, deltaX: xVersTemps(e.clientX) - debut, departY: e.clientY, lane: voie });
                          }}
                          title={`${track.name} — voie A${voie} · glisser pour déplacer (position respectée à l'export) · VERTICALEMENT vers A${voie === 1 ? 2 : 1} pour changer de voie`}
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
                            <button
                              onClick={(e) => { e.stopPropagation(); onUpdateAudio(track.id, { volume: track.volume > 0 ? 0 : 1 }); }}
                              className="p-0.5 rounded bg-black/25 text-white hover:bg-black/45 flex-shrink-0"
                              title={muet ? "Rétablir le volume" : "Rendre muette (volume 0)"}
                            >
                              {muet ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                            </button>
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
                          {track.fadeIn ? <span className="absolute top-1 left-0 h-2.5 w-2.5 rounded-sm bg-white/40" title={`Fondu entrée ${track.fadeIn}s`} /> : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ── ⭐ V3.63 — Surlignage de la piste de dépôt (drag en cours) ── */}
              {rangeeSurvolee && drag && (() => {
                const idx = RANGEES.findIndex((r) => r.id === rangeeSurvolee);
                if (idx < 0) return null;
                return (
                  <div className="absolute left-0 right-0 pointer-events-none z-30 rounded-md bg-[#C9A227]/10 ring-1 ring-[#C9A227]/60 ring-inset"
                    style={{ top: OFFSETS_RANGEES[idx], height: RANGEES[idx].h }} />
                );
              })()}

              {/* ── Tête de lecture ── */}
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
        ⭐ Glissez les blocs <strong>horizontalement</strong> pour les déplacer dans le temps et <strong>verticalement</strong> pour
        les faire changer de piste (V1 ↔ V2, TX1 ↔ TX2, A1 ↔ A2) · poignées <GripVertical className="w-2.5 h-2.5 inline" /> pour rogner ·
        badges <ArrowLeftRight className="w-2.5 h-2.5 inline" /> pour les transitions · glissez sons / musiques / vidéos depuis
        la <strong>Bibliothèque</strong> directement sur la piste ou la voie visée. V2 = incrustation vidéo par-dessus V1 ·
        TX2 se superpose au-dessus de TX1 · la position des pistes audio est respectée à l&apos;export.
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
