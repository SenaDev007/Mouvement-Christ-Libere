"use client";

import { useState, useEffect } from "react";
import { Pencil, Loader2, AlertCircle, X, Shield, Crown, MessageSquare, Users as UsersIcon, CheckCircle2 } from "lucide-react";

interface EditUserModalProps {
  userId: string;
  currentRole: string;
  isVerified: boolean;
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

export function EditUserModal({ userId, currentRole, isVerified, isSuperAdmin }: EditUserModalProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(currentRole);
  const [verified, setVerified] = useState(isVerified);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRole(currentRole);
    setVerified(isVerified);
  }, [currentRole, isVerified, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/admin/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, isVerified: verified }),
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
        title={canEditRole ? "Modifier le rôle" : "Impossible de modifier un super admin"}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1A0826]/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 max-w-md w-full overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />

            {/* Header */}
            <div className="px-6 py-4 border-b border-[#8A8378]/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1E0F2B]">Modifier l'utilisateur</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
                  <div className="text-xs text-[#8A8378]">L'utilisateur peut se connecter et accéder à la communauté</div>
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
