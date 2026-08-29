"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { X, Loader2, User, CheckCircle2, UserPlus, LogIn, Sparkles, Globe } from "lucide-react";
import Link from "next/link";
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
  onRegistered: (member: { id: string; firstName: string; isAnonymous: boolean }) => void;
  liveTitle: string;
}

export function LiveJoinModal({ open, onClose, onRegistered, liveTitle }: LiveJoinModalProps) {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [existingMember, setExistingMember] = useState<LiveMember | null>(null);

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
        const res = await apiFetch(`/api/live-members/me?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.member) {
          setExistingMember(data.member);
          setFirstName(data.member.firstName);
          setLastName(data.member.lastName || "");
          setCountry(data.member.country || "");
          setCity(data.member.city || "");
          setContact(data.member.contact || "");
        }
      } catch {}
      setChecking(false);
    };

    checkMember();
  }, [open]);

  // Quick join — juste le prénom
  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("Veuillez entrer votre nom");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sessionId = localStorage.getItem("live-session-id") || `s-${Date.now()}`;

      const res = await apiFetch("/api/live-members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          firstName: firstName.trim(),
          lastName: null,
          country: null,
          city: null,
          contact: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      const data = await res.json();

      // Sauvegarder pour le chat
      localStorage.setItem("live-chat-username", firstName.trim());
      localStorage.setItem("live-member-id", data.member.id);
      localStorage.setItem("live-anonymous", "true");

      onRegistered({ id: data.member.id, firstName: firstName.trim(), isAnonymous: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  // Full registration — tous les champs
  const handleFullRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("Le prénom est requis");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sessionId = localStorage.getItem("live-session-id") || `s-${Date.now()}`;

      const res = await apiFetch("/api/live-members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          country: country || null,
          city: city.trim() || null,
          contact: contact.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }

      const data = await res.json();

      localStorage.setItem("live-chat-username", firstName.trim());
      localStorage.setItem("live-member-id", data.member.id);
      localStorage.removeItem("live-anonymous");

      onRegistered({ id: data.member.id, firstName: firstName.trim(), isAnonymous: false });
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
              {existingMember ? "Bienvenue à nouveau" : "Rejoindre le live"}
            </h2>
            <p className="text-xs text-[#8A8378] mt-0.5">{liveTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#8A8378]/10 text-[#8A8378]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {checking ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#C9A227] animate-spin" />
          </div>
        ) : existingMember ? (
          /* ═══ Membre existant — auto rejoin ═══ */
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-700">
                Compte trouvé — {existingMember.livesWatched} live(s) suivi(s)
              </span>
            </div>
            <button
              onClick={() => onRegistered({ id: existingMember.id, firstName: existingMember.firstName, isAnonymous: !existingMember.contact })}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors"
            >
              Rejoindre le live
            </button>
          </div>
        ) : (
          /* ═══ Nouveau visiteur — quick join ou full registration ═══ */
          <div className="px-6 py-5">
            {/* Tabs */}
            <div className="flex gap-1 bg-[#2A0E3D]/5 rounded-xl p-1 mb-4">
              <button
                onClick={() => setMode("quick")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${mode === "quick" ? "bg-white text-[#1E0F2B] shadow-sm" : "text-[#8A8378]"}`}
              >
                Accès rapide
              </button>
              <button
                onClick={() => setMode("full")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${mode === "full" ? "bg-white text-[#1E0F2B] shadow-sm" : "text-[#8A8378]"}`}
              >
                Créer un compte
              </button>
            </div>

            {mode === "quick" ? (
              /* ═══ Quick join — juste le nom ═══ */
              <form onSubmit={handleQuickJoin} className="space-y-4">
                <p className="text-xs text-[#8A8378] bg-[#2A0E3D]/5 rounded-lg p-3">
                  Entrez simplement votre nom pour regarder le live et participer au chat.
                  Vous pourrez créer un compte complet plus tard.
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                    Votre nom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      maxLength={50}
                      autoFocus
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                      placeholder="Votre prénom ou pseudo"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !firstName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? "Connexion..." : "Regarder le live"}
                </button>

                {/* Lien création de compte */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode("full")}
                    className="text-xs text-[#C9A227] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    Créer un compte pour suivre tous les lives
                  </button>
                </div>
              </form>
            ) : (
              /* ═══ Full registration ═══ */
              <form onSubmit={handleFullRegister} className="space-y-4">
                <p className="text-xs text-[#8A8378] bg-[#2A0E3D]/5 rounded-lg p-3">
                  Créez votre compte une fois pour suivre tous les lives, participer au chat,
                  gagner de l'XP et apparaître sur la carte des dispersés.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        maxLength={50}
                        autoFocus
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                        placeholder="Prénom"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Nom</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={50}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                      placeholder="Nom"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Pays</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378] z-10" />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] appearance-none"
                      >
                        <option value="">Sélectionner...</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {flagFromCountryCode(c.code)} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">Ville</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      maxLength={50}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                      placeholder="Ville"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-1.5">
                    Contact <span className="text-[#8A8378] normal-case font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
                    placeholder="Email ou téléphone"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !firstName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {loading ? "Inscription..." : "Créer mon compte"}
                </button>

                {/* Lien vers page register officielle */}
                <div className="text-center pt-2">
                  <Link
                    href="/register"
                    className="text-xs text-[#8A8378] hover:text-[#C9A227] inline-flex items-center gap-1"
                  >
                    <LogIn className="w-3 h-3" />
                    Ou se connecter avec un compte existant
                  </Link>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
