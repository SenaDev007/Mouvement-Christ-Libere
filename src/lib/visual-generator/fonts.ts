/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : registre des polices serveur.
 *
 * Les TTF (Anton, Bebas Neue, Oswald, Montserrat, Inter, Poppins — spec
 * §9) sont stockés LOCALEMENT dans public/fonts/studio/ pour un rendu
 * SERVEUR reproductible (aucune dépendance réseau à la génération).
 *
 * Enregistrement paresseux via @napi-rs/canvas GlobalFonts (même mécanisme
 * que les polices DejaVu de la post-production vidéo V3.16 — le dossier
 * public/ est embarqué dans la fonction serverless via
 * outputFileTracingIncludes de next.config.ts).
 *
 * ⚠️ SERVEUR UNIQUEMENT — @napi-rs/canvas est natif : ne jamais importer
 * ce module depuis un composant client.
 */

import { GlobalFonts } from "@napi-rs/canvas";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { ClePolice } from "./types";

/** Fichiers du dossier public/fonts/studio indexés par clé de police. */
const FICHIERS_POLICES: Record<ClePolice, string> = {
  anton: "Anton-Regular.ttf",
  bebas: "BebasNeue-Regular.ttf",
  "oswald-600": "Oswald-SemiBold.ttf",
  "oswald-700": "Oswald-Bold.ttf",
  "montserrat-700": "Montserrat-Bold.ttf",
  "montserrat-800": "Montserrat-ExtraBold.ttf",
  "montserrat-900": "Montserrat-Black.ttf",
  "inter-400": "Inter-Regular.ttf",
  "inter-700": "Inter-Bold.ttf",
  "poppins-600": "Poppins-SemiBold.ttf",
};

/** Familles enregistrées (cle → famille canvas réelle). */
const famillesEnregistrees = new Map<ClePolice, string>();

/** Nom de famille canvas utilisé pour une clé (une seule famille par clé). */
export function famillePolice(cle: ClePolice): string {
  return `MCL ${cle}`;
}

/**
 * Enregistre une police dans le registre canvas (idempotent).
 * Retourne le nom de famille, ou null si le fichier est absent (fallback
 * système — la génération continue, sans casser).
 */
function enregistrer(cle: ClePolice): string | null {
  const deja = famillesEnregistrees.get(cle);
  if (deja) return deja;

  const fichier = FICHIERS_POLICES[cle];
  if (!fichier) return null;

  // public/fonts/studio/<fichier> — process.cwd() est la racine du
  // déploiement Next.js (Vercel embarque le dossier via tracing).
  const chemins = [
    path.join(process.cwd(), "public", "fonts", "studio", fichier),
    path.join(process.cwd(), "..", "public", "fonts", "studio", fichier), // dev depuis src/
  ];
  const chemin = chemins.find((c) => existsSync(c));
  if (!chemin) {
    console.warn(`[studio/fonts] Fichier police introuvable : ${fichier}`);
    return null;
  }

  try {
    const tampon = readFileSync(chemin);
    const famille = famillePolice(cle);
    const ok = GlobalFonts.register(tampon, famille);
    if (!ok) {
      console.warn(`[studio/fonts] Échec enregistrement ${famille}`);
      return null;
    }
    famillesEnregistrees.set(cle, famille);
    return famille;
  } catch (e) {
    console.warn(`[studio/fonts] Erreur chargement ${fichier} :`, e);
    return null;
  }
}

/**
 * Chaîne `font` CSS pour ctx.font — enregistre la police au besoin.
 * Fallback garanti : Montserrat → sinon police système sans-serif (le
 * rendu continue MÊME si un TTF manque).
 */
export function policeCanvas(cle: ClePolice, taillePx: number): string {
  const famille = enregistrer(cle);
  if (famille) return `${taillePx}px "${famille}"`;
  // Fallback : familles en cascade (sans-serif lisible).
  const fallback: Record<string, string> = {
    anton: `'Arial Black', 'DejaVu Sans Bold', sans-serif`,
    bebas: `'Oswald', 'Arial Narrow', sans-serif`,
  };
  return `${taillePx}px ${fallback[cle] || "sans-serif"}`;
}

/** Précharge toutes les polices (appelé une fois par worker de rendu). */
export function prechargerPolices(): void {
  (Object.keys(FICHIERS_POLICES) as ClePolice[]).forEach(enregistrer);
}
