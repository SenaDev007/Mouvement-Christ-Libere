"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Play, Eye, ChevronRight, ChevronDown, ChevronLeft,
  Calendar, Video as VideoIcon, Heart, Share2, Search,
  X, Check, Link2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppIcon, FacebookIcon, XIcon, InstagramIcon } from "@/components/videos/social-icons";
import { UpcomingLiveFloat } from "@/components/live/upcoming-live-float";

interface VideoItem {
  id: string;
  youtubeId: string;
  videoUrl?: string | null;
  hlsUrl?: string | null;
  title: string;
  description: string;
  duration: string;
  views: number;
  publishedAt: string;
  category: string;
  servant: "pam" | "kongo";
  servantName: string;
  thumbnailUrl?: string;
  isLive?: boolean;
  hasNativeVideo?: boolean;
}

// Ordre fixe des catégories
const CATEGORY_ORDER = [
  "Paroles & Exhortations",
  "Lives & Directs",
  "Prière & Délivrance",
  "Enseignements & Prédications",
  "Témoignages & Visions",
  "Fêtes & Shabbat",
  "Discernement Spirituel",
  "Vie Pastorale",
];

type ServantTab = "pam" | "kongo";

function getSortedCategories(videos: VideoItem[], servant: ServantTab) {
  const filtered = videos.filter(v => v.servant === servant);
  const catsMap = new Map<string, VideoItem[]>();
  for (const v of filtered) {
    if (!catsMap.has(v.category)) catsMap.set(v.category, []);
    catsMap.get(v.category)!.push(v);
  }
  // Trier selon l'ordre fixe
  const result: Array<{ id: string; name: string; servant: ServantTab; videos: VideoItem[] }> = [];
  for (const catName of CATEGORY_ORDER) {
    if (catsMap.has(catName)) {
      result.push({
        id: `${servant}-${catName}`,
        name: catName,
        servant,
        videos: catsMap.get(catName)!,
      });
    }
  }
  // Ajouter les catégories non listées
  for (const [name, vids] of catsMap) {
    if (!CATEGORY_ORDER.includes(name)) {
      result.push({ id: `${servant}-${name}`, name, servant, videos: vids });
    }
  }
  return result;
}

type SortOrder = "recent" | "oldest" | "title";

export default function VideosPage() {
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
      fetch("/api/videos")
        .then(r => r.json())
        .then(data => { setAllVideos(data.videos || []); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetchVideos();
    // Auto-refresh toutes les 30 secondes pour capter les nouveaux replays
    const interval = setInterval(fetchVideos, 30000);
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

  const categories = useMemo(() => getSortedCategories(filteredVideos, activeTab), [filteredVideos, activeTab]);
  const currentVideos = filteredVideos.filter(v => v.servant === activeTab);

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
      {/* HERO compact */}
      <section className="relative bg-[#2A0E3D] pt-24 pb-4 overflow-hidden">
        {/* Miniature live flottante */}
        <UpcomingLiveFloat />
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <VideoIcon className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227]">Vidéos & Lives</span>
          </div>
          <h1 className="font-bold text-xl md:text-2xl text-[#FAF6EF]">
            Enseignements vidéo & directs
          </h1>
        </div>
      </section>

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
          ) : filteredVideos.length === 0 ? (
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
                        : "bg-white text-[#1E0F2B] border border-[#8A8378]/20"
                    )}
                  >
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
                {!searchQuery && (
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
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="font-bold text-base md:text-lg text-[#1E0F2B]">{activeCat.name}</h2>
                      <span className="text-xs text-[#8A8378]">{activeCat.videos.length} vidéo{activeCat.videos.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      {activeCat.videos.map((video) => (
                        <YouTubeStyleCard key={video.id} video={video} onClick={() => { setCurrentVideo(video); router.push(`/videos?v=${video.id}`); window.scrollTo(0, 0); }} />
                      ))}
                    </div>
                  </>
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
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                      activeCategory === cat.id
                        ? "bg-[#2A0E3D] text-[#FAF6EF]"
                        : "text-[#1E0F2B] hover:bg-[#2A0E3D]/5"
                    )}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className={cn(
                      "text-xs ml-2 flex-shrink-0",
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
  const [likeCount, setLikeCount] = useState(video.views || 0);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const servantName = video.servant === "pam" ? "Pam" : "Pasteur Kongo";
  const servantPhoto = video.servant === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg";
  const recommended = allVideos.filter(v => v.id !== video.id).slice(0, 15);

  // Charger le like depuis localStorage
  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "{}");
    if (likedVideos[video.id]) setLiked(true);
    setLikeCount(video.views || 0);
  }, [video.id, video.views]);

  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

    // Persister dans localStorage
    const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "{}");
    if (newLiked) likedVideos[video.id] = true;
    else delete likedVideos[video.id];
    localStorage.setItem("likedVideos", JSON.stringify(likedVideos));

    // Persister en DB
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

  const shareUrl = encodeURIComponent(`https://mouvement-christ-libere.vercel.app/videos?v=${video.id}`);
  const shareTitle = encodeURIComponent(video.title);

  const shareLinks = [
    { name: "WhatsApp", Icon: WhatsAppIcon, href: `https://wa.me/?text=${shareTitle}%20${shareUrl}` },
    { name: "Facebook", Icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}` },
    { name: "X", Icon: XIcon, href: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}` },
    { name: "Instagram", Icon: InstagramIcon, href: `https://www.instagram.com/` },
  ];

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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
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

                {/* Partager */}
                <div className="relative">
                  <button onClick={() => setShowShare(!showShare)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors">
                    <Share2 className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                    Partager
                  </button>
                  {showShare && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-[#8A8378]/15 p-3 z-50 min-w-[200px]">
                      <p className="text-xs font-bold text-[#8A8378] uppercase tracking-wider mb-2">Partager sur</p>
                      <div className="flex items-center gap-2 mb-2">
                        {shareLinks.map((link) => {
                          const Icon = link.Icon;
                          return (
                            <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" title={link.name}
                              className="flex items-center justify-center w-9 h-9 rounded-lg border border-[#8A8378]/15 hover:scale-110 transition-transform">
                              <Icon size={18} />
                            </a>
                          );
                        })}
                      </div>
                      <button onClick={handleCopy} className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                        copied ? "bg-[#5B7052] text-white" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"
                      )}>
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
                  <img
                    src={rec.thumbnailUrl || (rec.youtubeId ? `https://img.youtube.com/vi/${rec.youtubeId}/mqdefault.jpg` : "/logo-christ-libere.png")}
                    alt={rec.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/logo-christ-libere.png"; }}
                    loading="lazy"
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
            src={video.thumbnailUrl || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : "/logo-christ-libere.png")}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).src = "/logo-christ-libere.png"; }}
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
