"use client";

import { useState, useEffect } from "react";
import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { CarteDisperses, type MembreDisperse } from "@/components/disperses/carte-disperses";
import { MagneticButton } from "@/components/magic/magnetic-button";
import { MapPin, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api-client";

export default function DispersesPage() {
  const [membres, setMembres] = useState<MembreDisperse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    pseudonyme: "",
    pays: "",
    ville: "",
    latitude: 0,
    longitude: 0,
    langue: "FR",
    niveau: "chercheur",
    message: "",
  });

  useEffect(() => {
    fetch(api.url("/api/disperses")))
      .then((res) => res.json())
      .then((data) => {
        setMembres(data.membres || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const detecterPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setForm((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
        },
        (err) => {
          alert("Impossible de détecter votre position : " + err.message);
        }
      );
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pseudonyme || !form.pays || !form.latitude || !form.longitude) {
      alert("Veuillez remplir tous les champs requis et détecter votre position.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(api.url("/api/disperses"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
        // Recharger les membres
        const data = await fetch(api.url("/api/disperses"))).then((r) => r.json());
        setMembres(data.membres || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop"
        kicker="Rassemblement des fils d'Israël"
        title="Carte des dispersés"
        subtitle="Les fils d'Israël dispersés parmi les nations, dont la réunification est un signe des temps prophétique (Ésaïe 11:12, Ézéchiel 37). Ajoutez votre position pour rendre visible l'accomplissement de la promesse."
        primaryCta={{ label: "Ajouter ma position", href: "#ajouter" }}
        secondaryCta={{ label: "Voir la carte", href: "#carte" }}
      />

      {/* Carte */}
      <section id="carte" className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gold" />
            </div>
          ) : (
            <CarteDisperses membres={membres} />
          )}
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Formulaire d'ajout */}
      <section id="ajouter" className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-semibold text-ink mb-3">
              Ajouter ma position
            </h2>
            <p className="text-sm text-stone">
              Rendez visible le rassemblement. Votre position est arrondie à 0.1° (environ 11 km)
              pour préserver votre anonymat. Aucune information personnelle n'est stockée.
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-gold-top p-8 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-success/15 border-2 border-state-success/40 mb-6">
                <CheckCircle2 className="w-8 h-8 text-state-success" />
              </div>
              <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
                Position ajoutée
              </h3>
              <p className="text-sm text-stone mb-6">
                Vous apparaissez maintenant sur la carte des dispersés. Que le Seigneur vous bénisse.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setShowForm(false);
                  setForm({
                    pseudonyme: "",
                    pays: "",
                    ville: "",
                    latitude: 0,
                    longitude: 0,
                    langue: "FR",
                    niveau: "chercheur",
                    message: "",
                  });
                }}
                className="text-sm font-semibold text-imperial hover:text-gold transition-colors"
              >
                Ajouter une autre position
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="card-gold-top p-8 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                    Pseudonyme *
                  </label>
                  <input
                    type="text"
                    value={form.pseudonyme}
                    onChange={(e) => setForm({ ...form, pseudonyme: e.target.value })}
                    required
                    placeholder="Un nom ou pseudo (pas votre vrai nom)"
                    className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                    Pays *
                  </label>
                  <input
                    type="text"
                    value={form.pays}
                    onChange={(e) => setForm({ ...form, pays: e.target.value.toUpperCase().substring(0, 2) })}
                    required
                    placeholder="FR, CI, US, IL..."
                    maxLength={2}
                    className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 uppercase"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                    Ville (optionnel)
                  </label>
                  <input
                    type="text"
                    value={form.ville}
                    onChange={(e) => setForm({ ...form, ville: e.target.value })}
                    placeholder="Votre ville"
                    className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                    Langue
                  </label>
                  <select
                    value={form.langue}
                    onChange={(e) => setForm({ ...form, langue: e.target.value })}
                    className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  >
                    <option value="FR">Français</option>
                    <option value="EN">English</option>
                    <option value="ES">Español</option>
                    <option value="PT">Português</option>
                    <option value="HE">עברית</option>
                    <option value="AM">አማርኛ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Niveau de engagement
                </label>
                <select
                  value={form.niveau}
                  onChange={(e) => setForm({ ...form, niveau: e.target.value })}
                  className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="chercheur">Chercheur — en quête spirituelle</option>
                  <option value="croyant">Croyant — engagé dans la foi</option>
                  <option value="disciple">Disciple — engagé dans le ministère</option>
                  <option value="pasteur">Pasteur — ministre affilié</option>
                </select>
              </div>

              {/* Géolocalisation */}
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Position géographique *
                </label>
                <button
                  type="button"
                  onClick={detecterPosition}
                  className="w-full px-4 py-3 rounded-md border border-imperial/30 text-imperial hover:bg-imperial/5 transition-colors inline-flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <MapPin className="w-4 h-4" />
                  {form.latitude ? `Position détectée : ${form.latitude.toFixed(1)}, ${form.longitude.toFixed(1)}` : "Détecter ma position"}
                </button>
                <p className="text-xs text-stone mt-2">
                  Votre navigateur vous demandera l'autorisation. La position est arrondie à 0.1° (environ 11 km) pour préserver votre anonymat.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Message (optionnel)
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  placeholder="Un court témoignage, une bénédiction, un encouragement pour la communauté..."
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 resize-none"
                />
              </div>

              {/* Bandeau confidentialité */}
              <div className="p-4 bg-imperial/5 border border-gold/20 rounded-md flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-ink mb-1">Confidentialité</p>
                  <p className="text-xs text-stone leading-relaxed">
                    Aucune information personnelle n'est stockée. La position est arrondie, le pseudonyme est libre,
                    et vous pouvez modifier ou supprimer votre entrée à tout moment en contactant l'équipe.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !form.latitude}
                className="w-full px-6 py-4 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Ajouter ma position"
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Citation */}
      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Il élèvera une bannière pour les nations, il rassemblera les exilés d'Israël, et il recueillera les dispersés de Juda des quatre extrémités de la terre."
            reference="Ésaïe 11:12"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}
