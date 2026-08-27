"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DottedMap from "dotted-map";
import Image from "next/image";
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
  pasteur: "#C9A227",
  disciple: "#8C5FA8",
  croyant: "#5B7052",
  chercheur: "#8A8378",
};

const NIVEAU_LABELS: Record<string, string> = {
  pasteur: "Pasteur",
  disciple: "Disciple",
  croyant: "Croyant",
  chercheur: "Chercheur",
};

// Drapeaux par code pays (ISO 2 lettres)
const PAYS_DRAPEAUX: Record<string, string> = {
  FR: "🇫🇷", CI: "🇨🇮", BJ: "🇧🇯", SN: "🇸🇳", ML: "🇲🇱", BF: "🇧🇫",
  NG: "🇳🇬", GH: "🇬🇭", TG: "🇹🇬", NE: "🇳🇪", CM: "🇨🇲", CD: "🇨🇩",
  CG: "🇨🇬", GA: "🇬🇦", US: "🇺🇸", CA: "🇨🇦", GB: "🇬🇧", BE: "🇧🇪",
  CH: "🇨🇭", DE: "🇩🇪", IT: "🇮🇹", ES: "🇪🇸", PT: "🇵🇹", NL: "🇳🇱",
  IL: "🇮🇱", BR: "🇧🇷", MX: "🇲🇽", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴",
  AU: "🇦🇺", NZ: "🇳🇿", ZA: "🇿🇦", EG: "🇪🇬", MA: "🇲🇦", DZ: "🇩🇿",
  TN: "🇹🇳", LY: "🇱🇾", ET: "🇪🇹", KE: "🇰🇪", UG: "🇺🇬", TZ: "🇹🇿",
  RW: "🇷🇼", BI: "🇧🇮", ZM: "🇿🇲", ZW: "🇿🇼", MZ: "🇲🇿", AO: "🇦🇴",
};

function getDrapeau(pays: string): string {
  return PAYS_DRAPEAUX[pays.toUpperCase()] || "🌐";
}

// Coordonnées de Jérusalem
const JERUSALEM = { lat: 31.7683, lng: 35.2137 };

