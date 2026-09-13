"use client";

/**
 * ⭐ V3.47 — FRISE CHRONOLOGIQUE PUBLIQUE (pages /pam et /pasteur-kongo).
 *
 * Affiche les jalons biographiques (module « Biographies » du back-office)
 * avec leur photo (Biography.photoUrl, uploadée depuis le modal
 * biographique) : date/période, titre, récit, verset. Si un jalon n'a pas
 * de photo, la carte reste élégante (point stylé + contenu seul).
 *
 * La section n'apparaît QUE si le serviteur a au moins un jalon —
 * zéro changement visuel pour les pages sans frise.
 *
 * Textes passés par IsololeText (« Israël » → « Isolélé (Israël) » en gras).
 */

import { motion } from "framer-motion";
import { Calendar, Quote, Milestone as MilestoneIcon, Sparkles } from "lucide-react";
import { IsololeText } from "@/lib/isolole";

export interface BioMilestone {
  id: string;
  date: string;
  title: string;
  description: string;
  verseRef?: string | null;
  verseText?: string | null;
  photoUrl?: string | null;
  order: number;
}

interface BioTimelineProps {
  milestones: BioMilestone[];
  accentColor?: string;
  /** Titre de la section (ex. « Les étapes du parcours de Pam »). */
  title?: string;
  kicker?: string;
}

export function BioTimeline({
  milestones,
  accentColor = "#C9A227",
  title = "Les étapes du parcours",
  kicker = "Frise chronologique",
}: BioTimelineProps) {
  if (!milestones.length) return null;

  return (
    <section className="py-16 md:py-24 bg-[#FAF6EF] overflow-x-clip">
      <div className="max-w-4xl mx-auto px-4">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] font-bold mb-3" style={{ color: accentColor }}>
            {kicker}
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1E0F2B] mb-4">
            <IsololeText>{title}</IsololeText>
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="w-12 h-px bg-[#C9A227]/40" />
            <Quote className="w-4 h-4 text-[#C9A227]" />
            <div className="w-12 h-px bg-[#C9A227]/40" />
          </div>
        </motion.div>

        {/* Timeline verticale */}
        <div className="relative">
          {/* Ligne verticale */}
          <div
            className="absolute left-[27px] top-4 bottom-4 w-0.5"
            style={{ background: `linear-gradient(to bottom, ${accentColor}55, ${accentColor}15)` }}
          />

          <div className="space-y-8">
            {milestones.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: 0.05 }}
                className="relative flex items-start gap-4 md:gap-6"
              >
                {/* Point timeline */}
                <div
                  className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full border-2 flex-shrink-0 bg-white shadow-md"
                  style={{ borderColor: accentColor }}
                >
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="w-full h-full object-cover rounded-full"
                      loading="lazy"
                    />
                  ) : (
                    <MilestoneIcon className="w-5 h-5" style={{ color: accentColor }} />
                  )}
                </div>

                {/* Carte du jalon */}
                <div
                  className="flex-1 min-w-0 bg-white rounded-2xl shadow-md border border-[#8A8378]/15 overflow-hidden"
                  style={{ borderLeft: `3px solid ${accentColor}` }}
                >
                  {m.photoUrl && (
                    <div className="relative aspect-video overflow-hidden bg-[#2A0E3D] group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.photoUrl}
                        alt={m.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2A0E3D]/50 via-transparent to-transparent" />
                      {m.date && (
                        <span
                          className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.15em] font-bold backdrop-blur-sm border"
                          style={{ background: "rgba(26,8,38,0.6)", borderColor: `${accentColor}55`, color: accentColor }}
                        >
                          <Calendar className="w-3 h-3" />
                          <IsololeText>{m.date}</IsololeText>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      {!m.photoUrl && m.date && (
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold"
                          style={{ color: accentColor }}
                        >
                          <Calendar className="w-3 h-3" />
                          <IsololeText>{m.date}</IsololeText>
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-[#8A8378]/60 ml-auto">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg md:text-xl font-bold text-[#1E0F2B] leading-snug">
                      <IsololeText>{m.title}</IsololeText>
                    </h3>

                    {m.description && (
                      <p className="text-sm text-[#1E0F2B]/75 mt-2 leading-relaxed">
                        <IsololeText>{m.description}</IsololeText>
                      </p>
                    )}

                    {(m.verseRef || m.verseText) && (
                      <div className="mt-4 pt-4 border-t border-[#8A8378]/10">
                        {m.verseText && (
                          <p className="font-serif text-sm italic text-[#2A0E3D] leading-relaxed">
                            « <IsololeText>{m.verseText}</IsololeText> »
                          </p>
                        )}
                        {m.verseRef && (
                          <p
                            className="text-[11px] font-bold uppercase tracking-[0.15em] mt-1.5 inline-flex items-center gap-1.5"
                            style={{ color: accentColor }}
                          >
                            <Sparkles className="w-3 h-3" />
                            {m.verseRef}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
