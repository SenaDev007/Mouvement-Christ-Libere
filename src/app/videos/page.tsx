"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Play, Eye, ChevronRight, ChevronDown, ChevronLeft,
  Calendar, Video as VideoIcon, ThumbsUp, Share2, Search,
  X, Check, Link2, MessageCircle, Facebook, Twitter, Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  category: string;
  servant: "pam" | "kongo";
  servantName: string;
  thumbnailUrl?: string;
  likes?: number;
}

interface VideoCategory {
  id: string;
  name: string;
  servant: "pam" | "kongo";
  videos: VideoItem[];
}

type ServantTab = "pam" | "kongo";

function getCategoriesFromVideos(videos: VideoItem[], servant: "pam" | "kongo"): VideoCategory[] {
  const filtered = videos.filter(v => v.servant === servant);
  const catsMap = new Map<string, VideoItem[]>();
  for (const v of filtered) {
    if (!catsMap.has(v.category)) catsMap.set(v.category, []);
    catsMap.get(v.category)!.push(v);
  }
  return Array.from(catsMap.entries()).map(([name, vs], i) => ({
    id: `${servant}-cat-${i}`, name, servant, videos: vs,
  }));
}

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState<ServantTab>("pam");
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/videos")
      .then(r => r.json())
      .then(data => { setAllVideos(data.videos || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return allVideos;
    const q = searchQuery.toLowerCase();
    return allVideos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q)
    );
  }, [allVideos, searchQuery]);

  const pamCategories = useMemo(() => getCategoriesFromVideos(filteredVideos, "pam"), [filteredVideos]);
  const kongoCategories = useMemo(() => getCategoriesFromVideos(filteredVideos, "kongo"), [filteredVideos]);
  const currentCategories = activeTab === "pam" ? pamCategories : kongoCategories;
  const currentVideos = activeTab === "pam"
    ? filteredVideos.filter(v => v.servant === "pam")
    : filteredVideos.filter(v => v.servant === "kongo");

  if (currentVideo) {
    return (
      <VideoPlayerView
        video={currentVideo}
        allVideos={currentVideos}
        onBack={() => setCurrentVideo(null)}
        onSelectVideo={(v) => { setCurrentVideo(v); window.scrollTo(0, 0); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* HERO compact */}
      <section className="bg-[#2A0E3D] pt-24 pb-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-3">
            <VideoIcon className="w-5 h-5 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227]">Vidéos & Lives</span>
          </div>
          <h1 className="font-bold text-2xl md:text-3xl text-[#FAF6EF] mb-2">
            Enseignements vidéo & directs
          </h1>
          <p className="text-sm text-[#FAF6EF]/60 mb-4">
            {allVideos.length} vidéos · Cliquez pour regarder directement sur la plateforme
          </p>
        </div>
      </section>

      {/* BARRE DE RECHERCHE + ONGLETS (style YouTube) */}
      <section className="sticky top-16 md:top-20 z-30 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Onglets serviteurs */}
            <div className="flex items-center gap-2">
              <ServantTabButton active={activeTab === "pam"} onClick={() => setActiveTab("pam")} name="Pam" count={allVideos.filter(v => v.servant === "pam").length} photo="/pam.jpeg" />
              <ServantTabButton active={activeTab === "kongo"} onClick={() => setActiveTab("kongo")} name="Pasteur Kongo" count={allVideos.filter(v => v.servant === "kongo").length} photo="/pasteur-kongo.jpeg" />
            </div>

            {/* Barre de recherche */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une vidéo..."
                className="w-full pl-9 pr-4 py-2 rounded-full border border-[#8A8378]/25 bg-white text-sm text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/20"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#8A8378]/10">
                  <X className="w-3.5 h-3.5 text-[#8A8378]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* VIDÉOS PAR CATÉGORIE */}
      <section className="py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#8A8378]">Aucune vidéo ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentCategories.map((category) => {
                const isExpanded = expandedCategories.size === 0 || expandedCategories.has(category.id);
                return (
                  <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/15 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-[#C9A227]/3 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2A0E3D]/5 border border-[#C9A227]/20">
                          <VideoIcon className="w-4 h-4 text-[#C9A227]" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-base text-[#1E0F2B] group-hover:text-[#C9A227] transition-colors">{category.name}</h3>
                          <p className="text-xs text-[#8A8378]">{category.videos.length} vidéo{category.videos.length > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-[#8A8378] transition-transform", isExpanded && "rotate-180")} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[#8A8378]/10 p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {category.videos.map((video) => (
                          <YouTubeStyleCard key={video.id} video={video} onClick={() => { setCurrentVideo(video); window.scrollTo(0, 0); }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section bas : citation */}
      <section className="py-12 bg-[#2A0E3D]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Play className="w-8 h-8 text-[#C9A227] mx-auto mb-4 opacity-40" />
          <p className="text-lg italic text-[#FAF6EF]/80 leading-relaxed mb-2">
            « Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe. »
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">Christ Libère</p>
        </div>
      </section>
    </div>
  );

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }
}

// ============================================================
// VUE LECTEUR VIDÉO (style YouTube)
// ============================================================
function VideoPlayerView({ video, allVideos, onBack, onSelectVideo }: {
  video: VideoItem;
  allVideos: VideoItem[];
  onBack: () => void;
  onSelectVideo: (v: VideoItem) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const servantName = video.servant === "pam" ? "Pam" : "Pasteur Kongo";
  const servantPhoto = video.servant === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg";
  const recommended = allVideos.filter(v => v.id !== video.id).slice(0, 15);

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await fetch(`/api/videos/${video.id}/like`, { method: "POST" });
    } catch {}
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://mouvement-christ-libere.vercel.app/videos?v=${video.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const shareUrl = encodeURIComponent(`https://mouvement-christ-libere.vercel.app/videos`);
  const shareTitle = encodeURIComponent(video.title);

  const shareLinks = [
    { name: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${shareTitle}%20${shareUrl}`, color: "#25D366" },
    { name: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, color: "#1877F2" },
    { name: "Twitter", icon: Twitter, href: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`, color: "#000000" },
    { name: "Instagram", icon: Instagram, href: `https://www.instagram.com/`, color: "#833AB4" },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6EF] pt-20 md:pt-24">
      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">
          {/* Colonne principale */}
          <div className="min-w-0">
            {/* Bouton retour en HAUT */}
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour à la liste
            </button>

            {/* Lecteur YouTube */}
            <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            {/* Titre */}
            <h1 className="font-bold text-lg md:text-xl text-[#1E0F2B] leading-snug mt-3 mb-2">
              {video.title}
            </h1>

            {/* Barre actions (style YouTube) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#8A8378]/15">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#C9A227]/30 flex-shrink-0">
                  <Image src={servantPhoto} alt={servantName} width={36} height={36} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1E0F2B]">{servantName}</p>
                  <p className="text-xs text-[#8A8378]">{video.category}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Bouton J'aime */}
                <button
                  onClick={handleLike}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                    liked
                      ? "bg-[#C9A227] text-[#1E0F2B]"
                      : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"
                  )}
                >
                  <ThumbsUp className={cn("w-3.5 h-3.5", liked && "fill-current")} style={{ color: liked ? "#1E0F2B" : "#C9A227" }} />
                  {likeCount > 0 ? likeCount.toLocaleString("fr-FR") : "J'aime"}
                </button>

                {/* Bouton Partager */}
                <div className="relative">
                  <button
                    onClick={() => setShowShare(!showShare)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                    Partager
                  </button>

                  {/* Dropdown partage */}
                  {showShare && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-[#8A8378]/15 p-3 z-50 min-w-[200px]">
                      <p className="text-xs font-bold text-[#8A8378] uppercase tracking-wider mb-2">Partager sur</p>
                      <div className="flex items-center gap-2 mb-2">
                        {shareLinks.map((link) => {
                          const Icon = link.icon;
                          return (
                            <a
                              key={link.name}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={link.name}
                              className="flex items-center justify-center w-9 h-9 rounded-lg border transition-all hover:scale-110"
                              style={{ borderColor: `${link.color}30`, color: link.color }}
                            >
                              <Icon className="w-4 h-4" />
                            </a>
                          );
                        })}
                      </div>
                      {/* Copier le lien */}
                      <button
                        onClick={handleCopy}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                          copied
                            ? "bg-[#5B7052] text-white"
                            : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"
                        )}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                        {copied ? "Lien copié !" : "Copier le lien"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-3 p-3 bg-[#2A0E3D]/5 rounded-xl border border-[#8A8378]/10">
              <div className="flex items-center gap-3 text-xs text-[#8A8378] mb-2">
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                  {video.views > 0 ? `${video.views.toLocaleString("fr-FR")} vues` : "Nouveau"}
                </span>
                {video.publishedAt && video.publishedAt !== "2024-01-01" && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                    {new Date(video.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#1E0F2B]/80 leading-relaxed">{video.description}</p>
            </div>
          </div>

          {/* Sidebar : vidéos recommandées (scrollable style YouTube) */}
          <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:sticky lg:top-24 space-y-2 pb-4">
            <h3 className="font-bold text-xs text-[#1E0F2B] uppercase tracking-wider mb-2 sticky top-0 bg-[#FAF6EF] py-2 z-10">
              Vidéos recommandées
            </h3>
            {recommended.map((rec) => (
              <button
                key={rec.id}
                onClick={() => onSelectVideo(rec)}
                className="group flex gap-2.5 w-full text-left hover:bg-[#2A0E3D]/5 rounded-lg p-1.5 transition-colors"
              >
                <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[#1A0826]">
                  <img
                    src={rec.thumbnailUrl || `https://img.youtube.com/vi/${rec.youtubeId}/mqdefault.jpg`}
                    alt={rec.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1E0F2B] line-clamp-2 group-hover:text-[#C9A227] transition-colors leading-snug mb-1">
                    {rec.title}
                  </p>
                  <p className="text-[10px] text-[#8A8378]">{rec.servantName}</p>
                  <p className="text-[10px] text-[#8A8378]">{rec.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CARTE VIDÉO STYLE YOUTUBE
// ============================================================
function YouTubeStyleCard({ video, onClick }: { video: VideoItem; onClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.3 }}>
      <button onClick={onClick} className="group block w-full text-left">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1A0826] mb-2.5">
          <img
            src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#C9A227] shadow-lg">
              <Play className="w-5 h-5 text-[#1E0F2B] ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#C9A227]/20 flex-shrink-0">
            <Image src={video.servant === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg"} alt={video.servantName} width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#1E0F2B] leading-snug line-clamp-2 group-hover:text-[#C9A227] transition-colors mb-0.5">{video.title}</h3>
            <p className="text-xs text-[#8A8378]">{video.servantName}</p>
            <p className="text-xs text-[#8A8378]/70">{video.category}</p>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ============================================================
// ONGLET SERVITEUR
// ============================================================
function ServantTabButton({ active, onClick, name, count, photo }: {
  active: boolean; onClick: () => void; name: string; count: number; photo: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 px-4 py-2 rounded-full font-bold transition-all duration-300",
        active ? "bg-[#2A0E3D] text-[#FAF6EF] shadow-md" : "bg-white text-[#1E0F2B] border border-[#8A8378]/20 hover:border-[#C9A227]/40"
      )}
    >
      <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-[#C9A227]/30">
        <Image src={photo} alt={name} width={28} height={28} className="w-full h-full object-cover" />
      </div>
      <span className="text-sm">{name}</span>
      <span className={cn("text-[10px] font-semibold", active ? "text-[#C9A227]" : "text-[#8A8378]")}>{count}</span>
    </button>
  );
}
