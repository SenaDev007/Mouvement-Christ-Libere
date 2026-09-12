"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus, Pencil, Video as VideoIcon, Radio, Eye, Clock, Crown,
  X, Loader2, AlertCircle, Save, Tag, ChevronDown,
  Download, Trash2, FolderDown, Star,
  // ⭐ V3.47 — upload direct de fichiers vidéo dans le modal « Nouvelle vidéo »
  Upload, FileVideo, Link as LinkIcon, Camera,
  // ⭐ V3.48 — champ d'upload de la miniature (remplace le champ « URL miniature »)
  Image as ImageIcon,
} from "lucide-react";
// ⭐ V3.46 — Rubriques signatures (partagées site public ↔ back-office) :
// « Saint-Esprit réponds-moi » (Pam), « Rhema du matin »/« Rhema du soir »
// (Pasteur Kongo). La rubrique EXPLICITE (Video.category) prime sur le
// devin historique par mots-clés du titre.
import {
  categorizeVideo, estRubrique, RUBRIQUE_OPTIONS,
  TOUTES_RUBRIQUES, categoryOrder,
} from "@/lib/video-rubrics";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminModal, ModalField, ModalError, modalInputClass } from "@/components/admin/admin-modal";
// ⭐ V3.64 — Miniatures TikTok dans la grille back-office : vraie image
// (R2, backfill) + badge, repli de marque si absente.
import { estUrlTiktok } from "@/lib/tiktok";
import { TiktokNoteIcon, BadgeTikTok } from "@/components/tiktok/tiktok-note-icon";
import type { Video, Servant } from "@prisma/client";
// ⭐ V3.48 — compression côté client de la miniature uploadée (ratio
// préservé, ≤ 150 Ko, HEIC/EXIF robustes — même mécanique que les photos de
// jalons et les sections hero).
import { compressHeroImage } from "@/lib/avatar-upload";
// ⭐ V3.37 — Copies locales de secours des replays (IndexedDB, propres à
// CET appareil) : quand l'upload R2 a échoué à l'arrêt d'un live, la vidéo
// complète reste récupérable ici, même après avoir quitté le studio.
import {
  listLocalReplays,
  getLocalReplay,
  deleteLocalReplay,
  telechargerBlob,
  nomFichierReplay,
  tailleLisible,
  type LocalReplayMeta,
} from "@/lib/local-replay-store";
// ⭐ V3.51 — Upload SÉQUENTIEL par morceaux vers R2 (remplace le PUT
// monolithique du fichier entier — un hoquet réseau ne redémarre plus
// tout l'envoi, chaque morceau est réessayé individuellement).
import {
  uploaderSequentielVersR2,
  ErreurR2NonConfigure,
} from "@/lib/upload-sequentiel";

type VideoWithServant = Video & { servant: Servant };

interface VideosTabsClientProps {
  videos: VideoWithServant[];
  servants: Servant[];
  /** ⭐ V3.34 — replays YouTube encore en attente de récupération : si > 0,
   *  un bandeau s'affiche et la page se rafraîchit automatiquement jusqu'à
   *  ce que la vidéo du dernier live apparaisse. */
  pendingReplayCount?: number;
  /** ⭐ V3.35 — true quand des lives attendent leur replay YouTube MAIS que
   *  l'OAuth YouTube n'est pas configuré : la récupération auto ne peut
   *  JAMAIS aboutir — on affiche un bandeau de configuration explicite au
   *  lieu du faux « récupération en cours » (et pas d'auto-refresh). */
  youtubeOauthMissing?: boolean;
}

// ⭐ V3.46 — Ordre/labels des catégories et catégorisation désormais
// importés depuis src/lib/video-rubrics.ts (SEUL point de vérité, partagé
// avec la page publique /videos et l'API /api/videos).

