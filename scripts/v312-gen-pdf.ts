/**
 * V3.12 — Génération locale des 3 PDF pour contrôle visuel
 * (chevauchement numéro/date gré + page de garde).
 * Sortie : /home/z/my-project/tool-results/pdf-v312/
 */
import { mkdirSync, writeFileSync } from "fs";
import { genererPdfCalendrier } from "../src/lib/calendrier/pdf/generer-pdf";

const OUT = "/home/z/my-project/tool-results/pdf-v312";
mkdirSync(OUT, { recursive: true });

for (const mode of ["mois", "trimestre", "annee"] as const) {
  const t0 = Date.now();
  const bytes = await genererPdfCalendrier(2026, mode, new Date("2026-09-01"));
  const nom = `${OUT}/calendrier-2026-${mode}.pdf`;
  writeFileSync(nom, bytes);
  console.log(`${mode.padEnd(10)} → ${(bytes.length / 1024).toFixed(0)} Ko en ${Date.now() - t0} ms`);
}
console.log("OK");
