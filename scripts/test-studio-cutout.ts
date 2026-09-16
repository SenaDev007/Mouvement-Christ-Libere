/**
 * ⭐ V3.89 — Test du détourage automatique (flood-fill) + rendu avec
 * la photo détourée (le chemin de production réel).
 */

import { writeFileSync, readFileSync } from "fs";
import path from "path";
import { detourerPhoto } from "../src/lib/visual-generator/cutout";
import { rendreVisuel } from "../src/lib/visual-generator/renderer";
import { TEMPLATES_SEED } from "../src/lib/studio/templates-seed";
import type { DonneesVisuel } from "../src/lib/visual-generator/types";

const DEST = "/home/z/my-project/download/studio-echantillons";

async function main() {
  const source = readFileSync(path.join(process.cwd(), "public", "pasteur-kongo.jpeg"));

  // ① Détourage.
  const debut = Date.now();
  const resultat = await detourerPhoto(source, { tolerance: 0.2 });
  console.log(
    `Détourage : ok=${resultat.ok} couverture=${(resultat.couverture * 100).toFixed(1)}% en ${Date.now() - debut} ms`
  );
  if (!resultat.ok || !resultat.tamponPng) {
    console.log("→ Détourage non concluant sur cette photo.");
    return;
  }
  writeFileSync(path.join(DEST, "13-detourage.png"), resultat.tamponPng);

  // ② Rendu de la variante C (la plus exigeante) avec la photo détourée.
  const dataUrl = `data:image/png;base64,${resultat.tamponPng.toString("base64")}`;
  const fireSermon = TEMPLATES_SEED.find((t) => t.nom === "Fire Sermon")!;
  const miniature: DonneesVisuel = {
    type: "miniature",
    titre: "Comment vaincre les attaques de l'ennemi ?",
    accroche: "VAINCRE LES ATTAQUES DE L'ENNEMI !",
    intervenant: "kongo",
    photoUrl: dataUrl,
    photoDecoupee: true,
    style: "feu-puissance",
  };
  for (const variante of ["A", "C"] as const) {
    const r = await rendreVisuel({
      donnees: miniature,
      layout: fireSermon.layout,
      format: "youtube",
      variante,
    });
    writeFileSync(path.join(DEST, `14-miniature-detouree-${variante}.png`), r.png);
    console.log(`✓ 14-miniature-detouree-${variante}.png (${(r.png.length / 1024).toFixed(0)} Ko)`);
  }
}

main().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
