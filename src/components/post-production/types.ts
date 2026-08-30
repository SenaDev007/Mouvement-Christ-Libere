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

// ─── Keyframes (déclaré tôt car utilisé par StickerOverlay) ───

export interface Keyframe {
  time: number; // secondes
  value: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

// ─── Stickers ───

export interface StickerOverlay {
  id: string;
  type: "sticker";
  emoji: string; // Unicode emoji
  x: number; // 0-100 %
  y: number;
  size: number; // font-size en px (relatif à 1080p)
  rotation: number; // degrés
  opacity: number;
  startTime?: number;
  endTime?: number;
  animation?: "none" | "bounce" | "pulse" | "rotate" | "shake";
  keyframes?: {
    x?: Keyframe[];
    y?: Keyframe[];
    scale?: Keyframe[];
    opacity?: Keyframe[];
  };
}

export type Overlay = TextOverlay | ImageOverlay | StickerOverlay;

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
  // ─── Sprint 5+ — features avancées ───
  stabilisation?: StabilisationConfig;
  chromaKey?: ChromaKeyConfig;
  backgroundRemoval?: BackgroundRemovalConfig;
  filters?: VideoFilter;
}

// ─── Keyframes (utilitaires) ───

export interface KeyframeProperty {
  keyframes: Keyframe[];
}

// ─── Effects avancés ───

export interface StabilisationConfig {
  enabled: boolean;
  shakiness: number; // 1-10 (ffmpeg deshake)
  smoothing: number; // 0-1
}

export interface ChromaKeyConfig {
  enabled: boolean;
  color: string; // hex, ex: "#00FF00" for green screen
  similarity: number; // 0.01-1.0
  blend: number; // 0-1
}

export interface BackgroundRemovalConfig {
  enabled: boolean;
  method: "mediapipe" | "tensorflow" | "canvas";
  threshold: number; // 0-1
}

export type VideoFilter =
  | "none"
  | "vintage"
  | "noir"
  | "sepia"
  | "cool"
  | "warm"
  | "dramatic"
  | "fade"
  | "vivid";

// ─── Effets sonores ───

export interface SoundEffect {
  id: string;
  name: string;
  category: "transition" | "impact" | "nature" | "ui" | "crowd" | "music";
  url: string;
  duration: number;
  icon: string;
}

// ─── Cloud sync ───

export interface SavedProject {
  id: string;
  videoId: string;
  name: string;
  state: PostProductionStateSnapshot;
  createdAt: string;
  updatedAt: string;
  sharedWith: string[];
  ownerId: string;
}

export interface PostProductionStateSnapshot {
  timeline: Segment[];
  overlays: Overlay[];
  subtitles: SubtitleConfig | null;
  transitions: TransitionConfig[];
  colorAdjust: ColorAdjust;
  speed: SpeedConfig;
  transform: TransformConfig;
  audioTracks: AudioTrack[];
  mainVolume: number;
  exportConfig: ExportConfig;
  thumbnailUrl: string | null;
  stabilisation?: StabilisationConfig;
  chromaKey?: ChromaKeyConfig;
  backgroundRemoval?: BackgroundRemovalConfig;
  filters?: VideoFilter;
}

// ─── Collaboration temps réel ───

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  activeTab?: string;
}

