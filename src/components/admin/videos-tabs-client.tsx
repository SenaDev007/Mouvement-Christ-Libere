"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, Pencil, Video as VideoIcon, Radio, Eye, Clock, Crown,
  X, Loader2, AlertCircle, Save, Tag, ChevronDown,
} from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminModal, ModalField, ModalSubmit, ModalError, modalInputClass } from "@/components/admin/admin-modal";
import type { Video, Servant } from "@prisma/client";

type VideoWithServant = Video & { servant: Servant };

interface VideosTabsClientProps {
  videos: VideoWithServant[];
  servants: Servant[];
}

// Catégorisation (même logique que la page /videos publique)
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

function categorize(title: string, servant: string): string {
  const t = title.toLowerCase();
  if (servant === "kongo") {
    if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
    if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
    if (t.includes("fête") || t.includes("shabbat")) return "Fêtes & Shabbat";
    if (t.includes("discernement") || t.includes("occult")) return "Discernement Spirituel";
    return "Paroles & Exhortations";
  }
  if (t.includes("direct") || t.includes("en direct")) return "Lives & Directs";
  if (t.includes("prière") || t.includes("délivrance")) return "Prière & Délivrance";
  if (t.includes("enseignement") || t.includes("prédication")) return "Enseignements & Prédications";
  if (t.includes("témoignage") || t.includes("vision")) return "Témoignages & Visions";
  if (t.includes("shabbat") || t.includes("fête")) return "Fêtes & Shabbat";
  return "Paroles & Exhortations";
}

