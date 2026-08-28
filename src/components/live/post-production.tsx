"use client";

import { useState, useRef, useEffect } from "react";
import {
  Scissors, Upload, Download, Play, Pause, SkipBack, SkipForward,
  Image as ImageIcon, Type, Film, Plus, Trash2, Loader2,
  Layers, Video as VideoIcon,
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
  duration: number;
  src?: string;
  text?: string;
  color: string;
}

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoUrl) return;
    const onLoadedMetadata = () => {
      setTrimEnd(video.duration);
      setTotalDuration(video.duration);
      setTimeline((prev) => prev.map((clip) => clip.type === "main" ? { ...clip, duration: video.duration } : clip));
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, [currentVideoUrl]);

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
          label: type === "intro" ? "Teaser Intro" : "Teaser Outro",
          duration: video.duration, src,
          color: type === "intro" ? "#C9A227" : "#8C5FA8",
        };
        if (type === "intro") setTimeline((prev) => [newClip, ...prev]);
        else setTimeline((prev) => [...prev, newClip]);
        setTotalDuration((prev) => prev + video.duration);
      };
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setThumbnail(event.target?.result as string); };
    reader.readAsDataURL(file);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  };

  const deleteClip = (id: string) => {
    const clip = timeline.find((c) => c.id === id);
    if (clip && clip.type !== "main") {
      setTimeline((prev) => prev.filter((c) => c.id !== id));
      setTotalDuration((prev) => prev - clip.duration);
    }
  };

  const [exportProgress, setExportProgress] = useState<string[]>([]);
  const [exportError, setExportError] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(videoUrl);
  const videoUploadRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    setExportProgress(["Initialisation du rendu..."]);
    try {
      const introClip = timeline.find((c) => c.type === "intro");
      const outroClip = timeline.find((c) => c.type === "outro");
      const res = await fetch(`/api/videos/${videoId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimStart: trimStart > 0 ? trimStart : undefined,
          trimEnd: trimEnd < totalDuration ? trimEnd : undefined,
          introUrl: introClip?.src,
          outroUrl: outroClip?.src,
          thumbnailUrl: thumbnail,
          title: title,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Erreur de rendu"); }
      const data = await res.json();
      setExportProgress(data.steps || ["Terminé"]);
      if (data.videoUrl) setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setExporting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadError("Veuillez sélectionner un fichier vidéo (MP4, WebM, etc.)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError(`Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)}MB — max 4MB)`);
      return;
    }
    setUploadingVideo(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/videos/${videoId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur upload");
      }
      const data = await res.json();
      setCurrentVideoUrl(data.videoUrl);
      // Recharger pour que le composant vidéo prenne en compte la nouvelle source
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setUploadingVideo(false);
      if (videoUploadRef.current) videoUploadRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="border-b border-[#8A8378]/15 px-6 py-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-[#1E0F2B]">
              <Film className="w-5 h-5 text-[#C9A227]" />Post-production
            </h1>
            <p className="text-xs text-[#8A8378] mt-1">{title} — {servantName}</p>
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors disabled:opacity-40 shadow-md">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Rendu en cours..." : "Exporter"}
          </button>
        </div>
      </div>

      {(exporting || exportProgress.length > 0 || exportError) && (
        <div className="px-6 pb-4">
          <div className={`rounded-xl p-4 ${exportError ? "bg-red-50 border border-red-200" : "bg-[#2A0E3D]/5 border border-[#C9A227]/20"}`}>
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

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 p-4">
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
            {currentVideoUrl ? (
              <video ref={videoRef} src={currentVideoUrl} className="w-full h-full object-contain"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-[#2A0E3D] to-[#1A0826] text-center p-8">
                {uploadingVideo ? (
                  <Loader2 className="w-12 h-12 text-[#C9A227] mx-auto mb-3 animate-spin" />
                ) : (
                  <VideoIcon className="w-12 h-12 text-[#C9A227]/60 mx-auto mb-3" />
                )}
                <p className="text-sm font-bold text-[#FAF6EF] mb-1">
                  {uploadingVideo ? "Upload en cours..." : "Aucune vidéo source"}
                </p>
                <p className="text-xs text-[#FAF6EF]/50 max-w-sm mb-4">
                  {uploadingVideo
                    ? "Veuillez patienter pendant l'upload du replay..."
                    : "Uploadez le replay enregistré (format MP4 ou WebM, max 4MB)"}
                </p>
                {!uploadingVideo && (
                  <button
                    onClick={() => videoUploadRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Uploader le replay
                  </button>
                )}
                {uploadError && (
                  <p className="text-xs text-red-400 mt-3 max-w-sm">{uploadError}</p>
                )}
                <input
                  ref={videoUploadRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </div>
            )}
            {thumbnail && activeTab === "thumbnail" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail} alt="thumbnail" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 bg-white rounded-xl p-3 border border-[#8A8378]/15">
            <button onClick={() => handleSeek(Math.max(trimStart, currentTime - 10))} className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 text-[#1E0F2B] transition-colors" disabled={!currentVideoUrl}>
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="p-3 rounded-full bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors disabled:opacity-40" disabled={!currentVideoUrl}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => handleSeek(Math.min(trimEnd, currentTime + 10))} className="p-2 rounded-lg hover:bg-[#2A0E3D]/5 text-[#1E0F2B] transition-colors" disabled={!currentVideoUrl}>
              <SkipForward className="w-5 h-5" />
            </button>
            <span className="text-xs text-[#8A8378] ml-2">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
          </div>

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

        {/* Tools */}
        <div className="space-y-3">
          <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#8A8378]/15">
            <button onClick={() => setActiveTab("trim")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "trim" ? "bg-[#2A0E3D] text-white" : "text-[#8A8378] hover:text-[#1E0F2B]"}`}>
              <Scissors className="w-3.5 h-3.5 inline" />
            </button>
            <button onClick={() => setActiveTab("intro-outro")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "intro-outro" ? "bg-[#2A0E3D] text-white" : "text-[#8A8378] hover:text-[#1E0F2B]"}`}>
              <Film className="w-3.5 h-3.5 inline" />
            </button>
            <button onClick={() => setActiveTab("overlay")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "overlay" ? "bg-[#2A0E3D] text-white" : "text-[#8A8378] hover:text-[#1E0F2B]"}`}>
              <ImageIcon className="w-3.5 h-3.5 inline" />
            </button>
            <button onClick={() => setActiveTab("thumbnail")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "thumbnail" ? "bg-[#2A0E3D] text-white" : "text-[#8A8378] hover:text-[#1E0F2B]"}`}>
              <Type className="w-3.5 h-3.5 inline" />
            </button>
          </div>

          {activeTab === "trim" && (
            <div className="bg-white rounded-xl p-4 space-y-3 border border-[#8A8378]/15">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#8A8378]">Découpage</h3>
              <p className="text-xs text-[#1E0F2B]/70 leading-relaxed">Ajustez le début et la fin du replay. Les zones rouges sur la timeline indiquent les parties qui seront supprimées.</p>
              <div className="flex gap-2">
                <button onClick={() => setTrimStart(currentTime)} className="flex-1 px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#A3821C] text-xs font-bold hover:bg-[#C9A227]/30 transition-colors" disabled={!currentVideoUrl}>Définir début</button>
                <button onClick={() => setTrimEnd(currentTime)} className="flex-1 px-3 py-2 rounded-lg bg-[#C9A227]/20 text-[#A3821C] text-xs font-bold hover:bg-[#C9A227]/30 transition-colors" disabled={!currentVideoUrl}>Définir fin</button>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[#2A0E3D]/5">
                <p className="text-xs text-[#1E0F2B]/70">Durée finale : <span className="font-bold text-[#1E0F2B]">{formatTime(trimEnd - trimStart)}</span></p>
                <p className="text-xs text-[#8A8378]">Supprimé : {formatTime(trimStart)} au début + {formatTime(totalDuration - trimEnd)} à la fin</p>
              </div>
            </div>
          )}

          {activeTab === "intro-outro" && (
            <div className="bg-white rounded-xl p-4 space-y-3 border border-[#8A8378]/15">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#8A8378]">Teaser Intro / Outro</h3>
              <p className="text-xs text-[#1E0F2B]/70 leading-relaxed">Ajoutez une vidéo d'intro et d'outro qui seront concaténées avec le replay.</p>
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                <Upload className="w-4 h-4" />Uploader un teaser
              </button>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { handleUploadClip("intro")(e); }} />
              <div className="space-y-2">
                {timeline.filter((c) => c.type === "intro" || c.type === "outro").map((clip) => (
                  <div key={clip.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A0E3D]/5">
                    <Film className="w-3.5 h-3.5" style={{ color: clip.color }} />
                    <span className="text-xs flex-1 truncate text-[#1E0F2B]">{clip.label}</span>
                    <span className="text-[10px] text-[#8A8378]">{formatTime(clip.duration)}</span>
                    <button onClick={() => deleteClip(clip.id)} className="p-1 rounded hover:bg-red-600/20 text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "overlay" && (
            <div className="bg-white rounded-xl p-4 space-y-3 border border-[#8A8378]/15">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#8A8378]">Images & Texte</h3>
              <p className="text-xs text-[#1E0F2B]/70 leading-relaxed">Ajoutez des images ou du texte par-dessus la vidéo.</p>
              <button className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                <Plus className="w-4 h-4" />Ajouter une image
              </button>
              <button className="w-full py-3 rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                <Type className="w-4 h-4" />Ajouter du texte
              </button>
              <p className="text-[10px] text-[#8A8378] italic">Bientôt disponible — nécessite FFmpeg serveur</p>
            </div>
          )}

          {activeTab === "thumbnail" && (
            <div className="bg-white rounded-xl p-4 space-y-3 border border-[#8A8378]/15">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[#8A8378]">Miniature</h3>
              <p className="text-xs text-[#1E0F2B]/70 leading-relaxed">Changez la miniature affichée dans le module vidéo.</p>
              {thumbnail ? (
                <div className="relative rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnail} alt="miniature" className="w-full aspect-video object-cover" />
                  <button onClick={() => setThumbnail(null)} className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => thumbnailInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-[#8A8378]/30 hover:border-[#C9A227] flex items-center justify-center gap-2 text-xs text-[#8A8378] hover:text-[#C9A227] transition-colors">
                  <Upload className="w-4 h-4" />Uploader une miniature
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
