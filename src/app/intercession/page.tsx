"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  Loader2,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Lock,
  AlertCircle,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock } from "@/components/premium/section-divider";
import { AudioRecorder } from "@/components/intercession/audio-recorder";
import { api } from "@/lib/api-client";

/**
 * ⭐ V3.2 — Page d'intercession CONFIDENTIELLE (demande explicite) :
 * les demandes de prière contiennent des informations personnelles (nom,
 * sujet, description) → elles ne sont PLUS affichées publiquement.
 * Le public ne voit que ce formulaire ; chaque demande arrive directement
 * dans le back-office de l'administration (/admin/intercession), où
 * l'équipe pastorale la prend en charge.
 *
 * ⭐ V3.32 — LOCALISATION + CONTACT (demande du pasteur : « savoir d'où
 * vient la personne qui fait la demande ») : le formulaire recueille
 * désormais le NOM COMPLET (qui remplace le pseudonyme), le PAYS, la VILLE,
 * le TÉLÉPHONE et l'EMAIL. L'équipe pastorale sait ainsi d'où vient chaque
 * demande et peut recontacter la personne. Ces informations restent
 * strictement confidentielles (back-office + canal dédié Yeshua Connect).
 *
 * ⭐ V3.30 — NOTE VOCALE (demande du pasteur : « possibilité de faire un
 * audio pour permettre à la personne de s'exprimer librement ») : la
 * personne peut enregistrer une note vocale en plus du texte. La demande
 * est envoyée en multipart/form-data (champs + fichier audio) et arrive :
 *   1. dans le module intercession du back-office (texte + audio) ;
 *   2. dans le canal dédié « Sujets de prière » de Yeshua Connect, réservé
 *      aux super administrateurs (message structuré : auteur, catégorie,
 *      urgence, sujet, description, note vocale).
 */

