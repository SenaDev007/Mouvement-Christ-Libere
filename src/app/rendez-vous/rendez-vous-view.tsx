"use client";

/**
 * ⭐ V3.66 — Formulaire public de demande de rendez-vous.
 *
 * Design public du site (nuit → crème, or, serif) : bandeau en-tête avec
 * logo, choix du serviteur de Dieu (Sœur Pam / Pasteur Kongo), urgence,
 * coordonnées + message. POST /api/rendez-vous (public, rate-limité,
 * honeypot anti-robots).
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
} from "lucide-react";
import { DEMANDE_URGENCES, SERVITEURS_RENDEZ_VOUS } from "@/lib/staff-space/constants";

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

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requesterName || !form.contact || !form.subject || !form.message) return;

    setEnvoi(true);
    setErreur("");
    try {
      const res = await fetch("/api/rendez-vous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      {/* En-tête public */}
      <header className="bg-[#000000] text-[#F0E9DE]">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-christ-libere-v2.png"
              alt="Christ Libère"
              width={36}
              height={36}
              className="w-9 h-9 object-contain"
              priority
            />
            <span className="text-sm font-bold">
              <span className="text-[#C9A227]">Christ</span>
              <span className="text-[#F0E9DE]">&nbsp;Libère</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#F0E9DE]/60 hover:text-[#FF7A1A] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour au site
          </Link>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-[#C9A227] to-transparent" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 md:py-14">
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
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1.5 uppercase tracking-wider">
                    Pays
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227]"
                    placeholder="Ex. Bénin"
                  />
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
