/**
 * ⭐ V3.90 — Test de rendu MULTI-INTERVENANTS du MCL Creative Studio.
 *
 * Valide la nouvelle capacité « une photo par intervenant » : 2 et 3
 * silhouettes dessinées côte à côte dans la zone sujet, noms libres
 * (speakerNames) affichés en sous-titre, dans plusieurs familles ×
 * variantes. Génère des échantillons PNG dans download/studio-echantillons.
 *
 * Usage : bun run scripts/test-studio-multisujet.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { rendreVisuel } from "../src/lib/visual-generator/renderer";
import { TEMPLATES_SEED } from "../src/lib/studio/templates-seed";
import type { ConfigLayout, DonneesVisuel } from "../src/lib/visual-generator/types";

const DEST = "/home/z/my-project/download/studio-echantillons";
mkdirSync(DEST, { recursive: true });

function enDataUrl(cheminRelatif: string): string {
  const tampon = readFileSync(path.join(process.cwd(), "public", cheminRelatif));
  return `data:image/png;base64,${tampon.toString("base64")}`;
}

async function main() {
  const photoA = enDataUrl("pasteur-kongo.jpeg");
  const photoB = enDataUrl("pam.jpeg");

  const fireSermon = TEMPLATES_SEED.find((t) => t.nom === "Fire Sermon")!;
  const goldPower = TEMPLATES_SEED.find((t) => t.nom === "Gold Power")!;
  const layout = (t: (typeof TEMPLATES_SEED)[number]): ConfigLayout =>
    t.layout as ConfigLayout;

  interface Cas {
    nom: string;
    donnees: DonneesVisuel;
    layout: ConfigLayout;
    format: "youtube" | "square" | "reels" | "instagram" | "story";
    variante: "A" | "B" | "C" | "D";
  }

  const cas: Cas[] = [
    {
      nom: "v390-duo-kongo-pam-youtube-A",
      donnees: {
        type: "miniature",
        titre: "La puissance du couple dans la prière",
        accroche: "LA PUISSANCE DU COUPLE DANS LA PRIÈRE !",
        speakerNames: ["Pasteur Kongo", "Pam"],
        photosSujet: [
          { url: photoA, decoupee: true },
          { url: photoB, decoupee: true },
        ],
        style: "feu-puissance",
      },
      layout: layout(fireSermon),
      format: "youtube",
      variante: "A",
    },
    {
      nom: "v390-duo-kongo-pam-reels-C",
      donnees: {
        type: "miniature",
        titre: "Semaine de consécration et de jeûne",
        accroche: "SEMAINE DE CONSÉCRATION !",
        speakerNames: ["Pasteur Kongo", "Pam"],
        photosSujet: [
          { url: photoA, decoupee: true },
          { url: photoB, decoupee: true },
        ],
        style: "noir-or",
      },
      layout: layout(goldPower),
      format: "reels",
      variante: "C",
    },
    {
      nom: "v390-trio-invites-instagram-A",
      donnees: {
        type: "affiche",
        titre: "Conférence des serviteurs",
        speakerNames: ["Pasteur Kongo", "Pam", "Chantre Grâce"],
        photosSujet: [
          { url: photoA, decoupee: true },
          { url: photoB, decoupee: true },
          { url: photoA, decoupee: true },
        ],
        style: "royal",
        dateEvenement: "2026-11-08",
        heureEvenement: "19h00",
        lieuEvenement: "Cotonou",
        verset: "Ésaïe 61:1",
      },
      layout: layout(goldPower),
      format: "instagram",
      variante: "A",
    },
    {
      nom: "v390-nom-libre-seul-story-B",
      donnees: {
        type: "affiche",
        titre: "Soirée de louange",
        speakerNames: ["Chantre Grâce Bello"],
        photosSujet: [{ url: photoB, decoupee: true }],
        style: "royal",
        dateEvenement: "2026-12-05",
        heureEvenement: "18h30",
        lieuEvenement: "Porto-Novo",
      },
      layout: layout(goldPower),
      format: "story",
      variante: "B",
    },
  ];

  let echecs = 0;
  for (const c of cas) {
    const debut = Date.now();
    try {
      const resultat = await rendreVisuel({
        donnees: c.donnees,
        layout: c.layout,
        format: c.format,
        variante: c.variante,
      });
      const chemin = path.join(DEST, `${c.nom}.png`);
      writeFileSync(chemin, resultat.png);
      console.log(
        `OK  ${c.nom}.png — ${resultat.largeur}×${resultat.hauteur}, ` +
          `${(resultat.png.length / 1024).toFixed(0)} Ko, ${Date.now() - debut} ms`
      );
    } catch (e) {
      echecs++;
      console.error(`ÉCHEC ${c.nom} :`, e);
    }
  }

  // Régression : une photo unique (ancien comportement) reste identique.
  const debut = Date.now();
  const unique = await rendreVisuel({
    donnees: {
      type: "miniature",
      titre: "Régression photo unique",
      accroche: "RÉGRESSION PHOTO UNIQUE",
      speakerNames: ["Pasteur Kongo"],
      photosSujet: [{ url: photoA, decoupee: true }],
      style: "feu-puissance",
    },
    layout: layout(fireSermon),
    format: "youtube",
    variante: "A",
  });
  const cheminUnique = path.join(DEST, "v390-regression-unique-youtube-A.png");
  writeFileSync(cheminUnique, unique.png);
  console.log(
    `OK  v390-regression-unique-youtube-A.png — ${(unique.png.length / 1024).toFixed(0)} Ko, ${Date.now() - debut} ms`
  );

  console.log(
    echecs === 0
      ? "\nTOUS LES RENDUS MULTI-INTERVENANTS RÉUSSIS ✔"
      : `\n${echecs} ÉCHEC(S) ✘`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