export function CarteDisperses({ membres }: CarteDispersesProps) {
  const [membreSelectionne, setMembreSelectionne] = useState<MembreDisperse | null>(null);
  const [filtreNiveau, setFiltreNiveau] = useState<string | null>(null);

  const membresFiltres = useMemo(() => {
    if (!filtreNiveau) return membres;
    return membres.filter((m) => m.niveau === filtreNiveau);
  }, [membres, filtreNiveau]);

  // Générer la carte dotted-map avec pins intégrés (alignement parfait)
  const { svgMap, pinPositions } = useMemo(() => {
    const map = new DottedMap({ height: 80, grid: "diagonal" });

    // Ajouter Jérusalem comme pin de référence
    const jerusalemPin = map.addPin({
      lat: JERUSALEM.lat,
      lng: JERUSALEM.lng,
      svgOptions: { color: "#C9A227", radius: 0.6 },
    });

    // Ajouter chaque membre comme pin
    const positions: Array<{ membre: MembreDisperse; x: number; y: number }> = [];
    for (const membre of membres) {
      const couleur = NIVEAU_COULEURS[membre.niveau] || NIVEAU_COULEURS.chercheur;
      const pin = map.addPin({
        lat: membre.latitude,
        lng: membre.longitude,
        svgOptions: { color: couleur, radius: 0.5 },
      });
      if (pin) {
        positions.push({ membre, x: pin.x, y: pin.y });
      }
    }

    const svg = map.getSVG({
      radius: 0.25,
      color: "#FAF6EF30",
      shape: "circle",
      backgroundColor: "#1A0826",
    });

    // Extraire les dimensions du viewBox
    const viewBoxMatch = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const width = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 1000;
    const height = viewBoxMatch ? parseFloat(viewBoxMatch[2]) : 500;

    return {
      svgMap: svg,
      pinPositions: positions.map((p) => ({
        ...p,
        x: (p.x / width) * 1000,
        y: (p.y / height) * 500,
      })),
      jerusalemPos: jerusalemPin
        ? {
            x: (jerusalemPin.x / width) * 1000,
            y: (jerusalemPin.y / height) * 500,
          }
        : null,
    } as any;
  }, [membres]);

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
            <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mr-2">
              Filtrer :
            </span>
            <button
              onClick={() => setFiltreNiveau(null)}
              className={cn(
                "px-3 py-1 rounded text-xs font-semibold transition-all",
                !filtreNiveau
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
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
                    ? "bg-[#2A0E3D] text-[#FAF6EF]"
                    : "border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
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

          {/* Carte dotted-map avec overlay interactif */}
          <div className="relative bg-[#1A0826] rounded-2xl overflow-hidden border-2 border-[#C9A227]/20" style={{ aspectRatio: "2 / 1" }}>
            {/* Fond dotted-map */}
            <Image
              src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
              alt="Carte du monde — Dispersés d'Israël"
              fill
              sizes="(max-width: 1024px) 100vw, 75vw"
              className="object-cover pointer-events-none select-none"
              draggable={false}
            />

            {/* Overlay SVG pour points interactifs */}
            <svg
              viewBox="0 0 1000 500"
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Lignes de latitude (équateur, tropiques) */}
              <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(201, 162, 39, 0.12)" strokeWidth="0.5" strokeDasharray="4 4" />

              {/* Traits reliant les points entre eux */}
              {membresFiltres.length > 1 && pinPositions && (() => {
                const pins = membresFiltres
                  .map(m => pinPositions.find((p: any) => p.membre.id === m.id))
                  .filter(Boolean) as Array<{ x: number; y: number; membre: MembreDisperse }>;

                const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
                for (let i = 0; i < pins.length - 1; i++) {
                  lines.push({ x1: pins[i].x, y1: pins[i].y, x2: pins[i + 1].x, y2: pins[i + 1].y });
                }

                return lines.map((line, i) => (
                  <motion.line
                    key={`line-${i}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="rgba(201, 162, 39, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, delay: i * 0.1 }}
                  />
                ));
              })()}

              {/* Traits reliant chaque point à Jérusalem */}
              {pinPositions && (() => {
                const jerusalemPin = pinPositions?.jerusalemPos;
                if (!jerusalemPin) return null;
                return membresFiltres.map((membre) => {
                  const pin = pinPositions.find((p: any) => p.membre.id === membre.id);
                  if (!pin) return null;
                  return (
                    <motion.line
                      key={`line-jerusalem-${membre.id}`}
                      x1={pin.x}
                      y1={pin.y}
                      x2={jerusalemPin.x}
                      y2={jerusalemPin.y}
                      stroke="rgba(201, 162, 39, 0.15)"
                      strokeWidth="0.5"
                      strokeDasharray="2 4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  );
                });
              })()}

              {/* Points des dispersés (overlay interactif) */}
              {membresFiltres.map((membre, idx) => {
                const pin = pinPositions?.find((p: any) => p.membre.id === membre.id);
                if (!pin) return null;
                const couleur = NIVEAU_COULEURS[membre.niveau] || NIVEAU_COULEURS.chercheur;
                return (
                  <g key={membre.id}>
                    {/* Halo pulsant */}
                    <motion.circle
                      cx={pin.x}
                      cy={pin.y}
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
                      style={{ transformOrigin: `${pin.x}px ${pin.y}px` }}
                    />
                    {/* Point central */}
                    <motion.circle
                      cx={pin.x}
                      cy={pin.y}
                      r="5"
                      fill={couleur}
                      stroke="#FAF6EF"
                      strokeWidth="1.5"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="cursor-pointer"
                      onClick={() => setMembreSelectionne(membre)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Overlay stats */}
            <div className="absolute top-4 left-4 bg-[#2A0E3D]/80 backdrop-blur-sm text-[#FAF6EF] px-3 py-2 rounded-md border border-[#C9A227]/20 pointer-events-none">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/80 font-semibold mb-1">
                Dispersés d'Israël
              </p>
              <p className="font-serif text-lg font-semibold">
                {stats.total} membres · {stats.pays} pays
              </p>
            </div>
          </div>

          {/* Légende */}
          <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-[#8A8378]">
            {Object.entries(NIVEAU_LABELS).map(([niveau, label]) => (
              <span key={niveau} className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: NIVEAU_COULEURS[niveau] }}
                />
                {label}
              </span>
            ))}
            <span className="text-[#8A8378]/60">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#C9A227]" />
              Jérusalem (référence)
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar (1/4) */}
      <div className="space-y-4">
        <div className="card-gold-top p-5">
          <h3 className="font-serif text-base font-semibold text-[#1E0F2B] mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#C9A227]" />
            Rassemblement en cours
          </h3>
          <div className="space-y-3">
            <StatItem icon={Users} label="Membres inscrits" value={stats.total} />
            <StatItem icon={MapPin} label="Pays représentés" value={stats.pays} />
            <StatItem icon={MessageCircle} label="Langues parlées" value={stats.langues} />
          </div>
        </div>

        <div className="bg-[#2A0E3D] text-[#FAF6EF] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A227]/10 blur-2xl rounded-full pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#DDBE55]/70 font-semibold mb-2">
              Prophétie
            </p>
            <p className="font-serif italic text-sm text-[#FAF6EF]/90 leading-relaxed mb-2">
              « Il rassemblera les exilés d'Israël, et il recueillera les dispersés de Juda des quatre extrémités de la terre. »
            </p>
            <p className="text-xs text-[#DDBE55]/70 font-semibold">Ésaïe 11:12</p>
          </div>
        </div>

        <div className="card-gold-top p-5">
          <h3 className="font-serif text-base font-semibold text-[#1E0F2B] mb-3">
            Derniers inscrits
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-discrete">
            {membresFiltres.slice(0, 8).map((m) => (
              <button
                key={m.id}
                onClick={() => setMembreSelectionne(m)}
                className="w-full text-left p-2 rounded hover:bg-[#C9A227]/5 transition-colors flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: NIVEAU_COULEURS[m.niveau] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#1E0F2B] truncate">{m.pseudonyme}</p>
                  <p className="text-[10px] text-[#8A8378]">
                    {getDrapeau(m.pays)} {m.ville || m.pays}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A0826]/60 backdrop-blur-sm"
            onClick={() => setMembreSelectionne(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FAF6EF] rounded-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="p-6 text-[#FAF6EF] relative"
                style={{ backgroundColor: NIVEAU_COULEURS[membreSelectionne.niveau] }}
              >
                <button
                  onClick={() => setMembreSelectionne(null)}
                  className="absolute top-4 right-4 p-1.5 rounded hover:bg-[#FAF6EF]/20"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#FAF6EF]/20 border border-[#FAF6EF]/30">
                    <span className="font-serif text-lg font-semibold">
                      {membreSelectionne.pseudonyme.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-semibold">
                      {membreSelectionne.pseudonyme}
                    </h3>
                    <p className="text-xs opacity-80">
                      {getDrapeau(membreSelectionne.pays)}{" "}
                      {membreSelectionne.ville}, {membreSelectionne.pays}
                    </p>
                  </div>
                </div>
              </div>

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
                  <div className="p-4 bg-[#2A0E3D]/5 rounded-md border border-[#C9A227]/20 mb-4">
                    <p className="font-serif italic text-sm text-[#1E0F2B]/80 leading-relaxed">
                      « {membreSelectionne.message} »
                    </p>
                  </div>
                )}

                <div className="text-xs text-[#8A8378] space-y-1">
                  <p>
                    <strong className="text-[#1E0F2B]">Position :</strong>{" "}
                    {membreSelectionne.latitude.toFixed(1)}°, {membreSelectionne.longitude.toFixed(1)}°
                    <span className="text-[#8A8378]/60 ml-1">(arrondie à 0.1° pour anonymat)</span>
                  </p>
                  <p>
                    <strong className="text-[#1E0F2B]">Langue :</strong> {membreSelectionne.langue}
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
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[#2A0E3D]/10">
        <Icon className="w-4 h-4 text-[#2A0E3D]" />
      </div>
      <div>
        <div className="font-serif text-xl font-semibold text-[#1E0F2B]">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-[#8A8378] font-semibold">{label}</div>
      </div>
    </div>
  );
}
