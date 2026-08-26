"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface DMS {
  id: string;
  contenuId: string;
  contenuType: string;
  contenuTitre: string;
  hash: string;
  delaiJours: number;
  derniereActivite: string;
  estDeclenche: boolean;
  dateDeclenchement: string | null;
}

export default function DeadMansSwitchAdminPage() {
  const [switches, setSwitches] = useState<DMS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contenuType: "temoignage", contenuTitre: "", contenuData: "", delaiJours: 30 });
  const [submitting, setSubmitting] = useState(false);

  const fetchSwitches = async () => {
    setLoading(true);
    try {
      const res = await fetch(api.url("/api/dead-mans-switch"));
      if (res.ok) {
        const data = await res.json();
        setSwitches(data.switches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSwitches(); }, []);

  const handleSignal = async (id?: string) => {
    await fetch(api.url("/api/dead-mans-switch/signal"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchSwitches();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(api.url("/api/dead-mans-switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ contenuType: "temoignage", contenuTitre: "", contenuData: "", delaiJours: 30 });
      fetchSwitches();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-state-danger" />
            Dead Man&apos;s Switch
          </h1>
          <p className="text-sm text-stone">
            Publication automatique de contenus réservés en cas d&apos;indisponibilité prolongée.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-ink text-sm font-semibold hover:bg-gold-light"
        >
          <Zap className="w-4 h-4" />
          Créer un commutateur
        </button>
      </div>

      {/* Bandeau explicatif */}
      <div className="p-5 bg-state-danger/5 border border-state-danger/20 rounded-card">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-state-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink mb-1">Comment ça fonctionne</p>
            <p className="text-xs text-stone leading-relaxed">
              Si Pam et le Pasteur Kongo cessent de manifester leur présence pendant {form.delaiJours} jours
              (paramétrable), le contenu réservé est automatiquement publié.
              Un cron job (Vercel) vérifie chaque jour à 3h00 UTC.
              Cliquer sur « Signaler activité » réinitialise le compteur.
            </p>
          </div>
        </div>
      </div>

      {/* Bouton signaler activité */}
      <button
        onClick={() => handleSignal()}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-state-success text-ivory text-sm font-semibold hover:bg-state-success/90 transition-colors"
      >
        <Activity className="w-4 h-4" />
        Signaler activité (réinitialiser tous les compteurs)
      </button>

      {/* Formulaire */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={handleSubmit}
          className="card-gold-top p-6 space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Type de contenu</label>
              <select value={form.contenuType} onChange={(e) => setForm({ ...form, contenuType: e.target.value })} className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold">
                <option value="temoignage">Témoignage</option>
                <option value="enseignement">Enseignement</option>
                <option value="video">Vidéo</option>
                <option value="biographie">Biographie</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Délai (jours)</label>
              <input type="number" min={1} max={365} value={form.delaiJours} onChange={(e) => setForm({ ...form, delaiJours: parseInt(e.target.value) || 30 })} className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Titre</label>
            <input type="text" value={form.contenuTitre} onChange={(e) => setForm({ ...form, contenuTitre: e.target.value })} required className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">Contenu réservé</label>
            <textarea value={form.contenuData} onChange={(e) => setForm({ ...form, contenuData: e.target.value })} required rows={6} className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink focus:outline-none focus:border-gold resize-y font-serif" placeholder="Le contenu qui sera publié automatiquement..." />
          </div>
          <button type="submit" disabled={submitting} className="px-6 py-3 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light disabled:opacity-50 inline-flex items-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Créer le commutateur
          </button>
        </motion.form>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-3">
          {switches.length === 0 ? (
            <p className="text-sm text-stone italic text-center py-8">
              Aucun commutateur actif. Le site fonctionne normalement.
            </p>
          ) : (
            switches.map((dms) => {
              const joursRestants = Math.ceil(
                (new Date(dms.derniereActivite).getTime() + dms.delaiJours * 86400000 - Date.now()) / 86400000
              );
              return (
                <div key={dms.id} className={cn("card-gold-top p-5", dms.estDeclenche && "border-state-danger/40 opacity-60")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {dms.estDeclenche ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-state-danger text-ivory">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            DÉCLENCHÉ
                          </span>
                        ) : joursRestants <= 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-state-danger/20 text-state-danger">
                            <Clock className="w-2.5 h-2.5" />
                            {joursRestants}j restants
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-state-success/15 text-state-success">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Actif
                          </span>
                        )}
                        <span className="text-xs text-stone">{dms.contenuType}</span>
                      </div>
                      <h3 className="font-serif text-base font-semibold text-ink">{dms.contenuTitre}</h3>
                      <p className="text-xs text-stone mt-1">
                        Délai : {dms.delaiJours} jours · Dernière activité : {new Date(dms.derniereActivite).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="text-[10px] text-stone/60 font-mono mt-1">Hash : {dms.hash.substring(0, 32)}...</p>
                    </div>
                    {!dms.estDeclenche && (
                      <button
                        onClick={() => handleSignal(dms.id)}
                        className="px-3 py-1.5 rounded text-xs font-semibold bg-state-success/10 text-state-success hover:bg-state-success/20 transition-colors inline-flex items-center gap-1"
                      >
                        <Activity className="w-3 h-3" />
                        Signaler
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