export function VideosTabsClient({ videos, servants, pendingReplayCount = 0, youtubeOauthMissing = false }: VideosTabsClientProps) {
  const router = useRouter();
  const initialServant =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("servant") || "all"
      : "all";

  const [activeTab, setActiveTab] = useState<string>(initialServant);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);

  // ⭐ V3.46 — Copie locale des vidéos : le sélecteur de rubrique en ligne
  // PATCH l'API puis met à jour CET état (retour visuel instantané) ;
  // router.refresh() recharge les props serveur juste après.
  const [videosLocal, setVideosLocal] = useState<VideoWithServant[]>(videos);
  useEffect(() => setVideosLocal(videos), [videos]);

  // Filtrer par serviteur
  const videosByServant = useMemo(() => {
    return activeTab === "all"
      ? videosLocal
      : videosLocal.filter((v) => v.servant.code === activeTab);
  }, [videosLocal, activeTab]);

  // Ordre d'affichage selon l'onglet : rubriques signatures en tête.
  const ordreCategories = useMemo(() => {
    if (activeTab === "kongo") return categoryOrder("kongo");
    if (activeTab === "pam") return categoryOrder("pam");
    // « Toutes » : rubriques signatures (tous serviteurs) puis catégories
    // historiques (fusion sans doublons).
    return [
      ...TOUTES_RUBRIQUES,
      ...categoryOrder("pam").filter((c) => !estRubrique(c)),
      ...categoryOrder("kongo").filter(
        (c) => !estRubrique(c) && !categoryOrder("pam").includes(c)
      ),
    ];
  }, [activeTab]);

  // Catégoriser les vidéos — ⭐ V3.46 : rubrique EXPLICITE (back-office)
  // prioritaire sur le devin par mots-clés (comportement historique sinon).
  const categories = useMemo(() => {
    const catsMap = new Map<string, VideoWithServant[]>();
    for (const v of videosByServant) {
      const cat = categorizeVideo(v.title, v.servant.code, v.category);
      if (!catsMap.has(cat)) catsMap.set(cat, []);
      catsMap.get(cat)!.push(v);
    }
    // Trier selon l'ordre (rubriques signatures en tête)
    const result: Array<{ name: string; videos: VideoWithServant[] }> = [];
    for (const catName of ordreCategories) {
      if (catsMap.has(catName)) {
        result.push({ name: catName, videos: catsMap.get(catName)! });
      }
    }
    // Ajouter les catégories non listées
    for (const [name, vids] of catsMap) {
      if (!ordreCategories.includes(name)) {
        result.push({ name, videos: vids });
      }
    }
    return result;
  }, [videosByServant, ordreCategories]);

  // Filtrer par catégorie
  const filteredVideos = useMemo(() => {
    if (activeCategory === "all") return videosByServant;
    const cat = categories.find((c) => c.name === activeCategory);
    return cat?.videos || [];
  }, [videosByServant, activeCategory, categories]);

  const counts = {
    all: videosLocal.length,
    pam: videosLocal.filter((v) => v.servant.code === "pam").length,
    kongo: videosLocal.filter((v) => v.servant.code === "kongo").length,
  };

  const tabs = [
    { id: "all", label: "Toutes", count: counts.all, icon: VideoIcon },
    { id: "pam", label: "Pam", count: counts.pam, icon: Crown, color: "#C9A227" },
    { id: "kongo", label: "Pasteur Kongo", count: counts.kongo, icon: Crown, color: "#8A857C" },
  ];

  // Ouvrir le modal (avec serviteur pré-sélectionné si onglet actif)
  const openNewVideoModal = () => {
    setModalOpen(true);
  };

  // ⭐ V3.46 — Changement de rubrique EN LIGNE : PATCH immédiat de
  // Video.category, mise à jour optimiste de l'état local (badge + filtre
  // instantanés) puis router.refresh() pour resynchroniser les props
  // serveur. Sélecteur présent sur CHAQUE carte du module Vidéos.
  const changerRubrique = async (videoId: string, category: string | null) => {
    setVideosLocal((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, category } : v))
    );
    try {
      const res = await fetch(`/admin/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) throw new Error("PATCH échoué");
      router.refresh();
    } catch {
      // Échec : revenir à la valeur serveur (le refresh la réaffiche).
      setVideosLocal((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, category: v.category } : v))
      );
    }
  };

  // ─── ⭐ V3.34 — AUTO-REFRESH PENDANT LA RÉCUPÉRATION YOUTUBE ───
  // Le pasteur arrive ici juste après l'arrêt du live (redirection depuis
  // le studio) ; YouTube publie le replay 30 s à 5 min après la fin du
  // flux. Tant qu'il reste des replays en attente, la page se rafraîchit
  // toute seule (router.refresh() → le composant serveur relance la
  // récupération + renvoie des props à jour) : la vidéo apparaît sans
  // qu'on ait besoin de recliquer. Le throttle côté serveur (30 s par
  // live) protège le quota YouTube (liveBroadcasts.list, 1 unité/appel).
  const nbRafraichissements = useRef(0);
  useEffect(() => {
    // ⭐ V3.35 — pas d'auto-refresh quand l'OAuth YouTube manque : la
    // récupération ne peut aboutir seule, rafraîchir ne sert à rien.
    if (pendingReplayCount <= 0 || youtubeOauthMissing) return;
    const interval = setInterval(() => {
      if (nbRafraichissements.current >= 18) {
        // ~3,5 min sans succès : on arrête l'auto-refresh (le bandeau
        // reste visible avec l'invitation à actualiser manuellement).
        clearInterval(interval);
        return;
      }
      nbRafraichissements.current += 1;
      router.refresh();
    }, 12_000);
    return () => clearInterval(interval);
  }, [pendingReplayCount, youtubeOauthMissing, router]);

  // ─── ⭐ V3.37 — COPIES LOCALES DE SECOURS (IndexedDB, CET appareil) ───
  // Si l'upload R2 a échoué à l'arrêt d'un live fait depuis CE navigateur,
  // la vidéo complète y est restée sauvegardée. On l'affiche ici avec un
  // bouton de téléchargement direct + suppression, pour que l'admin puisse
  // la réuploader (« Nouvelle vidéo ») même s'il a déjà quitté le studio.
  const [replaysLocaux, setReplaysLocaux] = useState<LocalReplayMeta[]>([]);
  const [telechargementEnCours, setTelechargementEnCours] = useState<string | null>(null);
  useEffect(() => {
    listLocalReplays().then(setReplaysLocaux).catch(() => {});
  }, []);
  const telechargerReplayLocal = async (meta: LocalReplayMeta) => {
    setTelechargementEnCours(meta.liveId);
    try {
      const rec = await getLocalReplay(meta.liveId).catch(() => null);
      if (rec?.blob) {
        telechargerBlob(rec.blob, nomFichierReplay(meta.title, meta.mimeType, meta.savedAt));
      }
    } finally {
      setTelechargementEnCours(null);
    }
  };
  const supprimerReplayLocal = async (meta: LocalReplayMeta) => {
    setTelechargementEnCours(meta.liveId);
    try {
      await deleteLocalReplay(meta.liveId).catch(() => {});
      setReplaysLocaux((prev) => prev.filter((r) => r.liveId !== meta.liveId));
    } finally {
      setTelechargementEnCours(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ⭐ V3.37 — bandeau des COPIES LOCALES de secours (IndexedDB de CET
          appareil) : replays dont l'upload R2 a échoué, toujours disponibles
          au téléchargement même après avoir quitté le studio. */}
      {replaysLocaux.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <FolderDown className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">
                {replaysLocaux.length === 1
                  ? "Vidéo d'un live sauvegardée sur cet appareil (upload R2 échoué)"
                  : `${replaysLocaux.length} vidéos de lives sauvegardées sur cet appareil (upload R2 échoué)`}
              </p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Ces enregistrements n'ont pas pu être envoyés au serveur au moment de l'arrêt du
                live, mais ils restent en sécurité dans ce navigateur (même après fermeture de
                la page). Téléchargez-les, puis réuploadez-les ici via « Nouvelle vidéo » pour
                les publier et les travailler.
              </p>
              <div className="mt-2.5 space-y-2">
                {replaysLocaux.map((r) => (
                  <div
                    key={r.liveId}
                    className="flex items-center gap-2 flex-wrap rounded-lg bg-white/70 border border-amber-200 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#000000] truncate">{r.title}</p>
                      <p className="text-[10px] text-[#000000]/50">
                        {tailleLisible(r.sizeBytes)} · {(r.mimeType || "video/webm").includes("mp4") ? "MP4" : "WebM"} ·{" "}
                        {new Date(r.savedAt).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => telechargerReplayLocal(r)}
                      disabled={telechargementEnCours === r.liveId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      {telechargementEnCours === r.liveId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Télécharger
                    </button>
                    <button
                      type="button"
                      onClick={() => supprimerReplayLocal(r)}
                      disabled={telechargementEnCours === r.liveId}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-700/60 hover:text-red-500 text-xs font-medium transition-colors disabled:opacity-40"
                      title="Supprimer cette copie locale"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ⭐ V3.35 — bandeau de CONFIGURATION : des lives attendent leur replay
          YouTube mais l'OAuth n'est pas configuré → l'identifiant YouTube ne
          sera JAMAIS récupéré automatiquement (c'est le cas « l'identifiant
          YouTube n'est pas disponible » remonté par le pasteur). */}
      {youtubeOauthMissing && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              Récupération automatique YouTube inactive — configuration manquante
            </p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              {pendingReplayCount > 1
                ? `${pendingReplayCount} lives sont terminés sans replay récupéré, et `
                : "Un live est terminé sans replay récupéré, et "}
              l&apos;identifiant YouTube ne peut pas être retrouvé automatiquement : les variables
              d&apos;environnement <span className="font-mono">YOUTUBE_CLIENT_ID</span>,{" "}
              <span className="font-mono">YOUTUBE_CLIENT_SECRET</span> et{" "}
              <span className="font-mono">YOUTUBE_REFRESH_TOKEN</span> ne sont pas définies sur
              Vercel. Ajoutez-les (Paramètres → Environment Variables) puis redéployez — la
              récupération reprendra toute seule. En attendant : le replay R2 reste le chemin
              principal, et l&apos;URL YouTube peut être collée manuellement sur le live dans le
              studio avant l&apos;arrêt.
            </p>
          </div>
        </div>
      )}
      {/* ⭐ V3.34 — bandeau de récupération des replays YouTube en cours */}
      {pendingReplayCount > 0 && !youtubeOauthMissing && (
        <div className="flex items-start gap-3 rounded-xl border border-[#C9A227]/40 bg-[#C9A227]/10 px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#C9A227] mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#000000]">
              Récupération du replay YouTube en cours
              {pendingReplayCount > 1 ? ` (${pendingReplayCount} lives en attente)` : ""}
            </p>
            <p className="text-xs text-[#000000]/60 mt-0.5">
              YouTube publie la vidéo quelques minutes après la fin du direct — cette page se met
              à jour automatiquement et la vidéo apparaîtra ici toute seule.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A857C] font-bold mb-1">
            Bibliothèque vidéo
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#000000]"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            Vidéos
          </h1>
          <p className="text-sm text-[#8A857C] mt-1">
            Vidéos archivées et lives enregistrés — {videos.length} au total.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewVideoModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#000000] text-sm font-bold hover:bg-[#FF7A1A] transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          {activeTab === "all"
            ? "Nouvelle vidéo"
            : activeTab === "pam"
              ? "Nouvelle vidéo · Pam"
              : "Nouvelle vidéo · Pasteur Kongo"}
        </button>
      </div>

      {/* Onglets serviteurs */}
      <div className="flex items-center gap-2 border-b border-[#8A857C]/15 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveCategory("all");
              }}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? "text-[#000000]"
                  : "text-[#8A857C] hover:text-[#000000]"
              }`}
            >
              <Icon
                className="w-4 h-4"
                style={tab.color && isActive ? { color: tab.color } : undefined}
              />
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? tab.color
                      ? "text-white"
                      : "bg-[#000000] text-white"
                    : "bg-[#8A857C]/15 text-[#8A857C]"
                }`}
                style={
                  isActive && tab.color
                    ? { backgroundColor: tab.color }
                    : undefined
                }
              >
                {tab.count}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ backgroundColor: tab.color || "#000000" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Filtres catégories */}
      {activeTab !== "all" && categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider font-bold text-[#8A857C] flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            Catégorie:
          </span>
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === "all"
                ? "bg-[#000000] text-[#F0E9DE]"
                : "bg-[#8A857C]/10 text-[#8A857C] hover:bg-[#8A857C]/20"
            }`}
          >
            Toutes ({videosByServant.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat.name
                  ? "bg-[#C9A227] text-[#000000]"
                  : estRubrique(cat.name)
                    ? "bg-[#C9A227]/15 text-[#A3821C] hover:bg-[#FF7A1A]/25"
                    : "bg-[#8A857C]/10 text-[#8A857C] hover:bg-[#8A857C]/20"
              }`}
            >
              {estRubrique(cat.name) && <Star className="w-3 h-3" />}
              {cat.name} ({cat.videos.length})
            </button>
          ))}
        </div>
      )}

      {/* Grille vidéos */}
      {filteredVideos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A857C]/30 p-12 text-center">
          <VideoIcon className="w-10 h-10 text-[#8A857C]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A857C] italic">
            {activeCategory !== "all"
              ? `Aucune vidéo dans la catégorie "${activeCategory}".`
              : activeTab === "all"
                ? "Aucune vidéo enregistrée."
                : `Aucune vidéo pour ${activeTab === "pam" ? "Pam" : "le Pasteur Kongo"}.`}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((v) => {
            const isPam = v.servant.code === "pam";
            const accentColor = isPam ? "#C9A227" : "#8A857C";

            return (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-[#8A857C]/15 overflow-hidden hover:shadow-lg transition-all group"
              >
                {/* Thumbnail — ⭐ V3.64 : les vidéos TikTok montrent leur
                    VRAIE miniature (R2 permanente) + badge TikTok, comme
                    YouTube montre img.youtube.com ; repli de marque si la
                    miniature est absente (backfill non encore passé). */}
                <div className="relative aspect-video bg-[#000000] overflow-hidden">
                  {estUrlTiktok(v.videoUrl) ? (
                    v.thumbnailUrl ? (
                      <>
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="w-full h-full object-cover object-[50%_30%] group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <BadgeTikTok />
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#0B0B0A] via-[#12110F] to-[#070706]">
                        <TiktokNoteIcon size={26} />
                        <span className="text-[8px] font-bold tracking-[0.18em] text-white/60 uppercase">TikTok</span>
                      </div>
                    )
                  ) : v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <VideoIcon className="w-8 h-8 text-[#F0E9DE]/30" />
                    </div>
                  )}

                  {/* Badge catégorie */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm"
                      style={{ backgroundColor: `${accentColor}DD`, color: "#FFFFFF" }}
                    >
                      <Crown className="w-2.5 h-2.5" />
                      {v.servant.shortName}
                    </span>
                    {activeCategory === "all" && (
                      (() => {
                        const cat = categorizeVideo(v.title, v.servant.code, v.category);
                        return estRubrique(cat) ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#C9A227] text-[#000000] backdrop-blur-sm">
                            <Star className="w-2.5 h-2.5" />
                            {cat}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-black/70 text-white backdrop-blur-sm">
                            {cat}
                          </span>
                        );
                      })()
                    )}
                  </div>

                  {v.isLive && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">
                        <Radio className="w-2.5 h-2.5" />
                        LIVE
                      </span>
                    </div>
                  )}

                  {v.duration && (
                    <div className="absolute bottom-2 right-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 text-white">
                        {v.duration}
                      </span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-[#000000] line-clamp-2 leading-tight">
                    {v.title}
                  </h3>

                  {/* ⭐ V3.46 — Rubrique de la vidéo, modifiable EN LIGNE :
                      un seul clic pour ranger la vidéo dans « Saint-Esprit
                      réponds-moi », « Rhema du matin », « Rhema du soir »…
                      Enregistrement immédiat (PATCH), badge doré si rubrique
                      signature. */}
                  <div className="mt-2">
                    <RubricSelect video={v} onChange={changerRubrique} />
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8A857C]">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {v.views.toLocaleString("fr-FR")}
                    </span>
                    {v.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(v.publishedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-[#8A857C]/10 ">
                    <Link
                      href={`/admin/videos/${v.id}/edit`}
                      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#FF7A1A]/10 text-[#8A857C] hover:text-[#FF7A1A] transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteButton entity="videos" id={v.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nouvelle vidéo */}
      <NewVideoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        servants={servants}
        preselectedServantCode={activeTab === "all" ? null : activeTab}
      />
    </div>
  );
}

// ============ ⭐ V3.46 — Sélecteur de rubrique en ligne ============
interface RubricSelectProps {
  video: VideoWithServant;
  onChange: (videoId: string, category: string | null) => void | Promise<void>;
}

function RubricSelect({ video, onChange }: RubricSelectProps) {
  const [value, setValue] = useState<string>(video.category || "");
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Resynchroniser si la prop change (refresh serveur)
  useEffect(() => {
    setValue(video.category || "");
  }, [video.category]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setValue(v);
    setErreur(false);
    setSaving(true);
    try {
      await onChange(video.id, v || null);
    } catch {
      setErreur(true);
      setValue(video.category || "");
    } finally {
      setSaving(false);
    }
  };

  const estSignature = estRubrique(value);

  return (
    <div className="relative">
      <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#8A857C] mb-1">
        <Tag className="w-2.5 h-2.5" />
        Rubrique
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={saving}
        title="Rubrique de la vidéo — visible sur la page publique /videos"
        className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-1 transition-colors cursor-pointer disabled:opacity-60 ${
          erreur
            ? "border-red-400 bg-red-50 text-red-700"
            : estSignature
              ? "border-[#C9A227]/60 bg-[#C9A227]/10 text-[#A3821C] focus:border-[#C9A227]"
              : "border-[#8A857C]/25 bg-[#F0E9DE] text-[#000000]/80 focus:border-[#C9A227]"
        }`}
      >
        {RUBRIQUE_OPTIONS.map((opt) => (
          <option key={opt.value || "auto"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {saving && (
        <Loader2 className="w-3 h-3 animate-spin text-[#C9A227] absolute right-2 bottom-2 pointer-events-none" />
      )}
    </div>
  );
}

// ============ Modal Nouvelle Vidéo ============
interface NewVideoModalProps {
  open: boolean;
  onClose: () => void;
  servants: Servant[];
  preselectedServantCode: string | null;
}

/** Formate une durée en secondes → « 1:24:30 » ou « 24:30 ». */
function formaterDuree(secondes: number): string {
  if (!isFinite(secondes) || secondes <= 0) return "";
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Taille lisible d'un fichier (« 128 Mo », « 1,2 Go »). */
function tailleLisibleFichier(octets: number): string {
  if (octets >= 1024 * 1024 * 1024) return `${(octets / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} Go`;
  if (octets >= 1024 * 1024) return `${Math.round(octets / 1024 / 1024)} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/**
 * ⭐ V3.47 — Miniature + durée auto-extraites du fichier vidéo côté client :
 * lecture <video>, seek ~20 %, capture canvas 480 px → JPEG ≤ 60 Ko.
 * Best-effort : renvoie null si le navigateur ne peut pas décoder (la
 * miniature reste alors vide — l'admin peut coller une URL manuellement).
 */
async function extraireMiniatureEtDuree(file: File): Promise<{ thumb: string; duration: string } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    let termine = false;
    const fin = (result: { thumb: string; duration: string } | null) => {
      if (termine) return;
      termine = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    // Sécurité : certains WebM ne déclenchent jamais onseeked → timeout 6 s.
    const timeout = setTimeout(() => fin(null), 6000);
    video.addEventListener("loadeddata", () => {
      try {
        video.currentTime = Math.min(Math.max(video.duration * 0.2, 1), 60);
      } catch {
        /* reste sur la frame 0 */
      }
    });
    video.addEventListener("seeked", () => {
      try {
        const largeur = Math.min(video.videoWidth || 480, 480);
        const ratio = video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 0.5625;
        const canvas = document.createElement("canvas");
        canvas.width = largeur;
        canvas.height = Math.round(largeur * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx || !video.videoWidth) throw new Error("canvas");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        let qualite = 0.8;
        let out = canvas.toDataURL("image/jpeg", qualite);
        let kb = Math.round((out.length * 3) / 4 / 1024);
        while (kb > 60 && qualite > 0.3) {
          qualite -= 0.1;
          out = canvas.toDataURL("image/jpeg", qualite);
          kb = Math.round((out.length * 3) / 4 / 1024);
        }
        clearTimeout(timeout);
        fin({ thumb: out, duration: formaterDuree(video.duration) });
      } catch {
        clearTimeout(timeout);
        fin(null);
      }
    });
    video.addEventListener("error", () => {
      clearTimeout(timeout);
      fin(null);
    });
    video.src = url;
  });
}

// ⭐ V3.51 — uploaderVersR2 (PUT monolithique du fichier entier) SUPPRIMÉ :
// remplacé par uploaderSequentielVersR2 (src/lib/upload-sequentiel.ts) —
// upload par morceaux avec reprise individuelle.

type PhaseUpload = "repos" | "fiche" | "envoi" | "finalisation" | "erreur";

/**
 * ⭐ V3.48 — Champ MINIATURE PAR UPLOAD (remplace les champs « URL miniature »).
 *
 * Le pasteur ne veut PAS saisir une URL de miniature : il veut CHOISIR un
 * fichier image. Ce champ professionnel (même pattern que la photo du jalon
 * biographique) affiche :
 *   - la miniature PERSONNALISÉE uploadée si présente (elle prime),
 *   - sinon la miniature AUTOMATIQUE (capturée depuis le fichier vidéo en
 *     mode upload, ou détectée depuis l'ID YouTube en mode lien),
 *   - sinon un professionnel pictogramme (icône Lucide, AUCUN emoji).
 *
 * L'image est compressée côté client (compressHeroImage : ratio préservé,
 * ≤ 150 Ko, HEIC iPhone accepté) et enregistrée avec la fiche vidéo.
 */
function MiniatureField({
  perso,
  auto,
  processing,
  onUpload,
  onRetirer,
  autoLabel,
}: {
  perso: string | null;
  auto: string | null;
  processing: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetirer: () => void;
  autoLabel: string;
}) {
  const affichee = perso || auto;
  return (
    <div className="rounded-xl border-2 border-[#8A857C]/15 bg-[#F0E9DE]/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-[#C9A227]" aria-hidden />
        <p className="text-xs font-bold text-[#000000] uppercase tracking-wider">
          Miniature de la vidéo
        </p>
        <span className="text-[10px] text-[#8A857C] font-medium">
          (affichée sur la page publique)
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-36 h-[81px] rounded-lg border-2 border-[#C9A227]/30 overflow-hidden bg-[#000000] flex items-center justify-center shadow-md">
            {affichee ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={affichee} alt="Miniature de la vidéo" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-7 h-7 text-[#C9A227]/50" aria-hidden />
            )}
            {processing && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <label
            className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#C9A227] text-[#000000] flex items-center justify-center shadow-lg hover:bg-[#FF7A1A] transition-colors border-2 border-white cursor-pointer"
            title="Choisir une miniature personnalisée (image)"
          >
            {processing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden"
              aria-label="Miniature personnalisée"
            />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[#000000]/70 leading-relaxed">
            {perso
              ? "Miniature personnalisée — c'est elle qui sera affichée sur la page publique."
              : auto
                ? `${autoLabel} — utilisée par défaut. Cliquez sur l'appareil photo pour la remplacer par votre propre image.`
                : `${autoLabel} — elle apparaîtra ici automatiquement. Vous pouvez aussi cliquer sur l'appareil photo pour choisir votre propre image.`}
          </p>
          {perso && (
            <button
              type="button"
              onClick={onRetirer}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" /> {auto ? "Revenir à la miniature automatique" : "Retirer la miniature"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewVideoModal({ open, onClose, servants, preselectedServantCode }: NewVideoModalProps) {
  // ⭐ V3.47 — source de la vidéo : lien (YouTube…) OU FICHIER (upload direct).
  const [source, setSource] = useState<"lien" | "fichier">("lien");
  const [form, setForm] = useState({
    servantId: "",
    title: "",
    description: "",
    duration: "",
    videoUrl: "",
    isLive: false,
    views: 0,
    // ⭐ V3.46 — rubrique signature (vide = catégorisation automatique).
    category: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ⭐ V3.48 — MINIATURE PAR UPLOAD (plus de champ « URL miniature ») :
  //  - miniatureYouTube : détectée automatiquement depuis l'ID de l'URL
  //    YouTube collée (mode lien) — utilisée par défaut ;
  //  - miniatureAuto : capturée depuis le fichier vidéo (mode fichier — V3.47) ;
  //  - miniaturePerso : image CHOISIE par le pasteur via le champ d'upload —
  //    elle PRIME sur toutes les automatiques.
  const [miniatureYouTube, setMiniatureYouTube] = useState<string | null>(null);
  const [miniaturePerso, setMiniaturePerso] = useState<string | null>(null);
  const [miniatureProcessing, setMiniatureProcessing] = useState(false);

  // ─── ⭐ V3.47 — état de l'upload direct ───
  const [fichier, setFichier] = useState<File | null>(null);
  const [miniatureAuto, setMiniatureAuto] = useState<string | null>(null);
  const [dureeAuto, setDureeAuto] = useState("");
  const [extractionEnCours, setExtractionEnCours] = useState(false);
  const [phase, setPhase] = useState<PhaseUpload>("repos");
  const [progression, setProgression] = useState(0);
  // ⭐ V3.51 — détails de l'upload séquentiel : « partie 3/6 » + tentatives.
  const [detailsProgression, setDetailsProgression] = useState<{ partie: number; total: number; tentatives: number } | null>(null);
  // Fiche déjà créée après un échec d'envoi → bouton « Réessayer l'envoi ».
  const [ficheCreeeId, setFicheCreeeId] = useState<string | null>(null);

  // Pré-remplir le serviteur quand le modal s'ouvre
  useEffect(() => {
    if (open && preselectedServantCode) {
      const s = servants.find((srv) => srv.code === preselectedServantCode);
      if (s) setForm((f) => ({ ...f, servantId: s.id }));
    }
  }, [open, preselectedServantCode, servants]);

  // Auto-extract YouTube ID + miniature depuis l'URL (⭐ V3.48 : la miniature
  // détectée est un DÉFAUT visible dans le champ d'upload — plus de champ
  // « URL miniature » à remplir manuellement).
  const handleUrlChange = (url: string) => {
    setForm((f) => ({ ...f, videoUrl: url }));
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (match) {
      setMiniatureYouTube(`https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`);
    }
  };

  // ─── ⭐ V3.48 — Upload d'une miniature personnalisée (image) ───
  const handleMiniaturePersoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMiniatureProcessing(true);
    setError("");
    try {
      const dataUrl = await compressHeroImage(file);
      setMiniaturePerso(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setMiniatureProcessing(false);
      e.target.value = "";
    }
  };

  // ─── Sélection du fichier vidéo ───
  const handleFichierChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFichier(file);
    setMiniatureAuto(null);
    setDureeAuto("");
    // ⭐ V3.48 — nouvelle vidéo = nouvelle miniature : la personnalisée
    // choisie pour l'ancien fichier est retirée (l'auto sera capturée).
    setMiniaturePerso(null);
    setError("");
    // Best-effort : miniature + durée auto (peut échouer selon le navigateur).
    setExtractionEnCours(true);
    const extrait = await extraireMiniatureEtDuree(file);
    setExtractionEnCours(false);
    if (extrait) {
      setMiniatureAuto(extrait.thumb);
      if (extrait.duration) {
        setDureeAuto(extrait.duration);
        setForm((f) => (f.duration ? f : { ...f, duration: extrait.duration }));
      }
    }
  };

  // ─── Soumission ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await envoyer(false);
  };

  const envoyer = async (estReessai: boolean) => {
    if (!form.servantId || !form.title) {
      setError("Serviteur et titre sont requis");
      return;
    }
    if (source === "fichier" && !fichier && !estReessai) {
      setError("Choisissez le fichier vidéo à envoyer");
      return;
    }

    setLoading(true);
    setError("");
    setProgression(0);

    try {
      let videoId = ficheCreeeId;

      // ① Créer (ou réutiliser) la fiche vidéo
      if (!videoId) {
        setPhase("fiche");
        // ⭐ V3.48 — la miniature est la personnalisée uploadée (champ
        // d'upload), sinon l'automatique du mode : capturée depuis le fichier
        // (mode fichier) ou détectée depuis l'ID YouTube (mode lien).
        const thumbnailFinal =
          miniaturePerso ||
          (source === "fichier" ? miniatureAuto : miniatureYouTube) ||
          "";
        const res = await fetch("/admin/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            servantId: form.servantId,
            title: form.title,
            description: form.description,
            duration: form.duration || dureeAuto || "",
            // ⭐ V3.47 — mode lien : URL ; mode fichier : null (l'URL du
            // stockage est posée par l'étape d'upload ci-dessous).
            videoUrl: source === "lien" ? form.videoUrl : null,
            thumbnailUrl: thumbnailFinal,
            isLive: form.isLive,
            views: Number(form.views) || 0,
            // ⭐ V3.46 — rubrique explicite (null = automatique) : la vidéo
            // apparaîtra dans la section du serviteur ET sa rubrique sur la
            // page publique /videos.
            category: form.category || null,
            // ⭐ V3.47 — publiée maintenant (sinon null → reléguée en fin de
            // liste, tri publishedAt desc côté public).
            publishedAt: new Date().toISOString(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur lors de la création");
        }
        const data = await res.json();
        // ⭐ V3.64 — cast corrigé : videoId est `string | null` (undefined
        // interdit par le typage strict — erreur préexistante détectée par
        // le typecheck V3.64, jamais vue car le fichier n'était pas dans
        // les includes des checks précédents).
        videoId = data.item?.id ?? null;
        if (!videoId) throw new Error("Identifiant vidéo manquant dans la réponse");
        setFicheCreeeId(videoId);
      }

      // ② Envoyer le fichier (mode fichier uniquement)
      if (source === "fichier" && fichier) {
        const contentType = fichier.type || "video/mp4";
        setPhase("envoi");
        setProgression(0);
        setDetailsProgression(null);
        let urlPublique: string | null = null;
        let r2NonConfigure = false;

        // ⭐ V3.51 — Upload SÉQUENTIEL PAR MORCEAUX (~8 Mo) vers R2 : le
        // fichier n'est plus envoyé en bloc (un hoquet réseau à 95 % tuait
        // TOUT l'envoi — « crash » du modal Nouvelle vidéo sur les gros
        // fichiers). Chaque morceau part avec une URL pré-signée FRAÎCHE et
        // est réessayé individuellement (3 tentatives) — l'envoi ne repart
        // jamais de zéro à cause d'un hoquet réseau passager.
        try {
          const { publicUrl } = await uploaderSequentielVersR2({
            endpoint: `/api/videos/${videoId}/multipart`,
            fichier,
            contentType,
            onPhase: (p) => {
              if (p === "assemblage") setPhase("finalisation");
              else if (p === "preparation") setPhase("fiche");
              else setPhase("envoi");
            },
            onProgression: (pourcent, details) => {
              setProgression(pourcent);
              setDetailsProgression(details ?? null);
            },
          });
          urlPublique = publicUrl;
        } catch (err) {
          if (err instanceof ErreurR2NonConfigure) {
            // R2 absent de ce déploiement → repli FormData ≤ 4 Mo ci-dessous.
            r2NonConfigure = true;
            console.warn("[Nouvelle vidéo] R2 non configuré :", err.message);
          } else {
            // Erreur RÉELLE remontée par l'uploader (quel morceau, quelle
            // cause, quoi faire) — remplace le message générique qui
            // masquait le vrai problème.
            throw err;
          }
        }

        // Confirmation : persister l'URL R2 en base (mode JSON — le
        // fichier est déjà sur R2, zéro re-transfert).
        if (urlPublique) {
          setPhase("finalisation");
          const commit = await fetch(`/api/videos/${videoId}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ r2Url: urlPublique }),
          });
          if (!commit.ok) {
            const d = await commit.json().catch(() => ({}));
            throw new Error(d.error || "Confirmation de l'envoi impossible");
          }
        } else if (r2NonConfigure) {
          // Repli FormData (uniquement si R2 n'est pas configuré) : limite
          // ~4,5 Mo du body Vercel.
          if (fichier.size > 4 * 1024 * 1024) {
            setPhase("erreur");
            throw new Error(
              `Ce fichier (${tailleLisibleFichier(fichier.size)}) dépasse 4 Mo et le stockage cloud R2 ` +
                "n'est pas configuré sur ce déploiement (variables R2_…). Ouvrez /admin/r2-test pour le diagnostic complet.",
            );
          }
          setPhase("envoi");
          const fd = new FormData();
          fd.append("file", fichier);
          const up = await fetch(`/api/videos/${videoId}/upload`, { method: "POST", body: fd });
          if (!up.ok) {
            const d = await up.json().catch(() => ({}));
            setPhase("erreur");
            throw new Error(d.error || "Échec de l'envoi du fichier");
          }
        }
      }

      // Reset + close
      setForm({
        servantId: "",
        title: "",
        description: "",
        duration: "",
        videoUrl: "",
        isLive: false,
        views: 0,
        category: "",
      });
      setFichier(null);
      setMiniatureAuto(null);
      setMiniatureYouTube(null);
      setMiniaturePerso(null);
      setDureeAuto("");
      setFicheCreeeId(null);
      setDetailsProgression(null);
      setPhase("repos");
      onClose();
      // Refresh page to show new video
      window.location.reload();
    } catch (err) {
      setPhase("erreur");
      setError(
        (err instanceof Error ? err.message : "Erreur inconnue") +
        (ficheCreeeId ? " — la fiche vidéo a été créée : « Réessayer l'envoi » ci-dessous reprendra l'envoi du fichier." : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  const phaseLabel: Record<PhaseUpload, string> = {
    repos: "",
    fiche: "Création de la fiche vidéo…",
    envoi: `Envoi du fichier… ${progression}%${
      detailsProgression
        ? ` · partie ${detailsProgression.partie}/${detailsProgression.total}${
            detailsProgression.tentatives > 1
              ? ` (tentative ${detailsProgression.tentatives})`
              : ""
          }`
        : ""
    }`,
    finalisation: "Assemblage des morceaux sur le stockage cloud…",
    erreur: "",
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Nouvelle vidéo"
      subtitle={
        preselectedServantCode
          ? `Ajouter une vidéo pour ${preselectedServantCode === "pam" ? "Pam" : "Pasteur Kongo"}`
          : "Ajouter une vidéo ou un live enregistré"
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ⭐ V3.47 — Sélecteur de source : Lien (YouTube…) OU Fichier */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F0E9DE] border-2 border-[#8A857C]/15">
          <button
            type="button"
            onClick={() => { setSource("lien"); setError(""); }}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              source === "lien"
                ? "bg-white text-[#000000] shadow-md border border-[#C9A227]/40"
                : "text-[#8A857C] hover:text-[#000000]"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            Lien YouTube
          </button>
          <button
            type="button"
            onClick={() => { setSource("fichier"); setError(""); }}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              source === "fichier"
                ? "bg-white text-[#000000] shadow-md border border-[#C9A227]/40"
                : "text-[#8A857C] hover:text-[#000000]"
            }`}
          >
            <Upload className="w-4 h-4" />
            Fichier vidéo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Serviteur */}
          <ModalField label="Serviteur" required>
            <select
              value={form.servantId}
              onChange={(e) => setForm({ ...form, servantId: e.target.value })}
              required
              className={modalInputClass()}
            >
              <option value="">Choisir...</option>
              {servants.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </ModalField>

          {/* Durée */}
          <ModalField label="Durée" help={source === "fichier" ? "Auto-détectée depuis le fichier" : undefined}>
            <input
              type="text"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder={source === "fichier" && dureeAuto ? dureeAuto : "1:24:30 ou EN DIRECT"}
              className={modalInputClass()}
            />
          </ModalField>
        </div>

        {/* Titre */}
        <ModalField label="Titre" required fullWidth>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="Titre de la vidéo"
            className={modalInputClass()}
          />
        </ModalField>

        {/* ⭐ V3.46 — Rubrique signature de la vidéo */}
        <ModalField label="Rubrique" fullWidth>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={modalInputClass()}
            title="Rubrique dans laquelle la vidéo apparaîtra sur la page publique /videos"
          >
            {RUBRIQUE_OPTIONS.map((opt) => (
              <option key={opt.value || "auto"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </ModalField>

        {/* Description */}
        <ModalField label="Description" fullWidth>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Description courte..."
            className={`${modalInputClass()} resize-none`}
          />
        </ModalField>

        {source === "lien" ? (
          <div className="space-y-4">
            {/* URL vidéo */}
            <ModalField label="URL vidéo" help="YouTube, Vimeo, etc." fullWidth>
              <input
                type="text"
                value={form.videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className={modalInputClass()}
              />
            </ModalField>

            {/* ⭐ V3.48 — MINIATURE PAR UPLOAD (remplace « URL miniature ») :
                la miniature YouTube détectée sert de DÉFAUT, le pasteur peut
                en choisir une autre via l'appareil photo (image compressée). */}
            <MiniatureField
              perso={miniaturePerso}
              auto={miniatureYouTube}
              processing={miniatureProcessing}
              onUpload={handleMiniaturePersoChange}
              onRetirer={() => setMiniaturePerso(null)}
              autoLabel="Miniature YouTube détectée automatiquement"
            />
          </div>
        ) : (
          /* ⭐ V3.47 — Zone fichier vidéo (upload direct) */
          <div className="space-y-3">
            {!fichier ? (
              <label
                className="flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed border-[#C9A227]/50 bg-[#C9A227]/5 cursor-pointer hover:bg-[#FF7A1A]/10 transition-colors"
                title="Choisir le fichier vidéo à envoyer"
              >
                <FileVideo className="w-10 h-10 text-[#C9A227]" />
                <div className="text-center">
                  <p className="text-sm font-bold text-[#000000]">
                    Choisir le fichier vidéo
                  </p>
                  <p className="text-xs text-[#8A857C] mt-1">
                    MP4, WebM, MOV — envoyé directement sur le site, sans passer par YouTube.
                    <br />
                    La miniature et la durée sont détectées automatiquement.
                  </p>
                </div>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*"
                  onChange={handleFichierChange}
                  className="hidden"
                  disabled={loading}
                  aria-label="Fichier vidéo"
                />
              </label>
            ) : (
              <div className="flex items-start gap-4 p-4 rounded-xl border-2 border-[#C9A227]/40 bg-[#F0E9DE]">
                {/* Aperçu miniature auto-capturée */}
                <div className="w-36 h-[81px] rounded-lg overflow-hidden bg-[#000000] flex items-center justify-center flex-shrink-0 border border-[#8A857C]/15">
                  {extractionEnCours ? (
                    <Loader2 className="w-5 h-5 text-[#C9A227] animate-spin" />
                  ) : miniatureAuto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={miniatureAuto} alt="Miniature détectée" className="w-full h-full object-cover" />
                  ) : (
                    <FileVideo className="w-6 h-6 text-[#C9A227]/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#000000] truncate" title={fichier.name}>
                    {fichier.name}
                  </p>
                  <p className="text-xs text-[#8A857C] mt-0.5">
                    {tailleLisibleFichier(fichier.size)}
                    {dureeAuto ? ` · durée ${dureeAuto}` : ""}
                    {extractionEnCours ? " · analyse en cours…" : ""}
                  </p>
                  {miniatureAuto && (
                    <p className="text-[10px] text-[#8A857C]/80 mt-1 flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Miniature capturée automatiquement
                    </p>
                  )}
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => {
                        setFichier(null);
                        setMiniatureAuto(null);
                        setDureeAuto("");
                        setMiniaturePerso(null);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Choisir un autre fichier
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ⭐ V3.48 — MINIATURE PAR UPLOAD (remplace « URL miniature
                personnalisée ») : la miniature capturée depuis le fichier sert
                de DÉFAUT, le pasteur peut en choisir une autre (image). */}
            <MiniatureField
              perso={miniaturePerso}
              auto={miniatureAuto}
              processing={miniatureProcessing}
              onUpload={handleMiniaturePersoChange}
              onRetirer={() => setMiniaturePerso(null)}
              autoLabel="Miniature capturée depuis le fichier"
            />
          </div>
        )}

        {/* Checkbox Live */}
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] cursor-pointer hover:border-[#FF7A1A] transition-colors">
          <input
            type="checkbox"
            checked={form.isLive}
            onChange={(e) => setForm({ ...form, isLive: e.target.checked })}
            className="w-4 h-4 accent-[#C9A227]"
          />
          <div>
            <div className="text-sm font-semibold text-[#000000]">En direct maintenant</div>
            <div className="text-xs text-[#8A857C]">Marquer comme live actif</div>
          </div>
        </label>

        <ModalError error={error} />

        {/* ⭐ V3.47 — Progression de l'envoi */}
        {loading && (phase === "envoi" || phase === "fiche" || phase === "finalisation") && (
          <div className="px-4 py-3 rounded-xl bg-[#000000]/5 border border-[#C9A227]/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#000000] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A227]" />
                {phaseLabel[phase]}
              </p>
              {phase === "envoi" && (
                <span className="text-xs font-bold text-[#A3821C]">{progression}%</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-[#8A857C]/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#C9A227] to-[#DDBE55] transition-all duration-300"
                style={{ width: `${phase === "envoi" ? progression : phase === "finalisation" ? 100 : 8}%` }}
              />
            </div>
            {fichier && phase === "envoi" && (
              <p className="text-[10px] text-[#8A857C] mt-1.5">
                {tailleLisibleFichier(fichier.size)} — ne fermez pas cette fenêtre pendant l&apos;envoi.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A857C]/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A857C] hover:text-[#000000] transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || extractionEnCours || miniatureProcessing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#000000] text-[#F0E9DE] font-bold text-sm hover:bg-[#161513] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {phase === "envoi" ? "Envoi en cours…" : "Création…"}
              </>
            ) : (
              <>
                {source === "fichier" ? <Upload className="w-4 h-4" /> : null}
                {source === "fichier" ? "Créer et envoyer la vidéo" : "Créer la vidéo"}
              </>
            )}
          </button>
          {/* Fiche créée mais envoi échoué → reprise directe */}
          {ficheCreeeId && phase === "erreur" && fichier && !loading && (
            <button
              type="button"
              onClick={() => envoyer(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#000000] font-bold text-sm hover:bg-[#FF7A1A] transition-colors"
            >
              <Upload className="w-4 h-4" /> Réessayer l&apos;envoi
            </button>
          )}
        </div>
      </form>
    </AdminModal>
  );
}
