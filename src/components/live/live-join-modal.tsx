"use client";

import { useState, useEffect } from "react";
import { X, Loader2, User, MapPin, Phone, Globe, CheckCircle2 } from "lucide-react";
import { COUNTRIES } from "@/lib/data/countries";
import { flagFromCountryCode } from "@/lib/data/flags";

interface LiveMember {
  id: string;
  sessionId: string;
  firstName: string;
  lastName: string | null;
  country: string | null;
  city: string | null;
  contact: string | null;
  totalXp: number;
  livesWatched: number;
}

interface LiveJoinModalProps {
  open: boolean;
  onClose: () => void;
  onRegistered: (member: LiveMember) => void;
  liveTitle: string;
}

export function LiveJoinModal({ open, onClose, onRegistered, liveTitle }: LiveJoinModalProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    country: "",
    city: "",
    contact: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [existingMember, setExistingMember] = useState<LiveMember | null>(null);

  // Vérifier si le membre est déjà inscrit (via sessionId en localStorage)
  useEffect(() => {
    if (!open) return;

    let sessionId = localStorage.getItem("live-session-id");
    if (!sessionId) {
      sessionId = `s-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;
      localStorage.setItem("live-session-id", sessionId);
    }

    const checkMember = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/live-members/me?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.member) {
          setExistingMember(data.member);
          // Pré-remplir le formulaire avec les infos existantes
          setForm({
            firstName: data.member.firstName,
            lastName: data.member.lastName || "",
            country: data.member.country || "",
            city: data.member.city || "",
            contact: data.member.contact || "",
          });
        }
      } catch {}
      setChecking(false);
    };

    checkMember();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      setError("Le prénom est requis");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sessionId = localStorage.getItem("live-session-id") || `s-${Date.now()}`;

      const res = await fetch("/api/live-members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          country: form.country || null,
          city: form.city.trim() || null,
          contact: form.contact.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      const data = await res.json();

      // Sauvegarder le nom pour le chat
      localStorage.setItem("live-chat-username", form.firstName.trim());
      localStorage.setItem("live-member-id", data.member.id);

      onRegistered(data.member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A0826]/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-[#8A8378]/15 max-w-md w-full overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#8A8378]/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1E0F2B]">
              {existingMember ? "Bienvenue à nouveau" : "Inscription"}
            </h2>
            <p className="text-xs text-[#8A8378] mt-0.5">
              {existingMember
                ? `Vous êtes déjà inscrit — ${existingMember.livesWatched} live(s) suivi(s)`
                : "Inscrivez-vous une fois pour suivre tous les lives"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {checking ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#C9A227] animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {!existingMember && (
              <p className="text-xs text-[#8A8378] bg-[#2A0E3D]/5 rounded-lg p-3">
                Une seule inscription suffit pour accéder à tous les lives, au chat
                et aux réactions. Vos informations sont conservées pour les prochaines diffusions.
              </p>
            )}

            {existingMember && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-700">Compte trouvé — vous pouvez modifier vos infos</span>
              </div>
            )}

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                    maxLength={50}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                    placeholder="Votre prénom"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Nom</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  maxLength={50}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                  placeholder="Nom"
                />
              </div>
            </div>

            {/* Pays + Ville */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Pays</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378] z-10" />
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] appearance-none"
                  >
                    <option value="">Sélectionner...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{flagFromCountryCode(c.code)} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Ville</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    maxLength={50}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                    placeholder="Votre ville"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                Contact <span className="text-[#8A8378] normal-case font-normal">(optionnel)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  maxLength={100}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                  placeholder="Email ou téléphone"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#8A8378] hover:text-[#1E0F2B] transition-colors">
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !form.firstName.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Enregistrement..." : existingMember ? "Mettre à jour" : "S'inscrire"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
