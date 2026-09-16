/**
 * ⭐ V3.90 — Boucle VLM : contrôle visuel des rendus MULTI-INTERVENANTS.
 * Vérifie que les silhouettes sont côte à côte, lisibles, sans chevauchement
 * de texte, et que les noms libres s'affichent correctement.
 *
 * Usage (depuis mouvement-christ-libere) :
 *   bun run ../scripts/vlm-studio-multisujet.mjs
 */

import { readFileSync } from "fs";
import path from "path";

const ZAI = (await import("z-ai-web-dev-sdk")).default;

const DEST = "/home/z/my-project/download/studio-echantillons";

const ECHANTILLONS = [
  {
    fichier: "v390-duo-kongo-pam-youtube-A.png",
    question:
      "This is a YouTube thumbnail with TWO people side by side. Check carefully: 1) Are both people fully visible and well framed (faces not cut off)? 2) Do the two silhouettes overlap naturally without covering each other's faces? 3) Is the text readable and NOT overlapping the people? 4) Are the names 'PASTEUR KONGO & PAM' displayed at the bottom? Answer concisely in French, listing any defect found.",
  },
  {
    fichier: "v390-trio-invites-instagram-A.png",
    question:
      "This is an Instagram portrait poster with THREE people side by side and event info. Check: 1) Are the three people well distributed, faces visible? 2) Is the title readable without overflow? 3) Are date/location displayed cleanly? 4) Does any element look broken or misplaced? Answer concisely in French, listing any defect found.",
  },
  {
    fichier: "v390-nom-libre-seul-story-B.png",
    question:
      "This is a 9:16 story poster with ONE person at the top and text below. Check: 1) Is the person well framed? 2) Is the name 'CHANTRE GRACE BELLO' displayed? 3) Are title, date, location readable without overlap? 4) Any layout defect? Answer concisely in French, listing any defect found.",
  },
];

async function main() {
  const zai = await ZAI.create();
  let defauts = 0;

  for (const e of ECHANTILLONS) {
    const chemin = path.join(DEST, e.fichier);
    const b64 = readFileSync(chemin).toString("base64");
    const reponse = await zai.chat.completions.createVision({
      model: "glm-4.5v",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}` },
            },
            { type: "text", text: e.question },
          ],
        },
      ],
      max_tokens: 400,
    });
    const texte = reponse.choices?.[0]?.message?.content || "(aucune réponse)";
    // Défaut = mot-clé SANS négation dans la même phrase (évite le faux
    // positif « Aucun défaut détecté »).
    const phrases = texte.split(/[.\n]/);
    const aDefaut = phrases.some((p) => {
      const negation = /aucun|aucune|sans|pas de|zéro|rien/i.test(p);
      const motDefaut = /défaut|defaut|coupé|coupée|chevauch|illisible|cassé|mal positionné|problème/i.test(p);
      return motDefaut && !negation;
    });
    if (aDefaut) defauts++;
    console.log(`\n=== ${e.fichier} ===\n${texte}\n[${aDefaut ? "DÉFAUT SIGNALÉ" : "RAS"}]`);
  }

  console.log(
    defauts === 0
      ? "\nVLM : AUCUN DÉFAUT BLOQUANT ✔"
      : `\nVLM : ${defauts} échantillon(s) avec défaut — corriger le moteur.`
  );
}

main().catch((e) => {
  console.error("Erreur VLM :", e);
  process.exit(1);
});