export default function IntercessionPage() {
  const [form, setForm] = useState({
    auteur: "",
    pays: "",
    ville: "",
    telephone: "",
    email: "",
    sujet: "",
    description: "",
    categorie: "general",
    isUrgent: false,
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErreur(null);
    try {
      // ⭐ V3.30 — multipart/form-data : champs + note vocale éventuelle.
      const data = new FormData();
      data.set("auteur", form.auteur);
      data.set("pays", form.pays);
      data.set("ville", form.ville);
      data.set("telephone", form.telephone);
      data.set("email", form.email);
      data.set("sujet", form.sujet);
      data.set("description", form.description);
      data.set("categorie", form.categorie);
      data.set("isUrgent", String(form.isUrgent));
      if (audioFile) {
        data.set("audio", audioFile, audioFile.name);
        data.set("audioDuration", String(Math.round(audioDuration)));
      }
      const res = await fetch(api.url("/api/intercession"), {
        method: "POST",
        body: data, // pas de Content-Type : le navigateur pose le boundary multipart
      });
      if (res.ok) {
        setSubmitted(true);
        setForm({
          auteur: "",
          pays: "",
          ville: "",
          telephone: "",
          email: "",
          sujet: "",
          description: "",
          categorie: "general",
          isUrgent: false,
        });
        setAudioFile(null);
        setAudioDuration(0);
      } else {
        const body = await res.json().catch(() => ({}));
        setErreur(
          body?.error ||
            "La transmission a échoué. Vérifiez votre connexion puis réessayez.",
        );
      }
    } catch (err) {
      console.error(err);
      setErreur("La transmission a échoué. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1920&auto=format&fit=crop"
        kicker="Moteur spirituel de la communauté"
        title="Chaîne d'intercession"
        subtitle="Déposez vos demandes de prière : elles arrivent directement et en toute confidentialité entre les mains de l'équipe pastorale, qui les porte devant le Seigneur. Quand deux ou trois s'accordent, le Seigneur est au milieu."
        primaryCta={{ label: "Déposer une demande", href: "#demander" }}
      />

      {/* Bandeau confidentialité */}
      <section className="bg-[#FAF6EF] py-14 md:py-16 border-b border-[#8A8378]/15">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="card-gold-top p-6 md:p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <span className="w-14 h-14 rounded-full bg-[#2A0E3D]/5 border border-[#C9A227]/30 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-[#C9A227]" />
            </span>
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-1.5 flex items-center gap-2 justify-center sm:justify-start">
                Vos demandes restent confidentielles
              </h2>
              <p className="text-sm text-[#8A8378] leading-relaxed">
                Chaque demande est transmise directement à l&apos;administration du site et à
                l&apos;équipe pastorale, dans leur espace privé. Votre nom complet, votre
                localisation, vos coordonnées et votre sujet de prière ne sont jamais
                affichés publiquement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Formulaire de demande */}
      <section id="demander" className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-2xl px-4">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-gold-top p-8 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-success/15 border-2 border-state-success/40 mb-6">
                <CheckCircle2 className="w-8 h-8 text-state-success" />
              </div>
              <h3 className="font-serif text-2xl font-semibold text-[#1E0F2B] mb-3">Demande transmise</h3>
              <p className="text-sm text-[#8A8378] mb-6 leading-relaxed">
                Votre demande de prière est arrivée directement entre les mains de l&apos;équipe
                pastorale, qui s&apos;en saisit sans délai. Que le Seigneur vous bénisse et vous
                garde.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors"
              >
                Déposer une autre demande
              </button>
            </motion.div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-3">Déposer une demande</h2>
                <p className="text-sm text-[#8A8378]">
                  Confiez votre fardeau à l&apos;équipe pastorale. « Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ. » (Galates 6:2)
                </p>
              </div>

              <form onSubmit={handleSubmit} className="card-gold-top p-6 md:p-8 space-y-5">
                <div>
                  <label htmlFor="intercession-auteur" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Nom complet *</label>
                  <input id="intercession-auteur" type="text" value={form.auteur} onChange={(e) => setForm({ ...form, auteur: e.target.value })} required placeholder="Votre nom et prénom" autoComplete="name" maxLength={100} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" />
                </div>

                {/* ⭐ V3.32 — Localisation : savoir d'où vient la demande */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="intercession-pays" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Pays *</label>
                    <input id="intercession-pays" type="text" value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} required placeholder="Ex. : Bénin" autoComplete="country-name" maxLength={100} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" />
                  </div>
                  <div>
                    <label htmlFor="intercession-ville" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Ville</label>
                    <input id="intercession-ville" type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Ex. : Cotonou" autoComplete="address-level2" maxLength={100} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" />
                  </div>
                </div>

                {/* ⭐ V3.32 — Contact : pouvoir recontacter la personne */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="intercession-telephone" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Numéro de téléphone</label>
                    <input id="intercession-telephone" type="tel" inputMode="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="Ex. : +229 01 02 03 04 05" autoComplete="tel" maxLength={30} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" />
                  </div>
                  <div>
                    <label htmlFor="intercession-email" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Email</label>
                    <input id="intercession-email" type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="votre.email@exemple.com" autoComplete="email" maxLength={150} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" />
                  </div>
                </div>

                <div>
                  <label htmlFor="intercession-categorie" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Catégorie</label>
                  <select id="intercession-categorie" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20">
                    <option value="general">Général</option>
                    <option value="sante">Santé</option>
                    <option value="famille">Famille</option>
                    <option value="spiritual">Spirituel</option>
                    <option value="action_graces">Action de grâces</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="intercession-sujet" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">Sujet *</label>
                  <input id="intercession-sujet" type="text" value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} required placeholder="Résumé court de votre demande" maxLength={200} className="w-full min-h-[44px] px-4 py-3 rounded-full border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" />
                </div>

                <div>
                  <label htmlFor="intercession-description" className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2 block">
                    Description {audioFile ? "(facultative — votre note vocale sera transmise)" : "*"}
                  </label>
                  <textarea id="intercession-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required={!audioFile} rows={5} placeholder="Décrivez votre demande en détail, ou enregistrez plutôt une note vocale ci-dessous…" maxLength={2000} className="w-full min-h-[120px] px-4 py-3 rounded-3xl border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/60 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 resize-y font-serif" />
                  <p className="text-[11px] text-[#8A8378] mt-1.5">
                    {audioFile
                      ? "Votre note vocale suffit : la description écrite est devenue facultative."
                      : "Obligatoire, sauf si vous enregistrez une note vocale."}
                  </p>
                </div>

                {/* ⭐ V3.30 — Note vocale : s'exprimer librement en audio */}
                <AudioRecorder
                  onFileChange={(file, d) => {
                    setAudioFile(file);
                    setAudioDuration(d);
                  }}
                />

                {erreur && (
                  <p className="text-sm text-[#B5502F] font-semibold bg-[#B5502F]/10 rounded-xl px-4 py-3 flex items-start gap-2" role="alert">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {erreur}
                  </p>
                )}

                <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={form.isUrgent} onChange={(e) => setForm({ ...form, isUrgent: e.target.checked })} className="w-4 h-4 rounded border-[#8A8378]/30 text-state-danger focus:ring-state-danger" />
                  <span className="text-sm text-[#1E0F2B] inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-state-danger" />
                    Marquer comme urgent
                  </span>
                </label>

                <button type="submit" disabled={submitting} className="w-full min-h-[52px] px-6 py-4 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Transmission en cours…</> : <><Heart className="w-4 h-4" /> Transmettre ma demande à l&apos;équipe pastorale</>}
                </button>

                <p className="text-[11px] text-[#8A8378] flex items-center justify-center gap-1.5 text-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                  Votre demande et vos coordonnées partent directement dans l&apos;espace privé de l&apos;administration — rien n&apos;est publié.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock text="Si deux d'entre vous s'accordent sur la terre pour demander une chose quelconque, elle leur sera accordée par mon Père qui est dans les cieux." reference="Matthieu 18:19" variant="dark" />
        </div>
      </AuroraBackground>
    </div>
  );
}
