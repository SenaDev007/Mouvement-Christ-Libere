"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import DottedMap from "dotted-map";
import Image from "next/image";

interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

interface WorldMapProps {
  points?: MapPoint[];
  lineColor?: string;
  dotColor?: string;
}

/**
 * WorldMap — Carte du monde en points avec halos lumineux clignotants.
 * Contextualisée pour Mouvement Christ Libère (dispersés d'Israël).
 *
 * - Fond violet impérial (#2A0E3D)
 * - Points en or (#C9A227) avec animation de halo pulsant
 * - Lignes courbes entre les points (trajectoires de dispersion)
 */
export function WorldMap({
  points = [],
  lineColor = "#C9A227",
  dotColor = "#C9A227",
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const map = new DottedMap({ height: 100, grid: "diagonal" });

  const svgMap = map.getSVG({
    radius: 0.22,
    color: "#FAF6EF40",
    shape: "circle",
    backgroundColor: "#2A0E3D",
  });

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  // Créer des lignes entre points consécutifs
  const lines: Array<{ start: MapPoint; end: MapPoint }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    lines.push({ start: points[i], end: points[i + 1] });
  }

  const createCurvedPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 50;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  return (
    <div className="w-full aspect-[2/1] bg-[#2A0E3D] rounded-2xl relative font-sans overflow-hidden border border-[#C9A227]/20">
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)] pointer-events-none select-none"
        alt="Carte du monde — Dispersés d'Israël"
        height="495"
        width="1056"
        draggable={false}
      />
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="w-full h-full absolute inset-0 pointer-events-none select-none"
      >
        {/* Lignes courbes entre les points */}
        {lines.map((line, i) => {
          const startPoint = projectPoint(line.start.lat, line.start.lng);
          const endPoint = projectPoint(line.end.lat, line.end.lng);
          return (
            <motion.path
              key={`path-${i}`}
              d={createCurvedPath(startPoint, endPoint)}
              fill="none"
              stroke={lineColor}
              strokeWidth="1"
              strokeOpacity="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: 0.3 * i, ease: "easeOut" }}
            />
          );
        })}

        {/* Points avec halo lumineux clignotant */}
        {points.map((point, i) => {
          const { x, y } = projectPoint(point.lat, point.lng);
          return (
            <g key={`point-${i}`}>
              {/* Point fixe */}
              <circle cx={x} cy={y} r="3" fill={dotColor} />
              {/* Halo pulsant */}
              <circle cx={x} cy={y} r="3" fill={dotColor} opacity="0.6">
                <animate
                  attributeName="r"
                  from="3"
                  to="12"
                  dur="2s"
                  begin={`${i * 0.2}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.6"
                  to="0"
                  dur="2s"
                  begin={`${i * 0.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
              {/* Label au survol */}
              {point.label && (
                <text
                  x={x}
                  y={y - 8}
                  fill="#FAF6EF"
                  fontSize="8"
                  textAnchor="middle"
                  className="opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
