#!/usr/bin/env node
/**
 * ⭐ V3.78 (scan) — Vérifier TITRE RÉEL de chaque média TikTok de la
 * rubrique « Saint-Esprit réponds-moi » (@pamela.dali7, 336 médias).
 *
 * Question du pasteur : « toutes les vidéos ont le même titre — pourquoi
 * tu n'as pas donné le titre précis ? »
 *
 * Ce scan établit EMPIRIQUEMENT, pour chaque URL de scripts/urls-tiktok.txt,
 * ce que TikTok renvoie comme titre via le proxy oEmbed de production
 * (la prod région Paris joint TikTok ; le bac local est bloqué).
 *
 * Sortie : scripts/titres-tiktok-saint-esprit-v378.json
 *   { "<url>": "<titre réel ou chaîne vide>", ... }
 *   + résumé : combien de titres réels existent.
 *
 * Usage : node scripts/verifier-titres-tiktok-v378.mjs
 *   (idempotent, cache disque au fil de l'eau — reprise après interruption)
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.mouvementchristlibere.com";
const FICHIER_URLS = path.resolve(import.meta.dirname, "urls-tiktok.txt");
const FICHIER_SORTIE = path.resolve(import.meta.dirname, "titres-tiktok-saint-esprit-v378.json");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Titre nettoyé (espaces normalisés). */
function nettoyerTitre(brut) {
  return (brut || "").replace(/\s+/g, " ").trim();
}

async function main() {
  const lignes = fs.readFileSync(FICHIER_URLS, "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean);
  const medias = lignes.filter((u) => /\/(video|photo)\/\d{5,25}/.test(u));
  const profils = lignes.length - medias.length;
  console.log(`── Scan titres TikTok (rubrique Saint-Esprit réponds-moi) ──`);
  console.log(`  ${lignes.length} lignes = ${profils} profils (ignorés) + ${medias.length} médias`);

  // Cache disque : reprendre là où on s'était arrêté
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(FICHIER_SORTIE, "utf8")); } catch { /* premier passage */ }
  const restants = medias.filter((u) => !(u in cache));
  console.log(`  ${medias.length - restants.length} déjà scannés (cache) · ${restants.length} à scanner`);

  let ko = 0;
  const t0 = Date.now();
  for (let i = 0; i < restants.length; i++) {
    const url = restants[i];
    let titre = "";
    let succes = false;
    for (let essai = 1; essai <= 3; essai++) {
      try {
        const res = await fetch(
          `${BASE}/api/tiktok/oembed?url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) {
            titre = nettoyerTitre(data.titre);
            succes = true;
            break;
          }
        }
      } catch { /* nouvel essai */ }
      await attendre(700);
    }
    if (!succes) ko++; // pas de titre connu — video privée/supprimée ?
    cache[url] = titre;
    if ((i + 1) % 25 === 0 || i === restants.length - 1) {
      fs.writeFileSync(FICHIER_SORTIE, JSON.stringify(cache, null, 1));
      const ecoule = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  … ${i + 1}/${restants.length} (${ecoule} s)`);
    }
    await attendre(250);
  }
  fs.writeFileSync(FICHIER_SORTIE, JSON.stringify(cache, null, 1));

  // Résumé
  const entrees = Object.entries(cache).filter(([u]) => medias.includes(u));
  const avecTitre = entrees.filter(([, t]) => t.length > 0);
  const vides = entrees.filter(([, t]) => t.length === 0);
  console.log(`── Résultat ──`);
  console.log(`  médias scannés : ${entrees.length}`);
  console.log(`  avec TITRE RÉEL sur TikTok : ${avecTitre.length}`);
  console.log(`  SANS légende TikTok (titre vide) : ${vides.length}`);
  console.log(`  échecs réseau (aucune réponse) : ${ko}`);
  if (avecTitre.length > 0) {
    console.log(`  exemples de titres réels :`);
    for (const [u, t] of avecTitre.slice(0, 8)) console.log(`    • ${t.slice(0, 90)}  ←  ${u}`);
  }
}

main().catch((e) => {
  console.error("ÉCHEC :", e.message);
  process.exit(1);
});
