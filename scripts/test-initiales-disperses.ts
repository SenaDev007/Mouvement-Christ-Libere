/**
 * ⭐ V3.15 — Test unitaire : initialesMembre (page des dispersés).
 * Directive du pasteur : sans photo, l'avatar porte les initiales du nom
 * EXACTEMENT tel qu'inscrit — « Akpovi Sènakpon → AS et non A simplement ».
 *
 * Exécution : npx tsx scripts/test-initiales-disperses.ts
 */
import { initialesMembre } from "../src/components/disperses/carte-disperses";

interface Cas {
  nom: string;
  attendu: string;
  commentaire: string;
}

const CAS: Cas[] = [
  { nom: "AKPOVI Sènakpon", attendu: "AS", commentaire: "directive du pasteur — AS et non A" },
  { nom: "Akpovi Sènakpon", attendu: "AS", commentaire: "même casse différente, mêmes initiales" },
  { nom: "Pasteur Kongo", attendu: "PK", commentaire: "deux mots → deux initiales" },
  { nom: "Pam", attendu: "P", commentaire: "un seul mot → une initiale" },
  { nom: "Sarah d'Abidjan", attendu: "SA", commentaire: "premier + dernier mot" },
  { nom: "Élisée de Cotonou", attendu: "ÉC", commentaire: "accents préservés puis majuscules" },
  { nom: "  Jean  ", attendu: "J", commentaire: "espaces superflus ignorés" },
  { nom: "", attendu: "?", commentaire: "nom vide → repli" },
  { nom: "grace225", attendu: "G", commentaire: "un mot → première lettre" },
];

let echecs = 0;
for (const c of CAS) {
  const obtenu = initialesMembre(c.nom);
  const ok = obtenu === c.attendu;
  if (!ok) echecs++;
  console.log(
    `${ok ? "✓" : "✗"} initialesMembre(${JSON.stringify(c.nom)}) = "${obtenu}"` +
      `${ok ? "" : ` (attendu "${c.attendu}")`} — ${c.commentaire}`
  );
}

if (echecs > 0) {
  console.error(`\n${echecs} échec(s) sur ${CAS.length}`);
  process.exit(1);
}
console.log(`\n${CAS.length}/${CAS.length} scénarios OK`);
