"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import { MapPin, Users, Globe, X, MessageCircle } from "lucide-react";
import "leaflet/dist/leaflet.css";
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

const LANGUE_DRAPEAUX: Record<string, string> = {
  FR: "🇫🇷",
  EN: "🇬🇧",
  ES: "🇪🇸",
  PT: "🇵🇹",
  HE: "🇮🇱",
  AM: "🇪🇹",
};

// Coordonnées de Jérusalem (référence)
const JERUSALEM: [number, number] = [31.7683, 35.2137];

export function CarteDisperses({ membres }: CarteDispersesProps) {
  const [filtreNiveau, setFiltreNiveau] = useState<string | null>(null);

  const membresFiltres = useMemo(() => {
    if (!filtreNiveau) return membres;
    return membres.filter((m) => m.niveau === filtreNiveau);
  }, [membres, filtreNiveau]);

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

          {/* Carte Leaflet — vraie carte géographique */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-[#C9A227]/20" style={{ height: "500px" }}>
            <MapContainer
              center={[20, 10]}
              zoom={2}
              minZoom={2}
              maxZoom={10}
              scrollWheelZoom={true}
              style={{ width: "100%", height: "100%", background: "#1A0826" }}
              worldCopyJump={true}
            >
              {/* Fond de carte — style sombre élégant */}
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />

              {/* Point Jérusalem (référence) */}
              <CircleMarker
                center={JERUSALEM}
                radius={8}
                pathOptions={{
                  color: "#C9A227",
                  fillColor: "#C9A227",
                  fillOpacity: 0.8,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -8]} className="custom-tooltip">
                  Jérusalem
                </Tooltip>
                <Popup>
                  <div className="text-center">
                    <strong>Jérusalem</strong>
                    <br />
                    <span className="text-xs">Lieu de référence — où l'Éternel a mis son nom</span>
                  </div>
                </Popup>
              </CircleMarker>

              {/* Points des dispersés */}
              {membresFiltres.map((membre) => {
                const couleur = NIVEAU_COULEURS[membre.niveau] || NIVEAU_COULEURS.chercheur;
                return (
                  <CircleMarker
                    key={membre.id}
                    center={[membre.latitude, membre.longitude]}
                    radius={7}
                    pathOptions={{
                      color: "#FAF6EF",
                      fillColor: couleur,
                      fillOpacity: 0.9,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[180px]">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: couleur }}
                          >
                            {membre.pseudonyme.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{membre.pseudonyme}</p>
                            <p className="text-xs text-gray-500">
                              {LANGUE_DRAPEAUX[membre.langue] || "🌐"} {membre.ville || ""} {membre.pays}
                            </p>
                          </div>
                        </div>
                        {membre.message && (
                          <p className="text-xs italic text-gray-600 mb-2">« {membre.message} »</p>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className="px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              backgroundColor: `${couleur}20`,
                              color: couleur,
                            }}
                          >
                            {NIVEAU_LABELS[membre.niveau] || membre.niveau}
                          </span>
                          <span className="text-gray-400">
                            {membre.latitude.toFixed(1)}°, {membre.longitude.toFixed(1)}°
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Overlay stats */}
            <div className="absolute top-3 left-3 z-[1000] bg-[#2A0E3D]/90 backdrop-blur-sm text-[#FAF6EF] px-3 py-2 rounded-lg border border-[#C9A227]/30 pointer-events-none">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/80 font-semibold mb-0.5">
                Dispersés d'Israël
              </p>
              <p className="font-serif text-base font-semibold">
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
              <div
                key={m.id}
                className="w-full text-left p-2 rounded hover:bg-[#C9A227]/5 transition-colors flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: NIVEAU_COULEURS[m.niveau] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#1E0F2B] truncate">{m.pseudonyme}</p>
                  <p className="text-[10px] text-[#8A8378]">
                    {LANGUE_DRAPEAUX[m.langue] || "🌐"} {m.ville || m.pays}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
