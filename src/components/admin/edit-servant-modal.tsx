"use client";

/**
 * ⭐ V2.8 — MODAL D'ÉDITION DU SERVITEUR (back-office /admin/servants).
 *
 * Remplace l'ancienne page pleine /admin/servants/[id]/edit par un MODAL
 * professionnel (AdminModal) : la liste reste visible derrière, la
 * modification est rapide — photo de profil compressée incluse
 * (≤ 60 Ko, synchronisée vers le compte User via l'API, cf. V2.7).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save, Trash2 } from "lucide-react";
import { AdminModal, ModalField, ModalError } from "./admin-modal";
import { compressAvatar } from "@/lib/avatar-upload";

export interface ServantLight {
  id: string;
  code: string;
  fullName: string;
  shortName: string;
  role: string;
  bio: string | null;
  portraitUrl: string | null;
  isActive: boolean;
}

interface EditServantModalProps {
  servant: ServantLight;
  open: boolean;
  onClose: () => void;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15 transition-all placeholder:text-[#8A8378]/50";

export function EditServantModal({ servant, open, onClose }: EditServantModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: servant.code || "",
    fullName: servant.fullName || "",
    shortName: servant.shortName || "",
    role: servant.role || "",
    bio: servant.bio || "",
    isActive: servant.isActive,
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(servant.portraitUrl);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Compresse la photo choisie (≤ 60 Ko) et l'affiche en aperçu. */
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoProcessing(true);
    setError("");
    try {
      const dataUrl = await compressAvatar(file);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setPhotoProcessing(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.code.trim()) {
      setError("Le code et le nom complet sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/admin/api/servants/${servant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          fullName: form.fullName.trim(),
          shortName: form.shortName.trim(),
          role: form.role.trim(),
          bio: form.bio || null,
          portraitUrl: photoUrl,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Échec de l'enregistrement");
      }
      // Rafraîchir les données serveur (liste + stats) puis fermer le modal
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.shortName || form.fullName || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 3)
    .toUpperCase();

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Modifier le serviteur"
      subtitle={servant.fullName}
      size="md"
      accentColor="#C9A227"
    >
      <div className="space-y-5">
        {/* ─── Photo de profil ─────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl border-4 border-[#C9A227]/30 overflow-hidden bg-[#2A0E3D] flex items-center justify-center shadow-lg">
              {photoUrl ? (
                <img src={photoUrl} alt={form.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-2xl font-bold text-[#C9A227]">{initials}</span>
              )}
              {photoProcessing && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center rounded-2xl">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            {/* Badge caméra */}
            <label
              className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center shadow-lg hover:bg-[#DDBE55] transition-colors border-2 border-white cursor-pointer"
              title="Changer la photo"
            >
              {photoProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="hidden"
                aria-label="Changer la photo"
              />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#1E0F2B] truncate">{form.fullName || "Serviteur"}</p>
            <p className="text-xs text-[#8A8378] mt-0.5">{form.role || "Rôle"}</p>
            <p className="text-[10px] text-[#8A8378]/80 mt-2 leading-relaxed">
              Photo affichée sur le site public ET synchronisée vers Yeshua Connect
              (canaux vocaux, chat) — compressée ≤ 60 Ko.
            </p>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Retirer la photo
              </button>
            )}
          </div>
        </div>

        <ModalError error={error} />

        {/* ─── Champs ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <ModalField label="Code" required>
            <input
              className={inputClass}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="pam"
            />
          </ModalField>
          <ModalField label="Nom court" required>
            <input
              className={inputClass}
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
              placeholder="Pam"
            />
          </ModalField>
          <ModalField label="Nom complet" required fullWidth>
            <input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Pam (Servante de Dieu)"
            />
          </ModalField>
          <ModalField label="Rôle" fullWidth>
            <input
              className={inputClass}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="Fondatrice · Visionnaire"
            />
          </ModalField>
          <ModalField label="Biographie courte" fullWidth>
            <textarea
              className={`${inputClass} min-h-[90px] resize-y`}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Quelques lignes sur le ministère…"
            />
          </ModalField>
          <ModalField label="Serviteur actif" help="Afficher ce serviteur sur le site public" fullWidth>
            <label className="flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer w-fit transition-colors hover:border-[#C9A227]/50">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-[#C9A227]"
              />
              <span className="text-sm font-medium text-[#1E0F2B]">
                {form.isActive ? "Visible sur le site" : "Masqué du site public"}
              </span>
            </label>
          </ModalField>
        </div>

        {/* ─── Actions ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-[#8A8378]/10">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#8A8378] hover:bg-[#8A8378]/10 transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || photoProcessing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
