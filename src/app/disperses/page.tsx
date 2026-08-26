"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Globe, MapPin, Loader2, CheckCircle2, ChevronRight, Search, Users } from "lucide-react";
import { WorldMap } from "@/components/ui/world-map";
import { COUNTRIES } from "@/lib/data/countries";
import { api } from "@/lib/api-client";

interface Disperse {
  id: string;
  pseudonyme: string;
  pays: string;
  ville?: string;
  latitude: number;
  longitude: number;
  langue: string;
  niveau: string;
  message?: string;
}

export default function DispersesPage() {
  const [members, setMembers] = useState<Disperse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [pseudonyme, setPseudonyme] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [ville, setVille] = useState("");
  const [langue, setLangue] = useState("FR");
  const [niveau, setNiveau] = useState("chercheur");
  const [message, setMessage] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);

  const LANGUES = [
    { code: "FR", label: "Français" },
    { code: "EN", label: "English" },
    { code: "ES", label: "Español" },
    { code: "PT", label: "Português" },
    { code: "HE", label: "עברית (Hébreu)" },
    { code: "AM", label: "አማርኛ (Amharique)" },
  ];

  const NIVEAUX = [
    { code: "chercheur", label: "Chercheur" },
    { code: "croyant", label: "Croyant" },
    { code: "disciple", label: "Disciple" },
    { code: "pasteur", label: "Pasteur" },
  ];

  // Load members from DB
  useEffect(() => {
    fetch(api.url("/api/disperses"))
      .then(r => r.json())
      .then(data => {
        setMembers(data.members || data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Filter countries by search
  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
    );
  }, [countrySearch]);

  // Map points from members
  const mapPoints = members.map(m => ({
    lat: m.latitude,
    lng: m.longitude,
    label: `${m.pseudonyme} — ${m.ville || m.pays}`,
  }));

  const handleSubmit = async () => {
    if (!pseudonyme || !selectedCountry) return;
    setSubmitting(true);
    setSuccess(false);

    const country = COUNTRIES.find(c => c.code === selectedCountry);
    if (!country) return;

    try {
      const res = await fetch(api.url("/api/disperses/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pseudonyme,
          pays: selectedCountry,
          ville: ville || null,
          langue,
          niveau,
          message: message || null,
          latitude: country.lat,
          longitude: country.lng,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        // Reload members
        const data = await fetch(api.url("/api/disperses")).then(r => r.json());
        setMembers(data.members || data || []);
        // Reset form
        setPseudonyme("");
        setSelectedCountry("");
        setVille("");
        setMessage("");
        setTimeout(() => { setSuccess(false); setShowForm(false); }, 2000);
      }
    } catch (e) {
      console.error("submit:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[50vh] flex items-center justify-center pt-24 pb-12 overflow-hidden bg-[#2A0E3D] text-white">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop" alt="Monde" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A0E3D]/80 via-[#2A0E3D]/90 to-[#1A0826]" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-[#C9A227]" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-[#C9A227]">Rassemblement des dispersés</span>
          </div>
          <h1 className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
            Carte des <span className="text-[#C9A227]">dispersés</span> d'Israël
          </h1>
          <p className="text-base md:text-lg text-[#FAF6EF]/70 leading-relaxed max-w-2xl mx-auto mb-8">
            « Il lèvera une bannière pour les nations lointaines, et il assemblera les exilés d'Israël. » — Ésaïe 11:12
          </p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg transition-all duration-300"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Ajouter ma position
          </button>
        </div>
      </section>

      {/* ═══ MAP ═══ */}
      <section className="py-12 md:py-16 bg-[#FAF6EF]">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <WorldMap points={mapPoints} />
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#8A8378]">
                <Users className="w-4 h-4" />
                <span>{members.length} dispersé{members.length > 1 ? "s" : ""} recensé{members.length > 1 ? "s" : ""} sur la carte</span>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ═══ FORM ═══ */}
      {showForm && (
        <section className="py-12 bg-white border-y border-[#8A8378]/10">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-[#FAF6EF] rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-8">
              <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-6">Ajouter ma position</h2>

              {success && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-[#5B7052]/10 border border-[#5B7052]/20 text-[#5B7052] text-sm mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  Votre position a été enregistrée avec succès !
                </div>
              )}

              <div className="space-y-4">
                {/* Pseudonyme */}
                <div>
                  <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Pseudonyme</label>
                  <input
                    type="text"
                    value={pseudonyme}
                    onChange={(e) => setPseudonyme(e.target.value)}
                    placeholder="Votre nom ou pseudo"
                    className="w-full px-4 py-3 rounded-full bg-white border border-[#8A8378]/20 text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                  />
                </div>

                {/* Pays — sélecteur avec recherche */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Pays</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                    <input
                      type="text"
                      value={selectedCountry ? COUNTRIES.find(c => c.code === selectedCountry)?.name || "" : countrySearch}
                      onChange={(e) => {
                        setCountrySearch(e.target.value);
                        setSelectedCountry("");
                        setShowCountryList(true);
                      }}
                      onFocus={() => setShowCountryList(true)}
                      placeholder="Rechercher un pays..."
                      className="w-full pl-10 pr-4 py-3 rounded-full bg-white border border-[#8A8378]/20 text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                    />
                  </div>
                  {showCountryList && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-2xl shadow-xl border border-[#8A8378]/20 py-1">
                      {filteredCountries.map((country) => (
                        <button
                          key={country.code}
                          onClick={() => {
                            setSelectedCountry(country.code);
                            setShowCountryList(false);
                            setCountrySearch("");
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[#FAF6EF] transition-colors text-[#1E0F2B]"
                        >
                          {country.name}
                          <span className="text-[#8A8378] ml-2 text-xs">{country.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ville */}
                <div>
                  <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Ville <span className="text-[#8A8378] normal-case">(optionnel)</span></label>
                  <input
                    type="text"
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    placeholder="Votre ville"
                    className="w-full px-4 py-3 rounded-full bg-white border border-[#8A8378]/20 text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                  />
                </div>

                {/* Langue + Niveau */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Langue</label>
                    <select
                      value={langue}
                      onChange={(e) => setLangue(e.target.value)}
                      className="w-full px-4 py-3 rounded-full bg-white border border-[#8A8378]/20 text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                    >
                      {LANGUES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Niveau</label>
                    <select
                      value={niveau}
                      onChange={(e) => setNiveau(e.target.value)}
                      className="w-full px-4 py-3 rounded-full bg-white border border-[#8A8378]/20 text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                    >
                      {NIVEAUX.map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">Témoignage court <span className="text-[#8A8378] normal-case">(optionnel)</span></label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Quelques mots sur votre parcours..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#8A8378]/20 text-sm text-[#1E0F2B] outline-none focus:ring-2 focus:ring-[#C9A227]/30 resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!pseudonyme || !selectedCountry || submitting}
                  className="w-full py-3.5 rounded-full bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-sans font-bold text-base shadow-lg disabled:opacity-30 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <MapPin className="w-5 h-5" />
                      Enregistrer ma position
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ LIST ═══ */}
      <section className="py-12 md:py-16 bg-[#FAF6EF]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-[#C9A227] font-semibold mb-3">Communauté</p>
            <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[#1E0F2B]">
              Les dispersés recensés
            </h2>
          </div>

          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-[#8A8378]/30 mx-auto mb-4" />
              <p className="text-[#8A8378]">Aucun dispersé enregistré pour l'instant.</p>
              <p className="text-sm text-[#8A8378] mt-1">Soyez le premier à ajouter votre position !</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member, i) => {
                const country = COUNTRIES.find(c => c.code === member.pays);
                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2A0E3D]">
                        <span className="text-sm font-bold text-[#C9A227]">{member.pseudonyme.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1E0F2B]">{member.pseudonyme}</p>
                        <p className="text-xs text-[#8A8378]">{country?.name || member.pays}{member.ville ? ` · ${member.ville}` : ""}</p>
                      </div>
                    </div>
                    {member.message && (
                      <p className="text-xs text-[#1E0F2B]/60 italic leading-relaxed">« {member.message} »</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#8A8378]/10">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8C5FA8]/10 text-[#8C5FA8]">{member.langue}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C9A227]/10 text-[#C9A227]">{member.niveau}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ CITA ═══ */}
      <section className="py-20 bg-[#2A0E3D] relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="font-serif text-lg md:text-xl italic text-[#FAF6EF]/80 leading-relaxed">
            « Ne crains pas, car je suis avec toi ; je rassemblerai ta postérité de l'orient, et je te recueillerai de l'occident. »
          </p>
          <p className="text-sm text-[#C9A227] font-semibold mt-4">Ésaïe 43:5</p>
        </div>
      </section>
    </div>
  );
}
