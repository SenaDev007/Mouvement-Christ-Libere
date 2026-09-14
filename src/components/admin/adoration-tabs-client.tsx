"use client";

/**
 * ============================================================
 * ⭐ V3.79 — MODULE BACK-OFFICE « ADORATION & LOUANGES »
 * ============================================================
 *
 * Module DÉDIÉ à Afrika (artiste, chantre de l'Éternel — c'est ELLE
 * qui gère ses chants) : même pattern que le module Vidéos
 * (videos-tabs-client.tsx), concentré sur les catégories Adoration et
 * Louanges de la page publique /adoration-louanges.
 *
 *  - ONGLETS SCINDÉS : « Adoration » et « Louanges », chacun avec son
 *    compte — les médias d'une catégorie ne se mélangent pas ;
 *  - « Nouveau média » : modal avec LIEN (YouTube/TikTok — titre et
 *    miniature pré-remplis) ou FICHIER (upload séquentiel R2 V3.51,
 *    reprise par morceau), miniature personnalisée (V3.48), serviteur
 *    pré-sélectionné sur Afrika et catégorie pré-sélectionnée sur
 *    l'onglet actif ;
 *  - BASCULE Adoration ↔ Louanges EN LIGNE sur chaque carte (PATCH
 *    immédiat de Video.category, retour visuel instantané — même
 *    mécanique que RubricSelect V3.46) ;
 *  - ÉDITION : le stylo ouvre le SYSTÈME DE POST-PRODUCTION complet
 *    (/admin/videos/[id]/edit — timeline, overlays, rendu…) ;
 *  - SUPPRESSION : purge R2 synchronisée (V3.58) via DeleteButton.
 */

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Music, Sparkles, Eye, Clock, X,
  Loader2, Tag, Star,
  // ⭐ V3.47 — upload direct de fichiers vidéo dans le modal.
  Upload, FileVideo, Link as LinkIcon, Camera,
  // ⭐ V3.48 — champ d'upload de la miniature.
  Image as ImageIcon, ExternalLink, Clapperboard,
} from "lucide-react";
// ⭐ V3.79 — Catégories de la page (seul point de vérité).
import { CATEGORIES_ADORATION } from "@/lib/video-rubrics";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminModal, ModalField, ModalError, modalInputClass } from "@/components/admin/admin-modal";
// ⭐ V3.64 — Miniatures TikTok dans la grille : vraie image + badge.
import { estUrlTiktok } from "@/lib/tiktok";
import { TiktokNoteIcon, BadgeTikTok } from "@/components/tiktok/tiktok-note-icon";
import type { Video, Servant } from "@prisma/client";
// ⭐ V3.48 — compression côté client de la miniature uploadée.
import { compressHeroImage } from "@/lib/avatar-upload";
// ⭐ V3.51 — Upload SÉQUENTIEL par morceaux vers R2.
import {
  uploaderSequentielVersR2,
  ErreurR2NonConfigure,
} from "@/lib/upload-sequentiel";

type MediaWithServant = Video & { servant: Servant };

interface AdorationTabsClientProps {
  medias: MediaWithServant[];
  servants: Servant[];
}

