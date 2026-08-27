"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Play, Eye, ChevronRight, ChevronDown,
  Calendar, Video as VideoIcon, ThumbsUp, Share2, Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface VideoCategory {
  id: string;
  name: string;
  description: string;
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
    id: `${servant}-cat-${i}`,
    name,
    description: "",
    servant,
    videos: vs,
  }));
}

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState<ServantTab>("pam");
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/videos")
      .then(r => r.json())
      .then(data => {
        setAllVideos(data.videos || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pamCategories = useMemo(() => getCategoriesFromVideos(allVideos, "pam"), [allVideos]);
  const kongoCategories = useMemo(() => getCategoriesFromVideos(allVideos, "kongo"), [allVideos]);

  const currentCategories = activeTab === "pam" ? pamCategories : kongoCategories;
  const currentVideos = activeTab === "pam"
    ? allVideos.filter(v => v.servant === "pam")
    : allVideos.filter(v => v.servant === "kongo");

  // Si une vidéo est sélectionnée, afficher le mode lecteur YouTube
  if (currentVideo) {
    return (
      <VideoPlayerView
        video={currentVideo}
        allVideos={currentVideos}
        onBack={() => setCurrentVideo(null)}
        onSelectVideo={(v) => setCurrentVideo(v)}
      />
    );
  }

  // Mode grille (liste des vidéos par catégories)
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* HERO */}
      <section className="relative min-h-[40vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1920&auto=format&fit=crop"
            alt="Vidéos & Lives"
            fill
            priority
            className="object-cover opacity-25"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/70 via-[#2A0E3D]/80 to-[#1A0826]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <VideoIcon className="w-5 h-5 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
              Vidéos & Lives
            </span>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-[#FAF6EF] leading-tight mb-4 drop-shadow-lg">
            Enseignements vidéo <span className="text-[#C9A227]">& directs</span>
          </h1>
          <p className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto">
            L'intégralité des enseignements vidéo de Pam et du Pasteur Kongo.
            Cliquez sur une vidéo pour la regarder directement sur la plateforme.
          </p>
        </div>
      </section>

      {/* ONGLETS SERVITEURS */}
      <section className="sticky top-16 md:top-20 z-40 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ServantTabButton
              active={activeTab === "pam"}
              onClick={() => setActiveTab("pam")}
              name="Pam"
              count={allVideos.filter(v => v.servant === "pam").length}
              photo="/pam.jpeg"
            />
            <ServantTabButton
              active={activeTab === "kongo"}
              onClick={() => setActiveTab("kongo")}
              name="Pasteur Kongo"
              count={allVideos.filter(v => v.servant === "kongo").length}
              photo="/pasteur-kongo.jpeg"
            />
          </div>
        </div>
      </section>

      {/* VIDÉOS PAR CATÉGORIE */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
            </div>
          ) : (
          <>
          {/* En-tête serviteur */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[#8A8378]/15">
            <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#C9A227]/30 flex-shrink-0">
              <Image
                src={activeTab === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg"}
                alt={activeTab === "pam" ? "Pam" : "Pasteur Kongo"}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#1E0F2B]">
                {activeTab === "pam" ? "Afrika Alkebulane Pamela Dali" : "Pasteur Kongo"}
              </h2>
              <p className="text-sm text-[#8A8378]">
                {currentCategories.length} séries · {currentVideos.length} vidéos
              </p>
            </div>
          </div>

          {/* Catégories accordéon */}
          <div className="space-y-6">
            {currentCategories.map((category) => {
              const isExpanded = expandedCategories.size === 0 || expandedCategories.has(category.id);
              return (
                <div key={category.id} className="bg-white rounded-2xl shadow-md border border-[#8A8378]/15 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-5 md:p-6 hover:bg-[#C9A227]/3 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex-shrink-0">
                        <VideoIcon className="w-5 h-5 text-[#C9A227]" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-serif text-lg font-bold text-[#1E0F2B] group-hover:text-[#C9A227] transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-xs text-[#8A8378] mt-0.5">
                          {category.videos.length} vidéo{category.videos.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 text-[#8A8378] transition-transform duration-300 flex-shrink-0", isExpanded && "rotate-180")} />
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-[#8A8378]/10"
                    >
                      <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {category.videos.map((video) => (
                          <YouTubeStyleCard
                            key={video.id}
                            video={video}
                            onClick={() => setCurrentVideo(video)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
          </>
          )}
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
function VideoPlayerView({
  video,
  allVideos,
  onBack,
  onSelectVideo,
}: {
  video: VideoItem;
  allVideos: VideoItem[];
  onBack: () => void;
  onSelectVideo: (v: VideoItem) => void;
}) {
  const servantName = video.servant === "pam" ? "Pam" : "Pasteur Kongo";
  const servantPhoto = video.servant === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg";

  // Vidéos recommandées (même serviteur, excluant la vidéo actuelle)
  const recommended = allVideos.filter(v => v.id !== video.id).slice(0, 12);

  return (
    <div className="min-h-screen bg-[#FAF6EF] pt-16 md:pt-20">
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Layout YouTube : vidéo principale + sidebar */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* Colonne principale */}
          <div className="min-w-0">
            {/* Lecteur vidéo YouTube */}
            <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            {/* Titre de la vidéo */}
            <h1 className="font-serif text-xl md:text-2xl font-bold text-[#1E0F2B] leading-snug mt-4 mb-3">
              {video.title}
            </h1>

            {/* Barre actions (style YouTube) */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#8A8378]/15">
              {/* Channel info */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#C9A227]/30 flex-shrink-0">
                  <Image src={servantPhoto} alt={servantName} width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1E0F2B]">{servantName}</p>
                  <p className="text-xs text-[#8A8378]">{video.category}</p>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors">
                  <ThumbsUp className="w-4 h-4 text-[#C9A227]" />
                  J'aime
                </button>
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors">
                  <Share2 className="w-4 h-4 text-[#C9A227]" />
                  Partager
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors"
                >
                  <Download className="w-4 h-4 text-[#C9A227]" />
                  YouTube
                </a>
              </div>
            </div>

            {/* Description (style YouTube) */}
            <div className="mt-4 p-4 bg-[#2A0E3D]/5 rounded-xl border border-[#8A8378]/10">
              <div className="flex items-center gap-3 text-xs text-[#8A8378] mb-2">
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-[#C9A227]" />
                  {video.views > 0 ? `${video.views.toLocaleString("fr-FR")} vues` : "Nouveau"}
                </span>
                {video.publishedAt && video.publishedAt !== "2024-01-01" && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
                    {new Date(video.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#1E0F2B]/80 leading-relaxed">
                {video.description}
              </p>
            </div>

            {/* Bouton retour */}
            <button
              onClick={onBack}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Retour à la liste
            </button>
          </div>

          {/* Sidebar : vidéos recommandées (style YouTube) */}
          <div className="space-y-3">
            <h3 className="font-serif text-sm font-bold text-[#1E0F2B] uppercase tracking-wider mb-3">
              Vidéos recommandées
            </h3>
            {recommended.map((rec) => (
              <button
                key={rec.id}
                onClick={() => onSelectVideo(rec)}
                className="group flex gap-3 w-full text-left hover:bg-[#2A0E3D]/5 rounded-lg p-2 transition-colors"
              >
                {/* Miniature */}
                <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[#1A0826]">
                  <img
                    src={`https://img.youtube.com/vi/${rec.youtubeId}/mqdefault.jpg`}
                    alt={rec.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1E0F2B] line-clamp-2 group-hover:text-[#C9A227] transition-colors leading-snug">
                    {rec.title}
                  </p>
                  <p className="text-[10px] text-[#8A8378] mt-1">
                    {rec.servant === "pam" ? "Pam" : "Pasteur Kongo"}
                  </p>
                  <p className="text-[10px] text-[#8A8378]">
                    {rec.category}
                  </p>
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
// CARTE VIDÉO STYLE YOUTUBE (grille)
// ============================================================
function YouTubeStyleCard({
  video,
  onClick,
}: {
  video: VideoItem;
  onClick: () => void;
}) {
  const servantName = video.servant === "pam" ? "Pam" : "Pasteur Kongo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={onClick}
        className="group block w-full text-left"
      >
        {/* Miniature YouTube (16:9) */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1A0826] mb-3">
          <img
            src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {/* Overlay sombre au hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {/* Play au centre au hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#C9A227] shadow-lg">
              <Play className="w-5 h-5 text-[#1E0F2B] ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Infos (style YouTube) */}
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#C9A227]/20 flex-shrink-0">
            <Image
              src={video.servant === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg"}
              alt={servantName}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Texte */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#1E0F2B] leading-snug line-clamp-2 group-hover:text-[#C9A227] transition-colors mb-1">
              {video.title}
            </h3>
            <p className="text-xs text-[#8A8378]">{servantName}</p>
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
function ServantTabButton({
  active,
  onClick,
  name,
  count,
  photo,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  count: number;
  photo: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all duration-300",
        active
          ? "bg-[#2A0E3D] text-[#FAF6EF] shadow-lg"
          : "bg-white text-[#1E0F2B] border border-[#8A8378]/20 hover:border-[#C9A227]/40 hover:bg-[#C9A227]/5"
      )}
    >
      <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#C9A227]/30">
        <Image src={photo} alt={name} width={36} height={36} className="w-full h-full object-cover" />
      </div>
      <div className="text-left">
        <div className="text-sm font-bold leading-none">{name}</div>
        <div className={cn("text-[10px] font-semibold mt-0.5", active ? "text-[#C9A227]" : "text-[#8A8378]")}>
          {count} vidéo{count > 1 ? "s" : ""}
        </div>
      </div>
    </button>
  );
}
