"use client";

/**
 * ============================================================
 * ⭐ V3.79 — PAGE ADORATION & LOUANGES (vue cliente)
 * ============================================================
 *
 * Afrika est aussi ARTISTE et CHANTRE de l'Éternel : ses clips, ses
 * adorations et ses louanges vivent sur cette page DÉDIÉE, avec la
 * catégorie ADORATION d'un côté et la catégorie LOUANGES de l'autre —
 * « les choses seront scindées » (directive du pasteur).
 *
 * Même pattern que la page /videos (V3.45 → V3.77) :
 *  - hero paramétrable depuis le back-office (/admin/heroes → page
 *    « adoration-louanges ») ;
 *  - médias chargés via /api/videos (60 s auto-refresh) — ne sont
 *    retenus que les médias d'Afrika des catégories Adoration /
 *    Louanges (les autres restent sur /videos) ;
 *  - cartes style YouTube + miniatures TikTok réelles (badge) ;
 *  - LECTEUR SUR PLACE : LecteurTikTok (embed officiel dimensionné
 *    exactement), iframe YouTube ou <video> natif — le croyant joue
 *    le chant SANS quitter la plateforme ;
 *  - likes réels (V3.26) + partage (V3.36) + lien profond ?v=<id> ;
 *  - photo de profil du module serviteur (V3.77).
 *
 * Géré depuis le back-office par le module DÉDIÉ /admin/adoration
 * (upload de fichiers, liens YouTube/TikTok, post-production).
 */

import { apiFetch } from "@/lib/api-client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Play, Eye, ChevronRight, ChevronLeft, Calendar, Music,
  Heart, Share2, Search, X, Clock, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareModal } from "@/components/videos/share-modal";
// ⭐ V3.64/V3.65 — Lecteur TikTok à dimension exacte + icône/badge partagés.
import { LecteurTikTok } from "@/components/tiktok/lecteur-tiktok";
import { TiktokNoteIcon, BadgeTikTok } from "@/components/tiktok/tiktok-note-icon";
import { HeroBackgroundImage } from "@/components/site/page-hero";
// ⭐ V3.77 — Photos de profil du module serviteur (data URL-compatible).
import { SmartImage } from "@/components/site/smart-image";
// Type uniquement (ce module importe Prisma — effacé à la compilation).
import type { PhotosServiteurs } from "@/lib/servant-photos";
import { IsololeText } from "@/lib/isolole";
import type { HeroConfig } from "@/lib/hero-defaults";
// ⭐ V3.79 — Catégories de la page (partagées avec le back-office).
import { CATEGORIES_ADORATION, estCategorieAdoration } from "@/lib/video-rubrics";

interface MediaAdoration {
  id: string;
  youtubeId: string;
  // id TikTok (extrait de videoUrl par /api/videos) : le média se lit
  // via l'embed officiel TikTok — directement sur la plateforme.
  tiktokId: string;
  videoUrl?: string | null;
  hlsUrl?: string | null;
  title: string;
  description: string;
  duration: string;
  views: number;
  // ⭐ V3.26 — likes RÉELS (colonne dédiée).
  likes?: number;
  publishedAt: string;
  category: string;
  servant: "afrika" | "kongo";
  servantName: string;
  thumbnailUrl?: string;
  isLive?: boolean;
  hasNativeVideo?: boolean;
}

type SortOrder = "recent" | "oldest" | "title";

/** Icône de chaque catégorie (cartes + têtes de section). */
function categorieIcon(name: string) {
  if (name === "Adoration") return Sparkles;
  return Music;
}

/** Libellé descriptif d'une catégorie (carte, sous le titre). */
function libelleCategorie(name: string) {
  if (name === "Adoration") return "Temps de prosternation, chants d'intimité et de révérence";
  return "Chants de joie, de célébration et d'action de grâces";
}

