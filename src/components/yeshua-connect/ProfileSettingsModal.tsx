"use client";

/**
 * ⭐ V2.9 — ProfileSettingsModal — Éditeur de profil complet dans Yeshua
 * Connect (remplace le stub « Membre / Disciple » au bouton inerte).
 *
 * Permet à l'utilisateur connecté de modifier :
 *   - sa PHOTO de profil (compression canvas ≤ 60 KB, partagée avec /profil)
 *   - son nom affiché, son téléphone
 *   - son pays, sa ville, sa bio
 *
 * Persistance : PUT /api/user/profile (NextAuth) — les autres membres
 * voient la mise à jour via le rafraîchissement des conversations.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Camera, Check, Trash2, X, User as UserIcon, Phone, Globe, MapPin, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { compressAvatar } from "@/lib/avatar-upload";

interface ProfileData {
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  bio?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  MODERATOR: "Modérateur",
  ANIMATOR: "Animateur",
  MEMBER: "Membre",
};

export function ProfileSettingsModal({
  currentUserId,
  currentUserRole,
  onClose,
  onSaved,
}: {
  currentUserId?: string;
  currentUserRole?: string;
  onClose: () => void;
  /** Appelé après sauvegarde : (avatarUrl | undefined) pour rafraîchir l'UI. */
  onSaved?: (avatarUrl?: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>({});
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(api.url("/api/user/profile"), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ProfileData) => {
        if (cancelled) return;
        setProfile(data);
        setAvatarUrl(data.avatarUrl ?? undefined);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setCountry(data.country ?? "");
        setCity(data.city ?? "");
        setBio(data.bio ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Impossible de charger votre profil. Réessayez.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Veuillez choisir une image.");
      return;
    }
    try {
      const compressed = await compressAvatar(file, 256);
      setAvatarUrl(compressed);
      setError(null);
    } catch {
      setError("Compression de l'image impossible. Essayez une autre photo.");
    }
  }, []);

  const removePhoto = useCallback(() => setAvatarUrl(undefined), []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!name.trim()) {
      setError("Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(api.url("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          country: country.trim() || null,
          city: city.trim() || null,
          bio: bio.trim() || null,
          avatarUrl: avatarUrl ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved?.(avatarUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [saving, name, phone, country, city, bio, avatarUrl, onSaved]);

  const roleLabel = ROLE_LABELS[profile.role || currentUserRole || "MEMBER"] || "Membre";
  const initials = (name || profile.email || "?")
    .trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("");

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A0826]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-[#C9A227]/25">
        {/* Bandeau */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-white/95 backdrop-blur border-b border-[#8A8378]/15">
          <h2 className="text-sm font-bold text-[#1E0F2B]">Mon profil</h2>
          <div className="flex items-center gap-2">
            {savedFlash && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <Check className="w-3.5 h-3.5" />Enregistré
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-[#8A8378]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Photo de profil */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Ma photo" className="w-24 h-24 rounded-full object-cover border-3 border-[#C9A227]/40 shadow-md" style={{ borderWidth: 3 }} />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#2A0E3D] text-white flex items-center justify-center text-2xl font-bold shadow-md">
                    {initials || <UserIcon className="w-8 h-8" />}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center shadow-md hover:bg-[#DDBE55] transition-colors"
                  title="Changer ma photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#8A8378]">
                <span>{roleLabel}</span>
                {avatarUrl && (
                  <button onClick={removePhoto} className="inline-flex items-center gap-1 text-red-500 hover:text-red-600 font-medium">
                    <Trash2 className="w-3 h-3" />Retirer la photo
                  </button>
                )}
              </div>
            </div>

            {/* Champs */}
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-[#8A8378] uppercase tracking-wide">Nom affiché</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="mt-1 w-full px-3.5 py-2.5 bg-[#FAF6EF] border border-[#8A8378]/20 rounded-xl text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                  placeholder="Votre nom"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-[#8A8378] uppercase tracking-wide flex items-center gap-1"><Phone className="w-3 h-3" />Téléphone</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                    className="mt-1 w-full px-3.5 py-2.5 bg-[#FAF6EF] border border-[#8A8378]/20 rounded-xl text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                    placeholder="+229 …"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-[#8A8378] uppercase tracking-wide flex items-center gap-1"><MapPin className="w-3 h-3" />Ville</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={60}
                    className="mt-1 w-full px-3.5 py-2.5 bg-[#FAF6EF] border border-[#8A8378]/20 rounded-xl text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                    placeholder="Cotonou…"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] font-bold text-[#8A8378] uppercase tracking-wide flex items-center gap-1"><Globe className="w-3 h-3" />Pays</span>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={60}
                  className="mt-1 w-full px-3.5 py-2.5 bg-[#FAF6EF] border border-[#8A8378]/20 rounded-xl text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/40"
                  placeholder="Bénin…"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-[#8A8378] uppercase tracking-wide flex items-center gap-1"><FileText className="w-3 h-3" />Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                  className="mt-1 w-full px-3.5 py-2.5 bg-[#FAF6EF] border border-[#8A8378]/20 rounded-xl text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/40 resize-none"
                  placeholder="Quelques mots sur vous (visibles par la communauté)…"
                />
                <span className="text-[10px] text-[#8A8378]/70">{bio.length}/280</span>
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  saving
                    ? "bg-[#C9A227]/50 text-[#1E0F2B]/60 cursor-not-allowed"
                    : "bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] shadow-md",
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#8A8378] hover:bg-stone-100 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