export interface CollaborationEvent {
  type: "user-join" | "user-leave" | "user-cursor" | "state-update" | "chat";
  userId: string;
  userName: string;
  timestamp: number;
  data?: unknown;
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

// ─── Données : stickers emoji ───

export const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "💩", "🤡", "👻", "👽", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"],
  },
  {
    name: "Gestes",
    emojis: ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "👏", "🙌", "👐", "🤲", "🙏", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋"],
  },
  {
    name: "Cœur & Amour",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "💌", "💋", "👨‍❤️‍💋‍👨", "👩‍❤️‍💋‍👩", "💑", "👩‍❤️‍👨", "💏", "👨‍❤️‍👨", "👩‍❤️‍👩", "💒", "💍", "💎"],
  },
  {
    name: "Religion & Spiritualité",
    emojis: ["✝️", "☦️", "☩", "✟", "耶", "🛐", "altar", "⛪", "🕌", "🕍", "⛩️", "🕋", "⛪", "🕯️", "🙏", "🕊️", "👼", "😇", "🙌", "✨", "⭐", "🌟", "💫", "⚡", "🔥", "🌈", "☁️", "⛅", "🌤️", "☀️", "🌙", "✨"],
  },
  {
    name: "Nature",
    emojis: ["🌸", "🌺", "🌻", "🌹", "🥀", "🌷", "💐", "🌼", "🌷", "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🥝", "🍅", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶️", "🥒", "🥬", "🥦", "🍄", "🥜", "🌰"],
  },
  {
    name: "Objets",
    emojis: ["⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "💽", "💾", "💿", "📀", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎"],
  },
  {
    name: "Symboles",
    emojis: ["✅", "❌", "❎", "✔️", "✖️", "➕", "➖", "➗", "✳️", "❇️", "♠️", "♥️", "♦️", "♣️", "🃏", "🎴", "🀄", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛", "⏰", "⌛", "♻️", "✨", "🌟", "💫", "⚡", "🔥", "💥", "☀️", "🌙", "🌈", "⛅", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "❄️", "☃️", "⛄"],
  },
];

// ─── Données : filtres vidéo ───

export const VIDEO_FILTERS: { value: VideoFilter; label: string; icon: string }[] = [
  { value: "none", label: "Aucun", icon: "⚪" },
  { value: "vintage", label: "Vintage", icon: "📷" },
  { value: "noir", label: "Noir", icon: "🖤" },
  { value: "sepia", label: "Sépia", icon: "🟤" },
  { value: "cool", label: "Froid", icon: "❄️" },
  { value: "warm", label: "Chaud", icon: "🔥" },
  { value: "dramatic", label: "Dramatique", icon: "🎭" },
  { value: "fade", label: "Fondu", icon: "🌫️" },
  { value: "vivid", label: "Vif", icon: "🌈" },
];

// ─── Données : effets sonores ───
// URLs vers des sons libres de droit (Mixkit / freesound CC0)

export const SOUND_EFFECTS: SoundEffect[] = [
  // Transitions
  { id: "sfx-whoosh", name: "Whoosh", category: "transition", url: "https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3", duration: 1.5, icon: "💨" },
  { id: "sfx-swoosh", name: "Swoosh", category: "transition", url: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", duration: 1.2, icon: "💨" },
  { id: "sfx-whoosh-fast", name: "Whoosh rapide", category: "transition", url: "https://assets.mixkit.co/active_storage/sfx/2997/2997-preview.mp3", duration: 0.8, icon: "💨" },
  // Impacts
  { id: "sfx-boom", name: "Boom", category: "impact", url: "https://assets.mixkit.co/active_storage/sfx/2996/2996-preview.mp3", duration: 2.0, icon: "💥" },
  { id: "sfx-hit", name: "Impact", category: "impact", url: "https://assets.mixkit.co/active_storage/sfx/2995/2995-preview.mp3", duration: 1.0, icon: "🔨" },
  { id: "sfx-thud", name: "Thud", category: "impact", url: "https://assets.mixkit.co/active_storage/sfx/3001/3001-preview.mp3", duration: 0.5, icon: "🥁" },
  // Nature
  { id: "sfx-rain", name: "Pluie", category: "nature", url: "https://assets.mixkit.co/active_storage/sfx/2008/2008-preview.mp3", duration: 10.0, icon: "🌧️" },
  { id: "sfx-wind", name: "Vent", category: "nature", url: "https://assets.mixkit.co/active_storage/sfx/2438/2438-preview.mp3", duration: 8.0, icon: "🌪️" },
  { id: "sfx-birds", name: "Oiseaux", category: "nature", url: "https://assets.mixkit.co/active_storage/sfx/2009/2009-preview.mp3", duration: 12.0, icon: "🐦" },
  { id: "sfx-ocean", name: "Océan", category: "nature", url: "https://assets.mixkit.co/active_storage/sfx/2437/2437-preview.mp3", duration: 15.0, icon: "🌊" },
  // UI
  { id: "sfx-pop", name: "Pop", category: "ui", url: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3", duration: 0.3, icon: "🔘" },
  { id: "sfx-click", name: "Click", category: "ui", url: "https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3", duration: 0.2, icon: "👆" },
  { id: "sfx-ding", name: "Ding", category: "ui", url: "https://assets.mixkit.co/active_storage/sfx/2021/2021-preview.mp3", duration: 0.5, icon: "🔔" },
  { id: "sfx-bell", name: "Cloche", category: "ui", url: "https://assets.mixkit.co/active_storage/sfx/2022/2022-preview.mp3", duration: 1.0, icon: "🔔" },
  // Crowd
  { id: "sfx-applause", name: "Applaudissements", category: "crowd", url: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3", duration: 5.0, icon: "👏" },
  { id: "sfx-cheer", name: "Acclamations", category: "crowd", url: "https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3", duration: 4.0, icon: "🎉" },
  { id: "sfx-laugh", name: "Rires", category: "crowd", url: "https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3", duration: 3.0, icon: "😂" },
  // Music
  { id: "sfx-shofar", name: "Shofar", category: "music", url: "/sfx/shofar.mp3", duration: 3.0, icon: "📯" },
  { id: "sfx-piano", name: "Piano doux", category: "music", url: "https://assets.mixkit.co/active_storage/sfx/2023/2023-preview.mp3", duration: 8.0, icon: "🎹" },
  { id: "sfx-guitar", name: "Guitare", category: "music", url: "https://assets.mixkit.co/active_storage/sfx/2024/2024-preview.mp3", duration: 6.0, icon: "🎸" },
];

// ─── Raccourcis clavier ───

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: " ", action: "play-pause", description: "Lecture / Pause" },
  { key: "ArrowLeft", action: "seek-back-10", description: "Reculer de 10s" },
  { key: "ArrowRight", action: "seek-forward-10", description: "Avancer de 10s" },
  { key: "ArrowLeft", shift: true, action: "seek-back-1", description: "Reculer de 1s" },
  { key: "ArrowRight", shift: true, action: "seek-forward-1", description: "Avancer de 1s" },
  { key: "i", action: "set-trim-start", description: "Définir début (trim)" },
  { key: "o", action: "set-trim-end", description: "Définir fin (trim)" },
  { key: "Delete", action: "delete-selected", description: "Supprimer la sélection" },
  { key: "z", ctrl: true, action: "undo", description: "Annuler" },
  { key: "z", ctrl: true, shift: true, action: "redo", description: "Refaire" },
  { key: "s", ctrl: true, action: "save-project", description: "Sauvegarder le projet" },
  { key: "e", ctrl: true, action: "export", description: "Exporter" },
  { key: "1", action: "tab-trim", description: "Onglet Découpage" },
  { key: "2", action: "tab-text", description: "Onglet Texte" },
  { key: "3", action: "tab-image", description: "Onglet Images" },
  { key: "4", action: "tab-subtitles", description: "Onglet Sous-titres" },
  { key: "5", action: "tab-transitions", description: "Onglet Transitions" },
  { key: "6", action: "tab-color", description: "Onglet Couleur" },
  { key: "7", action: "tab-speed", description: "Onglet Vitesse" },
  { key: "8", action: "tab-transform", description: "Onglet Transform" },
  { key: "9", action: "tab-audio", description: "Onglet Audio" },
  { key: "0", action: "tab-export", description: "Onglet Export" },
];

// ─── Helpers keyframes ───

export function interpolateKeyframe(keyframes: Keyframe[], time: number): number | null {
  if (!keyframes || keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].value;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i + 1];
    if (time >= k1.time && time <= k2.time) {
      const t = (time - k1.time) / (k2.time - k1.time);
      const easing = k2.easing || "linear";
      let easedT = t;
      if (easing === "ease-in") easedT = t * t;
      else if (easing === "ease-out") easedT = 1 - (1 - t) * (1 - t);
      else if (easing === "ease-in-out") easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return k1.value + (k2.value - k1.value) * easedT;
    }
  }
  return sorted[sorted.length - 1].value;
}
