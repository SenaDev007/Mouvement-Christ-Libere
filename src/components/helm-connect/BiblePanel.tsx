"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_BIBLE_REFS } from "@/lib/helm-connect/types";

const UPCOMING_FEASTS = [
  { name: "Pessah (Pâque)", date: "14 Aviv (12 avril 2025)", type: "Fête de printemps", color: "#C9A227" },
  { name: "Shavouot (Pentecôte)", date: "15 Sivan (1 juin 2025)", type: "Fête de printemps", color: "#C9A227" },
  { name: "Yom Teroua (Trompettes)", date: "1 Éthanim (23 sept 2025)", type: "Fête d'automne", color: "#8C5FA8" },
  { name: "Yom Kippour (Expiation)", date: "10 Éthanim (2 oct 2025)", type: "Fête d'automne", color: "#B5502F" },
  { name: "Souccot (Tabernacles)", date: "15 Éthanim (7 oct 2025)", type: "Fête d'automne", color: "#5B7052" },
];

export function BiblePanel() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl font-semibold text-[#1E0F2B] flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-[#C9A227]" />
        Bible & Calendrier biblique
      </h2>

      {/* Recherche biblique */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="font-bold text-[#1E0F2B] mb-4">Recherche rapide</h3>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un verset, un mot, une référence..."
            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/20"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {MOCK_BIBLE_REFS.map((ref, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-stone-50 border border-stone-100 hover:border-[#C9A227]/40 transition-colors cursor-pointer group"
            >
              <p className="font-serif italic text-sm text-[#1E0F2B] leading-relaxed">« {ref.text} »</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs font-semibold text-[#C9A227]">{ref.reference}</p>
                <ChevronRight className="w-3 h-3 text-stone-400 group-hover:text-[#C9A227] transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
        <a
          href="/bible"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors whitespace-nowrap"
        >
          Ouvrir la Bible complète
          <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Prochaines fêtes bibliques */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#C9A227]" />
          Prochaines fêtes de l'Éternel
        </h3>
        <div className="space-y-3">
          {UPCOMING_FEASTS.map((feast, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
            >
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: feast.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1E0F2B]">{feast.name}</p>
                <p className="text-xs text-stone-500">{feast.date}</p>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${feast.color}15`, color: feast.color }}>
                {feast.type}
              </span>
            </motion.div>
          ))}
        </div>
        <a
          href="/calendrier-biblique"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A0E3D] hover:text-[#C9A227] transition-colors whitespace-nowrap"
        >
          Voir le calendrier complet (364 jours)
          <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
