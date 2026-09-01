"use client";

import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import Image from "next/image";
import { User, Mail, Lock, Loader2, AlertCircle, ShieldCheck, MapPin, Users, Search } from "lucide-react";
import { COUNTRIES } from "@/lib/data/countries";
import { toast } from "sonner";

const NIVEAUX = [
  { code: "chercheur", label: "Chercheur — en quête spirituelle", desc: "Vous découvrez la foi et souhaitez en savoir plus" },
  { code: "croyant", label: "Croyant — engagé dans la foi", desc: "Vous marchez avec Yeshua et voulez grandir" },
  { code: "disciple", label: "Disciple — engagé dans le ministère", desc: "Vous servez activement dans le Royaume" },
  { code: "pasteur", label: "Pasteur — ministre accrédité", desc: "Vous avez un ministère pastoral reconnu" },
];

const CANAUX = [
  { id: "priere", label: "Chaîne d'intercession", desc: "Prière fervente et combat spirituel" },
  { id: "enseignement", label: "Études bibliques", desc: "Approfondissement de la Parole" },
  { id: "jeunes", label: "Jeunes disciples", desc: "Communauté des jeunes croyants" },
  { id: "femmes", label: "Femmes de foi", desc: "Sororité spirituelle" },
  { id: "hommes", label: "Hommes du Royaume", desc: "Fraternité et responsabilité" },
  { id: "louange", label: "Louange & Chofar", desc: "Adoration et musique céleste" },
];

const LANGUES = [
  { code: "FR", label: "Français" },
  { code: "EN", label: "English" },
  { code: "ES", label: "Español" },
  { code: "PT", label: "Português" },
  { code: "HE", label: "עברית" },
];

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    pseudonyme: "",
    pays: "",
    ville: "",
    langue: "FR",
    niveau: "chercheur",
    canal: "priere",
    message: "",
  });

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  ).slice(0, 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name || !form.pays) {
      toast.error("Veuillez remplir tous les champs requis.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Échec de l'inscription");
      }

      // ⭐ V3.11 — Le compte créé place automatiquement le membre sur la
      // carte des dispersés (voir /api/auth/register).
      toast.success("Compte créé ! Vous apparaissez désormais sur la carte des dispersés.");
      window.location.href = "/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden bg-[#1A0826]">
      {/* Décor de fond */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A227]/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#7C5CB8]/8 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-[#FAF6EF] rounded-3xl shadow-2xl overflow-hidden border border-[#C9A227]/20">
          {/* En-tête */}
          <div className="bg-[#2A0E3D] px-8 py-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative mb-3">
                <div className="absolute inset-0 rounded-full pointer-events-none logo-halo" />
                <Image src="/logo-christ-libere.png" alt="Christ Libère" width={64} height={64} className="relative w-14 h-14 md:w-16 md:h-16 object-contain" priority />
              </div>
              <h1 className="text-xl md:text-2xl font-bold mb-1">
                <span style={{ color: "#C9A227" }}>Christ</span>
                <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
              </h1>
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#C9A227]">Rejoindre la communauté</p>
            </div>
          </div>

          {/* Formulaire */}
          <div className="p-6 md:p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Users className="w-4 h-4 text-[#5B7052]" />
              <span className="text-xs font-semibold text-[#8A8378]">Inscription — Votre compte sera validé par un administrateur</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nom + Email */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Nom complet *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Votre nom"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="vous@email.com"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]" />
                  </div>
                </div>
              </div>

              {/* Mot de passe + Pseudonyme */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Mot de passe *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Pseudonyme</label>
                  <input type="text" value={form.pseudonyme} onChange={e => setForm({ ...form, pseudonyme: e.target.value })} placeholder="Nom sur la carte des dispersés"
                    className="w-full px-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]" />
                </div>
              </div>

              {/* Pays (avec recherche) + Ville */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Pays *</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input type="text" value={form.pays ? COUNTRIES.find(c => c.code === form.pays)?.name || "" : countrySearch}
                      onChange={e => { setCountrySearch(e.target.value); setForm({ ...form, pays: "" }); setShowCountryList(true); }}
                      onFocus={() => setShowCountryList(true)} placeholder="Rechercher un pays..."
                      className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]" />
                  </div>
                  {showCountryList && (
                    <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto bg-white rounded-xl shadow-xl border border-[#8A8378]/20 py-1">
                      {filteredCountries.map(c => (
                        <button key={c.code} type="button" onClick={() => { setForm({ ...form, pays: c.code }); setShowCountryList(false); setCountrySearch(""); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[#FAF6EF] text-[#1E0F2B]">
                          {c.name}<span className="text-[#8A8378] ml-2 text-xs">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Ville</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input type="text" value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} placeholder="Votre ville"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]" />
                  </div>
                </div>
              </div>

              {/* Langue + Niveau */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Langue</label>
                  <select value={form.langue} onChange={e => setForm({ ...form, langue: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]">
                    {LANGUES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Niveau spirituel</label>
                  <select value={form.niveau} onChange={e => setForm({ ...form, niveau: e.target.value })}
                    className="w-full px-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]">
                    {NIVEAUX.map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Choix du canal */}
              <div>
                <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-2 block">Canal de communauté</label>
                <p className="text-xs text-[#8A8378] mb-3">Choisissez le canal que vous souhaitez rejoindre. Un administrateur validera votre affectation.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CANAUX.map(canal => (
                    <button key={canal.id} type="button" onClick={() => setForm({ ...form, canal: canal.id })}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${form.canal === canal.id ? "border-[#C9A227] bg-[#C9A227]/5" : "border-[#8A8378]/15 hover:border-[#C9A227]/40"}`}>
                      <p className="text-sm font-bold text-[#1E0F2B]">{canal.label}</p>
                      <p className="text-xs text-[#8A8378]">{canal.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs uppercase tracking-[0.15em] text-[#8A8378] font-bold mb-1.5 block">Message (optionnel)</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={2} placeholder="Quelques mots sur votre parcours..."
                  className="w-full px-3 py-3 rounded-xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] resize-none" />
              </div>

              {/* Erreur */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton */}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Création du compte...</>
                ) : (
                  <>Créer mon compte</>
                )}
              </button>

              <p className="text-center text-xs text-[#8A8378]">
                Votre compte sera examiné par un administrateur qui validera votre canal de communauté.
              </p>
            </form>
          </div>
        </div>

        {/* Liens */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <a href="/login" className="text-xs font-semibold text-[#FAF6EF]/60 hover:text-[#C9A227] transition-colors">Déjà un compte ? Se connecter</a>
          <span className="text-[#FAF6EF]/20">|</span>
          <a href="/" className="text-xs font-semibold text-[#FAF6EF]/60 hover:text-[#C9A227] transition-colors">← Retour au site</a>
        </div>
      </div>
    </div>
  );
}
