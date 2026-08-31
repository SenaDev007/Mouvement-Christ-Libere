"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Scissors, Upload, Download, Play, Pause, SkipBack, SkipForward,
  Image as ImageIcon, Type, Film, Plus, Trash2, Loader2,
  Layers, Video as VideoIcon, Volume2, Music, Mic, Palette,
  Zap, Crop, RotateCw, FlipHorizontal, FlipVertical,
  Subtitles, Wand2, Undo2, Redo2, Save, Eye, RefreshCw,
  Smile, Sparkles, Cloud, Users, Keyboard, Sticker as StickerIcon,
  Wind, Shield, Eraser, CheckCircle2, Youtube,
} from "lucide-react";
import type {
  Overlay, TextOverlay, ImageOverlay, Segment, RenderProject,
  ColorAdjust, SpeedConfig, TransformConfig, AudioTrack, ExportConfig,
  SubtitleConfig, TransitionConfig, StickerOverlay, VideoFilter,
  StabilisationConfig, ChromaKeyConfig,
} from "./types";
import {
  DEFAULT_COLOR_ADJUST, DEFAULT_SPEED, DEFAULT_TRANSFORM, DEFAULT_EXPORT,
  DEFAULT_SUBTITLE_STYLE, ASPECT_RATIOS, RESOLUTIONS, TRANSITION_TYPES,
  EMOJI_CATEGORIES, VIDEO_FILTERS, SOUND_EFFECTS, KEYBOARD_SHORTCUTS,
} from "./types";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { BgRemovalProcessor } from "./bg-removal-processor";
import { useCollaboration } from "./use-collaboration";
import { CollaborationPanel, CollaboratorCursors } from "./collaboration-panel";

interface PostProductionProps {
  videoId: string;
  videoUrl?: string | null;
  title: string;
  servantName: string;
}

type TabType = "trim" | "text" | "image" | "stickers" | "subtitles" | "transitions" | "color" | "speed" | "transform" | "filters" | "advanced" | "audio" | "sfx" | "export";

interface TimelineClip {
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

// ─── Templates prédéfinis ───
const TEMPLATES: { id: string; name: string; description: string; apply: (project: PostProductionState) => PostProductionState }[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Trim + miniature",
    apply: (project) => ({ ...project }),
  },
  {
    id: "youtube",
    name: "YouTube 16:9",
    description: "Format YouTube + intro/outro + sous-titres",
    apply: (project) => ({
      ...project,
      exportConfig: { ...project.exportConfig, aspectRatio: "16:9" as const, resolution: "1080p" as const },
    }),
  },
  {
    id: "reels",
    name: "Reels 9:16",
    description: "Format vertical pour Reels/TikTok/Shorts",
    apply: (project) => ({
      ...project,
      exportConfig: { ...project.exportConfig, aspectRatio: "9:16" as const, resolution: "1080p" as const },
    }),
  },
  {
    id: "square",
    name: "Carré 1:1",
    description: "Format carré pour posts Instagram",
    apply: (project) => ({
      ...project,
      exportConfig: { ...project.exportConfig, aspectRatio: "1:1" as const, resolution: "1080p" as const },
    }),
  },
];

interface PostProductionState {
  timeline: TimelineClip[];
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
}

