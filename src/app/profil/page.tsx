"use client";

/**
 * ⭐ V2.7 — Profil membre/viewer « informations complètes ».
 *
 * Paramétrage demandé : les viewers qui créent leur compte sur Christ Libère
 * peuvent ici renseigner leurs informations complètes ET LEUR PHOTO :
 *   - Photo de profil : upload compressé (carré 256×256, JPEG ≤ 60 KB en
 *     data URL) → User.avatarUrl en base (aucun filesystem, Vercel-safe).
 *   - Nom, téléphone, pays (sélecteur 191 pays), ville, bio.
 *   - Préférences de notifications (existant) + déconnexion.
 *
 * Tout est persisté en PostgreSQL et visible par les administrateurs dans
 * le back-office /admin/users (photo, téléphone, pays, ville, bio) —
 * la photo s'affiche aussi dans Yeshua Connect (canaux vocaux + chat).
 */

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2, User, Mail, MapPin, Phone as PhoneIcon, Camera, Trash2,
  Bell, BellOff, Save, LogOut, CheckCircle2, AlertCircle,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { compressAvatar } from "@/lib/avatar-upload";
import { COUNTRIES } from "@/lib/data/countries";

export default function ProfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ⭐ V2.7 — Photo de profil (data URL compressée ou URL existante)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification preferences
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);
  const [notifLive, setNotifLive] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [dndEnabled, setDndEnabled] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/profil");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      // Fetch user profile
      fetch(api.url("/api/user/profile")).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }).then(data => {
        if (data.name) setName(data.name);
        if (data.bio) setBio(data.bio);
        if (data.country) setCountry(data.country);
        if (data.city) setCity(data.city);
        if (data.phone) setPhone(data.phone);
        setAvatarUrl(data.avatarUrl ?? null);
        setNotifMessages(data.notifMessages ?? true);
        setNotifAnnouncements(data.notifAnnouncements ?? true);
        setNotifLive(data.notifLive ?? true);
        setNotifCommunity(data.notifCommunity ?? true);
        setDndEnabled(data.dndEnabled ?? false);
      }).catch(() => {
        setLoadError(true);
      });
    }
  }, [session]);

  /** Compresse la photo choisie (≤ 60 KB) et l'affiche en aperçu. */
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarProcessing(true);
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatar(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Image invalide");
    } finally {
      setAvatarProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(api.url("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, bio, country, city, phone, avatarUrl,
          notifMessages, notifAnnouncements, notifLive, notifCommunity,
          dndEnabled,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      // ⭐ V3.0 — Notifie l'application (navbar, Yeshua Connect) que le
      // profil vient de changer : la photo et le nom s'y mettent à jour
      // immédiatement, sans recharger la page.
      try { window.dispatchEvent(new Event("profile-updated")); } catch { /* ignore */ }
    } catch (e) {
      console.error("save:", e);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
      </div>
    );
  }

  if (!session) return null;

  const initials = (session.user?.name || session.user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAF6EF] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header — photo de profil éditable */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="relative inline-block mb-4 group">
            <div className="w-28 h-28 rounded-full border-4 border-[#C9A227]/30 overflow-hidden bg-[#2A0E3D] flex items-center justify-center shadow-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Ma photo" className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-4xl font-semibold text-[#C9A227]">{initials}</span>
              )}
              {avatarProcessing && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center rounded-full">
                  <Loader2 className="w-7 h-7 text-white animate-spin" />
                </div>
              )}
            </div>
            {/* Bouton caméra (badge) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              id="profile-avatar-input"
              aria-label="Changer ma photo"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarProcessing}
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#C9A227] text-[#1E0F2B] flex items-center justify-center shadow-lg hover:bg-[#DDBE55] transition-colors border-2 border-[#FAF6EF]"
              title="Changer ma photo"
              aria-label="Changer ma photo"
            >
              <Camera className="w-4.5 h-4.5" />
            </button>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Mon profil
          </h1>
          <p className="text-sm text-[#8A8378]">{session.user?.email}</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Retirer ma photo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E0F2B] hover:bg-[#C9A227]/10 px-3 py-1.5 rounded-full transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-[#C9A227]" />
                Ajouter ma photo
              </button>
            )}
          </div>
          {avatarError && (
            <p className="text-xs text-red-600 flex items-center justify-center gap-1 mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              {avatarError}
            </p>
          )}
          <p className="text-[10px] text-[#8A8378] mt-2">
            JPG/PNG · recadrée en carré · compressée ≤ 60 Ko · visible dans Yeshua Connect
          </p>
        </motion.div>

        {loadError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Impossible de charger votre profil. Réessayez plus tard.</span>
          </div>
        )}

        {/* Profile form — informations complètes */}
        <div className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 space-y-5 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1E0F2B] flex items-center gap-2">
            <User className="w-4 h-4 text-[#C9A227]" /> Informations complètes
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Nom</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">
              <PhoneIcon className="w-3 h-3 text-[#C9A227]" /> Téléphone
            </label>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              maxLength={20}
              className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
            />
            <p className="text-[10px] text-[#8A8378] mt-1.5">
              Visible uniquement par les administrateurs (back-office).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">
                <MapPin className="w-3 h-3 text-[#C9A227]" /> Pays
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              >
                <option value="">— Choisir —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Ville</label>
              <input
                type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Abidjan"
                className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Bio</label>
            <textarea
              value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Quelques mots sur vous..."
              className="w-full px-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30 resize-none"
            />
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 space-y-4 mb-6">
          <h2 className="font-serif text-lg font-semibold text-[#1E0F2B] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#C9A227]" /> Notifications
          </h2>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Messages directs</span>
            <input type="checkbox" checked={notifMessages} onChange={(e) => setNotifMessages(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Annonces officielles</span>
            <input type="checkbox" checked={notifAnnouncements} onChange={(e) => setNotifAnnouncements(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Lives et vidéos</span>
            <input type="checkbox" checked={notifLive} onChange={(e) => setNotifLive(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#1E0F2B]">Activité communauté</span>
            <input type="checkbox" checked={notifCommunity} onChange={(e) => setNotifCommunity(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
          </label>

          <div className="pt-4 border-t border-stone-100">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-[#1E0F2B] flex items-center gap-1.5">
                  {dndEnabled ? <BellOff className="w-4 h-4 text-red-500" /> : <Bell className="w-4 h-4" />}
                  Ne pas déranger (DND)
                </span>
                <p className="text-xs text-[#8A8378] mt-0.5">Coupe toutes les notifications</p>
              </div>
              <input type="checkbox" checked={dndEnabled} onChange={(e) => setDndEnabled(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-[#C9A227]" />
            </label>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm rounded-full hover:bg-[#DDBE55] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mb-4 shadow-md"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedMsg ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {savedMsg ? "Enregistré" : saving ? "Enregistrement..." : "Enregistrer"}
        </button>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full py-3 border border-red-200 text-red-600 font-semibold text-sm rounded-full hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
