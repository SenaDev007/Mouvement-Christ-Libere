"use client";

import { useState } from "react";
import { Plus, Loader2, AlertCircle, Save } from "lucide-react";
import {
  AdminModal, ModalField, ModalSubmit, ModalError, modalInputClass,
} from "@/components/admin/admin-modal";
import { ThumbnailUploader } from "@/components/live/thumbnail-uploader";
// ⭐ V3.46 — Rubriques signatures (le replay du live hérite de la rubrique).
import { RUBRIQUE_OPTIONS } from "@/lib/video-rubrics";

interface ServantLite { id: string; shortName: string; code: string; }

interface NewLiveButtonProps {
  servants: ServantLite[];
  accentColor?: string;
}

export function NewLiveButton({ servants, accentColor = "#C9A227" }: NewLiveButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    servantId: "",
    scheduledAt: "",
    title: "",
    description: "",
    // ⭐ V3.46 — rubrique du live (vide = replay auto-catégorisé).
    category: "",
    thumbnailUrl: "" as string | null,
    streamToYoutube: true,
    streamToFacebook: false,
    streamToTiktok: false,
    streamToInstagram: false,
    multistreamEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.servantId || !form.title || !form.scheduledAt) {
      setError("Serviteur, titre et date sont requis");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const body = {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        thumbnailUrl: form.thumbnailUrl || null,
        // ⭐ V3.46 — rubrique explicite (null = automatique).
        category: form.category || null,
      };

      const res = await fetch("/admin/api/lives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      const data = await res.json();

      // Le thumbnailUrl (base64) est déjà stocké via /admin/api/lives (colonne TEXT en DB)
      // Pas besoin d'appeler /api/live/[id]/thumbnail séparément

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md"
        style={{ backgroundColor: accentColor, color: "#000000" }}
      >
        <Plus className="w-4 h-4" />
        Programmer un live
      </button>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Programmer un live"
        subtitle="Planifier une session de streaming en direct"
        size="lg"
        accentColor={accentColor}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Serviteur + Date */}
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Serviteur" required>
              <select
                value={form.servantId}
                onChange={(e) => setForm({ ...form, servantId: e.target.value })}
                required
                className={modalInputClass()}
              >
                <option value="">Choisir...</option>
                {servants.map((s) => (
                  <option key={s.id} value={s.id}>{s.shortName}</option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Date & heure" required>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                required
                className={modalInputClass()}
              />
            </ModalField>
          </div>

          {/* Titre */}
          <ModalField label="Titre du live" required fullWidth>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Ex: Enseignement sur l'horloge céleste"
              className={modalInputClass()}
            />
          </ModalField>

          {/* ⭐ V3.46 — Rubrique du live : le replay sera automatiquement
              classé dans cette rubrique sur la page publique /videos. */}
          <ModalField label="Rubrique du live" fullWidth>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={modalInputClass()}
              title="Le replay du live sera automatiquement classé dans cette rubrique"
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
              placeholder="Décrivez le sujet du live..."
              className={`${modalInputClass()} resize-none`}
            />
          </ModalField>

          {/* Upload miniature */}
          <ThumbnailUploader
            currentThumbnail={form.thumbnailUrl}
            onThumbnailChange={(url) => setForm({ ...form, thumbnailUrl: url })}
          />

          {/* Multistream checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] cursor-pointer hover:border-[#FF7A1A] transition-colors">
              <input type="checkbox" checked={form.streamToYoutube}
                onChange={(e) => setForm({ ...form, streamToYoutube: e.target.checked })}
                className="w-4 h-4 accent-[#C9A227]" />
              <span className="text-sm font-semibold text-[#000000]">Diffuser sur YouTube</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] cursor-pointer hover:border-[#FF7A1A] transition-colors">
              <input type="checkbox" checked={form.streamToFacebook}
                onChange={(e) => setForm({ ...form, streamToFacebook: e.target.checked })}
                className="w-4 h-4 accent-[#C9A227]" />
              <span className="text-sm font-semibold text-[#000000]">Diffuser sur Facebook</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] cursor-pointer hover:border-[#FF7A1A] transition-colors">
              <input type="checkbox" checked={form.streamToTiktok}
                onChange={(e) => setForm({ ...form, streamToTiktok: e.target.checked })}
                className="w-4 h-4 accent-[#C9A227]" />
              <span className="text-sm font-semibold text-[#000000]">Diffuser sur TikTok</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] cursor-pointer hover:border-[#FF7A1A] transition-colors">
              <input type="checkbox" checked={form.streamToInstagram}
                onChange={(e) => setForm({ ...form, streamToInstagram: e.target.checked })}
                className="w-4 h-4 accent-[#C9A227]" />
              <span className="text-sm font-semibold text-[#000000]">Diffuser sur Instagram</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A857C]/20 bg-[#F0E9DE] cursor-pointer hover:border-[#FF7A1A] transition-colors">
              <input type="checkbox" checked={form.multistreamEnabled}
                onChange={(e) => setForm({ ...form, multistreamEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#C9A227]" />
              <div>
                <div className="text-sm font-semibold text-[#000000]">Activer le multistreaming</div>
                <div className="text-xs text-[#8A857C]">Si activé, le live sera diffusé simultanément sur les plateformes cochées</div>
              </div>
            </label>
          </div>

          <ModalError error={error} />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A857C]/10">
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A857C] hover:text-[#000000] transition-colors">
              Annuler
            </button>
            <ModalSubmit loading={loading} disabled={!form.servantId || !form.title || !form.scheduledAt} label="Créer le live" />
          </div>
        </form>
      </AdminModal>
    </>
  );
}
