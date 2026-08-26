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

const SAISON_IMAGES: Record<string, string> = {
  printemps: "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?q=80&w=1920&auto=format&fit=crop",
  ete: "https://images.unsplash.com/photo-1551269901-5c5e14c25df9?q=80&w=1920&auto=format&fit=crop",
  automne: "https://images.unsplash.com/photo-1507006640577-59363a78103e?q=80&w=1920&auto=format&fit=crop",
  hiver: "https://images.unsplash.com/photo-1483631226437-9bf9eb5d3c3c?q=80&w=1920&auto=format&fit=crop",
};

const MOIS_SAISON = [
  "printemps", "printemps", "printemps", "ete", "ete", "ete",
  "automne", "automne", "automne", "hiver", "hiver", "hiver",
];

export function VueAujourdhui({ annee, maintenant }: VueAujourdhuiProps) {
  const [compteARebours, setCompteARebours] = useState({
    heures: 0,
    minutes: 0,
    secondes: 0,
  });

  // Déterminer le jour biblique en cours
  const jourEnCours = determinerJourEnCours(annee.jours, maintenant);
  const prochaineFete = annee.fetes.find((f) => f.joursRestants >= 0);

  // Compte à rebours du coucher de soleil (simulation — calcul réel côté serveur)
  useEffect(() => {
    const calculerCompteARebours = () => {
      // Heure du coucher de soleil approximatif (18:00 UTC par défaut)
      // En production, ce serait calculé côté serveur via astronomy-engine
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
  const saison = MOIS_SAISON[jourEnCours.mois - 1] || "printemps";
  const bgImage = SAISON_IMAGES[saison];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Carte principale : jour en cours */}
      <div className="lg:col-span-2">
        <div className="relative bg-[#2A0E3D] text-[#FAF6EF] rounded-3xl overflow-hidden p-8 md:p-10 shadow-lg">
          {/* Image de saison en fond */}
          <div className="absolute inset-0 z-0">
            <img src={bgImage} alt={saison} className="w-full h-full object-cover opacity-15" />
            <div className="absolute inset-0 bg-[#2A0E3D]/60" />
          </div>
          {/* Décor fond */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8C5FA8]/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#C9A227]" />
              <span className="text-xs uppercase tracking-[0.2em] text-[#C9A227]-light/80 font-semibold">
                Jour biblique en cours
              </span>
            </div>

            <h3 className="font-serif text-4xl md:text-5xl font-semibold text-[#FAF6EF] mb-2">
              {jourEnCours.jourDuMois} {jourEnCours.nomMois}
            </h3>
            <p className="text-lg text-[#FAF6EF]/70 mb-6">
              {jourEnCours.nomJourSemaine} · Jour {jourEnCours.jourDeAnnee} de l&apos;année
            </p>

            {/* Équivalence grégorienne */}
            <div className="flex items-center gap-2 text-sm text-[#FAF6EF]/60 mb-6">
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9A227]/20 border border-[#C9A227]/40 text-[#C9A227] text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                Shabbat — du coucher de soleil vendredi au coucher de soleil samedi
              </div>
            )}

            {/* Trimestre */}
            <div className="mt-6 pt-6 border-t border-[#C9A227]/15">
              <p className="text-xs text-[#FAF6EF]/50 uppercase tracking-[0.18em] font-semibold">
                Trimestre {jourEnCours.trimestre} · Mois {jourEnCours.mois}/12
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Carte compte à rebours coucher de soleil */}
      <div className="space-y-6">
        <div className="card-gold-top p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sunset className="w-5 h-5 text-[#C9A227]" />
            <h4 className="font-serif text-base font-semibold text-[#1E0F2B]">
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
            className="rounded-2xl p-6 text-[#FAF6EF] relative overflow-hidden"
            style={{ backgroundColor: prochaineFete.couleur }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FAF6EF]/10 blur-2xl rounded-full pointer-events-none" />
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 opacity-80">
                Prochaine fête
              </p>
              <h4 className="font-serif text-xl font-semibold mb-1">
                {prochaineFete.nomFr}
              </h4>
              {prochaineFete.nomHebrew && (
                <p className="text-sm opacity-90 font-serif" dir="rtl">
                  {prochaineFete.nomHebrew}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-ivory/20">
                <p className="text-2xl font-serif font-semibold">
                  {prochaineFete.joursRestants === 0
                    ? "Aujourd'hui !"
                    : `Dans ${prochaineFete.joursRestants} ${prochaineFete.joursRestants === 1 ? "jour" : "jours"}`}
                </p>
                <p className="text-xs opacity-75 mt-1">
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
        <div className="card-gold-top p-6">
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-[#C9A227] flex-shrink-0 mt-1" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mb-2">
                Le jour biblique
              </p>
              <p className="font-serif italic text-sm text-imperial/90 leading-relaxed mb-1">
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
    <div className="text-center p-3 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
      <motion.div
        key={value}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="font-serif text-2xl font-semibold text-[#1E0F2B]"
      >
        {value.toString().padStart(2, "0")}
      </motion.div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-semibold">
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

  // Si on est avant le début de l'année biblique, retourner le premier jour
  return jours[0] || null;
}
