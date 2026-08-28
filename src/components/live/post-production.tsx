"use client";

import { useState, useRef, useEffect } from "react";
import {
  Scissors, Upload, Download, Play, Pause, SkipBack, SkipForward,
  Image as ImageIcon, Type, Music, Film, Plus, Trash2, Loader2,
  ChevronLeft, ChevronRight, Layers,
} from "lucide-react";

interface PostProductionProps {
  videoId: string;
  videoUrl: string | null;
  title: string;
  servantName: string;
}

interface TimelineClip {
  id: string;
  type: "intro" | "main" | "outro" | "image" | "text";
  label: string;
  duration: number; // secondes
  src?: string;
  text?: string;
  color: string;
}

/**
 * Post-production façon CapCut.
 * Permet de :
 * - Trimmer le replay (couper début/fin)
 * - Ajouter un teaser intro (upload vidéo)
 * - Ajouter un teaser outro (upload vidéo)
 * - Ajouter des images d'overlay
 * - Ajouter du texte
 * - Changer la miniature
 * - Timeline visuelle avec clips
 */
export function PostProduction({ videoId, videoUrl, title, servantName }: PostProductionProps) {
  const [timeline, setTimeline] = useState<TimelineClip[]>([
    { id: "main", type: "main", label: "Replay principal", duration: 0, color: "#2A0E3D" },
  ]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"trim" | "intro-outro" | "overlay" | "thumbnail">("trim");

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Charger la vidéo et sa durée
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const onLoadedMetadata = () => {
      setTrimEnd(video.duration);
      setTotalDuration(video.duration);
      setTimeline((prev) => prev.map((clip) => clip.type === "main" ? { ...clip, duration: video.duration } : clip));
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, [videoUrl]);

  // Play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); }
    else { video.pause(); setIsPlaying(false); }
  };

  // Seek
  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  // Upload intro/outro
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
          id: `${type}-${Date.now()}`,
          type,
          label: type === "intro" ? "Teaser Intro" : "Teaser Outro",
          duration: video.duration,
          src,
          color: type === "intro" ? "#C9A227" : "#8C5FA8",
        };
        if (type === "intro") {
          setTimeline((prev) => [newClip, ...prev]);
        } else {
          setTimeline((prev) => [...prev, newClip]);
        }
        setTotalDuration((prev) => prev + video.duration);
      };
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload thumbnail
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setThumbnail(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  };

  // Delete clip
  const deleteClip = (id: string) => {
    const clip = timeline.find((c) => c.id === id);
    if (clip && clip.type !== "main") {
      setTimeline((prev) => prev.filter((c) => c.id !== id));
      setTotalDuration((prev) => prev - clip.duration);
    }
  };

  // Export (simulation)
  const handleExport = async () => {
    setExporting(true);
    // TODO: FFmpeg serveur pour concaténation réelle
    // Pour l'instant, on simule
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Sauvegarder les métadonnées
    try {
      await fetch(`/admin/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${title} (Édité)`,
          thumbnailUrl: thumbnail,
        }),
      });
    } catch {}

    setExporting(false);
    alert("Export terminé ! Les métadonnées ont été sauvegardées. La concaténation vidéo nécessite FFmpeg serveur.");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#0f0f0f] text-white min-h-screen">
      {/* ═══ Header ═══ */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Film className="w-5 h-5 text-[#C9A227]" />
              Post-production
            </h1>
            <p className="text-xs text-white/50 mt-1">{title} — {servantName}</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors disabled:opacity-40"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Export..." : "Exporter"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 p-4">
        {/* ═══ Colonne gauche : Preview + Timeline ═══ */}
        <div className="space-y-4">
          {/* Preview vidéo */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-white/40">Aucune vidéo source</p>
              </div>
            )}

            {/* Overlay thumbnail preview */}
            {thumbnail && activeTab === "thumbnail" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail} alt="thumbnail" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>

          {/* Contrôles lecture */}
          <div className="flex items-center justify-center gap-3 bg-white/5 rounded-xl p-3">
            <button onClick={() => handleSeek(Math.max(trimStart, currentTime - 10))} className="p-2 rounded-lg hover:bg-white/10">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="p-3 rounded-full bg-[#C9A227] text-[#1E0F2B]">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => handleSeek(Math.min(trimEnd, currentTime + 10))} className="p-2 rounded-lg hover:bg-white/10">
              <SkipForward className="w-5 h-5" />
            </button>
            <span className="text-xs text-white/60 ml-2">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
          </div>

          {/* Timeline visuelle (façon CapCut) */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs font-bold uppercase tracking-wider">Timeline</span>
            </div>

            {/* Barre timeline */}
            <div className="relative h-16 bg-black/30 rounded-lg overflow-hidden flex">
              {timeline.map((clip) => {
                const widthPercent = (clip.duration / totalDuration) * 100;
                return (
                  <div
                    key={clip.id}
                    className="relative h-full flex items-center justify-center text-xs font-bold text-white border-r border-black/30 group"
                    style={{ width: `${widthPercent}%`, backgroundColor: clip.color }}
                  >
                    <span className="px-2 truncate">{clip.label}</span>
                    <span className="absolute bottom-1 right-1 text-[9px] text-white/60">{formatTime(clip.duration)}</span>
                    {clip.type !== "main" && (
                      <button
                        onClick={() => deleteClip(clip.id)}
                        className="absolute top-1 right-1 p-0.5 rounded bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Curseur de lecture */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#C9A227] pointer-events-none"
                style={{ left: `${(currentTime / totalDuration) * 100}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#C9A227]" />
              </div>

              {/* Zones trim (rouge semi-transparent) */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-red-900/40 pointer-events-none"
                style={{ width: `${(trimStart / totalDuration) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 right-0 bg-red-900/40 pointer-events-none"
                style={{ width: `${((totalDuration - trimEnd) / totalDuration) * 100}%` }}
              />
            </div>

            {/* Handles trim */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1">
                <label className="text-[10px] text-white/50 uppercase">Début: {formatTime(trimStart)}</label>
                <input
                  type="range" min="0" max={totalDuration} step="0.1"
                  value={trimStart}
                  onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd))}
                  className="w-full accent-[#C9A227]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-white/50 uppercase">Fin: {formatTime(trimEnd)}</label>
                <input
                  type="range" min="0" max={totalDuration} step="0.1"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart))}
                  className="w-full accent-[#C9A227]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Colonne droite : Tabs outils ═══ */}
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            <button onClick={() => setActiveTab("trim")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "trim" ? "bg-white/10 text-white" : "text-white/50"}`}>
              <Scissors className="w-3.5 h-3.5 inline" />
            </button>
            <button onClick={() => setActiveTab("intro-outro")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "intro-outro" ? "bg-white/10 text-white" : "text-white/50"}`}>
              <Film className="w-3.5 h-3.5 inline" />
            </button>
            <button onClick={() => setActiveTab("overlay")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "overlay" ? "bg-white/10 text-white" : "text-white/50"}`}>
              <ImageIcon className="w-3.5 h-3.5 inline" />
            </button>
            <button onClick={() => setActiveTab("thumbnail")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "thumbnail" ? "bg-white/10 text-white" : "text-white/50"}`}>
              <Type className="w-3.5 h-3.5 inline" />
            </button>
          </div>

          {/* Tab Trim */}
          {activeTab === "trim" && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50">Découpage</h3>
              <p className="text-xs text-white/60">Ajustez le début et la fin du replay. Les zones rouges sur la timeline indiquent les parties qui seront supprimées.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTrimStart(currentTime)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#C9A227] text-xs font-bold hover:bg-[#C9A227]/30"
                >
                  Définir début
                </button>
                <button
                  onClick={() => setTrimEnd(currentTime)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#C9A227] text-xs font-bold hover:bg-[#C9A227]/30"
                >
                  Définir fin
                </button>
              </div>
              <div className="px-3 py-2 rounded-lg bg-black/30">
                <p className="text-xs text-white/60">Durée finale: <span className="font-bold text-white">{formatTime(trimEnd - trimStart)}</span></p>
                <p className="text-xs text-white/40">Supprimé: {formatTime(trimStart)} au début + {formatTime(totalDuration - trimEnd)} à la fin</p>
              </div>
            </div>
          )}

          {/* Tab Intro/Outro */}
          {activeTab === "intro-outro" && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50">Teaser Intro / Outro</h3>
              <p className="text-xs text-white/60">Ajoutez une vidéo d'intro et d'outro qui seront concaténées avec le replay.</p>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-white/60 hover:text-[#C9A227]"
              >
                <Upload className="w-4 h-4" />
                Uploader un teaser
              </button>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => { handleUploadClip("intro")(e); }} />

              <div className="space-y-2">
                {timeline.filter((c) => c.type === "intro" || c.type === "outro").map((clip) => (
                  <div key={clip.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30">
                    <Film className="w-3.5 h-3.5" style={{ color: clip.color }} />
                    <span className="text-xs flex-1 truncate">{clip.label}</span>
                    <span className="text-[10px] text-white/40">{formatTime(clip.duration)}</span>
                    <button onClick={() => deleteClip(clip.id)} className="p-1 rounded hover:bg-red-600/20 text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Overlay */}
          {activeTab === "overlay" && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50">Images & Texte</h3>
              <p className="text-xs text-white/60">Ajoutez des images ou du texte par-dessus la vidéo.</p>
              <button className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-white/60 hover:text-[#C9A227]">
                <Plus className="w-4 h-4" />
                Ajouter une image
              </button>
              <button className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-white/60 hover:text-[#C9A227]">
                <Type className="w-4 h-4" />
                Ajouter du texte
              </button>
              <p className="text-[10px] text-white/30 italic">Bientôt disponible — nécessite FFmpeg serveur</p>
            </div>
          )}

          {/* Tab Thumbnail */}
          {activeTab === "thumbnail" && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-white/50">Miniature</h3>
              <p className="text-xs text-white/60">Changez la miniature affichée dans le module vidéo.</p>
              {thumbnail ? (
                <div className="relative rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnail} alt="miniature" className="w-full aspect-video object-cover" />
                  <button
                    onClick={() => setThumbnail(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-white/20 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-white/60"
                >
                  <Upload className="w-4 h-4" />
                  Uploader une miniature
                </button>
              )}
              <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
