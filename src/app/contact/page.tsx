"use client";

import { useState } from "react";
import { PageHero } from "@/components/magic/page-hero";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { Send, CheckCircle2, Loader2, AlertCircle, MessageCircle } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", contact: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.contact || !form.message) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Échec de l'envoi");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <PageHero
        kicker="Prendre contact"
        title="Demander un échange"
        subtitle="Laissez-nous vos coordonnées, un membre de l'équipe pastorale reviendra vers vous. Délai de réponse garanti : sous 24h."
        primaryCta={{ label: "Envoyer ma demande", href: "#form" }}
      />

      {/* Formulaire */}
      <section id="form" className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-2xl px-4">
          {submitted ? (
            <div className="card-gold-top p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-success/15 border-2 border-state-success/40 mb-6">
                <CheckCircle2 className="w-8 h-8 text-state-success" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-3">
                Message bien transmis
              </h2>
              <p className="text-sm text-stone leading-relaxed mb-6">
                Votre message a bien été transmis. Une réponse vous parviendra sous 24 à 48h.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setForm({ name: "", contact: "", message: "" });
                }}
                className="text-sm font-semibold text-imperial hover:text-gold transition-colors"
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-gold-top p-8 md:p-10 space-y-6">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Votre nom
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3.5 rounded-card border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                  placeholder="Votre nom complet"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Votre email ou numéro WhatsApp
                </label>
                <input
                  type="text"
                  name="contact"
                  value={form.contact}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3.5 rounded-card border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                  placeholder="email@exemple.com ou +33 6 12 34 56 78"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Votre message
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3.5 rounded-card border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all resize-none"
                  placeholder="Décrivez en quelques mots l'objet de votre demande..."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-state-danger text-sm p-3 rounded-md bg-state-danger/5 border border-state-danger/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 rounded-card bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer ma demande
                  </>
                )}
              </button>

              <p className="text-xs text-stone text-center">
                Délai de réponse garanti : sous 24h.
              </p>
            </form>
          )}

          {/* Alternative WhatsApp */}
          <div className="mt-8 p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-state-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-ink/80 mb-3">
                  Pour une demande urgente, vous pouvez aussi nous écrire directement sur WhatsApp :
                </p>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Bonjour, je m'appelle ${form.name || "[VOTRE NOM]"}. Je souhaite échanger au sujet de : [SUJET]. ${form.message || "[MESSAGE LIBRE]"}. Mon numéro : ${form.contact || "[TÉLÉPHONE]"}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-state-success hover:opacity-80 transition-opacity"
                >
                  Envoyer un message WhatsApp pré-rempli
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ."
            reference="Galates 6:2"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
