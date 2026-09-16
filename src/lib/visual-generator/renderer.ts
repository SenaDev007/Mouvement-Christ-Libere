/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO : orchestrateur de rendu (§31/§32).
 *
 * Pipeline (architecture de la spécification) :
 *
 *   Configuration visuelle
 *           ↓
 *   Template Resolver (ADN graphique en base)
 *           ↓
 *   Format Resolver (dimensions + composition par famille)
 *           ↓
 *   Asset Loader (fond, photo, logo — fetch R2 / fs local)
 *           ↓
 *   Composition Engine (@napi-rs/canvas)
 *           ↓
 *   PNG (encode canvas)
 *           ↓
 *   [Storage — R2, côté service] → URL en base
 *
 * Moteur INDÉPENDANT de l'interface React (aucun composant importé) —
 * le même code rend l'aperçu, la miniature et l'affiche A4 300 DPI.
 *
 * ⚠️ SERVEUR UNIQUEMENT.
 */

import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  type CleFormat,
  type CleVariante,
  type ConfigLayout,
  type DonneesVisuel,
  FORMATS,
} from "./types";
import { composer } from "./composition";
import { prechargerPolices } from "./fonts";

let policesPretes = false;

/** Charge une image depuis une URL http(s) ou une data URL. */
async function chargerImage(url: string): Promise<Image | null> {
  try {
    if (url.startsWith("data:")) {
      return (await loadImage(url)) as Image;
    }
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
        headers: { "user-agent": "MCL-Studio/1.0" },
      });
      if (!res.ok) return null;
      const tampon = Buffer.from(await res.arrayBuffer());
      if (tampon.length < 64 || tampon.length > 25 * 1024 * 1024) return null;
      return (await loadImage(tampon)) as Image;
    }
    return null;
  } catch {
    return null;
  }
}

/** Logo officiel — fichier local public/ (embarqué par file tracing). */
let cacheLogo: Image | null = null;
async function chargerLogo(): Promise<Image | null> {
  if (cacheLogo) return cacheLogo;
  const chemins = [
    path.join(process.cwd(), "public", "logo-christ-libere-v3.png"),
    path.join(process.cwd(), "..", "public", "logo-christ-libere-v3.png"),
  ];
  const chemin = chemins.find((c) => existsSync(c));
  if (!chemin) {
    console.warn("[studio/renderer] Logo introuvable — rendu sans logo.");
    return null;
  }
  try {
    cacheLogo = (await loadImage(readFileSync(chemin))) as Image;
    return cacheLogo;
  } catch (e) {
    console.warn("[studio/renderer] Erreur chargement logo :", e);
    return null;
  }
}

export interface ParametresRendu {
  donnees: DonneesVisuel;
  layout: ConfigLayout;
  format: CleFormat;
  variante: CleVariante;
  /**
   * Échelle de l'aperçu (0-1] : 1 = résolution complète d'export,
   * 0.5 = moitié (aperçu rapide). Les proportions sont préservées.
   */
  echelle?: number;
}

export interface ResultatRendu {
  png: Buffer;
  largeur: number;
  hauteur: number;
  format: CleFormat;
  variante: CleVariante;
}

/** Génère le PNG d'un visuel (un format × une variante). */
export async function rendreVisuel(
  params: ParametresRendu
): Promise<ResultatRendu> {
  if (!policesPretes) {
    prechargerPolices();
    policesPretes = true;
  }

  const definition = FORMATS[params.format];
  if (!definition) {
    throw new Error(`FORMAT_INCONNU:${params.format}`);
  }
  const echelle = params.echelle && params.echelle > 0 && params.echelle <= 1
    ? params.echelle
    : 1;
  const W = Math.round(definition.largeur * echelle);
  const H = Math.round(definition.hauteur * echelle);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Chargement parallèle des assets.
  const [fond, sujet, logo] = await Promise.all([
    params.donnees.fondUrl ? chargerImage(params.donnees.fondUrl) : null,
    params.donnees.photoUrl ? chargerImage(params.donnees.photoUrl) : null,
    chargerLogo(),
  ]);

  // ⚠️ Le moteur compose en COORDONNÉES RÉELLES du format complet : pour
  // l'aperçu réduit, on met à l'échelle le contexte UNE FOIS — toutes les
  // proportions restent identiques.
  if (echelle !== 1) {
    ctx.scale(echelle, echelle);
  }

  composer(
    ctx,
    params.donnees,
    params.layout,
    definition,
    params.variante,
    { fond, sujet, logo }
  );

  const png = await canvas.encode("png");
  return {
    png,
    largeur: definition.largeur,
    hauteur: definition.hauteur,
    format: params.format,
    variante: params.variante,
  };
}

/** Rend plusieurs formats en parallèle (§34 — génération parallèle). */
export async function rendreFormats(
  donnees: DonneesVisuel,
  layout: ConfigLayout,
  formats: CleFormat[],
  variante: CleVariante
): Promise<ResultatRendu[]> {
  const resultats = await Promise.all(
    formats.map((format) =>
      rendreVisuel({ donnees, layout, format, variante })
    )
  );
  return resultats;
}
