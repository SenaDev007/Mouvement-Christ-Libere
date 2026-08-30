/**
 * Types partagés pour la post-production.
 * Reflète le RenderProject de lib/video-render.ts côté client.
 */

export interface TextOverlay {
  id: string;
  type: "text";
  content: string;
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  fontSize: number;
  fontColor: string;
  bgColor?: string | null;
  bold?: boolean;
  italic?: boolean;
  startTime?: number;
  endTime?: number;
  animation?: "none" | "fade-in" | "fade-out" | "fade-in-out";
  animationDuration?: number;
}

export interface ImageOverlay {
  id: string;
  type: "image";
  url: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  startTime?: number;
  endTime?: number;
  animation?: "none" | "fade-in" | "fade-out" | "fade-in-out";
  animationDuration?: number;
}

export type Overlay = TextOverlay | ImageOverlay;

export interface SubtitleConfig {
  srtContent: string;
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
  duration: number;
}

export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
}

export interface SpeedConfig {
  factor: number;
}

export interface TransformConfig {
  crop?: { x: number; y: number; width: number; height: number };
  flipH?: boolean;
  flipV?: boolean;
  rotate: number;
}

export interface AudioTrack {
  id: string;
  url: string;
  volume: number;
  startTime?: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
  name: string;
}

export interface ExportConfig {
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5" | "original";
  resolution: "480p" | "720p" | "1080p" | "original";
  fps?: number;
  crf?: number;
}

export interface Segment {
  id: string;
  type: "intro" | "main" | "outro" | "clip";
  url: string;
  label: string;
  trimStart?: number;
  trimEnd?: number;
}

export interface RenderProject {
  videoId: string;
  segments: Segment[];
  overlays: Overlay[];
  subtitles?: SubtitleConfig;
  transitions?: TransitionConfig[];
  colorAdjust?: ColorAdjust;
  speed?: SpeedConfig;
  transform?: TransformConfig;
  audioTracks?: AudioTrack[];
  mainVolume?: number;
  export: ExportConfig;
  thumbnailUrl?: string;
  title?: string;
}

export const DEFAULT_COLOR_ADJUST: ColorAdjust = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  gamma: 1,
};

export const DEFAULT_SPEED: SpeedConfig = {
  factor: 1,
};

export const DEFAULT_TRANSFORM: TransformConfig = {
  rotate: 0,
  flipH: false,
  flipV: false,
};

export const DEFAULT_EXPORT: ExportConfig = {
  aspectRatio: "original",
  resolution: "original",
  crf: 23,
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleConfig["style"] = {
  fontSize: 24,
  fontColor: "#FFFFFF",
  bgColor: "#000000",
  position: "bottom",
  bold: true,
  outlineColor: "#000000",
  outlineWidth: 2,
};

export const ASPECT_RATIOS: { value: ExportConfig["aspectRatio"]; label: string; icon: string }[] = [
  { value: "original", label: "Original", icon: "▢" },
  { value: "16:9", label: "16:9 YouTube", icon: "▭" },
  { value: "9:16", label: "9:16 Reels", icon: "▯" },
  { value: "1:1", label: "1:1 Carré", icon: "□" },
  { value: "4:5", label: "4:5 Portrait", icon: "▯" },
];

export const RESOLUTIONS: { value: ExportConfig["resolution"]; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "480p", label: "480p (SD)" },
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
];

export const TRANSITION_TYPES: { value: TransitionConfig["type"]; label: string }[] = [
  { value: "fade", label: "Fondu" },
  { value: "dissolve", label: "Dissoudre" },
  { value: "slideleft", label: "Glisser ←" },
  { value: "slideright", label: "Glisser →" },
  { value: "slideup", label: "Glisser ↑" },
  { value: "slidedown", label: "Glisser ↓" },
  { value: "circleopen", label: "Cercle ouvert" },
  { value: "circleclose", label: "Cercle fermé" },
  { value: "pixelize", label: "Pixelisation" },
];