/**
 * ⭐ V3.79 — VUE ADORATION & LOUANGES : hero (image + accroche + titre +
 * sous-titre paramétrables en back-office), bandeau d'identité de la
 * chantre, deux cartes de catégories (scission), barre de recherche,
 * puis les sections ADORATION et LOUANGES — chacune À PART, avec ses
 * propres cartes. Le clic sur une carte ouvre le lecteur intégré.
 */
export function AdorationView({ hero, photos }: { hero: HeroConfig; photos: PhotosServiteurs }) {
  const router = useRouter();
  const [currentVideo, setCurrentVideo] = useState<MediaAdoration | null>(null);
  const [allMedias, setAllMedias] = useState<MediaAdoration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  // « tout » = les DEUX sections affichées (scission visible) ;
  // « Adoration » / « Louanges » = focus sur une seule section.
  const [activeCategory, setActiveCategory] = useState<string>("tout");
  // Lien profond ?v=<id> déjà résolu (ne re-ouvre pas au retour).
  const [lienProfondResolu, setLienProfondResolu] = useState(false);

  // ─── Chargement des médias (même mécanique que /videos) ───
  useEffect(() => {
    const fetchMedias = () => {
      apiFetch("/api/videos")
        .then((r) => r.json())
        .then((data) => {
          // ⭐ V3.79 — SCISION : seuls les médias d'Afrika des catégories
          // Adoration / Louanges vivent ici (les catégories inverses sont
          // exclues de /videos — cf. videos-view.tsx).
          const medias: MediaAdoration[] = (data.videos || []).filter(
            (v: MediaAdoration) => v.servant === "afrika" && estCategorieAdoration(v.category)
          );
          setAllMedias(medias);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    fetchMedias();
    // Auto-refresh 60 s (nouveaux chants publiés par Afrika au back-office).
    const interval = setInterval(fetchMedias, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─── ⭐ V3.79 — LIEN PROFOND ?v=<id> (URLs de partage) ───
  // Les URLs partagées ouvrent directement le lecteur du chant visé.
  useEffect(() => {
    if (lienProfondResolu || loading) return;
    setLienProfondResolu(true);
    try {
      const v = new URLSearchParams(window.location.search).get("v");
      if (v) {
        const cible = allMedias.find((m) => m.id === v);
        if (cible) {
          setCurrentVideo(cible);
          window.scrollTo(0, 0);
        }
      }
    } catch {
      /* URL illisible — on reste sur la liste */
    }
  }, [loading, allMedias, lienProfondResolu]);

  // ─── Recherche + tri (même mécanique que /videos) ───
  const filteredMedias = useMemo(() => {
    let medias = allMedias;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      medias = medias.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    const sorted = [...medias];
    if (sortOrder === "recent") {
      sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (sortOrder === "oldest") {
      sorted.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    } else if (sortOrder === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [allMedias, searchQuery, sortOrder]);

  // ─── ⭐ V3.79 — SECTIONS SCINDÉES PAR CATÉGORIE ───
  // « On aura la catégorie adoration qui sera à part, la catégorie
  // louanges qui sera à part » : deux sections distinctes, chacune avec
  // son en-tête, ses cartes et son état vide.
  const sections = useMemo(
    () =>
      CATEGORIES_ADORATION.map((name) => ({
        name,
        medias: filteredMedias.filter((m) => m.category === name),
      })),
    [filteredMedias]
  );

  // Cartes de catégories (sous le hero) : nombre de chants + dernier publié.
  const latestParCategorie = useMemo(() => {
    const map: Record<string, MediaAdoration | null> = {};
    for (const { name, medias } of sections) {
      const tries = [...medias].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      map[name] = tries[0] || null;
    }
    return map;
  }, [sections]);

  // Si un média est sélectionné → LECTEUR intégré plein écran.
  if (currentVideo) {
    return (
      <LecteurAdoration
        video={currentVideo}
        allMedias={allMedias}
        photos={photos}
        onBack={() => {
          setCurrentVideo(null);
          router.push("/adoration-louanges");
        }}
        onSelectVideo={(v) => {
          setCurrentVideo(v);
          router.push(`/adoration-louanges?v=${v.id}`);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const sectionsAffichees =
    activeCategory === "tout" ? sections : sections.filter((s) => s.name === activeCategory);

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* HERO — ⭐ V3.79 : image + textes paramétrables depuis le
          back-office (/admin/heroes → page « adoration-louanges »). */}
      <section className="relative bg-[#2A0E3D] pt-24 pb-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <HeroBackgroundImage
            src={hero.backgroundImage}
            alt={hero.title}
            priority={false}
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/85 to-[#2A0E3D]" />
          <div className="absolute -top-40 -right-20 w-96 h-96 bg-[#C9A227]/10 rounded-full blur-[100px] animate-float" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#8C5FA8]/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: "1.5s" }} />
          <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DDBE55] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A227]" />
            </span>
            <Music className="w-4 h-4 text-[#DDBE55]" />
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#DDBE55]">
              <IsololeText>{hero.kicker}</IsololeText>
            </span>
          </div>
          <h1 className="font-serif font-bold text-xl md:text-2xl text-[#FAF6EF]">
            <IsololeText>{hero.title}</IsololeText>
            {hero.titleAccent && (
              <>
                {" "}
                <span className="text-[#C9A227]">
                  <IsololeText>{hero.titleAccent}</IsololeText>
                </span>
              </>
            )}
            {hero.titleSuffix && <> <IsololeText>{hero.titleSuffix}</IsololeText></>}
          </h1>
          {hero.subtitle && (
            <p className="text-sm text-[#FAF6EF]/60 leading-relaxed mt-1 max-w-2xl">
              <IsololeText>{hero.subtitle}</IsololeText>
            </p>
          )}
        </div>
      </section>

      {/* ─── IDENTITÉ DE LA CHANTRE ───
          « Il faut souligner que Africa est également artiste, une
          chantre de l'Éternel » : bandeau photo + rôle, photo gérée
          depuis le module serviteur du back-office. */}
      <section className="bg-[#FAF6EF] pt-6 pb-4 border-b border-[#8A8378]/10">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 flex-wrap">
          <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#C9A227]/50 flex-shrink-0">
            {/* ⭐ V3.77 — SmartImage : photo du module serviteur (data URL). */}
            <SmartImage
              src={photos.afrika}
              alt="Afrika"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1E0F2B]">Afrika Alkebulane Pamela Dali</p>
            <p className="text-xs text-[#8A8378]">
              Artiste · Chantre de l&apos;Éternel — ses chants se jouent directement ici
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-[#8A8378]">
            <Calendar className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
            {loading ? "Chargement…" : `${allMedias.length} chant${allMedias.length > 1 ? "s" : ""}`}
          </div>
        </div>
      </section>

      {/* ─── CARTES DE CATÉGORIES (la scission, d'un coup d'œil) ─── */}
      <section className="bg-[#FAF6EF] pt-4 pb-2" aria-label="Catégories de chants">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {sections.map(({ name, medias }) => {
              const Icon = categorieIcon(name);
              const actif = activeCategory === name;
              const latest = latestParCategorie[name];
              return (
                <button
                  key={name}
                  onClick={() => {
                    setActiveCategory(name);
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`section-${name.toLowerCase()}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className={cn(
                    "group relative text-left rounded-2xl overflow-hidden p-4 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#C9A227]",
                    actif ? "ring-2 ring-[#C9A227]" : ""
                  )}
                  aria-label={`Voir les chants de la catégorie ${name}`}
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
                      <div className="text-[11px] text-[#FAF6EF]/60 mt-0.5 leading-snug">
                        {libelleCategorie(name)}
                      </div>
                      {medias.length > 0 ? (
                        <>
                          <div className="text-[11px] text-[#C9A227] font-bold mt-1">
                            {medias.length} chant{medias.length > 1 ? "s" : ""}
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

      {/* BARRE RECHERCHE + FILTRES (sticky, même mécanique que /videos) */}
      <section className="sticky top-16 md:top-20 z-30 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-2 md:py-3">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {/* Chips catégories (scission) */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setActiveCategory("tout")}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                  activeCategory === "tout"
                    ? "bg-[#2A0E3D] text-[#FAF6EF]"
                    : "bg-white text-[#1E0F2B] border border-[#8A8378]/20 hover:border-[#C9A227]/40"
                )}
              >
                Tout
              </button>
              {CATEGORIES_ADORATION.map((name) => {
                const Icon = categorieIcon(name);
                const count = sections.find((s) => s.name === name)?.medias.length || 0;
                return (
                  <button
                    key={name}
                    onClick={() => setActiveCategory(name)}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                      activeCategory === name
                        ? "bg-[#2A0E3D] text-[#FAF6EF]"
                        : "bg-[#C9A227]/15 text-[#A3821C] border border-[#C9A227]/40 hover:bg-[#C9A227]/25"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {name}
                    <span className={cn("text-[10px]", activeCategory === name ? "text-[#C9A227]" : "text-[#8A8378]")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Recherche */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un chant…"
                className="w-full pl-9 pr-4 py-2 rounded-full border border-[#8A8378]/25 bg-white text-sm text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#8A8378]/10"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5 text-[#8A8378]" />
                </button>
              )}
            </div>
            {/* Tri */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="px-3 py-2 rounded-full border border-[#8A8378]/25 bg-white text-xs font-semibold text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] flex-shrink-0"
              aria-label="Ordre d'affichage"
            >
              <option value="recent">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="title">A → Z</option>
            </select>
          </div>
        </div>
      </section>

      {/* ─── SECTIONS SCINDÉES : ADORATION puis LOUANGES ─── */}
      <section className="py-6">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchQuery.trim() && filteredMedias.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#8A8378]">Aucun chant ne correspond à votre recherche.</p>
            </div>
          ) : (
            <>
              {!searchQuery.trim() && allMedias.length === 0 && (
                /* Page encore vide : les premiers chants d'Afrika arrivent
                   dès qu'elle les publie depuis son module back-office. */
                <div className="rounded-2xl border-2 border-dashed border-[#C9A227]/40 bg-[#C9A227]/5 p-8 md:p-10 text-center max-w-xl mx-auto mb-8">
                  <div className="w-12 h-12 rounded-full bg-[#C9A227]/15 flex items-center justify-center mx-auto mb-3">
                    <Music className="w-6 h-6 text-[#C9A227]" />
                  </div>
                  <p className="font-bold text-[#1E0F2B] text-sm md:text-base">
                    Les chants d&apos;adoration et de louanges d&apos;Afrika arrivent bientôt
                  </p>
                  <p className="text-xs md:text-sm text-[#8A8378] mt-1.5 leading-relaxed">
                    Chaque clip, chaque chant publié par Afrika apparaîtra ici et se jouera
                    directement sur la plateforme, sans quitter le site.
                  </p>
                </div>
              )}
              {sectionsAffichees.map(({ name, medias }) => {
                const Icon = categorieIcon(name);
                return (
                  <div
                    key={name}
                    id={`section-${name.toLowerCase()}`}
                    className="scroll-mt-32 mb-10 last:mb-0"
                  >
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-[#C9A227]" />
                      </span>
                      <h2 className="font-bold text-base md:text-lg text-[#1E0F2B]">{name}</h2>
                      {medias.length > 0 && (
                        <span className="text-xs text-[#8A8378]">
                          {medias.length} chant{medias.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {medias.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-[#C9A227]/40 bg-[#C9A227]/5 p-8 md:p-10 text-center max-w-xl mx-auto">
                        <div className="w-12 h-12 rounded-full bg-[#C9A227]/15 flex items-center justify-center mx-auto mb-3">
                          <Icon className="w-6 h-6 text-[#C9A227]" />
                        </div>
                        <p className="font-bold text-[#1E0F2B] text-sm md:text-base">
                          Les chants de « {name} » arrivent bientôt
                        </p>
                        <p className="text-xs md:text-sm text-[#8A8378] mt-1.5 leading-relaxed">
                          Restez connectés — chaque nouveau chant de cette catégorie sera publié
                          ici et jouable directement sur la plateforme.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {medias.map((media) => (
                          <CarteChant
                            key={media.id}
                            media={media}
                            photo={photos.afrika}
                            onClick={() => {
                              setCurrentVideo(media);
                              router.push(`/adoration-louanges?v=${media.id}`);
                              window.scrollTo(0, 0);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* Citation bas — les louanges, demeure de l'Éternel */}
      <section className="py-10 bg-[#2A0E3D]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Music className="w-7 h-7 text-[#C9A227] mx-auto mb-3 opacity-40" />
          <p className="text-base italic text-[#FAF6EF]/80 leading-relaxed mb-2">
            « Mais toi, ô Saint, tu habites au milieu des louanges d&apos;Israël. »
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold">
            <IsololeText>Psaume 22:4</IsololeText>
          </p>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// VUE LECTEUR (le chant se joue SUR LA PLATEFORME)
// ============================================================
// Même pattern que VideoPlayerView (/videos) : LecteurTikTok pour les
// médias TikTok (embed officiel, dimension exacte V3.65), iframe
// YouTube pour les clips YouTube, <video> natif pour les fichiers
// uploadés (R2) — plus likes réels, partage et recommandations.
function LecteurAdoration({ video, allMedias, photos, onBack, onSelectVideo }: {
  video: MediaAdoration;
  allMedias: MediaAdoration[];
  photos: PhotosServiteurs;
  onBack: () => void;
  onSelectVideo: (v: MediaAdoration) => void;
}) {
  const [liked, setLiked] = useState(false);
  // ⭐ V3.26 — likes RÉELS : vraie colonne Video.likes (0 par défaut).
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showShare, setShowShare] = useState(false);

  const servantName = "Afrika";
  // ⭐ V3.77 — photo de profil du module serviteur (repli historique).
  const servantPhoto = photos.afrika;
  // Recommandations : les AUTRES chants d'adoration & louanges.
  const recommended = allMedias.filter((m) => m.id !== video.id).slice(0, 15);

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
    setLikeCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    // Persister dans localStorage
    const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "{}");
    if (newLiked) likedVideos[video.id] = true;
    else delete likedVideos[video.id];
    localStorage.setItem("likedVideos", JSON.stringify(likedVideos));

    // Persister en DB — ⭐ V3.26 : like/unlike explicites.
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

  // ⭐ V3.79 — URL de partage publique de CE chant (lien profond).
  const publicShareUrl = `https://mouvement-christ-libere.vercel.app/adoration-louanges?v=${video.id}`;

  return (
    <div className="min-h-screen bg-[#FAF6EF] pt-16 md:pt-20">
      {/* Barre du haut (retour + titre, même style que /videos) */}
      <div className="sticky top-16 md:top-20 z-30 bg-[#FAF6EF] border-b border-[#8A8378]/15 py-2 px-4">
        <div className="max-w-[1800px] mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="h-4 w-px bg-[#8A8378]/20" />
          <p className="text-sm font-bold text-[#1E0F2B] truncate flex-1">{video.title}</p>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">
          <div className="min-w-0">
            {/* Catégorie au-dessus du lecteur */}
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.15em] font-bold text-[#C9A227]">
                {video.category}
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#8A8378]/70">
                Adoration & Louanges
              </span>
            </div>

            {/* Lecteur : TikTok embed (LecteurTikTok), YouTube iframe ou
                <video> natif — le chant se joue DIRECTEMENT ici. */}
            {video.tiktokId ? (
              <LecteurTikTok
                tiktokId={video.tiktokId}
                videoUrl={video.videoUrl || null}
                titre={video.title}
                miniature={video.thumbnailUrl || null}
              />
            ) : (
              <div
                className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl"
                style={{ aspectRatio: "16 / 9" }}
              >
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
                      <Music className="w-12 h-12 text-[#C9A227]/60 mx-auto mb-3" />
                      <p className="text-sm font-bold text-[#FAF6EF] mb-1">Chant en cours de traitement</p>
                      <p className="text-xs text-[#FAF6EF]/50">Le média sera disponible prochainement</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Titre */}
            <h1 className="font-bold text-lg md:text-xl text-[#1E0F2B] leading-snug mt-3 mb-2">
              {video.title}
            </h1>

            {/* Barre actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#8A8378]/15">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#C9A227]/30 flex-shrink-0">
                  {/* ⭐ V3.77 — SmartImage : photo du module serviteur. */}
                  <SmartImage
                    src={servantPhoto}
                    alt={servantName}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1E0F2B]">{servantName}</p>
                  <p className="text-xs text-[#8A8378]">{video.category} · Chantre de l&apos;Éternel</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Like → cœur rouge */}
                <button
                  onClick={handleLike}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                    liked ? "bg-red-50 text-red-600" : "bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B]"
                  )}
                >
                  <Heart
                    className={cn("w-3.5 h-3.5", liked && "fill-current text-red-600")}
                    style={{ color: liked ? "#dc2626" : "#8A8378" }}
                  />
                  {likeCount > 0 ? likeCount.toLocaleString("fr-FR") : "J'aime"}
                </button>

                {/* ⭐ V3.36 — Partage : grand modal complet. */}
                <button
                  onClick={() => setShowShare(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2A0E3D]/5 hover:bg-[#2A0E3D]/10 text-[#1E0F2B] text-xs font-semibold transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                  Partager
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="mt-3 p-3 bg-[#2A0E3D]/5 rounded-xl border border-[#8A8378]/10">
              <div className="flex items-center gap-3 text-xs text-[#8A8378] mb-2">
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                  {video.views > 0 ? `${video.views.toLocaleString("fr-FR")} vues` : "Nouveau"}
                </span>
                {video.publishedAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: "#C9A227" }} />
                    {new Date(video.publishedAt).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
              {/* break-words : les descriptions longues (URL TikTok
                  comprise) cassent proprement (garde V3.65). */}
              <p className="text-sm text-[#1E0F2B]/80 leading-relaxed break-words">{video.description}</p>
            </div>
          </div>

          {/* Sidebar recommandés (les autres chants) */}
          <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:sticky lg:top-24 space-y-2 pb-4">
            <h3 className="font-bold text-xs text-[#1E0F2B] uppercase tracking-wider mb-2 sticky top-0 bg-[#FAF6EF] py-2 z-10">
              Autres chants
            </h3>
            {recommended.map((rec) => (
              <button
                key={rec.id}
                onClick={() => onSelectVideo(rec)}
                className="group flex gap-2.5 w-full text-left hover:bg-[#2A0E3D]/5 rounded-lg p-1.5 transition-colors"
              >
                <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[#1A0826]">
                  {rec.tiktokId ? (
                    <TiktokMiniature src={rec.thumbnailUrl || null} title={rec.title} compact />
                  ) : (
                    <ThumbWithFallback
                      src={
                        rec.thumbnailUrl ||
                        (rec.youtubeId ? `https://img.youtube.com/vi/${rec.youtubeId}/mqdefault.jpg` : "/logo-christ-libere-v3.png")
                      }
                      title={rec.title}
                      sizes="160px"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1E0F2B] line-clamp-2 group-hover:text-[#C9A227] transition-colors leading-snug mb-1">
                    {rec.title}
                  </p>
                  <p className="text-[10px] text-[#8A8378]">Afrika</p>
                  <p className="text-[10px] text-[#8A8378]">{rec.category}</p>
                </div>
              </button>
            ))}
            {recommended.length === 0 && (
              <p className="text-xs text-[#8A8378] italic px-1">
                Les prochains chants publiés par Afrika apparaîtront ici.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ⭐ V3.36 — Modal de partage complet (clic extérieur / Échap ferme) */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        url={publicShareUrl}
        title={video.title}
        thumbnailUrl={
          video.thumbnailUrl || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : null)
        }
      />
    </div>
  );
}

// ⭐ V3.64 — Miniature TikTok : VRAIE image (R2 permanente, via le
// backfill /api/tiktok/backfill) remplissant la carte + badge TikTok.
// Les miniatures TikTok sont PORTRAIT : object-cover biaisé vers le
// haut (les visages occupent le tiers supérieur) ; repli automatique
// vers le style de marque « écran mobile » si absente/cassée.
function TiktokMiniature({ src, title, className, compact = false }: { src?: string | null; title: string; className?: string; compact?: boolean }) {
  const [echec, setEchec] = useState(false);
  const afficheImage = !!src && !echec;
  if (afficheImage) {
    return (
      <>
        <Image
          src={src as string}
          alt={title}
          fill
          sizes={compact ? "160px" : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 300px"}
          className={(className || "object-cover group-hover:scale-105 transition-transform duration-500") + " object-[50%_30%]"}
          onError={() => setEchec(true)}
        />
        <BadgeTikTok compact={compact} />
      </>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#111118] via-[#16162a] to-[#0d0d16]">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, #25F4EE 0%, transparent 45%), radial-gradient(circle at 75% 80%, #FE2C55 0%, transparent 45%)" }} />
      {/* « Écran mobile » portrait centré */}
      <div
        className={cn(
          "relative rounded-xl bg-black/40 ring-1 ring-white/15 shadow-lg flex flex-col items-center justify-center gap-2",
          compact ? "h-[86%]" : "h-[80%]"
        )}
        style={{ aspectRatio: "9 / 16" }}
      >
        <TiktokNoteIcon size={compact ? 20 : 30} />
        {!compact && (
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#C9A227]/90 shadow-md">
            <Play className="w-4 h-4 text-[#1E0F2B] ml-0.5" fill="currentColor" />
          </div>
        )}
        <span className="text-[8px] font-bold tracking-[0.18em] text-white/70 uppercase">TikTok</span>
      </div>
    </div>
  );
}

// ============================================================
// CARTE CHANT (style carte YouTube — même schéma visuel que /videos)
// ============================================================
// ⭐ V3.28 — Miniature de secours : next/image ne peut pas échanger
// son src en erreur comme un <img> brut — ce composant gère le repli
// vers le logo local avec un état par carte.
function ThumbWithFallback({ src, title, sizes, className }: { src: string; title: string; sizes: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed ? "/logo-christ-libere-v3.png" : src}
      alt={title}
      fill
      sizes={sizes}
      className={className || "object-cover"}
      onError={() => setFailed(true)}
    />
  );
}

function CarteChant({ media, photo, onClick }: { media: MediaAdoration; photo: string; onClick: () => void }) {
  const Icon = categorieIcon(media.category);
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.3 }}>
      <button onClick={onClick} className="group block w-full text-left">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1A0826] mb-2.5">
          {media.tiktokId ? (
            <TiktokMiniature src={media.thumbnailUrl || null} title={media.title} />
          ) : (
            <ThumbWithFallback
              src={
                media.thumbnailUrl ||
                (media.youtubeId ? `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg` : "/logo-christ-libere-v3.png")
              }
              title={media.title}
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 300px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )}
          {/* Badge catégorie (Adoration / Louanges) */}
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B] backdrop-blur-sm">
              <Icon className="w-2.5 h-2.5" />
              {media.category}
            </span>
          </div>
          {media.duration && (
            <div className="absolute bottom-2 right-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 text-white">
                {media.duration}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#C9A227] shadow-lg">
              <Play className="w-5 h-5 text-[#1E0F2B] ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#C9A227]/20 flex-shrink-0">
            {/* ⭐ V3.77 — photo de profil du module serviteur (SmartImage :
                data URL-compatible). */}
            <SmartImage src={photo} alt="Afrika" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#1E0F2B] leading-snug line-clamp-2 break-words group-hover:text-[#C9A227] transition-colors mb-0.5">
              {media.title}
            </h3>
            <p className="text-xs text-[#8A8378]">Afrika</p>
            <p className="text-xs text-[#8A8378]/70">{media.category}</p>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
