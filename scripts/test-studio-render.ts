/**
 * ⭐ V3.89 — Test de rendu du MCL Creative Studio (validation §46).
 * Génère des échantillons dans chaque famille × variante et mesure les
 * temps de génération (§34 : miniature < 3 s, affiche < 6 s).
 *
 * Usage : bun run scripts/test-studio-render.ts
 */

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";
import { rendreVisuel } from "../src/lib/visual-generator/renderer";
import { TEMPLATES_SEED } from "../src/lib/studio/templates-seed";
import type { ConfigLayout, DonneesVisuel } from "../src/lib/visual-generator/types";

const DEST = "/home/z/my-project/download/studio-echantillons";
import { mkdirSync } from "fs";
mkdirSync(DEST, { recursive: true });

async function chargerPhotoLocale(nom: string): Promise<string> {
  const chemin = path.join(process.cwd(), "public", nom);
  const tampon = readFileSync(chemin);
  return `data:image/jpeg;base64,${tampon.toString("base64")}`;
}

async function main() {
  const photoKongo = await chargerPhotoLocale("pasteur-kongo.jpeg");
  const photoPam = await chargerPhotoLocale("pam.jpeg");

  const fireSermon = TEMPLATES_SEED.find((t) => t.nom === "Fire Sermon")!;
  const goldPower = TEMPLATES_SEED.find((t) => t.nom === "Gold Power")!;
  const nuit = TEMPLATES_SEED.find((t) => t.nom === "Nuit de Délivrance")!;
  const cinema = TEMPLATES_SEED.find((t) => t.nom === "Cinematic Fire")!;

  const miniature: DonneesVisuel = {
    type: "miniature",
    titre: "Comment vaincre les attaques de l'ennemi ?",
    accroche: "VAINCRE LES ATTAQUES DE L'ENNEMI !",
    intervenant: "kongo",
    photoUrl: photoKongo,
    style: "feu-puissance",
  };

  const miniatureLongue: DonneesVisuel = {
    type: "miniature",
    titre: "Comment recevoir la puissance du Saint-Esprit dans sa vie ?",
    accroche: "COMMENT RECEVOIR LA PUISSANCE DU SAINT-ESPRIT DANS SA VIE ?",
    intervenant: "kongo",
    photoUrl: photoKongo,
    style: "noir-or",
  };

  const affiche: DonneesVisuel = {
    type: "affiche",
    titre: "Nuit de Délivrance",
    sousTitre: "Pasteur Kongo & Pam",
    intervenant: "kongo-pam",
    photoUrl: photoPam,
    style: "feu-puissance",
    dateEvenement: "2026-10-18",
    heureEvenement: "19h00",
    lieuEvenement: "Cotonou",
    verset: "Ésaïe 61:1",
  };

  const cas: Array<{
    nom: string;
    donnees: DonneesVisuel;
    layout: ConfigLayout;
    format: Parameters<typeof rendreVisuel>[0]["format"];
    variante: "A" | "B" | "C" | "D";
  }> = [
    { nom: "01-miniature-youtube-A", donnees: miniature, layout: fireSermon.layout, format: "youtube", variante: "A" },
    { nom: "02-miniature-youtube-B", donnees: miniature, layout: fireSermon.layout, format: "youtube", variante: "B" },
    { nom: "03-miniature-youtube-C", donnees: miniature, layout: cinema.layout, format: "youtube", variante: "C" },
    { nom: "04-miniature-youtube-D-long", donnees: miniatureLongue, layout: goldPower.layout, format: "youtube", variante: "D" },
    { nom: "05-miniature-square-A", donnees: miniatureLongue, layout: goldPower.layout, format: "square", variante: "A" },
    { nom: "06-miniature-reels-A", donnees: miniatureLongue, layout: goldPower.layout, format: "reels", variante: "A" },
    { nom: "07-affiche-story-A", donnees: affiche, layout: nuit.layout, format: "story", variante: "A" },
    { nom: "08-affiche-story-B", donnees: affiche, layout: nuit.layout, format: "story", variante: "B" },
    { nom: "09-affiche-instagram-C", donnees: affiche, layout: nuit.layout, format: "instagram", variante: "C" },
    { nom: "10-affiche-print-A", donnees: affiche, layout: nuit.layout, format: "print", variante: "A" },
  ];

  console.log("— Rendus studio —");
  for (const casTest of cas) {
    const debut = Date.now();
    const resultat = await rendreVisuel({
      donnees: casTest.donnees,
      layout: casTest.layout,
      format: casTest.format,
      variante: casTest.variante,
    });
    const ms = Date.now() - debut;
    const fichier = path.join(DEST, `${casTest.nom}.png`);
    writeFileSync(fichier, resultat.png);
    console.log(
      `  ✓ ${casTest.nom} — ${resultat.largeur}×${resultat.hauteur} — ${(ms / 1000).toFixed(2)} s — ${(resultat.png.length / 1024).toFixed(0)} Ko`
    );
  }

  // Test auto-fit extrême : titre de 120 caractères.
  const titreGeant =
    "LA PUISSANCE EXTRAORDINAIRE DE LA PRIÈRE D'INTERCESSION POUR TRANSFORMER VOTRE VIE ET CELLE DE VOTRE FAMILLE";
  const resultatGeant = await rendreVisuel({
    donnees: { ...miniature, accroche: titreGeant, titre: titreGeant },
    layout: goldPower.layout,
    format: "youtube",
    variante: "A",
  });
  writeFileSync(path.join(DEST, "11-overflow-test.png"), resultatGeant.png);
  console.log(`  ✓ 11-overflow-test (titre géant) — ${(resultatGeant.png.length / 1024).toFixed(0)} Ko`);

  // Test SANS photo (intervenant « aucun ») et SANS fond (procédural).
  const sansPhoto = await rendreVisuel({
    donnees: { ...miniature, intervenant: "aucun", photoUrl: undefined },
    layout: TEMPLATES_SEED.find((t) => t.nom === "Minimal Gold")!.layout,
    format: "youtube",
    variante: "A",
  });
  writeFileSync(path.join(DEST, "12-sans-photo-fond-procedural.png"), sansPhoto.png);
  console.log("  ✓ 12-sans-photo-fond-procedural");

  console.log("\n— Échantillons écrits dans", DEST, "—");
  console.log("Critères §46 à vérifier : lisibilité, contraste, aucun débordement.");
}

main().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