export function AdorationTabsClient({ medias, servants }: AdorationTabsClientProps) {
  const router = useRouter();
  // Onglet actif : catégorie affichée (défaut « Adoration » — première
  // catégorie de la page publique).
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES_ADORATION[0]);
  const [modalOpen, setModalOpen] = useState(false);

  // Copie locale des médias : la bascule de catégorie EN LIGNE PATCH
  // l'API puis met à jour CET état (retour visuel instantané) ;
  // router.refresh() recharge les props serveur juste après.
  const [mediasLocal, setMediasLocal] = useState<MediaWithServant[]>(medias);
  useEffect(() => setMediasLocal(medias), [medias]);

  // Médias de la catégorie active (le module n'affiche qu'une catégorie
  // à la fois — scission, comme sur la page publique).
  const mediasParCategorie = useMemo(
    () =>
      CATEGORIES_ADORATION.map((name) => ({
        name,
        medias: mediasLocal.filter((m) => m.category === name),
      })),
    [mediasLocal]
  );
  const mediasAffiches = useMemo(
    () => mediasParCategorie.find((c) => c.name === activeCategory)?.medias || [],
    [mediasParCategorie, activeCategory]
  );

  // Bascule Adoration ↔ Louanges EN LIGNE : PATCH immédiat de
  // Video.category, mise à jour optimiste de l'état local (le média
  // change d'onglet instantanément) puis router.refresh().
  const changerCategorie = async (mediaId: string, category: string | null) => {
    setMediasLocal((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, category } : m))
    );
    try {
      const res = await fetch(`/admin/api/videos/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) throw new Error("PATCH échoué");
      router.refresh();
    } catch {
      // Échec : revenir à la valeur serveur (le refresh la réaffiche).
      setMediasLocal((prev) =>
        prev.map((m) => (m.id === mediaId ? { ...m, category: m.category } : m))
      );
    }
  };

  // Serviteur Afrika (pré-sélection du modal — le module est le sien).
  const afrika = servants.find((s) => s.code === "afrika") || servants[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Page publique : /adoration-louanges
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            Adoration &amp; Louanges
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Les chants d&apos;Afrika, chantre de l&apos;Éternel — {medias.length} média
            {medias.length > 1 ? "s" : ""} publié{medias.length > 1 ? "s" : ""} sur la page
            dédiée du site.
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <ExternalLink className="w-3.5 h-3.5 text-[#C9A227]" />
            <a
              href="/adoration-louanges"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#C9A227] hover:text-[#DDBE55] transition-colors"
            >
              Voir la page publique
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          Nouveau média · {activeCategory}
        </button>
      </div>

      {/* Onglets catégories (scission) */}
      <div className="flex items-center gap-2 border-b border-[#8A8378]/15 overflow-x-auto">
        {mediasParCategorie.map(({ name, medias: liste }) => {
          const Icon = name === "Adoration" ? Sparkles : Music;
          const isActive = activeCategory === name;
          return (
            <button
              key={name}
              onClick={() => setActiveCategory(name)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                isActive ? "text-[#1E0F2B]" : "text-[#8A8378] hover:text-[#1E0F2B]"
              }`}
            >
              <Icon className="w-4 h-4" style={isActive ? { color: "#C9A227" } : undefined} />
              {name}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-[#C9A227] text-[#1E0F2B]" : "bg-[#8A8378]/15 text-[#8A8378]"
                }`}
              >
                {liste.length}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[#C9A227]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Grille médias de la catégorie active */}
      {mediasAffiches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          {activeCategory === "Adoration" ? (
            <Sparkles className="w-10 h-10 text-[#C9A227]/40 mx-auto mb-3" />
          ) : (
            <Music className="w-10 h-10 text-[#C9A227]/40 mx-auto mb-3" />
          )}
          <p className="text-sm text-[#8A8378] italic">
            Aucun média dans « {activeCategory} » pour l&apos;instant.
          </p>
          <p className="text-xs text-[#8A8378]/70 mt-1">
            Cliquez sur « Nouveau média · {activeCategory} » pour publier le premier chant
            d&apos;Afrika — il apparaîtra aussitôt sur la page publique.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediasAffiches.map((m) => (
            <CarteMedia
              key={m.id}
              media={m}
              onChangeCategory={changerCategorie}
            />
          ))}
        </div>
      )}

      {/* Modal Nouveau média (pré-configuré : Afrika + onglet actif) */}
      <NouveauMediaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        servants={servants}
        preselectedServantId={afrika?.id || null}
        preselectedCategory={activeCategory}
      />
    </div>
  );
}

// ============ Carte média + bascule de catégorie en ligne ============
interface CarteMediaProps {
  media: MediaWithServant;
  onChangeCategory: (mediaId: string, category: string | null) => void | Promise<void>;
}

function CarteMedia({ media, onChangeCategory }: CarteMediaProps) {
  return (
    <div className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden hover:shadow-lg transition-all group">
      {/* Miniature — ⭐ V3.64 : TikTok → vraie miniature + badge, repli
          de marque si absente. */}
      <div className="relative aspect-video bg-[#1A0826] overflow-hidden">
        {estUrlTiktok(media.videoUrl) ? (
          media.thumbnailUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.thumbnailUrl}
                alt={media.title}
                className="w-full h-full object-cover object-[50%_30%] group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <BadgeTikTok />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#111118] via-[#16162a] to-[#0d0d16]">
              <TiktokNoteIcon size={26} />
              <span className="text-[8px] font-bold tracking-[0.18em] text-white/60 uppercase">TikTok</span>
            </div>
          )
        ) : media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnailUrl}
            alt={media.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-8 h-8 text-[#FAF6EF]/30" />
          </div>
        )}

        {/* Badge catégorie (doré — c'est LA catégorie de la page dédiée) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#1E0F2B] backdrop-blur-sm">
            <Star className="w-2.5 h-2.5" />
            {media.category}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/70 text-white backdrop-blur-sm">
            {media.servant.shortName}
          </span>
        </div>

        {media.duration && (
          <div className="absolute bottom-2 right-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 text-white">
              {media.duration}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-[#1E0F2B] line-clamp-2 leading-tight">
          {media.title}
        </h3>

        {/* Bascule Adoration ↔ Louanges EN LIGNE (même mécanique que
            RubricSelect V3.46 — PATCH immédiat, retour visuel instantané). */}
        <div className="mt-2">
          <BasculeCategorie media={media} onChange={onChangeCategory} />
        </div>

        <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8A8378]">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {media.views.toLocaleString("fr-FR")}
          </span>
          {media.publishedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(media.publishedAt).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-[#8A8378]/10">
          <Link
            href={`/admin/videos/${media.id}/edit`}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
            aria-label="Modifier (post-production)"
            title="Modifier — post-production (timeline, overlays, rendu)"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Link>
          <DeleteButton entity="videos" id={media.id} />
        </div>
      </div>
    </div>
  );
}

// ============ Bascule Adoration ↔ Louanges (en ligne) ============
function BasculeCategorie({ media, onChange }: CarteMediaProps) {
  const [value, setValue] = useState<string>(media.category || CATEGORIES_ADORATION[0]);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Resynchroniser si la prop change (refresh serveur).
  useEffect(() => {
    setValue(media.category || CATEGORIES_ADORATION[0]);
  }, [media.category]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setValue(v);
    setErreur(false);
    setSaving(true);
    try {
      await onChange(media.id, v || null);
    } catch {
      setErreur(true);
      setValue(media.category || CATEGORIES_ADORATION[0]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1">
        <Tag className="w-2.5 h-2.5" />
        Catégorie (page publique)
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={saving}
        title="Catégorie du média sur la page publique /adoration-louanges"
        className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-1 transition-colors cursor-pointer disabled:opacity-60 ${
          erreur
            ? "border-red-400 bg-red-50 text-red-700"
            : "border-[#C9A227]/60 bg-[#C9A227]/10 text-[#A3821C] focus:border-[#C9A227]"
        }`}
      >
        {CATEGORIES_ADORATION.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {saving && (
        <Loader2 className="w-3 h-3 animate-spin text-[#C9A227] absolute right-2 bottom-2 pointer-events-none" />
      )}
    </div>
  );
}

