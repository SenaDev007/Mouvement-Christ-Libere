"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, Globe, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MembreDisperse {
  id: string;
  pseudonyme: string;
  pays: string;
  ville?: string;
  latitude: number;
  longitude: number;
  langue: string;
  niveau: string;
  message?: string;
}

interface CarteDispersesProps {
  membres: MembreDisperse[];
}

const NIVEAU_COULEURS: Record<string, string> = {
  pasteur: "#C9A227",      // or
  disciple: "#8C5FA8",     // lavande
  croyant: "#5B7052",      // vert olive
  chercheur: "#8A8378",    // gris pierre
};

const NIVEAU_LABELS: Record<string, string> = {
  pasteur: "Pasteur",
  disciple: "Disciple",
  croyant: "Croyant",
  chercheur: "Chercheur",
};

const LANGUE_DRAPEAUX: Record<string, string> = {
  FR: "🇫🇷",
  EN: "🇬🇧",
  ES: "🇪🇸",
  PT: "🇵🇹",
  HE: "🇮🇱",
  AM: "🇪🇹",
};

export function CarteDisperses({ membres }: CarteDispersesProps) {
  const [membreSelectionne, setMembreSelectionne] = useState<MembreDisperse | null>(null);
  const [filtreNiveau, setFiltreNiveau] = useState<string | null>(null);
  const [hoveredPays, setHoveredPays] = useState<string | null>(null);

  const membresFiltres = useMemo(() => {
    if (!filtreNiveau) return membres;
    return membres.filter((m) => m.niveau === filtreNiveau);
  }, [membres, filtreNiveau]);

  // Convertir lat/lon en coordonnées SVG (projection equirectangulaire simple)
  const projectCoord = (lat: number, lon: number) => {
    // SVG viewBox: 0 0 1000 500
    const x = ((lon + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x, y };
  };

  // Stats
  const stats = useMemo(() => {
    const pays = new Set(membres.map((m) => m.pays));
    const langues = new Set(membres.map((m) => m.langue));
    return {
      total: membres.length,
      pays: pays.size,
      langues: langues.size,
    };
  }, [membres]);

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      {/* Carte (3/4) */}
      <div className="lg:col-span-3">
        <div className="card-gold-top p-6">
          {/* Filtres */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mr-2">
              Filtrer :
            </span>
            <button
              onClick={() => setFiltreNiveau(null)}
              className={cn(
                "px-3 py-1 rounded text-xs font-semibold transition-all",
                !filtreNiveau
                  ? "bg-imperial text-ivory"
                  : "border border-imperial/30 text-imperial hover:bg-imperial/5"
              )}
            >
              Tous
            </button>
            {Object.entries(NIVEAU_LABELS).map(([niveau, label]) => (
              <button
                key={niveau}
                onClick={() => setFiltreNiveau(niveau)}
                className={cn(
                  "px-3 py-1 rounded text-xs font-semibold transition-all inline-flex items-center gap-1.5",
                  filtreNiveau === niveau
                    ? "bg-imperial text-ivory"
                    : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: NIVEAU_COULEURS[niveau] }}
                />
                {label}
              </button>
            ))}
          </div>

          {/* Carte SVG */}
          <div className="relative bg-imperial-dark/40 rounded-card overflow-hidden" style={{ aspectRatio: "2 / 1" }}>
            <svg
              viewBox="0 0 1000 500"
              className="w-full h-full"
              style={{ background: "linear-gradient(135deg, #1A0826 0%, #2A0E3D 50%, #1A0826 100%)" }}
            >
              {/* Grille de coordonnées discrète */}
              <defs>
                <pattern id="grid-disperses" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(201, 162, 39, 0.05)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="1000" height="500" fill="url(#grid-disperses)" />

              {/* Continents simplifiés (formes approximatives) */}
              <g fill="rgba(201, 162, 39, 0.08)" stroke="rgba(201, 162, 39, 0.2)" strokeWidth="0.5">
                {/* Amérique du Nord */}
                <path d="M 120 100 Q 150 80 200 90 L 280 100 Q 300 120 290 180 L 250 220 Q 200 230 180 200 L 150 180 Q 130 150 120 100 Z" />
                {/* Amérique du Sud */}
                <path d="M 280 250 Q 300 270 310 320 L 300 380 Q 280 400 270 380 L 260 320 Q 270 280 280 250 Z" />
                {/* Europe */}
                <path d="M 480 100 Q 510 90 540 100 L 560 130 Q 550 160 520 170 L 490 160 Q 470 140 480 100 Z" />
                {/* Afrique */}
                <path d="M 500 200 Q 530 190 560 210 L 580 280 Q 570 350 540 380 L 510 370 Q 490 320 500 200 Z" />
                {/* Asie */}
                <path d="M 580 100 Q 700 80 800 120 L 850 180 Q 830 220 780 230 L 700 220 Q 620 200 580 150 Z" />
                {/* Océanie */}
                <path d="M 800 320 Q 830 310 860 330 L 870 360 Q 850 380 820 370 L 800 350 Z" />
              </g>

              {/* Lignes de latitude (équateur, tropiques) */}
              <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(201, 162, 39, 0.15)" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="0" y1="185" x2="1000" y2="185" stroke="rgba(201, 162, 39, 0.1)" strokeWidth="0.3" strokeDasharray="2 4" />
              <line x1="0" y1="315" x2="1000" y2="315" stroke="rgba(201, 162, 39, 0.1)" strokeWidth="0.3" strokeDasharray="2 4" />

              {/* Points des dispersés */}
              {membresFiltres.map((membre, idx) => {
                const { x, y } = projectCoord(membre.latitude, membre.longitude);
                const couleur = NIVEAU_COULEURS[membre.niveau] || NIVEAU_COULEURS.chercheur;
                return (
                  <g key={membre.id}>
                    {/* Halo pulsant */}
                    <motion.circle
                      cx={x}
                      cy={y}
                      r="8"
                      fill={couleur}
                      opacity="0.2"
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: idx * 0.2,
                        ease: "easeInOut",
                      }}
                      style={{ transformOrigin: `${x}px ${y}px` }}
                    />
                    {/* Point central */}
                    <motion.circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill={couleur}
                      stroke="#FAF6EF"
                      strokeWidth="1"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="cursor-pointer"
                      onClick={() => setMembreSelectionne(membre)}
                      onMouseEnter={() => setHoveredPays(membre.pays)}
                      onMouseLeave={() => setHoveredPays(null)}
                    />
                    {/* Label au hover */}
                    {hoveredPays === membre.pays && (
                      <text
                        x={x}
                        y={y - 10}
                        fill="#FAF6EF"
                        fontSize="10"
                        textAnchor="middle"
                        className="pointer-events-none font-sans"
                      >
                        {membre.pseudonyme}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Légende Jérusalem */}
              <g>
                <circle cx="587" cy="232" r="5" fill="#C9A227" stroke="#FAF6EF" strokeWidth="1.5" />
                <text x="587" y="222" fill="#C9A227" fontSize="9" textAnchor="middle" className="font-serif font-semibold">
                  Jérusalem
                </text>
              </g>
            </svg>

            {/* Overlay stats */}
            <div className="absolute top-4 left-4 bg-imperial/80 backdrop-blur-sm text-ivory px-3 py-2 rounded-md border border-gold/20">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold-light/80 font-semibold mb-1">
                Dispersés d'Israël
              </p>
              <p className="font-serif text-lg font-semibold">
                {stats.total} membres · {stats.pays} pays
              </p>
            </div>
          </div>

          {/* Légende */}
          <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-stone">
            {Object.entries(NIVEAU_LABELS).map(([niveau, label]) => (
              <span key={niveau} className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: NIVEAU_COULEURS[niveau] }}
                />
                {label}
              </span>
            ))}
            <span className="text-stone/60">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gold border border-ivory" />
              Jérusalem (référence)
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar (1/4) */}
      <div className="space-y-4">
        {/* Stats globales */}
        <div className="card-gold-top p-5">
          <h3 className="font-serif text-base font-semibold text-ink mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-gold" />
            Rassemblement en cours
          </h3>
          <div className="space-y-3">
            <StatItem icon={Users} label="Membres inscrits" value={stats.total} />
            <StatItem icon={MapPin} label="Pays représentés" value={stats.pays} />
            <StatItem icon={MessageCircle} label="Langues parlées" value={stats.langues} />
          </div>
        </div>

        {/* Prophétie */}
        <div className="bg-imperial text-ivory rounded-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 blur-2xl rounded-full pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold-light/70 font-semibold mb-2">
              Prophétie
            </p>
            <p className="font-serif italic text-sm text-ivory/90 leading-relaxed mb-2">
              « Il rassemblera les exilés d'Israël, et il recueillera les dispersés de Juda des quatre extrémités de la terre. »
            </p>
            <p className="text-xs text-gold-light/70 font-semibold">Ésaïe 11:12</p>
          </div>
        </div>

        {/* Liste des membres récents */}
        <div className="card-gold-top p-5">
          <h3 className="font-serif text-base font-semibold text-ink mb-3">
            Derniers inscrits
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-discrete">
            {membresFiltres.slice(0, 8).map((m) => (
              <button
                key={m.id}
                onClick={() => setMembreSelectionne(m)}
                className="w-full text-left p-2 rounded hover:bg-gold/5 transition-colors flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: NIVEAU_COULEURS[m.niveau] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink truncate">{m.pseudonyme}</p>
                  <p className="text-[10px] text-stone">
                    {LANGUE_DRAPEAUX[m.langue] || "🌐"} {m.ville || m.pays}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal détail membre */}
      <AnimatePresence>
        {membreSelectionne && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-imperial-dark/60 backdrop-blur-sm"
            onClick={() => setMembreSelectionne(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-ivory rounded-card max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête */}
              <div
                className="p-6 text-ivory relative"
                style={{ backgroundColor: NIVEAU_COULEURS[membreSelectionne.niveau] }}
              >
                <button
                  onClick={() => setMembreSelectionne(null)}
                  className="absolute top-4 right-4 p-1.5 rounded hover:bg-ivory/20"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-ivory/20 border border-ivory/30">
                    <span className="font-serif text-lg font-semibold">
                      {membreSelectionne.pseudonyme.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-semibold">
                      {membreSelectionne.pseudonyme}
                    </h3>
                    <p className="text-xs opacity-80">
                      {LANGUE_DRAPEAUX[membreSelectionne.langue]}{" "}
                      {membreSelectionne.ville}, {membreSelectionne.pays}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${NIVEAU_COULEURS[membreSelectionne.niveau]}20`,
                      color: NIVEAU_COULEURS[membreSelectionne.niveau],
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: NIVEAU_COULEURS[membreSelectionne.niveau] }}
                    />
                    {NIVEAU_LABELS[membreSelectionne.niveau]}
                  </span>
                </div>

                {membreSelectionne.message && (
                  <div className="p-4 bg-imperial/5 rounded-md border border-gold/20 mb-4">
                    <p className="font-serif italic text-sm text-ink/80 leading-relaxed">
                      « {membreSelectionne.message} »
                    </p>
                  </div>
                )}

                <div className="text-xs text-stone space-y-1">
                  <p>
                    <strong className="text-ink">Position :</strong>{" "}
                    {membreSelectionne.latitude.toFixed(1)}°, {membreSelectionne.longitude.toFixed(1)}°
                    <span className="text-stone/60 ml-1">(arrondie à 0.1° pour anonymat)</span>
                  </p>
                  <p>
                    <strong className="text-ink">Langue :</strong> {membreSelectionne.langue}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-imperial/10">
        <Icon className="w-4 h-4 text-imperial" />
      </div>
      <div>
        <div className="font-serif text-xl font-semibold text-ink">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-stone font-semibold">{label}</div>
      </div>
    </div>
  );
}