export function VideosTabsClient({ videos, servants }: VideosTabsClientProps) {
  const initialServant =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("servant") || "all"
      : "all";

  const [activeTab, setActiveTab] = useState<string>(initialServant);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);

  // Filtrer par serviteur
  const videosByServant = useMemo(() => {
    return activeTab === "all"
      ? videos
      : videos.filter((v) => v.servant.code === activeTab);
  }, [videos, activeTab]);

  // Catégoriser les vidéos
  const categories = useMemo(() => {
    const catsMap = new Map<string, VideoWithServant[]>();
    for (const v of videosByServant) {
      const servantCode = v.servant.code;
      const cat = categorize(v.title, servantCode);
      if (!catsMap.has(cat)) catsMap.set(cat, []);
      catsMap.get(cat)!.push(v);
    }
    // Trier selon l'ordre fixe
    const result: Array<{ name: string; videos: VideoWithServant[] }> = [];
    for (const catName of CATEGORY_ORDER) {
      if (catsMap.has(catName)) {
        result.push({ name: catName, videos: catsMap.get(catName)! });
      }
    }
    // Ajouter les catégories non listées
    for (const [name, vids] of catsMap) {
      if (!CATEGORY_ORDER.includes(name)) {
        result.push({ name, videos: vids });
      }
    }
    return result;
  }, [videosByServant]);

  // Filtrer par catégorie
  const filteredVideos = useMemo(() => {
    if (activeCategory === "all") return videosByServant;
    const cat = categories.find((c) => c.name === activeCategory);
    return cat?.videos || [];
  }, [videosByServant, activeCategory, categories]);

  const counts = {
    all: videos.length,
    pam: videos.filter((v) => v.servant.code === "pam").length,
    kongo: videos.filter((v) => v.servant.code === "kongo").length,
  };

  const tabs = [
    { id: "all", label: "Toutes", count: counts.all, icon: VideoIcon },
    { id: "pam", label: "Pam", count: counts.pam, icon: Crown, color: "#C9A227" },
    { id: "kongo", label: "Pasteur Kongo", count: counts.kongo, icon: Crown, color: "#8C5FA8" },
  ];

  // Ouvrir le modal (avec serviteur pré-sélectionné si onglet actif)
  const openNewVideoModal = () => {
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
            Bibliothèque vidéo
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            Vidéos
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            Vidéos archivées et lives enregistrés — {videos.length} au total.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewVideoModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] text-sm font-bold hover:bg-[#DDBE55] transition-colors shadow-md"
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
      <div className="flex items-center gap-2 border-b border-[#8A8378]/15 overflow-x-auto">
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
                  ? "text-[#1E0F2B]"
                  : "text-[#8A8378] hover:text-[#1E0F2B]"
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
                      : "bg-[#1E0F2B] text-white"
                    : "bg-[#8A8378]/15 text-[#8A8378]"
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
                  style={{ backgroundColor: tab.color || "#1E0F2B" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Filtres catégories */}
      {activeTab !== "all" && categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider font-bold text-[#8A8378] flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            Catégorie:
          </span>
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === "all"
                ? "bg-[#2A0E3D] text-[#FAF6EF]"
                : "bg-[#8A8378]/10 text-[#8A8378] hover:bg-[#8A8378]/20"
            }`}
          >
            Toutes ({videosByServant.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat.name
                  ? "bg-[#C9A227] text-[#1E0F2B]"
                  : "bg-[#8A8378]/10 text-[#8A8378] hover:bg-[#8A8378]/20"
              }`}
            >
              {cat.name} ({cat.videos.length})
            </button>
          ))}
        </div>
      )}

      {/* Grille vidéos */}
      {filteredVideos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#8A8378]/30 p-12 text-center">
          <VideoIcon className="w-10 h-10 text-[#8A8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378] italic">
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
            const accentColor = isPam ? "#C9A227" : "#8C5FA8";

            return (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden hover:shadow-lg transition-all group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-[#1A0826] overflow-hidden">
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <VideoIcon className="w-8 h-8 text-[#FAF6EF]/30" />
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-black/70 text-white backdrop-blur-sm">
                        {categorize(v.title, v.servant.code)}
                      </span>
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
                  <h3 className="font-semibold text-sm text-[#1E0F2B] line-clamp-2 leading-tight">
                    {v.title}
                  </h3>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#8A8378]">
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

                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-[#8A8378]/10 ">
                    <Link
                      href={`/admin/videos/${v.id}/edit`}
                      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
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

// ============ Modal Nouvelle Vidéo ============
interface NewVideoModalProps {
  open: boolean;
  onClose: () => void;
  servants: Servant[];
  preselectedServantCode: string | null;
}

function NewVideoModal({ open, onClose, servants, preselectedServantCode }: NewVideoModalProps) {
  const [form, setForm] = useState({
    servantId: "",
    title: "",
    description: "",
    duration: "",
    videoUrl: "",
    thumbnailUrl: "",
    isLive: false,
    views: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pré-remplir le serviteur quand le modal s'ouvre
  useEffect(() => {
    if (open && preselectedServantCode) {
      const s = servants.find((srv) => srv.code === preselectedServantCode);
      if (s) setForm((f) => ({ ...f, servantId: s.id }));
    }
  }, [open, preselectedServantCode, servants]);

  // Auto-extract YouTube ID + thumbnail from URL
  const handleUrlChange = (url: string) => {
    setForm((f) => ({ ...f, videoUrl: url }));
    // Extract YouTube ID
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (match && !form.thumbnailUrl) {
      const ytId = match[1];
      setForm((f) => ({
        ...f,
        thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.servantId || !form.title) {
      setError("Serviteur et titre sont requis");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/admin/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          views: Number(form.views) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      // Reset + close
      setForm({
        servantId: "",
        title: "",
        description: "",
        duration: "",
        videoUrl: "",
        thumbnailUrl: "",
        isLive: false,
        views: 0,
      });
      onClose();
      // Refresh page to show new video
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
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
          <ModalField label="Durée">
            <input
              type="text"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder="1:24:30 ou EN DIRECT"
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

        <div className="grid grid-cols-2 gap-4">
          {/* URL vidéo */}
          <ModalField label="URL vidéo" help="YouTube, Vimeo, etc.">
            <input
              type="text"
              value={form.videoUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className={modalInputClass()}
            />
          </ModalField>

          {/* Thumbnail */}
          <ModalField label="URL miniature" help="Auto-rempli depuis YouTube">
            <input
              type="text"
              value={form.thumbnailUrl}
              onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
              placeholder="https://..."
              className={modalInputClass()}
            />
          </ModalField>
        </div>

        {/* Checkbox Live */}
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
          <input
            type="checkbox"
            checked={form.isLive}
            onChange={(e) => setForm({ ...form, isLive: e.target.checked })}
            className="w-4 h-4 accent-[#C9A227]"
          />
          <div>
            <div className="text-sm font-semibold text-[#1E0F2B]">En direct maintenant</div>
            <div className="text-xs text-[#8A8378]">Marquer comme live actif</div>
          </div>
        </label>

        <ModalError error={error} />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors"
          >
            Annuler
          </button>
          <ModalSubmit loading={loading} label="Créer la vidéo" />
        </div>
      </form>
    </AdminModal>
  );
}