// ============ Modal Nouveau Média ============
interface NouveauMediaModalProps {
  open: boolean;
  onClose: () => void;
  servants: Servant[];
  /** Serviteur pré-sélectionné (Afrika — le module est le sien). */
  preselectedServantId: string | null;
  /** Catégorie pré-sélectionnée (onglet actif du module). */
  preselectedCategory: string;
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
 * ⭐ V3.47 — Miniature + durée auto-extraites du fichier vidéo côté client
 * (lecture <video>, seek ~20 %, capture canvas 480 px → JPEG ≤ 60 Ko).
 * Best-effort : renvoie null si le navigateur ne peut pas décoder.
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

/**
 * ⭐ V3.48 — Champ MINIATURE PAR UPLOAD (même pattern que le module
 * Vidéos) : miniature PERSONNALISÉE si uploadée (elle prime), sinon la
 * miniature AUTOMATIQUE (YouTube/TikTok en mode lien, capture du
 * fichier en mode upload), sinon pictogramme Lucide (aucun emoji).
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
    <div className="rounded-xl border-2 border-[#8A8378]/15 bg-[#FAF6EF]/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-[#C9A227]" aria-hidden />
        <p className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">
          Miniature du média
        </p>
        <span className="text-[10px] text-[#8A8378] font-medium">
          (affichée sur la page publique)
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-36 h-[81px] rounded-lg border-2 border-[#C9A227]/30 overflow-hidden bg-[#2A0E3D] flex items-center justify-center shadow-md">
            {affichee ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={affichee} alt="Miniature du média" className="w-full h-full object-cover" />
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
            className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center shadow-lg hover:bg-[#DDBE55] transition-colors border-2 border-white cursor-pointer"
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
          <p className="text-[11px] text-[#1E0F2B]/70 leading-relaxed">
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
              <X className="w-3 h-3" /> {auto ? "Revenir à la miniature automatique" : "Retirer la miniature"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type PhaseUpload = "repos" | "fiche" | "envoi" | "finalisation" | "erreur";

function NouveauMediaModal({ open, onClose, servants, preselectedServantId, preselectedCategory }: NouveauMediaModalProps) {
  // ⭐ V3.47 — source du média : lien (YouTube/TikTok) OU FICHIER (upload direct).
  const [source, setSource] = useState<"lien" | "fichier">("lien");
  const [form, setForm] = useState({
    servantId: "",
    title: "",
    description: "",
    duration: "",
    videoUrl: "",
    // ⭐ V3.79 — catégorie de la page dédiée (Adoration ou Louanges) :
    // pré-sélectionnée sur l'onglet actif du module.
    category: CATEGORIES_ADORATION[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ⭐ V3.48 — MINIATURE :
  //  - miniatureLien : détectée depuis l'ID YouTube OU le proxy oEmbed
  //    TikTok (légende réelle + miniature) quand Afrika colle un lien ;
  //  - miniatureAuto : capturée depuis le fichier vidéo (mode fichier) ;
  //  - miniaturePerso : image CHOISIE via le champ d'upload — PRIME.
  const [miniatureLien, setMiniatureLien] = useState<string | null>(null);
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

  // Pré-remplir le serviteur (Afrika) + la catégorie (onglet actif) quand
  // le modal s'ouvre.
  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        servantId: preselectedServantId || f.servantId,
        category: preselectedCategory || f.category,
      }));
    }
  }, [open, preselectedServantId, preselectedCategory]);

  // Auto-extract : YouTube (miniature) OU TikTok (titre + miniature via le
  // proxy oEmbed public — la légende TikTok devient le titre pré-rempli,
  // comme les imports du pasteur sur /videos).
  const handleUrlChange = (url: string) => {
    setForm((f) => ({ ...f, videoUrl: url }));
    setError("");
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (match) {
      setMiniatureLien(`https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`);
      return;
    }
    if (estUrlTiktok(url)) {
      // ⭐ V3.79 — pré-remplissage TikTok : titre (légende réelle) +
      // miniature (signée — repli temporaire, le backfill R2 la rend
      // permanente ensuite). Best-effort : silencieux si le proxy échoue.
      fetch(`/api/tiktok/oembed?url=${encodeURIComponent(url)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { ok?: boolean; titre?: string; miniatureUrl?: string } | null) => {
          if (!d?.ok) return;
          if (d.miniatureUrl) setMiniatureLien(d.miniatureUrl);
          if (d.titre) {
            // Légende TikTok → titre (pré-rempli seulement si vide : Afrika
            // garde la main ; elle peut corriger avant de créer).
            setForm((f) => (f.title ? f : { ...f, title: d.titre as string }));
          }
        })
        .catch(() => {});
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
    // Nouveau média = nouvelle miniature : la personnalisée de l'ancien
    // fichier est retirée (l'auto sera capturée).
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
    if (!CATEGORIES_ADORATION.includes(form.category)) {
      setError("Choisissez la catégorie : Adoration ou Louanges");
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
      let mediaId = ficheCreeeId;

      // ① Créer (ou réutiliser) la fiche média
      if (!mediaId) {
        setPhase("fiche");
        // La miniature : la personnalisée uploadée, sinon l'automatique du
        // mode (YouTube/TikTok en lien, capture du fichier en upload).
        const thumbnailFinal =
          miniaturePerso ||
          (source === "fichier" ? miniatureAuto : miniatureLien) ||
          "";
        const res = await fetch("/admin/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            servantId: form.servantId,
            title: form.title,
            description: form.description,
            duration: form.duration || dureeAuto || "",
            // Mode lien : URL (YouTube/TikTok) ; mode fichier : null (l'URL
            // du stockage est posée par l'étape d'upload ci-dessous).
            videoUrl: source === "lien" ? form.videoUrl : null,
            thumbnailUrl: thumbnailFinal,
            isLive: false,
            views: 0,
            // ⭐ V3.79 — catégorie explicite (Adoration / Louanges) : le
            // média apparaîtra dans SA section de la page publique
            // /adoration-louanges (et nulle part ailleurs — scission).
            category: form.category,
            // Publié maintenant (tri publishedAt desc côté public).
            publishedAt: new Date().toISOString(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur lors de la création");
        }
        const data = await res.json();
        mediaId = data.item?.id ?? null;
        if (!mediaId) throw new Error("Identifiant du média manquant dans la réponse");
        setFicheCreeeId(mediaId);
      }

      // ② Envoyer le fichier (mode fichier uniquement) — ⭐ V3.51 upload
      // SÉQUENTIEL par morceaux vers R2 (reprise individuelle).
      if (source === "fichier" && fichier) {
        const contentType = fichier.type || "video/mp4";
        setPhase("envoi");
        setProgression(0);
        setDetailsProgression(null);
        let urlPublique: string | null = null;
        let r2NonConfigure = false;

        try {
          const { publicUrl } = await uploaderSequentielVersR2({
            endpoint: `/api/videos/${mediaId}/multipart`,
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
            console.warn("[Nouveau média adoration] R2 non configuré :", err.message);
          } else {
            throw err;
          }
        }

        // Confirmation : persister l'URL R2 en base (mode JSON — le
        // fichier est déjà sur R2, zéro re-transfert).
        if (urlPublique) {
          setPhase("finalisation");
          const commit = await fetch(`/api/videos/${mediaId}/upload`, {
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
          const up = await fetch(`/api/videos/${mediaId}/upload`, { method: "POST", body: fd });
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
        category: CATEGORIES_ADORATION[0],
      });
      setFichier(null);
      setMiniatureAuto(null);
      setMiniatureLien(null);
      setMiniaturePerso(null);
      setDureeAuto("");
      setFicheCreeeId(null);
      setDetailsProgression(null);
      setPhase("repos");
      onClose();
      // Refresh page to show new media
      window.location.reload();
    } catch (err) {
      setPhase("erreur");
      setError(
        (err instanceof Error ? err.message : "Erreur inconnue") +
          (ficheCreeeId ? " — la fiche média a été créée : « Réessayer l'envoi » ci-dessous reprendra l'envoi du fichier." : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  const phaseLabel: Record<PhaseUpload, string> = {
    repos: "",
    fiche: "Création de la fiche média…",
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
      title="Nouveau média — Adoration & Louanges"
      subtitle="Publier un chant d'Afrika sur la page publique /adoration-louanges"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sélecteur de source : Lien (YouTube/TikTok) OU Fichier */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#FAF6EF] border-2 border-[#8A8378]/15">
          <button
            type="button"
            onClick={() => { setSource("lien"); setError(""); }}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              source === "lien"
                ? "bg-white text-[#1E0F2B] shadow-md border border-[#C9A227]/40"
                : "text-[#8A8378] hover:text-[#1E0F2B]"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            Lien YouTube / TikTok
          </button>
          <button
            type="button"
            onClick={() => { setSource("fichier"); setError(""); }}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              source === "fichier"
                ? "bg-white text-[#1E0F2B] shadow-md border border-[#C9A227]/40"
                : "text-[#8A8378] hover:text-[#1E0F2B]"
            }`}
          >
            <Upload className="w-4 h-4" />
            Fichier vidéo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Serviteur (Afrika pré-sélectionnée — le module est le sien) */}
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
              placeholder={source === "fichier" && dureeAuto ? dureeAuto : "3:45 ou 1:24:30"}
              className={modalInputClass()}
            />
          </ModalField>
        </div>

        {/* ⭐ V3.79 — Catégorie : LA catégorie de la page dédiée (scission) */}
        <ModalField label="Catégorie" required fullWidth>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES_ADORATION.map((c) => {
              const Icon = c === "Adoration" ? Sparkles : Music;
              const actif = form.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, category: c })}
                  disabled={loading}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                    actif
                      ? "bg-[#C9A227] text-[#1E0F2B] shadow-md"
                      : "bg-[#FAF6EF] text-[#8A8378] border-2 border-[#8A8378]/20 hover:border-[#C9A227]/50 hover:text-[#1E0F2B]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {c}
                </button>
              );
            })}
          </div>
        </ModalField>

        {/* Titre */}
        <ModalField
          label="Titre"
          required
          fullWidth
          help={source === "lien" && estUrlTiktok(form.videoUrl) ? "Légende TikTok pré-remplie — corrigez si besoin" : undefined}
        >
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="Titre du chant (ex. « Adoration — Grand est l'Éternel »)"
            className={modalInputClass()}
          />
        </ModalField>

        {/* Description */}
        <ModalField label="Description" fullWidth>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Description courte…"
            className={`${modalInputClass()} resize-none`}
          />
        </ModalField>

        {source === "lien" ? (
          <div className="space-y-4">
            {/* URL vidéo */}
            <ModalField label="URL vidéo" help="YouTube, TikTok, etc. — le média se joue directement sur la page publique" fullWidth>
              <input
                type="text"
                value={form.videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.tiktok.com/@pamela.dali7/video/… ou https://youtube.com/watch?v=…"
                className={modalInputClass()}
              />
            </ModalField>

            {/* ⭐ V3.48/V3.79 — MINIATURE PAR UPLOAD : miniature détectée
                (YouTube ou TikTok oEmbed) par défaut, remplaçable. */}
            <MiniatureField
              perso={miniaturePerso}
              auto={miniatureLien}
              processing={miniatureProcessing}
              onUpload={handleMiniaturePersoChange}
              onRetirer={() => setMiniaturePerso(null)}
              autoLabel={estUrlTiktok(form.videoUrl) ? "Miniature TikTok détectée automatiquement" : "Miniature YouTube détectée automatiquement"}
            />
          </div>
        ) : (
          /* ⭐ V3.47 — Zone fichier vidéo (upload direct) */
          <div className="space-y-3">
            {!fichier ? (
              <label
                className="flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed border-[#C9A227]/50 bg-[#C9A227]/5 cursor-pointer hover:bg-[#C9A227]/10 transition-colors"
                title="Choisir le fichier vidéo à envoyer"
              >
                <FileVideo className="w-10 h-10 text-[#C9A227]" />
                <div className="text-center">
                  <p className="text-sm font-bold text-[#1E0F2B]">
                    Choisir le fichier vidéo
                  </p>
                  <p className="text-xs text-[#8A8378] mt-1">
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
              <div className="flex items-start gap-4 p-4 rounded-xl border-2 border-[#C9A227]/40 bg-[#FAF6EF]">
                {/* Aperçu miniature auto-capturée */}
                <div className="w-36 h-[81px] rounded-lg overflow-hidden bg-[#2A0E3D] flex items-center justify-center flex-shrink-0 border border-[#8A8378]/15">
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
                  <p className="text-sm font-bold text-[#1E0F2B] truncate" title={fichier.name}>
                    {fichier.name}
                  </p>
                  <p className="text-xs text-[#8A8378] mt-0.5">
                    {tailleLisibleFichier(fichier.size)}
                    {dureeAuto ? ` · durée ${dureeAuto}` : ""}
                    {extractionEnCours ? " · analyse en cours…" : ""}
                  </p>
                  {miniatureAuto && (
                    <p className="text-[10px] text-[#8A8378]/80 mt-1 flex items-center gap-1">
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
                      <X className="w-3 h-3" /> Choisir un autre fichier
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ⭐ V3.48 — MINIATURE PAR UPLOAD : la miniature capturée depuis
                le fichier sert de DÉFAUT, remplaçable par une image. */}
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

        <ModalError error={error} />

        {/* ⭐ V3.47 — Progression de l'envoi */}
        {loading && (phase === "envoi" || phase === "fiche" || phase === "finalisation") && (
          <div className="px-4 py-3 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#1E0F2B] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A227]" />
                {phaseLabel[phase]}
              </p>
              {phase === "envoi" && (
                <span className="text-xs font-bold text-[#A3821C]">{progression}%</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-[#8A8378]/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#C9A227] to-[#DDBE55] transition-all duration-300"
                style={{ width: `${phase === "envoi" ? progression : phase === "finalisation" ? 100 : 8}%` }}
              />
            </div>
            {fichier && phase === "envoi" && (
              <p className="text-[10px] text-[#8A8378] mt-1.5">
                {tailleLisibleFichier(fichier.size)} — ne fermez pas cette fenêtre pendant l&apos;envoi.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || extractionEnCours || miniatureProcessing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {phase === "envoi" ? "Envoi en cours…" : "Création…"}
              </>
            ) : (
              <>
                {source === "fichier" ? <Upload className="w-4 h-4" /> : <Clapperboard className="w-4 h-4" />}
                {source === "fichier" ? "Créer et envoyer le média" : "Créer le média"}
              </>
            )}
          </button>
          {/* Fiche créée mais envoi échoué → reprise directe */}
          {ficheCreeeId && phase === "erreur" && fichier && !loading && (
            <button
              type="button"
              onClick={() => envoyer(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors"
            >
              <Upload className="w-4 h-4" /> Réessayer l&apos;envoi
            </button>
          )}
        </div>
      </form>
    </AdminModal>
  );
}
