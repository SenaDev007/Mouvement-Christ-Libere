"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Play, Clock, Eye, Radio, ChevronRight, ChevronDown,
  Calendar, Users, Video as VideoIcon, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayerModal } from "@/components/videos/video-player-modal";
import { VideoCardPro } from "@/components/videos/video-card-pro";
import {
  getCategoriesByServant,
  getAllVideos,
  type VideoItem,
} from "@/lib/data/videos-exemple";

type ServantTab = "pam" | "kongo" | "all";

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState<ServantTab>("pam");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  const allVideos = useMemo(() => getAllVideos(), []);
  const pamCategories = useMemo(() => getCategoriesByServant("pam"), []);
  const kongoCategories = useMemo(() => getCategoriesByServant("kongo"), []);

  const stats = useMemo(() => {
    const pamCount = allVideos.filter((v) => v.servant === "pam").length;
    const kongoCount = allVideos.filter((v) => v.servant === "kongo").length;
    const totalViews = allVideos.reduce((acc, v) => acc + v.views, 0);
    const categories = new Set(allVideos.map((v) => v.category)).size;
    return { pamCount, kongoCount, totalViews, categories };
  }, [allVideos]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const currentCategories = activeTab === "pam" ? pamCategories : activeTab === "kongo" ? kongoCategories : [];

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[50vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#2A0E3D] text-[#FAF6EF]">
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <VideoIcon className="w-5 h-5 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
              Vidéos & Lives
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-[#FAF6EF] leading-tight mb-4 drop-shadow-lg"
          >
            Enseignements vidéo <span className="text-[#C9A227]">& directs</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-8 drop-shadow"
          >
            L'intégralité des enseignements vidéo et des directs de Pam et du Pasteur Kongo,
            classés par séries et par thèmes. Lecture directement sur la plateforme.
          </motion.p>

          {/* Stats rapides */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#FAF6EF]/60"
          >
            <span className="inline-flex items-center gap-1.5">
              <VideoIcon className="w-3.5 h-3.5 text-[#C9A227]" />
              {allVideos.length} vidéos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-[#C9A227]" />
              {stats.categories} séries
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#C9A227]" />
              {stats.totalViews.toLocaleString("fr-FR")} vues
            </span>
          </motion.div>
        </div>
      </section>

      {/* ═══ BANDEAU LIVE (si un direct est en cours ou programmé) ═══ */}
      <section className="bg-[#1A0826] border-b border-[#C9A227]/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <p className="text-sm text-[#FAF6EF]/80">
            <span className="font-bold text-[#C9A227]">Direct programmé</span> —
            Prochain live : Sam. 18h00 (CET)
          </p>
          <a
            href="#live"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#C9A227] hover:text-[#DDBE55] transition-colors"
          >
            Rappel <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </section>

      {/* ═══ ONGLETS SERVITEURS ═══ */}
      <section className="sticky top-16 md:top-20 z-40 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ServantTabButton
              active={activeTab === "pam"}
              onClick={() => setActiveTab("pam")}
              name="Pam"
              count={stats.pamCount}
              photo="/pam.jpeg"
            />
            <ServantTabButton
              active={activeTab === "kongo"}
              onClick={() => setActiveTab("kongo")}
              name="Pasteur Kongo"
              count={stats.kongoCount}
              photo="/pasteur-kongo.jpeg"
            />
          </div>
        </div>
      </section>

      {/* ═══ VIDÉOS PAR CATÉGORIE ═══ */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          {activeTab === "pam" && (
            <ServantSection
              name="Pam"
              fullName="Afrika Alkebulane Pamela Dali"
              photo="/pam.jpeg"
              categories={pamCategories}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              onSelectVideo={setSelectedVideo}
            />
          )}

          {activeTab === "kongo" && (
            <ServantSection
              name="Pasteur Kongo"
              fullName="Pasteur Kongo"
              photo="/pasteur-kongo.jpeg"
              categories={kongoCategories}
              expandedCategories={expandedCategories}
              toggleCategory={toggleCategory}
              onSelectVideo={setSelectedVideo}
            />
          )}
        </div>
      </section>

      {/* ═══ CITATION FINALE ═══ */}
      <section className="py-16 md:py-20 bg-[#2A0E3D] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Play className="w-10 h-10 text-[#C9A227] mx-auto mb-6 opacity-50" />
          <p className="font-serif text-xl md:text-2xl italic text-[#FAF6EF]/90 leading-relaxed mb-4">
            « Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe. »
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">
            Christ Libère
          </p>
        </div>
      </section>

      {/* ═══ MODAL LECTEUR VIDÉO ═══ */}
      {selectedVideo && (
        <VideoPlayerModal
          youtubeId={selectedVideo.youtubeId}
          title={selectedVideo.title}
          description={selectedVideo.description}
          duration={selectedVideo.duration}
          views={selectedVideo.views}
          publishedAt={selectedVideo.publishedAt}
          servantName={selectedVideo.servant === "pam" ? "Pam" : "Pasteur Kongo"}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// COMPOSANT : ONGLET SERVITEUR
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
        <Image
          src={photo}
          alt={name}
          width={36}
          height={36}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="text-left">
        <div className="text-sm font-bold leading-none">{name}</div>
        <div className={cn(
          "text-[10px] font-semibold mt-0.5",
          active ? "text-[#C9A227]" : "text-[#8A8378]"
        )}>
          {count} vidéo{count > 1 ? "s" : ""}
        </div>
      </div>
    </button>
  );
}

// ============================================================
// COMPOSANT : SECTION SERVITEUR (catégories + vidéos)
// ============================================================
function ServantSection({
  name,
  fullName,
  photo,
  categories,
  expandedCategories,
  toggleCategory,
  onSelectVideo,
}: {
  name: string;
  fullName: string;
  photo: string;
  categories: ReturnType<typeof getCategoriesByServant>;
  expandedCategories: Set<string>;
  toggleCategory: (id: string) => void;
  onSelectVideo: (v: VideoItem) => void;
}) {
  return (
    <div>
      {/* En-tête serviteur */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[#8A8378]/15">
        <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#C9A227]/30 flex-shrink-0">
          <Image
            src={photo}
            alt={fullName}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#1E0F2B]">{fullName}</h2>
          <p className="text-sm text-[#8A8378]">
            {categories.length} série{categories.length > 1 ? "s" : ""} ·{" "}
            {categories.reduce((acc, c) => acc + c.videos.length, 0)} vidéos
          </p>
        </div>
      </div>

      {/* Catégories accordéon */}
      <div className="space-y-6">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.id) || expandedCategories.size === 0;
          return (
            <div key={category.id} className="bg-white rounded-2xl shadow-md border border-[#8A8378]/15 overflow-hidden">
              {/* En-tête catégorie (cliquable) */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-5 md:p-6 hover:bg-[#C9A227]/3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-[#C9A227]" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-serif text-lg font-bold text-[#1E0F2B] group-hover:text-[#C9A227] transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-xs text-[#8A8378] mt-0.5">
                      {category.videos.length} vidéo{category.videos.length > 1 ? "s" : ""} · {category.description.slice(0, 60)}...
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-[#8A8378] transition-transform duration-300 flex-shrink-0",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {/* Vidéos de la catégorie */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-[#8A8378]/10"
                >
                  <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {category.videos.map((video, idx) => (
                      <VideoCardPro
                        key={video.id}
                        youtubeId={video.youtubeId}
                        title={video.title}
                        description={video.description}
                        duration={video.duration}
                        views={video.views}
                        publishedAt={video.publishedAt}
                        servantName={name}
                        servantCode={video.servant}
                        category={video.category}
                        delay={idx * 0.05}
                        onClick={() => onSelectVideo(video)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
