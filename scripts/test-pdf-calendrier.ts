import { writeFileSync } from "fs";
import { genererPdfCalendrier } from "../src/lib/calendrier/pdf/generer-pdf";

for (const mode of ["mois", "trimestre", "annee"] as const) {
  const t0 = Date.now();
  const bytes = await genererPdfCalendrier(2026, mode, new Date("2026-09-01"));
  const nom = `/tmp/calendrier-2026-${mode}.pdf`;
  writeFileSync(nom, bytes);
  console.log(`${mode.padEnd(10)} → ${(bytes.length / 1024).toFixed(0)} Ko en ${Date.now() - t0} ms`);
}
console.log("OK");
