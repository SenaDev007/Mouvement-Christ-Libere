"use client";

import { useState, useEffect } from "react";
import { Pencil, Loader2, AlertCircle, Save } from "lucide-react";
import {
  AdminModal, ModalField, ModalSubmit, ModalError, modalInputClass,
} from "@/components/admin/admin-modal";
import { ThumbnailUploader } from "@/components/live/thumbnail-uploader";

interface EditLiveModalProps {
  liveId: string;
  servants: { id: string; shortName: string; code: string }[];
}

export function EditLiveModal({ liveId, servants }: EditLiveModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    servantId: "",
    scheduledAt: "",
    title: "",
    description: "",
    thumbnailUrl: "" as string | null,
    status: "SCHEDULED",
    streamToYoutube: true,
    streamToFacebook: false,
    streamToTiktok: false,
    multistreamEnabled: true,
  });

  // Charger les données du live quand le modal s'ouvre
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    fetch(`/admin/api/lives/${liveId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const live = data.item;
        if (live) {
          // Convertir la date ISO en format datetime-local
          const date = new Date(live.scheduledAt);
          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          const dateStr = localDate.toISOString().slice(0, 16);

          setForm({
            servantId: live.servantId || "",
            scheduledAt: dateStr,
            title: live.title || "",
            description: live.description || "",
            thumbnailUrl: live.thumbnailUrl || null,
            status: live.status || "SCHEDULED",
            streamToYoutube: live.streamToYoutube ?? true,
            streamToFacebook: live.streamToFacebook ?? false,
            streamToTiktok: live.streamToTiktok ?? false,
            multistreamEnabled: live.multistreamEnabled ?? true,
          });
        }
      })
      .catch(() => setError("Impossible de charger le live"))
      .finally(() => setFetching(false));
  }, [open, liveId]);

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
      };

      const res = await fetch(`/admin/api/lives/${liveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      // Upload thumbnail si base64
      if (form.thumbnailUrl && form.thumbnailUrl.startsWith("data:image/")) {
        try {
          await fetch(`/api/live/${liveId}/thumbnail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnail: form.thumbnailUrl }),
          });
        } catch {}
      }

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
        className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors"
        aria-label="Modifier"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Modifier le live"
        subtitle={form.title || "Chargement..."}
        size="lg"
        accentColor="#C9A227"
      >
        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#C9A227] animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Serviteur + Date + Statut */}
            <div className="grid grid-cols-3 gap-4">
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
              <ModalField label="Statut">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={modalInputClass()}
                >
                  <option value="SCHEDULED">Programmé</option>
                  <option value="LIVE">En direct</option>
                  <option value="ENDED">Terminé</option>
                  <option value="CANCELLED">Annulé</option>
                </select>
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

            {/* Thumbnail */}
            <ThumbnailUploader
              liveId={liveId}
              currentThumbnail={form.thumbnailUrl}
              onThumbnailChange={(url) => setForm({ ...form, thumbnailUrl: url })}
            />

            {/* Multistream */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
                <input type="checkbox" checked={form.streamToYoutube}
                  onChange={(e) => setForm({ ...form, streamToYoutube: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A227]" />
                <span className="text-sm font-semibold text-[#1E0F2B]">Diffuser sur YouTube</span>
              </label>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
                <input type="checkbox" checked={form.streamToFacebook}
                  onChange={(e) => setForm({ ...form, streamToFacebook: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A227]" />
                <span className="text-sm font-semibold text-[#1E0F2B]">Diffuser sur Facebook</span>
              </label>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
                <input type="checkbox" checked={form.streamToTiktok}
                  onChange={(e) => setForm({ ...form, streamToTiktok: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A227]" />
                <span className="text-sm font-semibold text-[#1E0F2B]">Diffuser sur TikTok</span>
              </label>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
                <input type="checkbox" checked={form.multistreamEnabled}
                  onChange={(e) => setForm({ ...form, multistreamEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#C9A227]" />
                <div>
                  <div className="text-sm font-semibold text-[#1E0F2B]">Activer le multistreaming</div>
                  <div className="text-xs text-[#8A8378]">Diffusion simultanée sur les plateformes cochées</div>
                </div>
              </label>
            </div>

            <ModalError error={error} />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors">
                Annuler
              </button>
              <ModalSubmit loading={loading} disabled={!form.servantId || !form.title || !form.scheduledAt} label="Enregistrer" />
            </div>
          </form>
        )}
      </AdminModal>
    </>
  );
}
