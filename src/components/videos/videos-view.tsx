"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Play, Eye, ChevronRight, ChevronDown, ChevronLeft,
  Calendar, Video as VideoIcon, Heart, Share2, Search,
  X, Clock, Star, Wind, Sunrise, MoonStar, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareModal } from "@/components/videos/share-modal";
import { UpcomingLiveFloat } from "@/components/live/upcoming-live-float";
import { HeroBackgroundImage } from "@/components/site/page-hero";
import { IsololeText } from "@/lib/isolole";
import type { HeroConfig } from "@/lib/hero-defaults";
// ⭐ V3.46 — Rubriques signatures (partagées avec le back-office) :
// « Saint-Esprit réponds-moi » (Pam), « Rhema du matin »/« Rhema du soir »
// (Pasteur Kongo). La rubrique EXPLICITE (assignée en back-office, ou
// héritée du live pour les replays) prime sur la catégorisation
// automatique par mots-clés du titre.
import {
  categoryOrder, estRubrique, rubriquesDe,
} from "@/lib/video-rubrics";

interface VideoItem {
  id: string;
  youtubeId: string;
  videoUrl?: string | null;
  hlsUrl?: string | null;
  title: string;
  description: string;
  duration: string;
  views: number;
  // ⭐ V3.26 — likes RÉELS (colonne dédiée) — le cœur n'affiche plus views.
  likes?: number;
  publishedAt: string;
  category: string;
  servant: "pam" | "kongo";
  servantName: string;
  thumbnailUrl?: string;
  isLive?: boolean;
  hasNativeVideo?: boolean;
}

type ServantTab = "pam" | "kongo";

/**
 * Icône de chaque rubrique signature (bandeau + catégories épinglées).
 */
function rubricIcon(name: string) {
  if (name === "Saint-Esprit réponds-moi") return Wind;
  if (name === "Rhema du matin") return Sunrise;
  if (name === "Rhema du soir") return MoonStar;
  return Sparkles;
}

/**
 * ⭐ V3.46 — Catégories triées PAR SERVITEUR : les rubriques signatures
 * (« Saint-Esprit réponds-moi » Pam ; « Rhema du matin »/« Rhema du soir »
 * Pasteur Kongo) sont ÉPINGLÉES EN TÊTE et restent visibles MÊME VIDES
 * (les croyants peuvent les suivre et voir les prochains épisodes
 * apparaître) — sauf en mode recherche (données pures). Les catégories
 * historiques suivent leur ordre d'origine ; les catégories inconnues
 * sont ajoutées à la fin (comportement historique).
 */
function getSortedCategories(
  videos: VideoItem[],
  servant: ServantTab,
  options?: { pinRubriques?: boolean }
) {
  const filtered = videos.filter(v => v.servant === servant);
  const catsMap = new Map<string, VideoItem[]>();
  for (const v of filtered) {
    if (!catsMap.has(v.category)) catsMap.set(v.category, []);
    catsMap.get(v.category)!.push(v);
  }
  const pin = options?.pinRubriques !== false;
  const result: Array<{ id: string; name: string; servant: ServantTab; videos: VideoItem[] }> = [];
  for (const catName of categoryOrder(servant)) {
    const vids = catsMap.get(catName) || [];
    const epinglee = pin && estRubrique(catName) && rubriquesDe(servant).includes(catName);
    if (vids.length > 0 || epinglee) {
      result.push({ id: `${servant}-${catName}`, name: catName, servant, videos: vids });
      catsMap.delete(catName);
    }
  }
  // Ajouter les catégories non listées (ayant des vidéos)
  for (const [name, vids] of catsMap) {
    result.push({ id: `${servant}-${name}`, name, servant, videos: vids });
  }
  return result;
}

type SortOrder = "recent" | "oldest" | "title";

/**
 * ⭐ V3.45 — VUE VIDÉOS (cliente) — hero (image + accroche + titre +
 * sous-titre) paramétrable depuis le back-office (/admin/heroes →
 * page « videos »). La page serveur /videos charge la config (getHero)
 * et la transmet ici.
 */
