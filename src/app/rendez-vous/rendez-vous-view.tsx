"use client";

/**
 * ⭐ V3.66 — Formulaire public de demande de rendez-vous.
 *
 * Design public du site (nuit → crème, or, serif) : choix du serviteur de
 * Dieu (Sœur Pam / Pasteur Kongo), urgence, coordonnées + message. POST
 * /api/rendez-vous (public, rate-limité, honeypot anti-robots).
 *
 * ⭐ V3.73 — Deux retours pasteur :
 *   ① bande logo supprimée (doublon navbar + bande d'annonce) — seul le
 *      bouton « Retour au site » reste, simplement posé au-dessus du
 *      contenu ;
 *   ② champ « Pays » libre remplacé par LE sélecteur pays habituel des
 *      formulaires (recherche + drapeaux + suggestions — comme /register
 *      et le modal serviteur). Le NOM du pays est stocké (affichage email /
 *      PDF du secrétariat inchangé).
 */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarHeart,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Search,
  ChevronDown,
} from "lucide-react";
import { DEMANDE_URGENCES, SERVITEURS_RENDEZ_VOUS } from "@/lib/staff-space/constants";
import { COUNTRIES } from "@/lib/data/countries";
import { flagFromCountryCode } from "@/lib/data/flags";

export function RendezVousView() {
  const [form, setForm] = useState({
    requesterName: "",
    contact: "",
    servantCode: "pam",
    subject: "",
    message: "",
    urgency: "normale",
    country: "",
    city: "",
    site: "", // honeypot
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
  // ⭐ V3.67 — code de suivi remis au demandeur ( consultation publique
  // sur /rendez-vous/suivi).
  const [codeSuivi, setCodeSuivi] = useState<string | null>(null);

  // ⭐ V3.73 — Sélecteur pays habituel (comme /register + modal
  // serviteur) : champ de recherche + liste de suggestions filtrée.
  // form.country stocke le NOM (ex. « Bénin ») — l'email et le PDF du
  // secrétariat l'affichent tel quel.
  const [paysRecherche, setPaysRecherche] = useState("");
  const [listePaysOuverte, setListePaysOuverte] = useState(false);

  const paysFiltres = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(paysRecherche.toLowerCase()) ||
      c.code.toLowerCase().includes(paysRecherche.toLowerCase())
  ).slice(0, 8);
  const paysSelectionne = form.country
    ? COUNTRIES.find((c) => c.name === form.country)
    : undefined;

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requesterName || !form.contact || !form.subject || !form.message) return;

    // ⭐ V3.73 — Auto-résolution du pays (même garde-fou que /register
    // V3.24) : si le nom est tapé sans cliquer la suggestion, on résout
    // le texte saisi (match exact, sinon préfixe unique). Champ optionnel :
    // sans résolution, il part simplement vide.
    let paysFinal = form.country;
    if (!paysFinal && paysRecherche.trim()) {
      const recherche = paysRecherche.trim().toLowerCase();
      const exact =
        COUNTRIES.find((c) => c.name.toLowerCase() === recherche) ??
        COUNTRIES.find((c) => c.code.toLowerCase() === recherche);
      const prefixes = COUNTRIES.filter((c) =>
        c.name.toLowerCase().startsWith(recherche)
      );
      const resolu = exact ?? (prefixes.length === 1 ? prefixes[0] : undefined);
      if (resolu) {
        paysFinal = resolu.name;
        setForm((f) => ({ ...f, country: resolu.name }));
      }
    }

    setEnvoi(true);
    setErreur("");
    try {
      const res = await fetch("/api/rendez-vous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, country: paysFinal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
      setCodeSuivi(data.codeSuivi || null);
      setSucces(true);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0E9DE]">
      {/* ⭐ V3.73 — Bande logo SUPPRIMÉE (doublon avec la navbar + la bande
          d'annonce du layout) : il ne reste que le bouton « Retour au site »,
          simplement posé au-dessus du contenu. */}
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#8A857C]/25 bg-white/70 text-sm font-semibold text-[#000000]/70 hover:border-[#C9A227] hover:text-[#000000] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au site
          </Link>
        </div>
        {succes ? (
          /* ── Confirmation ── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-[#C9A227]/25 p-8 md:p-10 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[#5B7052]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#5B7052]" />
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-semibold text-[#000000] mb-3">
              Votre demande est bien reçue
            </h1>
            <p className="text-sm text-[#8A857C] leading-relaxed max-w-md mx-auto mb-6">
              Le secrétariat du Mouvement Christ Libère a enregistré votre
              demande. La secrétaire l&apos;examinera et la transmettra au
              serviteur de Dieu concerné, qui reviendra vers vous selon les
              disponibilités du calendrier pastoral.
            </p>

            {/* ⭐ V3.67 — Code de suivi */}
            {codeSuivi && (
              <div className="max-w-md mx-auto mb-6 px-5 py-4 rounded-xl bg-[#000000] border border-[#C9A227]/30">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/80 font-semibold mb-1">
                  Votre code de suivi — conservez-le
                </p>
                <p className="font-mono text-2xl font-bold text-[#DDBE55] tracking-widest">
                  {codeSuivi}
                </p>
                <p className="text-[11px] text-[#F0E9DE]/60 mt-2 leading-relaxed">
                  Il vous permet de suivre l&apos;avancement de votre demande
                  (statut et étapes) sur{" "}
                  <Link
                    href={`/rendez-vous/suivi?code=${encodeURIComponent(codeSuivi)}`}
                    className="text-[#C9A227] underline font-semibold"
                  >
                    la page de suivi
                  </Link>
                  , sans exposer son contenu.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#000000] text-[#F0E9DE] text-sm font-semibold hover:bg-[#161513] transition-colors"
              >
                Retour à l&apos;accueil
              </Link>
              <button
                onClick={() => {
                  setSucces(false);
                  setForm({
                    requesterName: "",
                    contact: "",
                    servantCode: "pam",
                    subject: "",
                    message: "",
                    urgency: "normale",
                    country: "",
                    city: "",
                    site: "",
                  });
                  setPaysRecherche("");
                  setListePaysOuverte(false);
                }}
                className="px-5 py-2.5 rounded-xl border border-[#8A857C]/25 text-sm font-semibold text-[#000000] hover:bg-[#F0E9DE] transition-colors"
              >
                Déposer une autre demande
              </button>
            </div>
          </motion.div>
        ) : (
          /* ── Formulaire ── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#000000] flex items-center justify-center mx-auto mb-4">
                <CalendarHeart className="w-7 h-7 text-[#C9A227]" />
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-[#000000] mb-3">
                Demander un rendez-vous
              </h1>
              <p className="text-sm md:text-base text-[#8A857C] leading-relaxed max-w-xl mx-auto">
                Vous souhaitez rencontrer un serviteur de Dieu du Mouvement
                Christ Libère ? Votre demande sera reçue par le secrétariat,
                qui la transmettra à la personne concernée.
              </p>
            </div>

            <form
              onSubmit={soumettre}
              className="bg-white rounded-2xl border border-[#8A857C]/15 p-6 md:p-8 space-y-6"
            >
              {/* Honeypot (invisible) */}
              <input
                type="text"
                value={form.site}
                onChange={(e) => setForm({ ...form, site: e.target.value })}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {/* Choix du serviteur */}
              <div>
                <label className="block text-xs font-bold text-[#000000] mb-2 uppercase tracking-wider">
                  Serviteur de Dieu souhaité
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.values(SERVITEURS_RENDEZ_VOUS).map((s) => {
                    const actif = form.servantCode === s.code;
                    return (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => setForm({ ...form, servantCode: s.code })}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          actif
                            ? "border-[#C9A227] bg-[#C9A227]/5"
                            : "border-[#8A857C]/15 hover:border-[#FF7A1A]/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Image
                            src={s.code === "pam" ? "/pam.jpeg" : "/pasteur-kongo.jpeg"}
                            alt={s.libelle}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-sm font-bold text-[#000000]">
                              {s.libelle}
                            </p>
                            <p className="text-[11px] text-[#8A857C]">{s.titre}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Identité */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Votre nom complet <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.requesterName}
                    onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
                    placeholder="Ex. Grâce Adjoua"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Contact (téléphone / WhatsApp / email) <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
                    placeholder="Pour être recontacté(e)"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Pays
                  </label>
                  {/* ⭐ V3.73 — LE sélecteur pays habituel des formulaires :
                      recherche + drapeaux + suggestions (comme /register et
                      le modal serviteur). Cliquer une suggestion enregistre
                      le NOM du pays. */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A857C] pointer-events-none" />
                    <input
                      type="text"
                      value={
                        form.country
                          ? `${flagFromCountryCode(paysSelectionne?.code || "")} ${form.country}`
                          : paysRecherche
                      }
                      onChange={(e) => {
                        setPaysRecherche(e.target.value);
                        setForm({ ...form, country: "" });
                        setListePaysOuverte(true);
                      }}
                      onFocus={() => setListePaysOuverte(true)}
                      placeholder="Rechercher un pays…"
                      autoComplete="off"
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227]"
                    />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A857C] pointer-events-none" />
                  </div>
                  {listePaysOuverte && (
                    <>
                      {/* Clic extérieur → fermer la liste (comme le modal
                          serviteur) */}
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setListePaysOuverte(false)}
                      />
                      <div className="absolute z-30 mt-1 w-full max-h-40 overflow-y-auto bg-white rounded-xl shadow-xl border border-[#8A857C]/20 py-1">
                        {paysFiltres.length === 0 && (
                          <p className="px-4 py-2 text-sm text-[#8A857C]">
                            Aucun pays trouvé — vérifiez l&apos;orthographe puis
                            cliquez sur un pays de la liste.
                          </p>
                        )}
                        {paysFiltres.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, country: c.name });
                              setPaysRecherche("");
                              setListePaysOuverte(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-[#F0E9DE] text-[#000000]"
                          >
                            {flagFromCountryCode(c.code)} {c.name}
                            <span className="text-[#8A857C] ml-2 text-xs">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227]"
                    placeholder="Ex. Cotonou"
                  />
                </div>
              </div>

              {/* Objet + urgence */}
              <div className="grid sm:grid-cols-[1fr_180px] gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Objet de la demande <span className="text-[#B3452E]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227]"
                    placeholder="Ex. Accompagnement spirituel personnel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Urgence
                  </label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227]"
                  >
                    {Object.entries(DEMANDE_URGENCES).map(([v, u]) => (
                      <option key={v} value={v}>
                        {u.libelle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                  Votre message <span className="text-[#B3452E]">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] resize-none"
                  placeholder="Présentez votre demande, le motif de la rencontre et toute information utile…"
                />
              </div>

              {erreur && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#B3452E] text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {erreur}
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="flex items-center gap-1.5 text-[11px] text-[#8A857C]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5B7052]" />
                  Demande transmise au secrétariat du ministère
                </p>
                <button
                  type="submit"
                  disabled={envoi}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#000000] text-[#F0E9DE] text-sm font-bold hover:bg-[#161513] transition-colors disabled:opacity-50"
                >
                  {envoi ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {envoi ? "Envoi…" : "Déposer ma demande"}
                </button>
              </div>
            </form>

            <p className="text-[11px] text-[#8A857C] text-center leading-relaxed max-w-lg mx-auto">
              Vos coordonnées sont transmises uniquement au secrétariat du
              Mouvement Christ Libère et au serviteur de Dieu concerné — elles
              ne sont jamais publiées. Consultez notre{" "}
              <Link href="/confidentialite" className="text-[#C9A227] underline underline-offset-2">
                politique de confidentialité
              </Link>
              .
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
