"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sunset, Sun, Calendar, ChevronRight, BookOpen, Sparkles } from "lucide-react";
import type { AnneeBibliqueData, JourBiblique, Fete } from "./calendrier-app";
import { cn } from "@/lib/utils";

interface VueAujourdhuiProps {
  annee: AnneeBibliqueData;
  maintenant: Date;
}

// Images saisonnières (Unsplash — paysages bibliques)
const SAISON_BG: Array<{ image: string; overlay: string; saison: string }> = [
  {
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.92) 0%, rgba(42,14,61,0.7) 50%, rgba(201,162,39,0.35) 100%)",
    saison: "Printemps",
  },
  {
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(201,162,39,0.45) 50%, rgba(42,14,61,0.72) 100%)",
    saison: "Été",
  },
  {
    image: "https://images.unsplash.com/photo-1507371341162-763b5e419408?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.88) 0%, rgba(124,92,184,0.4) 50%, rgba(156,126,30,0.5) 100%)",
    saison: "Automne",
  },
  {
    image: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1920&auto=format&fit=crop",
    overlay: "linear-gradient(135deg, rgba(42,14,61,0.92) 0%, rgba(250,246,239,0.25) 50%, rgba(42,14,61,0.78) 100%)",
    saison: "Hiver",
  },
];

export function VueAujourdhui({ annee, maintenant }: VueAujourdhuiProps) {
  const [compteARebours, setCompteARebours] = useState({
    heures: 0,
    minutes: 0,
    secondes: 0,
  });

  const jourEnCours = determinerJourEnCours(annee.jours, maintenant);
  const prochaineFete = annee.fetes.find((f) => f.joursRestants >= 0);

  // Déterminer la saison du trimestre en cours
  const trimestre = jourEnCours?.trimestre || 1;
  const saison = SAISON_BG[trimestre - 1];

  useEffect(() => {
    const calculerCompteARebours = () => {
      const maintenant = new Date();
      const coucher = new Date(maintenant);
      coucher.setUTCHours(18, 0, 0, 0);
      if (coucher.getTime() <= maintenant.getTime()) {
        coucher.setUTCDate(coucher.getUTCDate() + 1);
      }

      const diff = coucher.getTime() - maintenant.getTime();
      const heures = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secondes = Math.floor((diff % (1000 * 60)) / 1000);

      setCompteARebours({ heures, minutes, secondes });
    };

    calculerCompteARebours();
    const timer = setInterval(calculerCompteARebours, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!jourEnCours) {
    return (
      <div className="text-center py-20">
        <p className="text-[#8A8378] italic">Calcul du jour biblique en cours...</p>
      </div>
    );
  }

  const dateGreg = new Date(jourEnCours.dateGregorienne);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Carte principale : jour en cours — avec image saisonnière */}
      <div className="lg:col-span-2">
        <div
          className="relative rounded-2xl overflow-hidden shadow-xl border border-[#8A8378]/20"
          style={{
            backgroundImage: `url(${saison.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay saisonnier */}
          <div className="absolute inset-0" style={{ background: saison.overlay }} />

          {/* Décor fond */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#7C5CB8]/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 p-8 md:p-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs uppercase tracking-[0.2em] text-[#C9A227] font-bold drop-shadow">
                Jour biblique en cours · {saison.saison}
              </span>
            </div>

            <h3 className="font-serif text-4xl md:text-5xl font-bold text-[#FAF6EF] mb-2 drop-shadow-lg">
              {jourEnCours.jourDuMois} {jourEnCours.nomMois}
            </h3>
            <p className="text-lg text-[#FAF6EF]/80 mb-6 drop-shadow">
              {jourEnCours.nomJourSemaine} · Jour {jourEnCours.jourDeAnnee} de l&apos;année
            </p>

            {/* Équivalence grégorienne */}
            <div className="flex items-center gap-2 text-sm text-[#FAF6EF]/80 mb-6">
              <Calendar className="w-4 h-4 text-[#C9A227]" />
              <span>
                {dateGreg.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            </div>

            {/* Shabbat ? */}
            {jourEnCours.estShabbat && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9A227]/20 border border-[#C9A227]/40 text-[#C9A227] text-xs font-bold backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                Shabbat — du coucher de soleil vendredi au coucher de soleil samedi
              </div>
            )}

            {/* Trimestre */}
            <div className="mt-6 pt-6 border-t border-[#C9A227]/15">
              <p className="text-xs text-[#FAF6EF]/60 uppercase tracking-[0.18em] font-bold">
                Trimestre {jourEnCours.trimestre} · Mois {jourEnCours.mois}/12 · Saison de {saison.saison}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Carte compte à rebours coucher de soleil */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#8A8378]/15 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sunset className="w-5 h-5 text-[#C9A227]" />
            <h4 className="font-serif text-base font-bold text-[#1E0F2B]">
              Coucher de soleil
            </h4>
          </div>
          <p className="text-xs text-[#8A8378] mb-4">
            Le jour biblique se termine au coucher du soleil à Jérusalem.
          </p>

          {/* Compte à rebours */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <CompteAReboursCard value={compteARebours.heures} label="heures" />
            <CompteAReboursCard value={compteARebours.minutes} label="min" />
            <CompteAReboursCard value={compteARebours.secondes} label="sec" />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#8A8378]">
            <Sun className="w-3 h-3 text-[#C9A227]" />
            <span>Prochain coucher : ~18:00 UTC</span>
          </div>
        </div>

        {/* Prochaine fête */}
        {prochaineFete && (
          <div
            className="rounded-2xl p-6 text-[#FAF6EF] relative overflow-hidden shadow-lg"
            style={{ backgroundColor: prochaineFete.couleur }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FAF6EF]/10 blur-2xl rounded-full pointer-events-none" />
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2 opacity-90">
                Prochaine fête
              </p>
              <h4 className="font-serif text-xl font-bold mb-1">
                {prochaineFete.nomFr}
              </h4>
              {prochaineFete.nomHebrew && (
                <p className="text-sm opacity-90 font-serif" dir="rtl">
                  {prochaineFete.nomHebrew}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-[#FAF6EF]/20">
                <p className="text-2xl font-serif font-bold">
                  {prochaineFete.joursRestants === 0
                    ? "Aujourd'hui !"
                    : `Dans ${prochaineFete.joursRestants} ${prochaineFete.joursRestants === 1 ? "jour" : "jours"}`}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  {new Date(prochaineFete.dateGregorienne).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Référence biblique */}
        <div className="bg-white rounded-xl shadow-sm border border-[#8A8378]/15 p-6">
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-1" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2">
                Le jour biblique
              </p>
              <p className="font-serif italic text-sm text-[#2A0E3D] leading-relaxed mb-1">
                « Il y eut un soir et il y eut un matin, un jour. »
              </p>
              <p className="text-xs text-[#8A8378]">Genèse 1:5</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompteAReboursCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-[#2A0E3D]/5 border border-[#C9A227]/20">
      <motion.div
        key={value}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="font-serif text-2xl font-bold text-[#1E0F2B]"
      >
        {value.toString().padStart(2, "0")}
      </motion.div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold">
        {label}
      </div>
    </div>
  );
}

function determinerJourEnCours(
  jours: JourBiblique[],
  maintenant: Date
): JourBiblique | null {
  const maintenantMs = maintenant.getTime();

  for (const jour of jours) {
    const jourDebut = new Date(jour.dateGregorienne).getTime();
    const jourFin = jourDebut + 24 * 60 * 60 * 1000;
    if (maintenantMs >= jourDebut && maintenantMs < jourFin) {
      return jour;
    }
  }

  return jours[0] || null;
}