export function VideosView({ hero }: { hero: HeroConfig }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ServantTab>("pam");
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  useEffect(() => {
    const fetchVideos = () => {
      apiFetch("/api/videos")
        .then(r => r.json())
        .then(data => { setAllVideos(data.videos || []); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetchVideos();
    // Auto-refresh toutes les 30 secondes pour capter les nouveaux replays
    const interval = setInterval(fetchVideos, 60000); // 60s au lieu de 30s (réduit charge DB)
    return () => clearInterval(interval);
  }, []);

  const filteredVideos = useMemo(() => {
    let vids = allVideos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      vids = vids.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
      );
    }
    // Tri
    const sorted = [...vids];
    if (sortOrder === "recent") {
      sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (sortOrder === "oldest") {
      sorted.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    } else if (sortOrder === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [allVideos, searchQuery, sortOrder]);

  // ⭐ V3.46 — hors recherche, les rubriques signatures sont épinglées
  // (visibles même vides) ; en recherche, catégories 100 % données.
  const categories = useMemo(
    () => getSortedCategories(filteredVideos, activeTab, { pinRubriques: !searchQuery.trim() }),
    [filteredVideos, activeTab, searchQuery]
  );
  const currentVideos = filteredVideos.filter(v => v.servant === activeTab);

  // ─── ⭐ V3.46 — RUBRIQUES DU SERVITEUR (bandeau « à suivre ») ───
  // « Saint-Esprit réponds-moi » (Pam) / « Rhema du matin » + « Rhema du
  // soir » (Pasteur Kongo) : cartes mises en avant sous le hero, avec le
  // nombre d'épisodes et le dernier épisode publié.
  const rubriquesServant = rubriquesDe(activeTab);
  const rubriquesCards = useMemo(() => {
    return rubriquesServant.map((name) => {
      const vids = currentVideos
        .filter(v => v.category === name)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      return { name, count: vids.length, latest: vids[0] || null };
    });
    // rubriquesServant = référence stable du module (par code serviteur).
  }, [rubriquesServant, currentVideos]);

  // Vidéos récentes (8 plus récentes du serviteur actuel)
  const recentVideos = useMemo(() => {
    return [...currentVideos]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 8);
  }, [currentVideos]);

  // Auto-sélection première catégorie
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Si une vidéo est sélectionnée
  if (currentVideo) {
    return (
      <VideoPlayerView
        video={currentVideo}
        allVideos={currentVideos}
        onBack={() => { setCurrentVideo(null); router.push("/videos"); }}
        onSelectVideo={(v) => { setCurrentVideo(v); router.push(`/videos?v=${v.id}`); window.scrollTo(0, 0); }}
      />
    );
  }

  const activeCat = categories.find(c => c.id === activeCategory) || categories[0];

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* HERO compact — ⭐ V3.45 : image d'arrière-plan + textes
          paramétrables depuis le back-office (/admin/heroes) */}
      <section className="relative bg-[#2A0E3D] pt-24 pb-4 overflow-hidden">
        {/* Image d'arrière-plan paramétrable (photo du hero) */}
        <div className="absolute inset-0 z-0">
          <HeroBackgroundImage
            src={hero.backgroundImage}
            alt={hero.title}
            priority={false}
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/85 to-[#2A0E3D]" />
        </div>
        {/* Miniature live flottante */}
        <UpcomingLiveFloat />
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <VideoIcon className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227]">
              <IsololeText>{hero.kicker}</IsololeText>
            </span>
          </div>
          <h1 className="font-bold text-xl md:text-2xl text-[#FAF6EF]">
            <IsololeText>{hero.title}</IsololeText>
          </h1>
          {hero.subtitle && (
            <p className="text-sm text-[#FAF6EF]/60 leading-relaxed mt-1 max-w-2xl">
              <IsololeText>{hero.subtitle}</IsololeText>
            </p>
          )}
        </div>
      </section>

      {/* ─── ⭐ V3.46 — RUBRIQUES SIGNATURES « À SUIVRE » ───
          Saint-Esprit réponds-moi (Pam) · Rhema du matin / Rhema du soir
          (Pasteur Kongo) : cartes mises en avant pour que les croyants
          suivent ces rendez-vous réguliers. Caché pendant la recherche. */}
      {!searchQuery.trim() && rubriquesCards.length > 0 && (
        <section className="bg-[#FAF6EF] pt-6 pb-2 border-b border-[#8A8378]/10" aria-label="Rubriques à suivre">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227]">
                Les rubriques de {activeTab === "pam" ? "Pam" : "Pasteur Kongo"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rubriquesCards.map(({ name, count, latest }) => {
                const Icon = rubricIcon(name);
                const actif = activeCategory === `${activeTab}-${name}`;
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setActiveCategory(`${activeTab}-${name}`);
                      // Défiler jusqu'à la catégorie sélectionnée
                      requestAnimationFrame(() => {
                        document.getElementById("categorie-active")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    className={cn(
                      "group relative text-left rounded-2xl overflow-hidden p-4 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#C9A227]",
                      actif ? "ring-2 ring-[#C9A227]" : ""
                    )}
                    aria-label={`Voir la rubrique ${name}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#2A0E3D] via-[#2A0E3D]/95 to-[#C9A227]/20" />
                    <div className="relative flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-[#C9A227]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-[#FAF6EF] leading-tight">
                          <IsololeText>{name}</IsololeText>
                        </div>
                        {count > 0 ? (
                          <>
                            <div className="text-[11px] text-[#C9A227] font-bold mt-1">
                              {count} épisode{count > 1 ? "s" : ""}
                            </div>
                            {latest && (
                              <div className="text-[11px] text-[#FAF6EF]/60 truncate mt-0.5">
                                Dernier : {latest.title}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-[11px] text-[#FAF6EF]/70 mt-1 italic">
                            Prochainement — restez connectés
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#C9A227]/60 flex-shrink-0 self-center group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* BARRE DE RECHERCHE + ONGLETS */}
      <section className="sticky top-16 md:top-20 z-30 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-2 md:py-3">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <ServantTabButton active={activeTab === "pam"} onClick={() => { setActiveTab("pam"); setActiveCategory(null); }} name="Pam" count={allVideos.filter(v => v.servant === "pam").length} photo="/pam.jpeg" />
              <ServantTabButton active={activeTab === "kongo"} onClick={() => { setActiveTab("kongo"); setActiveCategory(null); }} name="Kongo" count={allVideos.filter(v => v.servant === "kongo").length} photo="/pasteur-kongo.jpeg" />
            </div>
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher une vidéo..."
                className="w-full pl-9 pr-4 py-2 rounded-full border border-[#8A8378]/25 bg-white text-sm text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/20" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#8A8378]/10">
                  <X className="w-3.5 h-3.5 text-[#8A8378]" />
                </button>
              )}
            </div>
            {/* Filtre de tri */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="px-3 py-2 rounded-full border border-[#8A8378]/25 bg-white text-xs font-semibold text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] flex-shrink-0"
            >
              <option value="recent">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="title">A → Z</option>
            </select>
          </div>
        </div>
      </section>

      {/* LAYOUT : vidéos + sidebar catégories (style YouTube) */}
      <section className="py-6">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchQuery.trim() && filteredVideos.length === 0 ? (
            <div className="text-center py-20"><p className="text-[#8A8378]">Aucune vidéo ne correspond à votre recherche.</p></div>
          ) : (
            <>
            {/* Chips de catégories scrollables horizontalement (mobile) */}
            <div className="lg:hidden mb-4 overflow-x-auto scrollbar-thin">
              <div className="flex items-center gap-2 pb-2 whitespace-nowrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0",
                      activeCategory === cat.id
                        ? "bg-[#2A0E3D] text-[#FAF6EF]"
                        : estRubrique(cat.name)
                          ? "bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/40"
                          : "bg-white text-[#1E0F2B] border border-[#8A8378]/20"
                    )}
                  >
                    {estRubrique(cat.name) && <Star className="w-3 h-3" />}
                    {cat.name}
                    <span className={cn("text-[10px]", activeCategory === cat.id ? "text-[#C9A227]" : "text-[#8A8378]")}>{cat.videos.length}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_240px] gap-6">
              {/* Colonne principale : vidéos récentes + catégorie active */}
              <div className="min-w-0">
                {/* Section Vidéos récentes */}
                {!searchQuery && recentVideos.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-[#C9A227]" />
                      <h2 className="font-bold text-base md:text-lg text-[#1E0F2B]">Vidéos récentes</h2>
                      <span className="text-xs text-[#8A8378]">{recentVideos.length} vidéos</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      {recentVideos.map((video) => (
                        <YouTubeStyleCard key={`recent-${video.id}`} video={video} onClick={() => { setCurrentVideo(video); router.push(`/videos?v=${video.id}`); window.scrollTo(0, 0); }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Vidéos de la catégorie active */}
                {activeCat && (
                  <div id="categorie-active" className="scroll-mt-32">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      {estRubrique(activeCat.name) && (
                        <span className="w-7 h-7 rounded-lg bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                          {(() => { const RubIcon = rubricIcon(activeCat.name); return <RubIcon className="w-4 h-4 text-[#C9A227]" />; })()}
                        </span>
                      )}
                      <h2 className="font-bold text-base md:text-lg text-[#1E0F2B]">{activeCat.name}</h2>
                      {activeCat.videos.length > 0 && (
                        <span className="text-xs text-[#8A8378]">{activeCat.videos.length} vidéo{activeCat.videos.length > 1 ? "s" : ""}</span>
                      )}
                    </div>

                    {activeCat.videos.length === 0 && estRubrique(activeCat.name) ? (
                      /* ⭐ V3.46 — rubrique signature encore vide : rendez-vous
                         régulier à venir, pas une erreur. */
                      <div className="rounded-2xl border-2 border-dashed border-[#C9A227]/40 bg-[#C9A227]/5 p-8 md:p-10 text-center max-w-xl mx-auto">
                        <div className="w-12 h-12 rounded-full bg-[#C9A227]/15 flex items-center justify-center mx-auto mb-3">
                          {(() => { const EmptyIcon = rubricIcon(activeCat.name); return <EmptyIcon className="w-6 h-6 text-[#C9A227]" />; })()}
                        </div>
                        <p className="font-bold text-[#1E0F2B] text-sm md:text-base">
                          Les épisodes de « {activeCat.name} » arrivent bientôt
                        </p>
                        <p className="text-xs md:text-sm text-[#8A8378] mt-1.5 leading-relaxed">
                          Restez connectés — chaque nouvel épisode de cette rubrique sera publié ici,
                          au service du rassemblement des fils d&#39;Isolélé (Israël) dispersés.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {activeCat.videos.map((video) => (
                          <YouTubeStyleCard key={video.id} video={video} onClick={() => { setCurrentVideo(video); router.push(`/videos?v=${video.id}`); window.scrollTo(0, 0); }} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar droite : liste des catégories (desktop uniquement) */}
              <div className="hidden lg:block space-y-1.5">
                <h3 className="font-bold text-xs text-[#1E0F2B] uppercase tracking-wider mb-3">Catégories</h3>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                      activeCategory === cat.id
                        ? "bg-[#2A0E3D] text-[#FAF6EF]"
                        : estRubrique(cat.name)
                          ? "text-[#A3821C] bg-[#C9A227]/10 hover:bg-[#C9A227]/20"
                          : "text-[#1E0F2B] hover:bg-[#2A0E3D]/5"
                    )}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {estRubrique(cat.name) && <Star className="w-3.5 h-3.5 flex-shrink-0" />}
                      {cat.name}
                    </span>
                    <span className={cn(
                      "text-xs flex-shrink-0",
                      activeCategory === cat.id ? "text-[#C9A227]" : "text-[#8A8378]"
                    )}>{cat.videos.length}</span>
                  </button>
                ))}
              </div>
            </div>
            </>
          )}
        </div>
      </section>

      {/* Citation bas */}
      <section className="py-10 bg-[#2A0E3D]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Play className="w-7 h-7 text-[#C9A227] mx-auto mb-3 opacity-40" />
          <p className="text-base italic text-[#FAF6EF]/80 leading-relaxed mb-2">
            « Ce qui est reçu du ciel doit être transmis avant que la nuit ne tombe. »
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">Christ Libère</p>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// VUE LECTEUR VIDÉO
// ============================================================
function VideoPlayerView({ video, allVideos, onBack, onSelectVideo }: {
  video: VideoItem;
  allVideos: VideoItem[];
  onBack: () => void;
  onSelectVideo: (v: VideoItem) => void;
}) {
  const [liked, setLiked] = useState(false);
  // ⭐ V3.26 — likes RÉELS : avant, likeCount était initialisé avec
  // video.views — la colonne des VUES était détournée en compteur de
  // likes, et un replay fraîchement publié (créé avec views = viewers
  // du live) affichait « 5 likes » sans AUCUN like réel. On affiche
  // désormais la vraie colonne likes (0 par défaut).
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showShare, setShowShare] = useState(false);

  const servantName = video.servant === "pam" ? "Pam" : "Pasteur Kongo";
  const servantPhoto = video.servant === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg";
  const recommended = allVideos.filter(v => v.id !== video.id).slice(0, 15);

  // Charger le like depuis localStorage
  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "{}");
    if (likedVideos[video.id]) setLiked(true);
    setLikeCount(video.likes || 0);
  }, [video.id, video.likes]);

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    // Optimiste ; corrigé par la réponse du serveur (compteur réel).
    setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

    // Persister dans localStorage
    const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "{}");
    if (newLiked) likedVideos[video.id] = true;
    else delete likedVideos[video.id];
    localStorage.setItem("likedVideos", JSON.stringify(likedVideos));

    // Persister en DB — ⭐ V3.26 : action explicite like/unlike (avant,
    // la route incrémentait TOUJOURS views : unlike puis re-like comptait +2).
    try {
      const res = await apiFetch(`/api/videos/${video.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newLiked ? "like" : "unlike" }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.likes === "number") setLikeCount(data.likes);
      }
    } catch {}
  };

  // ⭐ V3.36 — URL de partage publique de cette vidéo.
  const publicShareUrl = `https://mouvement-christ-libere.vercel.app/videos?v=${video.id}`;

  return (
    <div className="min-h-screen bg-[#FAF6EF] pt-16 md:pt-20">
      {/* Barre du haut (titre + recherche, style YouTube) */}
      <div className="sticky top-16 md:top-20 z-30 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-2 px-4">
        <div className="max-w-[1800px] mx-auto flex items-center gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors flex-shrink-0">
            <ChevronLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="h-4 w-px bg-[#8A8378]/20" />
          <p className="text-sm font-bold text-[#1E0F2B] truncate flex-1">{video.title}</p>
          <div className="relative w-48 md:w-64 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8378]" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-1.5 rounded-full border border-[#8A8378]/25 bg-white text-xs text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227]"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                const filtered = allVideos.filter(v =>
                  v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q)
                );
                // Mettre à jour les recommandées filtrées
              }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">
          <div className="min-w-0">
            {/* Catégorie au-dessus de la vidéo */}
            <div className="mb-2">
              <span className="text-xs uppercase tracking-[0.15em] font-bold text-[#C9A227]">{video.category}</span>
            </div>

            {/* Lecteur vidéo : YouTube iframe SI youtubeId, sinon lecteur natif <video> */}
            <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: "16 / 9" }}>
              {video.youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              ) : video.videoUrl ? (
                <video
                  src={video.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full"
                  poster={video.thumbnailUrl || undefined}
                >
                  Votre navigateur ne supporte pas la lecture vidéo.
                </video>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#2A0E3D] to-[#1A0826] text-center p-8">
                  {video.thumbnailUrl && (
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      sizes="(max-width: 1023px) 100vw, 62vw"
                      className="object-cover opacity-30"
                    />
                  )}
                  <div className="relative z-10">
                    <VideoIcon className="w-12 h-12 text-[#C9A227]/60 mx-auto mb-3" />
                    <p className="text-sm font-bold text-[#FAF6EF] mb-1">Replay en cours de traitement</p>
                    <p className="text-xs text-[#FAF6EF]/50">La vidéo sera disponible prochainement</p>
                  </div>
                </div>
              )}
            </div>

            {/* Titre vidéo */}
            <h1 className="font-bold text-lg md:text-xl text-[#1E0F2B] leading-snug mt-3 mb-2">{video.title}</h1>

            {/* Barre actions */}
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
                {/* Like → cœur rouge */}
                <button onClick={handleLike} className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  liked ? "bg-red-50 text-red-600" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"
                )}>
                  <Heart className={cn("w-3.5 h-3.5", liked && "fill-current text-red-600")} style={{ color: liked ? "#dc2626" : "#8A8378" }} />
                  {likeCount > 0 ? likeCount.toLocaleString("fr-FR") : "J'aime"}
                </button>

                {/* ⭐ V3.36 — Partager : GRAND modal complet (plateformes
                    toutes visibles d'un coup, clic extérieur / Échap pour
                    fermer) — remplace le petit popover tronqué. */}
                <div className="relative">
                  <button onClick={() => setShowShare(!showShare)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors">
                    <Share2 className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                    Partager
                  </button>
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
              </div>
              <p className="text-sm text-[#1E0F2B]/80 leading-relaxed">{video.description}</p>
            </div>
          </div>

          {/* Sidebar recommandées scrollable */}
          <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:sticky lg:top-24 space-y-2 pb-4">
            <h3 className="font-bold text-xs text-[#1E0F2B] uppercase tracking-wider mb-2 sticky top-0 bg-[#FAF6EF] py-2 z-10">
              Vidéos recommandées
            </h3>
            {recommended.map((rec) => (
              <button key={rec.id} onClick={() => onSelectVideo(rec)} className="group flex gap-2.5 w-full text-left hover:bg-[#2A0E3D]/5 rounded-lg p-1.5 transition-colors">
                <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[#1A0826]">
                  {/* ⭐ V3.28 — <img> brut -> next/image (optimisée + lazy) */}
                  <ThumbWithFallback
                    src={rec.thumbnailUrl || (rec.youtubeId ? `https://img.youtube.com/vi/${rec.youtubeId}/mqdefault.jpg` : "/logo-christ-libere.png")}
                    title={rec.title}
                    sizes="160px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1E0F2B] line-clamp-2 group-hover:text-[#C9A227] transition-colors leading-snug mb-1">{rec.title}</p>
                  <p className="text-[10px] text-[#8A8378]">{rec.servantName}</p>
                  <p className="text-[10px] text-[#8A8378]">{rec.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ⭐ V3.36 — Modal de partage complet (clic extérieur / Échap ferme) */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        url={publicShareUrl}
        title={video.title}
        thumbnailUrl={video.thumbnailUrl || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : null)}
      />
    </div>
  );
}

// ============================================================
// CARTE VIDÉO STYLE YOUTUBE
// ============================================================
// ⭐ V3.28 — Miniature de secours : next/image ne peut pas échanger son
// src en erreur comme un <img> brut — ce petit composant gère le repli
// vers le logo local avec un état par carte.
function ThumbWithFallback({ src, title, sizes, className }: { src: string; title: string; sizes: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed ? "/logo-christ-libere.png" : src}
      alt={title}
      fill
      sizes={sizes}
      className={className || "object-cover"}
      onError={() => setFailed(true)}
    />
  );
}

function YouTubeStyleCard({ video, onClick }: { video: VideoItem; onClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.3 }}>
      <button onClick={onClick} className="group block w-full text-left">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1A0826] mb-2.5">
          {/* ⭐ V3.28 — <img> brut -> next/image : AVIF/WebP dimensionné,
              lazy loading natif, plus de miniatures 480px chargées sur mobile. */}
          <ThumbWithFallback
            src={video.thumbnailUrl || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : "/logo-christ-libere.png")}
            title={video.title}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 300px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
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
            <h3 className="text-sm font-semibold text-[#1E0F2B] leading-snug line-clamp-2 break-words group-hover:text-[#C9A227] transition-colors mb-0.5">{video.title}</h3>
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
    <button onClick={onClick} className={cn(
      "inline-flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold transition-all duration-300",
      active ? "bg-[#2A0E3D] text-[#FAF6EF] shadow-md" : "bg-white text-[#1E0F2B] border border-[#8A8378]/20 hover:border-[#C9A227]/40"
    )}>
      <div className="relative w-6 h-6 md:w-7 md:h-7 rounded-full overflow-hidden ring-1 ring-[#C9A227]/30 flex-shrink-0">
        <Image src={photo} alt={name} width={28} height={28} className="w-full h-full object-cover" />
      </div>
      <span className="text-xs md:text-sm">{name}</span>
      <span className={cn("text-[10px] font-semibold", active ? "text-[#C9A227]" : "text-[#8A8378]")}>{count}</span>
    </button>
  );
}
