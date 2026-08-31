"use client";

/**
 * ⭐ V2.7 — Modal d'édition d'utilisateur (back-office /admin/users).
 *
 * Outre le rôle et la vérification (existant), permet désormais de
 * MODIFIER LA PHOTO de l'utilisateur (upload compressé ≤ 60 KB en data URL
 * → User.avatarUrl) — notamment les serviteurs (Pam, Pasteur Kongo) dont la
 * photo s'affiche dans les canaux vocaux Yeshua Connect et les bulles de chat.
 */

import { useState, useEffect, useRef } from "react";
import {
  Pencil, Loader2, AlertCircle, X, Shield, Crown, MessageSquare,
  Users as UsersIcon, CheckCircle2, Camera, Trash2,
} from "lucide-react";
import { compressAvatar } from "@/lib/avatar-upload";

interface EditUserModalProps {
  userId: string;
  userName: string | null;
  currentRole: string;
  isVerified: boolean;
  currentAvatarUrl?: string | null;
  isSuperAdmin: boolean; // si l'admin courant est super admin
}

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin", desc: "Accès complet + gestion des admins", icon: Crown, color: "#C9A227" },
  { value: "ADMIN", label: "Admin", desc: "Accès complet au back-office", icon: Shield, color: "#8C5FA8" },
  { value: "MODERATOR", label: "Modérateur", desc: "Modération des contenus", icon: MessageSquare, color: "#3B82F6" },
  { value: "ANIMATOR", label: "Animateur", desc: "Animation des canaux", icon: UsersIcon, color: "#10B981" },
  { value: "MEMBER_VERIFIED", label: "Membre vérifié", desc: "Membre authentifié", icon: CheckCircle2, color: "#6B7280" },
  { value: "MEMBER", label: "Membre", desc: "Inscrit de base", icon: UsersIcon, color: "#9CA3AF" },
];

export function EditUserModal({ userId, userName, currentRole, isVerified, currentAvatarUrl, isSuperAdmin }: EditUserModalProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(currentRole);
  const [verified, setVerified] = useState(isVerified);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ⭐ V2.7 — Photo de l'utilisateur (data URL compressée ou URL existante)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl ?? null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = (userName || "?").charAt(0).toUpperCase();

  useEffect(() => {
    setRole(currentRole);
    setVerified(isVerified);
    setAvatarUrl(currentAvatarUrl ?? null);
  }, [currentRole, isVerified, currentAvatarUrl, open]);

  /** Compresse l'image choisie (≤ 60 KB, 256×256) et l'affiche en aperçu. */
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarProcessing(true);
    setError("");
    try {
      const dataUrl = await compressAvatar(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setAvatarProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = { role, isVerified: verified };
      // On n'envoie l'avatar que s'il a changé (data URL nouvelle ou retrait)
      if ((currentAvatarUrl ?? null) !== avatarUrl) {
        payload.avatarUrl = avatarUrl;
      }

      const res = await fetch(`/admin/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      setOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Ne pas permettre de modifier un super admin si on n'est pas super admin
  const canEditRole = isSuperAdmin || currentRole !== "SUPER_ADMIN";
  // Ne pas permettre d'attribuer SUPER_ADMIN si on n'est pas super admin
  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r.value !== "SUPER_ADMIN");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canEditRole}
        className="p-2 rounded-lg hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#C9A227] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Modifier"
        title={canEditRole ? "Modifier l'utilisateur (rôle, photo…)" : "Impossible de modifier un super admin"}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1A0826]/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 max-w-md w-full overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />

            {/* Header */}
            <div className="px-6 py-4 border-b border-[#8A8378]/10 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-[#1E0F2B]">Modifier l&apos;utilisateur</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* ⭐ V2.7 — Photo de profil */}
              <div>
                <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-2">
                  Photo de profil
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A227] to-[#A3821C] flex items-center justify-center text-white font-bold text-2xl overflow-hidden border-2 border-[#C9A227]/30 flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={userName || "Avatar"} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                    {avatarProcessing && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      className="hidden"
                      id={`avatar-input-${userId}`}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarProcessing}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-xs font-bold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl(null)}
                        disabled={avatarProcessing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Retirer
                      </button>
                    )}
                    <p className="text-[10px] text-[#8A8378]">
                      JPG/PNG · recadrée en carré · compressée ≤ 60 KB
                    </p>
                  </div>
                </div>
              </div>

              {/* Rôle */}
              <div>
                <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-2">
                  Rôle
                </label>
                <div className="space-y-2">
                  {availableRoles.map((r) => {
                    const Icon = r.icon;
                    return (
                      <label
                        key={r.value}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                          role === r.value
                            ? "border-[#C9A227] bg-[#C9A227]/5"
                            : "border-[#8A8378]/20 hover:border-[#8A8378]/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r.value}
                          checked={role === r.value}
                          onChange={(e) => setRole(e.target.value)}
                          className="mt-1 accent-[#C9A227]"
                        />
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 mt-0.5" style={{ color: r.color }} />
                          <div>
                            <div className="text-sm font-semibold text-[#1E0F2B]">{r.label}</div>
                            <div className="text-xs text-[#8A8378]">{r.desc}</div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Vérification */}
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] cursor-pointer hover:border-[#C9A227] transition-colors">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="w-4 h-4 accent-[#C9A227]"
                />
                <div>
                  <div className="text-sm font-semibold text-[#1E0F2B]">Compte vérifié</div>
                  <div className="text-xs text-[#8A8378]">L&apos;utilisateur peut se connecter et accéder à la communauté</div>
                </div>
              </label>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#8A8378]/10">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
