"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Loader2,
  CheckCircle2,
  Flame,
  Users,
  Clock,
  HandHeart,
  Sparkles,
} from "lucide-react";
import { PageHero } from "@/components/magic/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { cn } from "@/lib/utils";

interface Demande {
  id: string;
  auteur: string;
  sujet: string;
  description: string;
  categorie: string;
  isUrgent: boolean;
  statut: string;
  prayCount: number;
  createdAt: string;
  temoignageExaucement: string | null;
}

const CATEGORIES = [
  { id: "tous", label: "Toutes", icon: Heart },
  { id: "sante", label: "Santé", icon: Heart },
  { id: "famille", label: "Famille", icon: Users },
  { id: "spiritual", label: "Spirituel", icon: Sparkles },
  { id: "urgence", label: "Urgent", icon: Flame },
  { id: "action_graces", label: "Actions de grâces", icon: CheckCircle2 },
];

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  ouvert: { label: "Ouvert", color: "bg-stone/15 text-stone" },
  en_priere: { label: "En prière", color: "bg-gold/15 text-gold-dark" },
  exauce: { label: "Exaucé", color: "bg-state-success/15 text-state-success" },
  archive: { label: "Archivé", color: "bg-stone/10 text-stone/60" },
};

export default function IntercessionPage() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [stats, setStats] = useState({ total: 0, enPriere: 0, exauces: 0, priersTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("tous");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ auteur: "", sujet: "", description: "", categorie: "general", isUrgent: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchDemandes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intercession${filtre !== "tous" ? `?categorie=${filtre}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setDemandes(data.demandes || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemandes(); }, [filtre]);

  const handlePrier = async (id: string) => {
    try {
      await fetch(`/api/intercession/${id}/prier`, { method: "POST" });
      setDemandes((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, prayCount: d.prayCount + 1, statut: "en_priere" } : d
        )
      );
      setStats((prev) => ({ ...prev, priersTotal: prev.priersTotal + 1 }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/intercession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
        fetchDemandes();
        setForm({ auteur: "", sujet: "", description: "", categorie: "general", isUrgent: false });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const demandesFiltrees = filtre === "urgence"
    ? demandes.filter((d) => d.isUrgent)
    : demandes;

  return (
    <div>
      <PageHero
        kicker="Moteur spirituel de la communauté"
        title="Chaîne d'intercession"
        subtitle="Le moteur spirituel de la communauté. Déposez vos demandes de prière, priez pour les autres, partageez les exaucements. Quand deux ou trois s'accordent, le Seigneur est au milieu."
        primaryCta={{ label: "Déposer une demande", href: "#demander" }}
        secondaryCta={{ label: "Prier pour d'autres", href: "#liste" }}
      />

      {/* Stats */}
      <section className="bg-ivory py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Heart} value={stats.total} label="Demandes actives" color="text-gold" />
            <StatCard icon={HandHeart} value={stats.enPriere} label="En prière" color="text-lavender" />
            <StatCard icon={CheckCircle2} value={stats.exauces} label="Exaucées" color="text-state-success" />
            <StatCard icon={Users} value={stats.priersTotal} label="Prières exprimées" color="text-imperial" />
          </div>
        </div>
      </section>

      {/* Filtres */}
      <section id="liste" className="bg-ivory py-8 border-t border-stone/15">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-2 flex-wrap mb-6">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setFiltre(cat.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-all",
                    filtre === cat.id
                      ? "bg-imperial text-ivory"
                      : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Liste des demandes */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gold" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demandesFiltrees.map((demande, i) => (
                <motion.div
                  key={demande.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={cn(
                    "card-gold-top p-5 flex flex-col",
                    demande.isUrgent && "border-state-danger/40"
                  )}
                >
                  {/* En-tête */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {demande.isUrgent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-state-danger text-ivory animate-pulse">
                          <Flame className="w-2.5 h-2.5" />
                          URGENT
                        </span>
                      )}
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold",
                        STATUT_LABELS[demande.statut]?.color || "bg-stone/15 text-stone"
                      )}>
                        {STATUT_LABELS[demande.statut]?.label || demande.statut}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {new Date(demande.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>

                  {/* Contenu */}
                  <h3 className="font-serif text-base font-semibold text-ink mb-2">{demande.sujet}</h3>
                  <p className="text-xs text-stone mb-1">par {demande.auteur}</p>
                  <p className="text-sm text-ink/70 leading-relaxed mb-4 flex-1">{demande.description}</p>

                  {/* Témoignage d'exaucement */}
                  {demande.temoignageExaucement && (
                    <div className="p-3 bg-state-success/5 border border-state-success/20 rounded-md mb-4">
                      <p className="text-xs font-semibold text-state-success mb-1">Témoignage d'exaucement</p>
                      <p className="text-xs text-ink/70 italic">« {demande.temoignageExaucement} »</p>
                    </div>
                  )}

                  {/* Bouton prier */}
                  <button
                    onClick={() => handlePrier(demande.id)}
                    className="w-full px-4 py-2.5 rounded-md bg-gold text-ink text-xs font-semibold hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 group"
                  >
                    <HandHeart className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Je prie pour cette demande
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-imperial/10 text-imperial text-[10px]">
                      {demande.prayCount}
                    </span>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Formulaire de demande */}
      <section id="demander" className="bg-ivory py-16 md:py-20">
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
              <h3 className="font-serif text-2xl font-semibold text-ink mb-3">Demande déposée</h3>
              <p className="text-sm text-stone mb-6">
                Votre demande est maintenant visible par la communauté. Que le Seigneur vous bénisse.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm font-semibold text-imperial hover:text-gold transition-colors"
              >
                Déposer une autre demande
              </button>
            </motion.div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="font-serif text-3xl font-semibold text-ink mb-3">Déposer une demande</h2>
                <p className="text-sm text-stone">
                  Confiez votre fardeau à la communauté. « Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ. » (Galates 6:2)
                </p>
              </div>

              <form onSubmit={handleSubmit} className="card-gold-top p-8 space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Pseudonyme *</label>
                    <input type="text" value={form.auteur} onChange={(e) => setForm({ ...form, auteur: e.target.value })} required placeholder="Votre nom ou pseudo" className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Catégorie</label>
                    <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20">
                      <option value="general">Général</option>
                      <option value="sante">Santé</option>
                      <option value="famille">Famille</option>
                      <option value="spiritual">Spirituel</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Sujet *</label>
                  <input type="text" value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} required placeholder="Résumé court de votre demande" maxLength={200} className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Description *</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={5} placeholder="Décrivez votre demande en détail..." maxLength={2000} className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 resize-y font-serif" />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isUrgent} onChange={(e) => setForm({ ...form, isUrgent: e.target.checked })} className="w-4 h-4 rounded border-stone/30 text-state-danger focus:ring-state-danger" />
                  <span className="text-sm text-ink inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-state-danger" />
                    Marquer comme urgent
                  </span>
                </label>

                <button type="submit" disabled={submitting} className="w-full px-6 py-4 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Dépôt en cours...</> : <><Heart className="w-4 h-4" /> Déposer ma demande</>}
                </button>
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

function StatCard({ icon: Icon, value, label, color }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string; color: string }) {
  return (
    <div className="card-gold-top p-5 text-center">
      <Icon className={cn("w-6 h-6 mx-auto mb-2", color)} />
      <div className="font-serif text-2xl font-semibold text-ink">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-stone font-semibold mt-1">{label}</div>
    </div>
  );
}
