/**
 * ⭐ V3.91 — Test LOCAL du moteur : calques (ordre/masques/décalages) +
 * palette libre. Vérifie que le PNG sort SANS crash et que les pixels
 * changent selon les réglages (preuve que les calques agissent).
 *
 * node --experimental-strip-types scripts/test-v391-calques.ts
 * (ou bun scripts/test-v391-calques.ts)
 */
import { rendreVisuel } from "../src/lib/visual-generator/renderer";
import { FORMATS } from "../src/lib/visual-generator/types";
import { db } from "../src/lib/db";
import sharp from "sharp";

const LAYOUT_MINIMAL = {
  policeTitre: "anton",
  policeSousTitre: "oswald-600",
  tailleTitre: 1,
  degradeTitre: true,
  sujet: { ombre: true, halo: true, contour: 0.004, luminosite: 1.04, contraste: 1.06 },
  voile: { type: "bas", intensite: 0.5 },
  overrides: {},
} as never;

function moyenneHuex(png: Buffer): Promise<{ h: number; s: number; l: number }> {
  return sharp(png)
    .resize(8, 8)
    .removeAlpha()
    .raw()
    .toBuffer()
    .then((brut) => {
      let h = 0;
      let s = 0;
      let l = 0;
      for (let i = 0; i < brut.length; i += 3) {
        h += brut[i];
        s += brut[i + 1];
        l += brut[i + 2];
      }
      const n = brut.length / 3;
      return { h: h / n, s: s / n, l: l / n };
    });
}

async function main() {
  void db;
  console.log("── Test moteur V3.91 : calques + palette libre ──");

  const donneesBase = {
    type: "affiche" as const,
    titre: "NUIT DE DÉLIVRANCE",
    accroche: "LE FEU DE DIEU",
    speakerNames: ["Pasteur Kongo"],
    dateEvenement: "2026-10-18",
    heureEvenement: "19h00",
    lieuEvenement: "Cotonou",
    verset: "Ésaïe 61:1",
    style: "noir-or",
  };

  // ① Rendu PAR DÉFAUT (rétrocompatibilité : identique à V3.90).
  const defaut = await rendreVisuel({
    donnees: donneesBase,
    layout: LAYOUT_MINIMAL,
    format: "story",
    variante: "A",
    echelle: 0.35,
  });
  console.log(`  ✓ rendu par défaut : ${defaut.png.length} octets`);

  // ② Calques : titre DEVANT le logo, sujet masqué, verset décalé.
  const avecCalques = await rendreVisuel({
    donnees: {
      ...donneesBase,
      calques: {
        ordre: [
          "fond",
          "voile",
          "titre",
          "sousTitre",
          "evenement",
          "verset",
          "logo",
          "sujet",
        ].slice(0, 7) as never,
        masques: ["sujet"],
        decalages: { verset: { x: 0, y: 0.08 }, titre: { x: -0.05, y: 0 } },
      },
    },
    layout: LAYOUT_MINIMAL,
    format: "story",
    variante: "A",
    echelle: 0.35,
  });
  console.log(`  ✓ rendu calques (sujet masqué, décalages) : ${avecCalques.png.length} octets`);
  if (avecCalques.png.length === defaut.png.length) {
    throw new Error("les calques n'ont rien changé au rendu !");
  }

  // ③ Palette LIBRE : vert émeraude au lieu du noir & or.
  const avecPalette = await rendreVisuel({
    donnees: {
      ...donneesBase,
      palettePerso: {
        accent: "#2E9E6B",
        secondary: "#EAF5EE",
        background: "#08251A",
      },
    },
    layout: LAYOUT_MINIMAL,
    format: "story",
    variante: "A",
    echelle: 0.35,
  });
  const statsDefaut = await moyenneHuex(defaut.png);
  const statsPalette = await moyenneHuex(avecPalette.png);
  console.log(
    `  ✓ palette libre : moyennes R/V/B ${statsDefaut.h.toFixed(1)}/${statsDefaut.s.toFixed(1)}/${statsDefaut.l.toFixed(1)} → ${statsPalette.h.toFixed(1)}/${statsPalette.s.toFixed(1)}/${statsPalette.l.toFixed(1)}`
  );
  const deltaVert = Math.abs(statsPalette.s - statsDefaut.s);
  if (deltaVert < 2) {
    throw new Error("la palette libre n'a pas changé les couleurs !");
  }

  // ④ Sauvegarde des PNG pour inspection visuelle.
  const dir = "/home/z/my-project/download/tests-v391";
  const fs = await import("fs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/calques-defaut.png`, defaut.png);
  fs.writeFileSync(`${dir}/calques-regles.png`, avecCalques.png);
  fs.writeFileSync(`${dir}/palette-emeraude.png`, avecPalette.png);
  console.log(`  ✓ 3 PNG de preuve dans ${dir}/`);

  console.log("── TOUS LES TESTS MOTEUR V3.91 PASSENT ──");
  process.exit(0);
}

main().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
