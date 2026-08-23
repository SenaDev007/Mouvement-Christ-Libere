"use client";

import { useState } from "react";
import { CTAButton } from "@/components/section-primitives/section-heading";
import { Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    contact: "",
    message: "",
  });

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
    <div className="fade-cross">
      {/* Hero */}
      <section className="hero-imperial py-16 md:py-24 relative">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold mb-4">
            Prendre contact
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ivory leading-tight mb-4">
            Demander un échange
          </h1>
          <p className="text-lg text-ivory/80 leading-relaxed max-w-2xl">
            Laissez-nous vos coordonnées, un membre de l'équipe pastorale
            reviendra vers vous.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold opacity-60" />
      </section>

      {/* Formulaire */}
      <section className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-2xl px-4">
          {submitted ? (
            <div className="card-gold-top p-8 md:p-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-state-success mx-auto mb-4" />
              <h2 className="font-serif text-2xl font-semibold text-ink mb-3">
                Message bien transmis
              </h2>
              <p className="text-sm text-ink/70 leading-relaxed mb-6">
                Votre message a bien été transmis. Une réponse vous parviendra
                sous 24 à 48h.
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
            <form
              onSubmit={handleSubmit}
              className="card-gold-top p-8 md:p-10 space-y-5"
            >
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
                  className="w-full px-4 py-3 rounded border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
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
                  className="w-full px-4 py-3 rounded border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
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
                  className="w-full px-4 py-3 rounded border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                  placeholder="Décrivez en quelques mots l'objet de votre demande..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 rounded bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? "Envoi en cours..." : "Envoyer ma demande"}
                {!submitting && <Send className="w-4 h-4" />}
              </button>

              {error && (
                <p className="text-sm text-state-danger text-center">{error}</p>
              )}

              <p className="text-xs text-stone text-center">
                Délai de réponse garanti : sous 24h.
              </p>
            </form>
          )}

          {/* Alternative WhatsApp */}
          <div className="mt-8 p-6 bg-imperial/5 border border-gold/20 rounded-card">
            <p className="text-sm text-ink/80 mb-3">
              Pour une demande urgente, vous pouvez aussi nous écrire
              directement sur WhatsApp :
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
      </section>
    </div>
  );
}