export function PostProduction({ videoId, videoUrl: initialVideoUrl, title, servantName }: PostProductionProps) {
  // ─── États principaux ───
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("trim");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string[]>([]);
  const [exportError, setExportError] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // ───État d'édition ───
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleConfig | null>(null);
  const [transitions, setTransitions] = useState<TransitionConfig[]>([]);
  const [colorAdjust, setColorAdjust] = useState<ColorAdjust>(DEFAULT_COLOR_ADJUST);
  const [speed, setSpeed] = useState<SpeedConfig>(DEFAULT_SPEED);
  const [transform, setTransform] = useState<TransformConfig>(DEFAULT_TRANSFORM);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [mainVolume, setMainVolume] = useState(1);
  const [exportConfig, setExportConfig] = useState<ExportConfig>(DEFAULT_EXPORT);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineClip[]>([
    { id: "main", type: "main", label: "Replay principal", duration: 0, color: "#2A0E3D" },
  ]);

  // ─── Sprint 5+ — nouveaux états ───
  const [videoFilter, setVideoFilter] = useState<VideoFilter>("none");
  const [stabilisation, setStabilisation] = useState<StabilisationConfig>({ enabled: false, shakiness: 5, smoothing: 0.5 });
  const [chromaKey, setChromaKey] = useState<ChromaKeyConfig>({ enabled: false, color: "#00FF00", similarity: 0.3, blend: 0.1 });
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; color: string }[]>([]);
  const [projectSaved, setProjectSaved] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [collabUserName] = useState(() => {
    // Générer un nom d'éditeur ou récupérer depuis localStorage
    const saved = typeof window !== "undefined" ? localStorage.getItem("collab-username") : null;
    return saved || `Éditeur-${Math.floor(Math.random() * 1000)}`;
  });

  // ─── Undo/Redo ───
  const [history, setHistory] = useState<PostProductionState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const voiceoverRef = useRef<MediaRecorder | null>(null);
  const voiceoverChunksRef = useRef<Blob[]>([]);
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState(false);

  // ─── Récupérer l'URL de la vidéo ───
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(initialVideoUrl || null);
  const [loadingVideo, setLoadingVideo] = useState(!initialVideoUrl);

  useEffect(() => {
    if (initialVideoUrl) {
      setCurrentVideoUrl(initialVideoUrl);
      setLoadingVideo(false);
      return;
    }
    let cancelled = false;
    setLoadingVideo(true);
    apiFetch(`/api/videos/${videoId}/source`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.videoUrl) setCurrentVideoUrl(data.videoUrl);
      })
      .catch((err) => console.error("[post-production] Failed to fetch video source:", err))
      .finally(() => { if (!cancelled) setLoadingVideo(false); });
    return () => { cancelled = true; };
  }, [videoId, initialVideoUrl]);

  // ─── Métadonnées vidéo ───
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoUrl) return;
    const onLoadedMetadata = () => {
      setTrimEnd(video.duration);
      setTotalDuration(video.duration);
      setTimeline((prev) => prev.map((clip) => clip.type === "main" ? { ...clip, duration: video.duration, url: currentVideoUrl } : clip));
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, [currentVideoUrl]);

  // ─── Snapshot pour undo/redo ───
  const pushHistory = useCallback(() => {
    const snapshot: PostProductionState = {
      timeline, overlays, subtitles, transitions, colorAdjust, speed, transform, audioTracks, mainVolume, exportConfig, thumbnailUrl: thumbnail,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [timeline, overlays, subtitles, transitions, colorAdjust, speed, transform, audioTracks, mainVolume, exportConfig, thumbnail, history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setTimeline(prev.timeline);
      setOverlays(prev.overlays);
      setSubtitles(prev.subtitles);
      setTransitions(prev.transitions);
      setColorAdjust(prev.colorAdjust);
      setSpeed(prev.speed);
      setTransform(prev.transform);
      setAudioTracks(prev.audioTracks);
      setMainVolume(prev.mainVolume);
      setExportConfig(prev.exportConfig);
      setThumbnail(prev.thumbnailUrl);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setTimeline(next.timeline);
      setOverlays(next.overlays);
      setSubtitles(next.subtitles);
      setTransitions(next.transitions);
      setColorAdjust(next.colorAdjust);
      setSpeed(next.speed);
      setTransform(next.transform);
      setAudioTracks(next.audioTracks);
      setMainVolume(next.mainVolume);
      setExportConfig(next.exportConfig);
      setThumbnail(next.thumbnailUrl);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // ─── Lecture ───
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); }
    else { video.pause(); setIsPlaying(false); }
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleSeekBy = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
    handleSeek(newTime);
  };

  // ─── Raccourcis clavier ───
  useKeyboardShortcuts({
    onPlayPause: togglePlay,
    onSeek: handleSeek,
    onSeekBy: handleSeekBy,
    onSetTrimStart: () => setTrimStart(currentTime),
    onSetTrimEnd: () => setTrimEnd(currentTime),
    onDeleteSelected: () => {
      if (selectedOverlayId) deleteOverlay(selectedOverlayId);
    },
    onUndo: undo,
    onRedo: redo,
    onSaveProject: () => handleSaveProject(),
    onExport: () => handleExport(),
    onSwitchTab: (tab) => setActiveTab(tab as TabType),
    currentTime,
    totalDuration,
  });

  // ─── Collaboration temps réel ───
  const {
    collaborators: collabUsers,
    isConnected: collabConnected,
    sendCursor: collabSendCursor,
    sendStateUpdate: collabSendState,
    sendChat: collabSendChat,
    chatMessages: collabMessages,
  } = useCollaboration({
    videoId,
    userName: collabUserName,
    enabled: collabEnabled,
    onStateUpdate: (state) => {
      // Quand un autre utilisateur modifie le projet, on applique son état
      const data = state as {
        overlays?: Overlay[];
        colorAdjust?: ColorAdjust;
        speed?: SpeedConfig;
        exportConfig?: ExportConfig;
      };
      if (data.overlays) setOverlays(data.overlays);
      if (data.colorAdjust) setColorAdjust(data.colorAdjust);
      if (data.speed) setSpeed(data.speed);
      if (data.exportConfig) setExportConfig(data.exportConfig);
    },
  });

  // Broadcast les changements d'état aux collaborateurs (debounce)
  const collabDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastState = useCallback(() => {
    if (!collabEnabled) return;
    if (collabDebounceRef.current) clearTimeout(collabDebounceRef.current);
    collabDebounceRef.current = setTimeout(() => {
      collabSendState({
        overlays,
        colorAdjust,
        speed,
        exportConfig,
      });
    }, 500);
  }, [collabEnabled, collabSendState, overlays, colorAdjust, speed, exportConfig]);

  // Track souris pour les curseurs partagés
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!collabEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    collabSendCursor(x, y);
  }, [collabEnabled, collabSendCursor]);

  // ─── Upload vidéo source ───
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadError("Veuillez sélectionner un fichier vidéo (MP4, WebM, etc.)");
      return;
    }
    const fileSizeMB = Math.round(file.size / 1024 / 1024);
    setUploadingVideo(true);
    setUploadError("");
    setUploadProgress(0);
    setUploadStage("Demande d'URL d'upload...");

    try {
      const presignRes = await apiFetch(`/api/videos/${videoId}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, filename: file.name }),
      });

      if (presignRes.ok) {
        const { uploadUrl, publicUrl } = await presignRes.json();
        setUploadStage(`Upload direct vers R2 (${fileSizeMB} MB)...`);

        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (ev) => {
              if (ev.lengthComputable) {
                setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
              }
            });
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`Upload R2 échoué: HTTP ${xhr.status}`));
            });
            xhr.addEventListener("error", () => reject(new Error("Erreur réseau CORS")));
            xhr.addEventListener("abort", () => reject(new Error("Upload annulé")));
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type);
            xhr.send(file);
          });

          setUploadStage("Finalisation...");
          setUploadProgress(100);
          const commitRes = await apiFetch(`/api/videos/${videoId}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ r2Url: publicUrl }),
          });
          if (!commitRes.ok) {
            const data = await commitRes.json().catch(() => ({}));
            throw new Error(data.error || "Erreur lors de la finalisation");
          }
          const result = await commitRes.json();
          setCurrentVideoUrl(result.videoUrl);
          setTimeout(() => window.location.reload(), 1500);
          return;
        } catch (putError) {
          // (S5) Si le PUT vers R2 échoue (CORS non configuré, réseau, etc.),
          // on retombe sur l'upload FormData via le serveur (limité à 4.5 MB
          // sur Vercel Hobby, mais au moins ça marche en attendant que le
          // CORS soit propagé).
          console.warn("[post-production] Upload R2 direct échoué, fallback FormData:", putError);
          setUploadStage("Upload via serveur (fallback)...");
          setUploadProgress(0);
          // Continuer vers le fallback FormData ci-dessous
        }
      }

      // Fallback FormData (R2 non configuré OU PUT direct échoué)
      const fallbackData = presignRes.ok ? {} : await presignRes.json().catch(() => ({}));
      if (fallbackData.r2NotConfigured || true) {
        setUploadStage(`Upload via serveur (${fileSizeMB} MB)...`);
        const result = await new Promise<{ videoUrl: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("file", file);
          xhr.upload.addEventListener("progress", (ev) => {
            if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); }
              catch { reject(new Error("Réponse invalide")); }
            } else {
              try { reject(new Error(JSON.parse(xhr.responseText).error || `HTTP ${xhr.status}`)); }
              catch { reject(new Error(`HTTP ${xhr.status}`)); }
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Erreur réseau")));
          xhr.open("POST", `/api/videos/${videoId}/upload`);
          xhr.send(formData);
        });
        setCurrentVideoUrl(result.videoUrl);
        setUploadProgress(100);
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
      throw new Error(fallbackData.error || "Impossible de générer l'URL d'upload");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploadingVideo(false);
      setUploadStage("");
      if (videoUploadRef.current) videoUploadRef.current.value = "";
    }
  };

  // ─── Upload miniature ───
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setThumbnail(event.target?.result as string); pushHistory(); };
    reader.readAsDataURL(file);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  };

  // ─── Ajouter overlay texte ───
  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      type: "text",
      content: "Nouveau texte",
      x: 50,
      y: 50,
      fontSize: 48,
      fontColor: "#FFFFFF",
      bgColor: null,
      bold: true,
      animation: "fade-in",
      animationDuration: 0.5,
    };
    setOverlays([...overlays, newOverlay]);
    pushHistory();
  };

  // ─── Ajouter overlay image ───
  const addImageOverlay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newOverlay: ImageOverlay = {
        id: `img-${Date.now()}`,
        type: "image",
        url: event.target?.result as string,
        x: 50,
        y: 50,
        scale: 1,
        opacity: 1,
        animation: "none",
      };
      setOverlays([...overlays, newOverlay]);
      pushHistory();
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Ajouter sticker emoji ───
  const addSticker = (emoji: string) => {
    const newSticker: StickerOverlay = {
      id: `sticker-${Date.now()}`,
      type: "sticker",
      emoji,
      x: 50,
      y: 50,
      size: 80,
      rotation: 0,
      opacity: 1,
      animation: "none",
    };
    setOverlays([...overlays, newSticker]);
    setSelectedOverlayId(newSticker.id);
    pushHistory();
  };

  // ─── Ajouter effet sonore ───
  const addSoundEffect = (sfx: typeof SOUND_EFFECTS[0]) => {
    const newTrack: AudioTrack = {
      id: `sfx-${Date.now()}`,
      url: sfx.url,
      volume: 0.5,
      name: sfx.name,
      fadeIn: 0.1,
      fadeOut: 0.3,
    };
    setAudioTracks([...audioTracks, newTrack]);
    pushHistory();
  };

  // ─── Sauvegarder le projet (cloud sync) ───
  const handleSaveProject = async () => {
    setProjectSaved(true);
    try {
      const projectState = {
        videoId,
        timeline,
        overlays,
        subtitles,
        transitions,
        colorAdjust,
        speed,
        transform,
        audioTracks,
        mainVolume,
        exportConfig,
        thumbnailUrl: thumbnail,
        videoFilter,
        stabilisation,
        chromaKey,
      };
      // Sauvegarder en localStorage (cloud sync basique)
      localStorage.setItem(`post-prod-project-${videoId}`, JSON.stringify(projectState));
      // Aussi en DB via API (best-effort)
      await apiFetch(`/api/videos/${videoId}/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectState),
      }).catch(() => {});
    } catch {}
    setTimeout(() => setProjectSaved(false), 2000);
  };

  // ─── Charger le projet ───
  const loadProject = useCallback(async () => {
    try {
      const saved = localStorage.getItem(`post-prod-project-${videoId}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timeline) setTimeline(data.timeline);
        if (data.overlays) setOverlays(data.overlays);
        if (data.subtitles) setSubtitles(data.subtitles);
        if (data.colorAdjust) setColorAdjust(data.colorAdjust);
        if (data.speed) setSpeed(data.speed);
        if (data.exportConfig) setExportConfig(data.exportConfig);
        if (data.videoFilter) setVideoFilter(data.videoFilter);
        if (data.stabilisation) setStabilisation(data.stabilisation);
        if (data.chromaKey) setChromaKey(data.chromaKey);
      }
    } catch {}
  }, [videoId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // ─── Modifier un overlay ───
  const updateOverlay = (id: string, updates: Partial<Overlay>) => {
    setOverlays(overlays.map((o) => o.id === id ? { ...o, ...updates } as Overlay : o));
  };

  const deleteOverlay = (id: string) => {
    setOverlays(overlays.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
    pushHistory();
  };

  // ─── Upload clip intro/outro ───
  const handleUploadClip = (type: "intro" | "outro") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const video = document.createElement("video");
      video.src = src;
      video.onloadedmetadata = () => {
        const newClip: TimelineClip = {
          id: `${type}-${Date.now()}`, type,
          label: type === "intro" ? "Intro" : "Outro",
          duration: video.duration, src, url: src,
          color: type === "intro" ? "#C9A227" : "#8C5FA8",
        };
        if (type === "intro") setTimeline((prev) => [newClip, ...prev]);
        else setTimeline((prev) => [...prev, newClip]);
        setTotalDuration((prev) => prev + video.duration);
        pushHistory();
      };
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteClip = (id: string) => {
    const clip = timeline.find((c) => c.id === id);
    if (clip && clip.type !== "main") {
      setTimeline((prev) => prev.filter((c) => c.id !== id));
      setTotalDuration((prev) => prev - clip.duration);
      pushHistory();
    }
  };

  // ─── Audio : upload musique de fond ───
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newTrack: AudioTrack = {
        id: `audio-${Date.now()}`,
        url: event.target?.result as string,
        volume: 0.3,
        name: file.name,
        loop: true,
        fadeIn: 1,
        fadeOut: 2,
      };
      setAudioTracks([...audioTracks, newTrack]);
      pushHistory();
    };
    reader.readAsDataURL(file);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  // ─── Voiceover recording ───
  const startVoiceover = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceoverChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceoverChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(voiceoverChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = (event) => {
          const newTrack: AudioTrack = {
            id: `voiceover-${Date.now()}`,
            url: event.target?.result as string,
            volume: 1,
            name: "Voiceover",
            fadeIn: 0.5,
            fadeOut: 0.5,
          };
          setAudioTracks([...audioTracks, newTrack]);
          pushHistory();
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      voiceoverRef.current = recorder;
      setIsRecordingVoiceover(true);
    } catch (err) {
      setExportError("Impossible d'accéder au micro: " + (err instanceof Error ? err.message : "erreur"));
    }
  };

  const stopVoiceover = () => {
    if (voiceoverRef.current && voiceoverRef.current.state !== "inactive") {
      voiceoverRef.current.stop();
      setIsRecordingVoiceover(false);
    }
  };

  // ─── Sous-titres : générer via Whisper ───
  const [generatingSubtitles, setGeneratingSubtitles] = useState(false);

  const generateSubtitles = async () => {
    if (!currentVideoUrl) return;
    setGeneratingSubtitles(true);
    setExportError("");
    try {
      const res = await apiFetch(`/api/soustitres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichierUrl: currentVideoUrl, langueSource: "fr", languesCibles: [] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur génération sous-titres");
      }
      const data = await res.json();
      setSubtitles({
        srtContent: data.srtSource || "",
        style: DEFAULT_SUBTITLE_STYLE,
      });
      pushHistory();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingSubtitles(false);
    }
  };

  // ─── Export / Render ───
  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    setExportProgress(["Préparation du rendu..."]);

    try {
      // Construire le RenderProject
      const segments: Segment[] = timeline.map((clip) => ({
        id: clip.id,
        type: clip.type,
        url: clip.url || clip.src || currentVideoUrl || "",
        label: clip.label,
        trimStart: clip.type === "main" ? (trimStart > 0 ? trimStart : undefined) : clip.trimStart,
        trimEnd: clip.type === "main" ? (trimEnd < totalDuration ? trimEnd : undefined) : clip.trimEnd,
      }));

      const project: RenderProject = {
        videoId,
        segments,
        overlays,
        subtitles: subtitles || undefined,
        transitions: transitions.length > 0 ? transitions : undefined,
        colorAdjust: (colorAdjust.brightness !== 0 || colorAdjust.contrast !== 1 || colorAdjust.saturation !== 1 || colorAdjust.gamma !== 1) ? colorAdjust : undefined,
        speed: speed.factor !== 1 ? speed : undefined,
        transform: (transform.rotate !== 0 || transform.flipH || transform.flipV || transform.crop) ? transform : undefined,
        audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
        mainVolume: mainVolume !== 1 ? mainVolume : undefined,
        export: exportConfig,
        thumbnailUrl: thumbnail || undefined,
        title,
        // Sprint 5+
        filters: videoFilter !== "none" ? videoFilter : undefined,
        stabilisation: stabilisation.enabled ? stabilisation : undefined,
        chromaKey: chromaKey.enabled ? chromaKey : undefined,
      };

      const res = await apiFetch(`/api/videos/${videoId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de rendu");
      }

      const data = await res.json();
      setExportProgress(data.steps || ["Terminé"]);
      if (data.videoUrl) setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setExporting(false);
    }
  };

  // ─── Templates ───
  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const state: PostProductionState = {
      timeline, overlays, subtitles, transitions, colorAdjust, speed, transform, audioTracks, mainVolume, exportConfig, thumbnailUrl: thumbnail,
    };
    const newState = template.apply(state);
    setExportConfig(newState.exportConfig);
    pushHistory();
    setShowTemplates(false);
  };

  // ─── Helpers ───
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Détecter si l'URL est YouTube → besoin d'un iframe au lieu de <video>
  const isYoutubeVideo = (url: string | null): boolean => {
    if (!url) return false;
    return url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/) !== null;
  };
  const getYoutubeEmbedUrl = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&modestbranding=1&rel=0` : url;
  };
  const youtubeMode = isYoutubeVideo(currentVideoUrl);

  const TABS: { id: TabType; label: string; icon: typeof Scissors }[] = [
    { id: "trim", label: "Couper", icon: Scissors },
    { id: "text", label: "Texte", icon: Type },
    { id: "image", label: "Images", icon: ImageIcon },
    { id: "stickers", label: "Stickers", icon: Smile },
    { id: "subtitles", label: "Sous-titres", icon: Subtitles },
    { id: "transitions", label: "Transitions", icon: Film },
    { id: "color", label: "Couleur", icon: Palette },
    { id: "filters", label: "Filtres", icon: Sparkles },
    { id: "speed", label: "Vitesse", icon: Zap },
    { id: "transform", label: "Transform", icon: Crop },
    { id: "advanced", label: "Avancé", icon: Wind },
    { id: "audio", label: "Audio", icon: Volume2 },
    { id: "sfx", label: "SFX", icon: Music },
    { id: "export", label: "Export", icon: Download },
  ];

  const hasActiveOverlays = overlays.length > 0;
  const hasActiveSubtitles = !!subtitles;
  const hasActiveTransitions = transitions.length > 0;
  const hasActiveColor = colorAdjust.brightness !== 0 || colorAdjust.contrast !== 1 || colorAdjust.saturation !== 1 || colorAdjust.gamma !== 1;
  const hasActiveSpeed = speed.factor !== 1;
  const hasActiveTransform = transform.rotate !== 0 || transform.flipH || transform.flipV;
  const hasActiveAudio = audioTracks.length > 0 || mainVolume !== 1;

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* ─── Header ─── */}
      <div className="border-b border-[#8A8378]/15 px-6 py-3 bg-white sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2 text-[#1E0F2B]">
              <Film className="w-5 h-5 text-[#C9A227]" />Post-production
            </h1>
            <span className="text-xs text-[#8A8378]">{title} — {servantName}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button onClick={undo} disabled={historyIndex <= 0}
              className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 disabled:opacity-30 transition-colors" title="Annuler">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 disabled:opacity-30 transition-colors" title="Refaire">
              <Redo2 className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-[#8A8378]/20" />
            {/* Templates */}
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="px-3 py-2 rounded-lg hover:bg-[#2A0E3D]/5 text-xs font-bold flex items-center gap-1.5 transition-colors">
              <Wand2 className="w-3.5 h-3.5" />Templates
            </button>
            {/* Save project */}
            <button onClick={handleSaveProject}
              className="px-3 py-2 rounded-lg hover:bg-[#2A0E3D]/5 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Ctrl+S">
              {projectSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Save className="w-3.5 h-3.5" />}
              {projectSaved ? "Sauvegardé" : "Sauver"}
            </button>
            {/* Keyboard shortcuts */}
            <button onClick={() => setShowShortcuts(!showShortcuts)}
              className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 transition-colors" title="Raccourcis clavier">
              <Keyboard className="w-4 h-4" />
            </button>
            {/* Collaboration */}
            <button onClick={() => { setCollabEnabled(!collabEnabled); setShowCollabPanel(!collabEnabled); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${collabEnabled ? "bg-green-600 text-white" : "hover:bg-[#2A0E3D]/5"}`}
              title="Collaboration temps réel">
              <Users className="w-3.5 h-3.5" />
              {collabEnabled ? (
                <span className="flex items-center gap-1">
                  {collabUsers.length}
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                </span>
              ) : "Collab"}
            </button>
            {/* Export */}
            <button onClick={handleExport} disabled={exporting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors disabled:opacity-40 shadow-md">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Rendu..." : "Exporter"}
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts dropdown */}
        {showShortcuts && (
          <div className="absolute top-full right-6 mt-1 bg-white rounded-xl shadow-2xl border border-[#8A8378]/15 p-3 w-80 z-40 max-h-96 overflow-y-auto">
            <p className="text-xs font-bold text-[#8A8378] uppercase tracking-wider px-2 py-1 mb-1">Raccourcis clavier</p>
            {KEYBOARD_SHORTCUTS.map((sc, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1 hover:bg-[#2A0E3D]/5 rounded">
                <span className="text-xs text-[#1E0F2B]">{sc.description}</span>
                <kbd className="text-[10px] font-bold px-1.5 py-0.5 bg-[#2A0E3D]/10 rounded">
                  {sc.ctrl ? "⌘+" : ""}{sc.shift ? "⇧+" : ""}{sc.key === " " ? "Space" : sc.key}
                </kbd>
              </div>
            ))}
          </div>
        )}

        {/* Templates dropdown */}
        {showTemplates && (
          <div className="absolute top-full right-6 mt-1 bg-white rounded-xl shadow-2xl border border-[#8A8378]/15 p-2 w-64 z-40">
            <p className="text-xs font-bold text-[#8A8378] uppercase tracking-wider px-2 py-1">Templates</p>
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => applyTemplate(t.id)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#2A0E3D]/5 transition-colors">
                <p className="text-sm font-bold text-[#1E0F2B]">{t.name}</p>
                <p className="text-xs text-[#8A8378]">{t.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Progress export ─── */}
      {(exporting || exportProgress.length > 0 || exportError) && (
        <div className="px-6 py-3 bg-[#2A0E3D]/5">
          <div className={`rounded-xl p-4 ${exportError ? "bg-red-50 border border-red-200" : "bg-white border border-[#C9A227]/20"}`}>
            {exportError ? (
              <p className="text-sm text-red-700">✗ {exportError}</p>
            ) : (
              <>
                <p className="text-xs font-bold text-[#C9A227] uppercase tracking-wider mb-2">{exporting ? "Rendu en cours..." : "✓ Rendu terminé"}</p>
                <ul className="space-y-1">
                  {exportProgress.map((step, i) => (
                    <li key={i} className="text-xs text-[#1E0F2B]/70 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />{step}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Main layout ─── */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 p-4">
        {/* ─── Colonne gauche : Preview + Timeline ─── */}
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl"
            onMouseMove={handleMouseMove}>
            {currentVideoUrl ? (
              <>
                {youtubeMode ? (
                  /* YouTube : iframe au lieu de <video> car les URL YouTube
                     ne sont pas lisibles dans un <video> HTML5. */
                  <iframe
                    src={getYoutubeEmbedUrl(currentVideoUrl)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video ref={videoRef} src={currentVideoUrl} className="w-full h-full object-contain"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)} />
                )}

                {/* Overlays preview (texte) — masqués en mode YouTube car
                    on ne peut pas superposer du contenu sur un iframe YouTube */}
                {!youtubeMode && overlays.filter((o) => o.type === "text").map((overlay) => {
                  const t = overlay as TextOverlay;
                  const isActive = (!t.startTime || t.startTime <= currentTime) && (!t.endTime || t.endTime >= currentTime);
                  if (!isActive) return null;
                  return (
                    <div key={t.id}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${t.x}%`, top: `${t.y}%`,
                        transform: "translate(-50%, -50%)",
                        fontSize: `${t.fontSize}px`,
                        color: t.fontColor,
                        fontWeight: t.bold ? "bold" : "normal",
                        fontStyle: t.italic ? "italic" : "normal",
                        backgroundColor: t.bgColor || "transparent",
                        padding: t.bgColor ? "4px 8px" : 0,
                        borderRadius: t.bgColor ? "4px" : 0,
                        whiteSpace: "nowrap",
                      }}>
                      {t.content}
                    </div>
                  );
                })}

                {/* Overlays preview (image) — masqués en mode YouTube */}
                {!youtubeMode && overlays.filter((o) => o.type === "image").map((overlay) => {
                  const img = overlay as ImageOverlay;
                  const isActive = (!img.startTime || img.startTime <= currentTime) && (!img.endTime || img.endTime >= currentTime);
                  if (!isActive) return null;
                  return (
                    <img key={img.id} src={img.url} alt=""
                      className="absolute pointer-events-none"
                      style={{
                        left: `${img.x}%`, top: `${img.y}%`,
                        transform: `translate(-50%, -50%) scale(${img.scale})`,
                        opacity: img.opacity,
                      }} />
                  );
                })}

                {/* Overlays preview (sticker emoji) — masqués en mode YouTube */}
                {!youtubeMode && overlays.filter((o) => o.type === "sticker").map((overlay) => {
                  const s = overlay as StickerOverlay;
                  const isActive = (!s.startTime || s.startTime <= currentTime) && (!s.endTime || s.endTime >= currentTime);
                  if (!isActive) return null;
                  return (
                    <div key={s.id}
                      className="absolute pointer-events-none select-none"
                      style={{
                        left: `${s.x}%`, top: `${s.y}%`,
                        transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
                        fontSize: `${s.size}px`,
                        opacity: s.opacity,
                        lineHeight: 1,
                      }}>
                      {s.emoji}
                    </div>
                  );
                })}

                {/* Crop overlay preview — masqué en mode YouTube */}
                {!youtubeMode && transform.crop && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute bg-black/50" style={{
                      left: 0, top: 0, width: "100%", height: `${(transform.crop.y / (videoRef.current?.videoHeight || 1080)) * 100}%`,
                    }} />
                  </div>
                )}

                {/* Bannière mode YouTube — explique qu'il faut uploader
                    le fichier source pour éditer (trim, overlays, etc.) */}
                {youtubeMode && (
                  <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#2A0E3D]/90 backdrop-blur-sm px-4 py-2 border-t border-[#C9A227]/30">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-[11px] text-[#FAF6EF]/80 flex-1 leading-tight">
                        Vidéo YouTube en lecture. Pour éditer (découper, texte, filtres),
                        uploadez le fichier source ci-dessous.
                      </p>
                      <button
                        onClick={() => videoUploadRef.current?.click()}
                        className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-[10px] font-bold hover:bg-[#DDBE55] transition-colors flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        Uploader
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : loadingVideo ? (
              <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-[#2A0E3D] to-[#1A0826] text-center p-8">
                <Loader2 className="w-12 h-12 text-[#C9A227] mx-auto mb-3 animate-spin" />
                <p className="text-sm font-bold text-[#FAF6EF] mb-1">Chargement de la vidéo...</p>
              </div>
            ) : uploadingVideo ? (
              <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-[#2A0E3D] to-[#1A0826] text-center p-8">
                <Loader2 className="w-12 h-12 text-[#C9A227] mx-auto mb-4 animate-spin" />
                <p className="text-sm font-bold text-[#FAF6EF] mb-2">{uploadStage || "Upload..."} {uploadProgress}%</p>
                <div className="w-full max-w-xs bg-white/10 rounded-full h-3 overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-[#C9A227] to-[#DDBE55] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-[#FAF6EF]/50">Ne fermez pas cette page</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-[#2A0E3D] to-[#1A0826] text-center p-8">
                <VideoIcon className="w-12 h-12 text-[#C9A227]/60 mx-auto mb-3" />
                <p className="text-sm font-bold text-[#FAF6EF] mb-1">Aucune vidéo source</p>
                <p className="text-xs text-[#FAF6EF]/50 max-w-sm mb-4">Uploadez le replay enregistré (MP4, WebM — aucune limite de taille)</p>
                <button onClick={() => videoUploadRef.current?.click()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors">
                  <Upload className="w-4 h-4" />Uploader le replay
                </button>
                {uploadError && <p className="text-xs text-red-400 mt-3 max-w-sm">{uploadError}</p>}
                <input ref={videoUploadRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
              </div>
            )}
          </div>

          {/* Controls — masqués en mode YouTube (l'iframe a ses propres contrôles) */}
          {!youtubeMode && (
          <div className="flex items-center justify-center gap-3 bg-white rounded-xl p-3 border border-[#8A8378]/15">
            <button onClick={() => handleSeek(Math.max(trimStart, currentTime - 10))} className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 transition-colors" disabled={!currentVideoUrl}>
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="p-3 rounded-full bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors disabled:opacity-40" disabled={!currentVideoUrl}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => handleSeek(Math.min(trimEnd, currentTime + 10))} className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 transition-colors" disabled={!currentVideoUrl}>
              <SkipForward className="w-5 h-5" />
            </button>
            <span className="text-xs text-[#8A8378] ml-2">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
          </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl p-4 border border-[#8A8378]/15">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E0F2B]">Timeline</span>
            </div>
            <div className="relative h-16 bg-[#2A0E3D]/10 rounded-lg overflow-hidden flex">
              {timeline.map((clip) => {
                const widthPercent = totalDuration > 0 ? (clip.duration / totalDuration) * 100 : 100;
                return (
                  <div key={clip.id} className="relative h-full flex items-center justify-center text-xs font-bold text-white border-r border-black/30 group"
                    style={{ width: `${widthPercent}%`, backgroundColor: clip.color }}>
                    <span className="px-2 truncate">{clip.label}</span>
                    <span className="absolute bottom-1 right-1 text-[9px] text-white/60">{formatTime(clip.duration)}</span>
                    {clip.type !== "main" && (
                      <button onClick={() => deleteClip(clip.id)} className="absolute top-1 right-1 p-0.5 rounded bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {totalDuration > 0 && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#C9A227] pointer-events-none" style={{ left: `${(currentTime / totalDuration) * 100}%` }}>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#C9A227]" />
                </div>
              )}
              {totalDuration > 0 && (
                <>
                  <div className="absolute top-0 bottom-0 left-0 bg-red-900/30 pointer-events-none" style={{ width: `${(trimStart / totalDuration) * 100}%` }} />
                  <div className="absolute top-0 bottom-0 right-0 bg-red-900/30 pointer-events-none" style={{ width: `${((totalDuration - trimEnd) / totalDuration) * 100}%` }} />
                </>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1">
                <label className="text-[10px] text-[#8A8378] uppercase font-bold">Début : {formatTime(trimStart)}</label>
                <input type="range" min="0" max={totalDuration} step="0.1" value={trimStart}
                  onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd))}
                  className="w-full accent-[#C9A227]" disabled={!currentVideoUrl} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[#8A8378] uppercase font-bold">Fin : {formatTime(trimEnd)}</label>
                <input type="range" min="0" max={totalDuration} step="0.1" value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart))}
                  className="w-full accent-[#C9A227]" disabled={!currentVideoUrl} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Colonne droite : Tabs + Panels ─── */}
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="grid grid-cols-5 gap-1 bg-white rounded-xl p-1 border border-[#8A8378]/15">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasIndicator =
                (tab.id === "text" && overlays.some((o) => o.type === "text")) ||
                (tab.id === "image" && overlays.some((o) => o.type === "image")) ||
                (tab.id === "subtitles" && hasActiveSubtitles) ||
                (tab.id === "transitions" && hasActiveTransitions) ||
                (tab.id === "color" && hasActiveColor) ||
                (tab.id === "speed" && hasActiveSpeed) ||
                (tab.id === "transform" && hasActiveTransform) ||
                (tab.id === "audio" && hasActiveAudio);
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`relative py-2 rounded-lg text-[10px] font-bold transition-colors ${isActive ? "bg-[#2A0E3D] text-white" : "text-[#8A8378] hover:text-[#1E0F2B]"}`}>
                  <Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />
                  {tab.label}
                  {hasIndicator && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#C9A227]" />}
                </button>
              );
            })}
          </div>

          {/* ─── Panel: Découpage ─── */}
          {activeTab === "trim" && (
            <Panel title="Découpage">
              <p className="text-xs text-[#1E0F2B]/70 leading-relaxed mb-3">Ajustez le début et la fin du replay. Les zones rouges sur la timeline indiquent les parties supprimées.</p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setTrimStart(currentTime)} className="flex-1 px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#A3821C] text-xs font-bold hover:bg-[#C9A227]/30 transition-colors" disabled={!currentVideoUrl}>Définir début</button>
                <button onClick={() => setTrimEnd(currentTime)} className="flex-1 px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#A3821C] text-xs font-bold hover:bg-[#C9A227]/30 transition-colors" disabled={!currentVideoUrl}>Définir fin</button>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[#2A0E3D]/5 mb-3">
                <p className="text-xs text-[#1E0F2B]/70">Durée finale : <span className="font-bold">{formatTime(trimEnd - trimStart)}</span></p>
                <p className="text-xs text-[#8A8378]">Supprimé : {formatTime(trimStart)} début + {formatTime(totalDuration - trimEnd)} fin</p>
              </div>
              {/* Intro/outro upload */}
              <div className="space-y-2">
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                  <Upload className="w-4 h-4" />Ajouter intro/outro
                </button>
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { handleUploadClip("intro")(e); }} />
              </div>
              <div className="space-y-2 mt-2">
                {timeline.filter((c) => c.type !== "main").map((clip) => (
                  <div key={clip.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A0E3D]/5">
                    <Film className="w-3.5 h-3.5" style={{ color: clip.color }} />
                    <span className="text-xs flex-1 truncate">{clip.label}</span>
                    <span className="text-[10px] text-[#8A8378]">{formatTime(clip.duration)}</span>
                    <button onClick={() => deleteClip(clip.id)} className="p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* ─── Panel: Texte ─── */}
          {activeTab === "text" && (
            <Panel title="Texte & Titres">
              <button onClick={addTextOverlay} className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors mb-3">
                <Plus className="w-4 h-4" />Ajouter un texte
              </button>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {overlays.filter((o) => o.type === "text").map((overlay) => {
                  const t = overlay as TextOverlay;
                  return (
                    <div key={t.id} className="bg-[#2A0E3D]/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate flex-1">{t.content || "Texte vide"}</span>
                        <button onClick={() => deleteOverlay(t.id)} className="p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <input type="text" value={t.content} onChange={(e) => updateOverlay(t.id, { content: e.target.value })}
                        placeholder="Texte..." className="w-full px-2 py-1.5 rounded-lg border border-[#8A8378]/20 bg-white text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#8A8378]">X: {Math.round(t.x)}%</label>
                          <input type="range" min="0" max="100" value={t.x} onChange={(e) => updateOverlay(t.id, { x: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Y: {Math.round(t.y)}%</label>
                          <input type="range" min="0" max="100" value={t.y} onChange={(e) => updateOverlay(t.id, { y: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Taille: {t.fontSize}px</label>
                          <input type="range" min="12" max="120" value={t.fontSize} onChange={(e) => updateOverlay(t.id, { fontSize: parseInt(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Couleur</label>
                          <input type="color" value={t.fontColor} onChange={(e) => updateOverlay(t.id, { fontColor: e.target.value })} className="w-full h-7 rounded" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Début: {Math.round(t.startTime || 0)}s</label>
                          <input type="range" min="0" max={Math.round(totalDuration)} value={t.startTime || 0} onChange={(e) => updateOverlay(t.id, { startTime: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Fin: {Math.round(t.endTime || totalDuration)}s</label>
                          <input type="range" min="0" max={Math.round(totalDuration)} value={t.endTime || totalDuration} onChange={(e) => updateOverlay(t.id, { endTime: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Animation</label>
                        <select value={t.animation || "none"} onChange={(e) => updateOverlay(t.id, { animation: e.target.value as TextOverlay["animation"] })} className="w-full px-2 py-1 rounded-lg border border-[#8A8378]/20 bg-white text-xs">
                          <option value="none">Aucune</option>
                          <option value="fade-in">Fondu entrée</option>
                          <option value="fade-out">Fondu sortie</option>
                          <option value="fade-in-out">Fondu in/out</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* ─── Panel: Images ─── */}
          {activeTab === "image" && (
            <Panel title="Images & Logos">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors mb-3">
                <Plus className="w-4 h-4" />Ajouter une image
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={addImageOverlay} />
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {overlays.filter((o) => o.type === "image").map((overlay) => {
                  const img = overlay as ImageOverlay;
                  return (
                    <div key={img.id} className="bg-[#2A0E3D]/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <img src={img.url} alt="" className="w-12 h-12 object-cover rounded" />
                        <button onClick={() => deleteOverlay(img.id)} className="p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#8A8378]">X: {Math.round(img.x)}%</label>
                          <input type="range" min="0" max="100" value={img.x} onChange={(e) => updateOverlay(img.id, { x: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Y: {Math.round(img.y)}%</label>
                          <input type="range" min="0" max="100" value={img.y} onChange={(e) => updateOverlay(img.id, { y: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Scale: {img.scale.toFixed(1)}x</label>
                          <input type="range" min="0.1" max="5" step="0.1" value={img.scale} onChange={(e) => updateOverlay(img.id, { scale: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Opacité: {Math.round(img.opacity * 100)}%</label>
                          <input type="range" min="0" max="1" step="0.05" value={img.opacity} onChange={(e) => updateOverlay(img.id, { opacity: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Début: {Math.round(img.startTime || 0)}s</label>
                          <input type="range" min="0" max={Math.round(totalDuration)} value={img.startTime || 0} onChange={(e) => updateOverlay(img.id, { startTime: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Fin: {Math.round(img.endTime || totalDuration)}s</label>
                          <input type="range" min="0" max={Math.round(totalDuration)} value={img.endTime || totalDuration} onChange={(e) => updateOverlay(img.id, { endTime: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* ─── Panel: Stickers ─── */}
          {activeTab === "stickers" && (
            <Panel title="Stickers & Emoji">
              <div className="space-y-3">
                {/* Catégories */}
                <div className="flex gap-1 flex-wrap">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button key={cat.name} onClick={() => setEmojiCategory(i)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${emojiCategory === i ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>
                {/* Grille d'emojis */}
                <div className="grid grid-cols-8 gap-1 max-h-[300px] overflow-y-auto">
                  {EMOJI_CATEGORIES[emojiCategory].emojis.map((emoji, i) => (
                    <button key={i} onClick={() => addSticker(emoji)}
                      className="aspect-square flex items-center justify-center text-xl hover:bg-[#2A0E3D]/5 rounded-lg transition-colors">
                      {emoji}
                    </button>
                  ))}
                </div>
                {/* Stickers actifs */}
                {overlays.filter((o) => o.type === "sticker").length > 0 && (
                  <div className="space-y-2 border-t border-[#8A8378]/15 pt-3">
                    <p className="text-[10px] text-[#8A8378] uppercase font-bold">Stickers actifs</p>
                    {overlays.filter((o) => o.type === "sticker").map((overlay) => {
                      const s = overlay as StickerOverlay;
                      return (
                        <div key={s.id} className="bg-[#2A0E3D]/5 rounded-lg p-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{s.emoji}</span>
                            <button onClick={() => deleteOverlay(s.id)} className="ml-auto p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#8A8378]">X: {Math.round(s.x)}%</label>
                              <input type="range" min="0" max="100" value={s.x} onChange={(e) => updateOverlay(s.id, { x: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#8A8378]">Y: {Math.round(s.y)}%</label>
                              <input type="range" min="0" max="100" value={s.y} onChange={(e) => updateOverlay(s.id, { y: parseFloat(e.target.value) })} className="w-full accent-[#C9A227]" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-[#8A8378]">Taille: {s.size}px</label>
                            <input type="range" min="20" max="200" value={s.size} onChange={(e) => updateOverlay(s.id, { size: parseInt(e.target.value) })} className="w-full accent-[#C9A227]" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#8A8378]">Rotation: {s.rotation}°</label>
                            <input type="range" min="0" max="360" value={s.rotation} onChange={(e) => updateOverlay(s.id, { rotation: parseInt(e.target.value) })} className="w-full accent-[#C9A227]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* ─── Panel: Sous-titres ─── */}
          {activeTab === "subtitles" && (
            <Panel title="Sous-titres">
              {!subtitles ? (
                <div className="text-center py-6">
                  <Subtitles className="w-10 h-10 text-[#C9A227]/40 mx-auto mb-3" />
                  <p className="text-xs text-[#1E0F2B]/70 mb-4">Générez automatiquement des sous-titres avec l'IA (Whisper) ou importez un fichier SRT.</p>
                  <button onClick={generateSubtitles} disabled={generatingSubtitles || !currentVideoUrl}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-xs hover:bg-[#DDBE55] transition-colors disabled:opacity-40 mb-2">
                    {generatingSubtitles ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Générer avec l'IA"}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-2.5 rounded-xl border border-[#8A8378]/30 text-xs font-bold hover:bg-[#2A0E3D]/5 transition-colors">
                    Importer SRT
                  </button>
                  <input ref={fileInputRef} type="file" accept=".srt,.vtt" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setSubtitles({ srtContent: ev.target?.result as string, style: DEFAULT_SUBTITLE_STYLE });
                      pushHistory();
                    };
                    reader.readAsText(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <Subtitles className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-emerald-700 flex-1">Sous-titres actifs</span>
                    <button onClick={() => { setSubtitles(null); pushHistory(); }} className="p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-[#8A8378]">Taille: {subtitles.style.fontSize}px</label>
                      <input type="range" min="12" max="48" value={subtitles.style.fontSize}
                        onChange={(e) => setSubtitles({ ...subtitles, style: { ...subtitles.style, fontSize: parseInt(e.target.value) } })}
                        className="w-full accent-[#C9A227]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Couleur texte</label>
                        <input type="color" value={subtitles.style.fontColor}
                          onChange={(e) => setSubtitles({ ...subtitles, style: { ...subtitles.style, fontColor: e.target.value } })}
                          className="w-full h-7 rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Contour</label>
                        <input type="color" value={subtitles.style.outlineColor}
                          onChange={(e) => setSubtitles({ ...subtitles, style: { ...subtitles.style, outlineColor: e.target.value } })}
                          className="w-full h-7 rounded" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#8A8378]">Position</label>
                      <select value={subtitles.style.position}
                        onChange={(e) => setSubtitles({ ...subtitles, style: { ...subtitles.style, position: e.target.value as "bottom" | "top" | "center" } })}
                        className="w-full px-2 py-1 rounded-lg border border-[#8A8378]/20 bg-white text-xs">
                        <option value="bottom">Bas</option>
                        <option value="center">Centre</option>
                        <option value="top">Haut</option>
                      </select>
                    </div>
                  </div>
                  <textarea value={subtitles.srtContent} onChange={(e) => setSubtitles({ ...subtitles, srtContent: e.target.value })}
                    className="w-full h-32 px-2 py-1.5 rounded-lg border border-[#8A8378]/20 bg-white text-xs font-mono" placeholder="Contenu SRT..." />
                </div>
              )}
            </Panel>
          )}

          {/* ─── Panel: Transitions ─── */}
          {activeTab === "transitions" && (
            <Panel title="Transitions">
              <p className="text-xs text-[#1E0F2B]/70 mb-3">Ajoutez des transitions entre les segments de la timeline.</p>
              {timeline.length <= 1 ? (
                <p className="text-xs text-[#8A8378] text-center py-4">Ajoutez d'abord une intro ou un outro.</p>
              ) : (
                <div className="space-y-2">
                  {timeline.slice(0, -1).map((clip, i) => (
                    <div key={`trans-${i}`} className="bg-[#2A0E3D]/5 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-bold">{clip.label} → {timeline[i + 1].label}</p>
                      <select value={transitions[i]?.type || "fade"}
                        onChange={(e) => {
                          const newTrans = [...transitions];
                          newTrans[i] = { type: e.target.value as TransitionConfig["type"], duration: newTrans[i]?.duration || 0.5 };
                          setTransitions(newTrans);
                          pushHistory();
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-[#8A8378]/20 bg-white text-xs">
                        {TRANSITION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Durée: {transitions[i]?.duration || 0.5}s</label>
                        <input type="range" min="0.1" max="3" step="0.1" value={transitions[i]?.duration || 0.5}
                          onChange={(e) => {
                            const newTrans = [...transitions];
                            newTrans[i] = { ...newTrans[i]!, duration: parseFloat(e.target.value) };
                            setTransitions(newTrans);
                          }}
                          className="w-full accent-[#C9A227]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* ─── Panel: Couleur ─── */}
          {activeTab === "color" && (
            <Panel title="Étalonnage couleur">
              <div className="space-y-3">
                <Slider label="Luminosité" min={-1} max={1} step={0.05} value={colorAdjust.brightness}
                  onChange={(v) => setColorAdjust({ ...colorAdjust, brightness: v })} format={(v) => v.toFixed(2)} />
                <Slider label="Contraste" min={0} max={3} step={0.05} value={colorAdjust.contrast}
                  onChange={(v) => setColorAdjust({ ...colorAdjust, contrast: v })} format={(v) => v.toFixed(2)} />
                <Slider label="Saturation" min={0} max={3} step={0.05} value={colorAdjust.saturation}
                  onChange={(v) => setColorAdjust({ ...colorAdjust, saturation: v })} format={(v) => v.toFixed(2)} />
                <Slider label="Gamma" min={0.1} max={10} step={0.1} value={colorAdjust.gamma}
                  onChange={(v) => setColorAdjust({ ...colorAdjust, gamma: v })} format={(v) => v.toFixed(1)} />
                <button onClick={() => { setColorAdjust(DEFAULT_COLOR_ADJUST); pushHistory(); }}
                  className="w-full px-3 py-2 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold hover:bg-[#2A0E3D]/10 transition-colors">
                  Réinitialiser
                </button>
              </div>
            </Panel>
          )}

          {/* ─── Panel: Filtres ─── */}
          {activeTab === "filters" && (
            <Panel title="Filtres vidéo">
              <div className="grid grid-cols-3 gap-2">
                {VIDEO_FILTERS.map((f) => (
                  <button key={f.value} onClick={() => { setVideoFilter(f.value); pushHistory(); }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-colors ${videoFilter === f.value ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                    <span className="text-2xl">{f.icon}</span>
                    <span className="text-[10px] font-bold">{f.label}</span>
                  </button>
                ))}
              </div>
              {videoFilter !== "none" && (
                <button onClick={() => { setVideoFilter("none"); pushHistory(); }}
                  className="w-full mt-3 px-3 py-2 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold hover:bg-[#2A0E3D]/10 transition-colors">
                  Retirer le filtre
                </button>
              )}
            </Panel>
          )}

          {/* ─── Panel: Avancé (stabilisation + chroma key) ─── */}
          {activeTab === "advanced" && (
            <Panel title="Effets avancés">
              <div className="space-y-4">
                {/* Stabilisation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1"><Wind className="w-3.5 h-3.5" />Stabilisation</span>
                    <button onClick={() => setStabilisation({ ...stabilisation, enabled: !stabilisation.enabled })}
                      className={`w-9 h-5 rounded-full transition-colors ${stabilisation.enabled ? "bg-[#C9A227]" : "bg-[#8A8378]/30"}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${stabilisation.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {stabilisation.enabled && (
                    <>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Tremblement: {stabilisation.shakiness}/10</label>
                        <input type="range" min="1" max="10" value={stabilisation.shakiness}
                          onChange={(e) => setStabilisation({ ...stabilisation, shakiness: parseInt(e.target.value) })}
                          className="w-full accent-[#C9A227]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Lissage: {Math.round(stabilisation.smoothing * 100)}%</label>
                        <input type="range" min="0" max="1" step="0.1" value={stabilisation.smoothing}
                          onChange={(e) => setStabilisation({ ...stabilisation, smoothing: parseFloat(e.target.value) })}
                          className="w-full accent-[#C9A227]" />
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-[#8A8378]/15" />

                {/* Chroma key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1"><Eraser className="w-3.5 h-3.5" />Chroma Key (fond vert)</span>
                    <button onClick={() => setChromaKey({ ...chromaKey, enabled: !chromaKey.enabled })}
                      className={`w-9 h-5 rounded-full transition-colors ${chromaKey.enabled ? "bg-[#C9A227]" : "bg-[#8A8378]/30"}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${chromaKey.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {chromaKey.enabled && (
                    <>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Couleur de fond</label>
                        <input type="color" value={chromaKey.color}
                          onChange={(e) => setChromaKey({ ...chromaKey, color: e.target.value })}
                          className="w-full h-7 rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Similarité: {chromaKey.similarity.toFixed(2)}</label>
                        <input type="range" min="0.01" max="1" step="0.01" value={chromaKey.similarity}
                          onChange={(e) => setChromaKey({ ...chromaKey, similarity: parseFloat(e.target.value) })}
                          className="w-full accent-[#C9A227]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8A8378]">Fusion: {chromaKey.blend.toFixed(2)}</label>
                        <input type="range" min="0" max="1" step="0.05" value={chromaKey.blend}
                          onChange={(e) => setChromaKey({ ...chromaKey, blend: parseFloat(e.target.value) })}
                          className="w-full accent-[#C9A227]" />
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-[#8A8378]/15" />

                {/* Background removal IA — MediaPipe Selfie Segmentation */}
                <BgRemovalProcessor
                  videoRef={videoRef}
                  videoId={videoId}
                  onProcessed={(url) => setCurrentVideoUrl(url)}
                />
              </div>
            </Panel>
          )}

          {/* ─── Panel: Vitesse ─── */}
          {activeTab === "speed" && (
            <Panel title="Vitesse de lecture">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#8A8378] uppercase font-bold">Vitesse: {speed.factor.toFixed(2)}x</label>
                  <input type="range" min={0.25} max={4} step={0.25} value={speed.factor}
                    onChange={(e) => setSpeed({ factor: parseFloat(e.target.value) })}
                    className="w-full accent-[#C9A227]" />
                  <div className="flex justify-between text-[9px] text-[#8A8378] mt-1">
                    <span>0.25x</span><span>1x</span><span>4x</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 1, 1.5, 2].map((v) => (
                    <button key={v} onClick={() => setSpeed({ factor: v })}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${speed.factor === v ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                      {v}x
                    </button>
                  ))}
                </div>
                <button onClick={() => { setSpeed(DEFAULT_SPEED); pushHistory(); }}
                  className="w-full px-3 py-2 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold hover:bg-[#2A0E3D]/10 transition-colors">
                  Réinitialiser
                </button>
              </div>
            </Panel>
          )}

          {/* ─── Panel: Transform ─── */}
          {activeTab === "transform" && (
            <Panel title="Transformations">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#8A8378] uppercase font-bold">Rotation</label>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {[0, 90, 180, 270].map((r) => (
                      <button key={r} onClick={() => setTransform({ ...transform, rotate: r })}
                        className={`py-2 rounded-lg text-xs font-bold transition-colors ${transform.rotate === r ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                        {r}°
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTransform({ ...transform, flipH: !transform.flipH })}
                    className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${transform.flipH ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                    <FlipHorizontal className="w-3.5 h-3.5" /> Miroir H
                  </button>
                  <button onClick={() => setTransform({ ...transform, flipV: !transform.flipV })}
                    className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${transform.flipV ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                    <FlipVertical className="w-3.5 h-3.5" /> Miroir V
                  </button>
                </div>
                <button onClick={() => { setTransform(DEFAULT_TRANSFORM); pushHistory(); }}
                  className="w-full px-3 py-2 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold hover:bg-[#2A0E3D]/10 transition-colors">
                  Réinitialiser
                </button>
              </div>
            </Panel>
          )}

          {/* ─── Panel: Audio ─── */}
          {activeTab === "audio" && (
            <Panel title="Audio">
              <div className="space-y-3">
                {/* Volume principal */}
                <div>
                  <label className="text-[10px] text-[#8A8378] uppercase font-bold">Volume vidéo: {Math.round(mainVolume * 100)}%</label>
                  <input type="range" min={0} max={2} step={0.05} value={mainVolume}
                    onChange={(e) => setMainVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#C9A227]" />
                </div>

                {/* Voiceover */}
                <div className="border-t border-[#8A8378]/15 pt-3">
                  <p className="text-xs font-bold mb-2 flex items-center gap-1"><Mic className="w-3.5 h-3.5" />Voiceover</p>
                  {!isRecordingVoiceover ? (
                    <button onClick={startVoiceover} className="w-full py-2 rounded-lg bg-red-600/10 text-red-600 text-xs font-bold hover:bg-red-600/20 transition-colors flex items-center justify-center gap-1">
                      <Mic className="w-3.5 h-3.5" />Enregistrer
                    </button>
                  ) : (
                    <button onClick={stopVoiceover} className="w-full py-2 rounded-lg bg-red-600 text-white text-xs font-bold animate-pulse flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-white" />Arrêter
                    </button>
                  )}
                </div>

                {/* Musique de fond */}
                <div className="border-t border-[#8A8378]/15 pt-3">
                  <p className="text-xs font-bold mb-2 flex items-center gap-1"><Music className="w-3.5 h-3.5" />Musique de fond</p>
                  <button onClick={() => audioInputRef.current?.click()} className="w-full py-2 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                    <Upload className="w-3.5 h-3.5" />Importer musique
                  </button>
                  <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </div>

                {/* Liste des pistes audio */}
                {audioTracks.length > 0 && (
                  <div className="space-y-2 border-t border-[#8A8378]/15 pt-3">
                    {audioTracks.map((track) => (
                      <div key={track.id} className="bg-[#2A0E3D]/5 rounded-lg p-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-3 h-3 text-[#8A8378]" />
                          <span className="text-xs flex-1 truncate">{track.name}</span>
                          <button onClick={() => setAudioTracks(audioTracks.filter((t) => t.id !== track.id))} className="p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8A8378]">Volume: {Math.round(track.volume * 100)}%</label>
                          <input type="range" min={0} max={2} step={0.05} value={track.volume}
                            onChange={(e) => setAudioTracks(audioTracks.map((t) => t.id === track.id ? { ...t, volume: parseFloat(e.target.value) } : t))}
                            className="w-full accent-[#C9A227]" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* ─── Panel: Effets sonores ─── */}
          {activeTab === "sfx" && (
            <Panel title="Bibliothèque d'effets sonores">
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {(["transition", "impact", "nature", "ui", "crowd", "music"] as const).map((cat) => (
                  <div key={cat}>
                    <p className="text-[10px] text-[#8A8378] uppercase font-bold mb-1">{cat}</p>
                    <div className="space-y-1">
                      {SOUND_EFFECTS.filter((s) => s.category === cat).map((sfx) => (
                        <button key={sfx.id} onClick={() => addSoundEffect(sfx)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 transition-colors text-left">
                          <span className="text-lg">{sfx.icon}</span>
                          <span className="text-xs font-bold flex-1 truncate">{sfx.name}</span>
                          <span className="text-[10px] text-[#8A8378]">{sfx.duration}s</span>
                          <Plus className="w-3 h-3 text-[#C9A227]" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* ─── Panel: Export ─── */}
          {activeTab === "export" && (
            <Panel title="Paramètres d'export">
              <div className="space-y-4">
                {/* Miniature */}
                <div>
                  <p className="text-xs font-bold mb-2">Miniature</p>
                  {thumbnail ? (
                    <div className="relative rounded-lg overflow-hidden">
                      <img src={thumbnail} alt="" className="w-full aspect-video object-cover" />
                      <button onClick={() => { setThumbnail(null); pushHistory(); }} className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => thumbnailInputRef.current?.click()} className="w-full aspect-video rounded-lg border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                      <Upload className="w-4 h-4" />Uploader
                    </button>
                  )}
                  <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                </div>

                {/* Format */}
                <div>
                  <p className="text-xs font-bold mb-2">Format</p>
                  <div className="grid grid-cols-3 gap-1">
                    {ASPECT_RATIOS.map((ar) => (
                      <button key={ar.value} onClick={() => setExportConfig({ ...exportConfig, aspectRatio: ar.value })}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-colors ${exportConfig.aspectRatio === ar.value ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                        <span className="text-base block">{ar.icon}</span>
                        {ar.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Résolution */}
                <div>
                  <p className="text-xs font-bold mb-2">Résolution</p>
                  <div className="grid grid-cols-2 gap-1">
                    {RESOLUTIONS.map((res) => (
                      <button key={res.value} onClick={() => setExportConfig({ ...exportConfig, resolution: res.value })}
                        className={`py-2 rounded-lg text-xs font-bold transition-colors ${exportConfig.resolution === res.value ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Qualité */}
                <div>
                  <label className="text-[10px] text-[#8A8378] uppercase font-bold">Qualité (CRF): {exportConfig.crf || 23}</label>
                  <input type="range" min={18} max={28} value={exportConfig.crf || 23}
                    onChange={(e) => setExportConfig({ ...exportConfig, crf: parseInt(e.target.value) })}
                    className="w-full accent-[#C9A227]" />
                  <div className="flex justify-between text-[9px] text-[#8A8378] mt-1">
                    <span>Haute (18)</span><span>Standard (23)</span><span>Léger (28)</span>
                  </div>
                </div>

                {/* FPS */}
                <div>
                  <p className="text-xs font-bold mb-2">Images/seconde</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[24, 30, 60].map((fps) => (
                      <button key={fps} onClick={() => setExportConfig({ ...exportConfig, fps })}
                        className={`py-2 rounded-lg text-xs font-bold transition-colors ${exportConfig.fps === fps ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                        {fps}
                      </button>
                    ))}
                    <button onClick={() => setExportConfig({ ...exportConfig, fps: undefined })}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors ${!exportConfig.fps ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10"}`}>
                      Auto
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ─── Collaboration temps réel ─── */}
      {collabEnabled && showCollabPanel && (
        <CollaborationPanel
          collaborators={collabUsers}
          isConnected={collabConnected}
          chatMessages={collabMessages}
          onSendChat={collabSendChat}
          onClose={() => setShowCollabPanel(false)}
        />
      )}

      {/* Curseurs des collaborateurs sur le preview */}
      {collabEnabled && (
        <CollaboratorCursors collaborators={collabUsers} />
      )}
    </div>
  );
}

// ─── Composants réutilisables ───

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 space-y-3 border border-[#8A8378]/15">
      <h3 className="text-xs uppercase tracking-wider font-bold text-[#8A8378]">{title}</h3>
      {children}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format }: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div>
      <label className="text-[10px] text-[#8A8378] uppercase font-bold">{label}: {format(value)}</label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#C9A227]" />
    </div>
  );
}
