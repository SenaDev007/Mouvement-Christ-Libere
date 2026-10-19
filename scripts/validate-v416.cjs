#!/usr/bin/env node
/**
 * ⭐ V4.16 — Validation locale : mode muet global des sonneries.
 *
 * 1) Parse Babel des 5 fichiers modifiés :
 *    - src/lib/sonnerie-muette.ts (nouveau)
 *    - src/components/site/landing-intro.tsx (bouton Son + respect du muet)
 *    - src/components/yeshua-connect/MessagingView.tsx (ringback + bi-bip)
 *    - src/components/yeshua-connect/ShofarNotifier.tsx (shofar auto + bannière)
 *    - src/lib/shofar/shofar-audio.ts (arreterShofar)
 * 2) Vérifications structurelles clés.
 */
const fs = require("fs");
const babel = require("/home/z/my-project/.tmp-babel/node_modules/@babel/parser");

const BASE = "/home/z/my-project/mouvement-christ-libere";
const FICHIERS = [
  ["sonnerie-muette.ts", `${BASE}/src/lib/sonnerie-muette.ts`],
  ["landing-intro.tsx", `${BASE}/src/components/site/landing-intro.tsx`],
  ["MessagingView.tsx", `${BASE}/src/components/yeshua-connect/MessagingView.tsx`],
  ["ShofarNotifier.tsx", `${BASE}/src/components/yeshua-connect/ShofarNotifier.tsx`],
  ["shofar-audio.ts", `${BASE}/src/lib/shofar/shofar-audio.ts`],
];

let ok = 0, ko = 0;
const check = (label, cond) => {
  if (cond) { ok++; console.log(`  ✔ ${label}`); }
  else { ko++; console.log(`  ✘ ${label}`); }
};

const src = {};
console.log("— Parse Babel —");
for (const [nom, chemin] of FICHIERS) {
  src[nom] = fs.readFileSync(chemin, "utf8");
  try {
    babel.parse(src[nom], { sourceType: "module", plugins: ["jsx", "typescript"] });
    check(`parse ${nom}`, true);
  } catch (e) {
    check(`parse ${nom} — ${e.message}`, false);
  }
}

console.log("— sonnerie-muette.ts —");
check("clé localStorage mcl-sonnerie-muette", src["sonnerie-muette.ts"].includes('CLE_SONNERIE_MUETTE = "mcl-sonnerie-muette"'));
check("événement custom mcl-sonnerie-muette-change", src["sonnerie-muette.ts"].includes('EVENEMENT_SONNERIE_MUETTE = "mcl-sonnerie-muette-change"'));
check("exports lire/ecrire/basculer", /export function (lireSonnerieMuette|ecrireSonnerieMuette|basculerSonnerieMuette)/.test(src["sonnerie-muette.ts"]));

console.log("— landing-intro.tsx —");
check("import du mode muet", src["landing-intro.tsx"].includes('from "@/lib/sonnerie-muette"'));
check("lire préférence au montage", src["landing-intro.tsx"].includes("const muetteInitiale = lireSonnerieMuette()"));
check("pause + retrait si muet au montage", /if \(muetteInitiale\) \{\s*\n\s*audio\?\.pause\(\);\s*\n\s*setAudioVivant\(false\);/.test(src["landing-intro.tsx"]));
check("boucle de relance respecte le muet", src["landing-intro.tsx"].includes("if (lireSonnerieMuette()) {\n          arreterBoucle();"));
check("premier geste respecte le muet", src["landing-intro.tsx"].includes("if (lireSonnerieMuette()) return;"));
check("onCanPlay respecte le muet", src["landing-intro.tsx"].includes("!lireSonnerieMuette() && a.paused"));
check("bouton muet rendu (basculerMuet)", src["landing-intro.tsx"].includes("onClick={basculerMuet}"));
check("libellés Son / Sonneries coupées", src["landing-intro.tsx"].includes('"Sonneries coupées" : "Son"'));
check("onEnded marque shofarTermineRef", src["landing-intro.tsx"].includes("shofarTermineRef.current = true"));
check("« Passer » conservé", src["landing-intro.tsx"].includes("Passer l'introduction"));

console.log("— MessagingView.tsx —");
check("import du mode muet", src["MessagingView.tsx"].includes('EVENEMENT_SONNERIE_MUETTE } from "@/lib/sonnerie-muette"'));
check("ringback respecte le muet (condition)", src["MessagingView.tsx"].includes('callState === "outgoing" && !endStatus && !jitsiRoom && !sonnerieMuette'));
check("ringback réactif (deps)", src["MessagingView.tsx"].includes("[callState, endStatus, jitsiRoom, sonnerieMuette]"));
check("bouton muet overlay sortant", src["MessagingView.tsx"].includes("setSonnerieMuette(basculerSonnerieMuette())"));
check("bi-bip entrant gated (AC && !sonnerieMuette)", src["MessagingView.tsx"].includes("if (AC && !sonnerieMuette)"));
check("effet bi-bip réactif (deps [sonnerieMuette])", /\}, \[sonnerieMuette\]\);/.test(src["MessagingView.tsx"]));

console.log("— ShofarNotifier.tsx —");
check("sonnerie gated par le mode muet global", src["ShofarNotifier.tsx"].includes('type === "sonnerie" && prefs.sound && !lireSonnerieMuette()'));
check("état initial sonnerieMuette au montage", src["ShofarNotifier.tsx"].includes("setSonnerieMuette(lireSonnerieMuette());"));
check("bouton « Couper le son » dans la bannière", src["ShofarNotifier.tsx"].includes('"Couper le son"'));
check("arrêt immédiat du shofar au clic", src["ShofarNotifier.tsx"].includes("if (muet) arreterShofar();"));
check("indicateur tient compte du muet global", src["ShofarNotifier.tsx"].includes("!sonnerieMuette && prefs?.sound && audioDisponible"));

console.log("— shofar-audio.ts —");
check("export arreterShofar", src["shofar-audio.ts"].includes("export function arreterShofar()"));
check("arreterShofar ferme le contexte synthèse", src["shofar-audio.ts"].includes("ctx.close()"));

console.log(`\nRésultat : ${ok} ✔ / ${ko} ✘`);
process.exit(ko === 0 ? 0 : 1);
