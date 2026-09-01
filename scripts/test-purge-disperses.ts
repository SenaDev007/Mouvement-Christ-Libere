/**
 * V3.12 — Test unitaire de la classification de purge des dispersés
 * (fonction PURE classerDisperses — aucun accès base).
 *
 * Scénarios :
 *   (a) liveMemberId renseigné             → conservé
 *   (b) userId renseigné                    → conservé
 *   (b bis) userId d'un compte SUPPRIMÉ     → supprimé (position orpheline, ⭐ V3.13)
 *   (c) pseudonyme = nom d'un compte       → conservé
 *   (c bis) pseudonyme = préfixe d'email   → conservé
 *   (d) créée à ±30 s d'un compte, même pays (signature /register) → conservé
 *   (d') créée à ±30 s d'un compte mais PAYS différent            → supprimé
 *   (d'') créée à 6 mois d'écart, même pays                        → supprimé
 *   (e) position anonyme classique (ancien formulaire)            → supprimé
 *   (f) accents/casse : « Élisée » vs « elisee »                   → conservé
 */
import {
  classerDisperses,
  type DisperseLite,
  type UtilisateurLite,
} from "../src/lib/disperses/classification-purge";

const J = (s: string) => new Date(s).getTime();

const utilisateurs: UtilisateurLite[] = [
  { id: "u1", name: "Pam", email: "pam@example.com", country: null, createdAt: new Date(J("2026-06-01T10:00:00Z")) },
  { id: "u2", name: "Élisée", email: "elisee.k@example.com", country: "Bénin", createdAt: new Date(J("2026-08-30T12:00:00Z")) },
  { id: "u3", name: null, email: "grace225@example.com", country: "Côte d'Ivoire", createdAt: new Date(J("2026-09-01T08:30:00Z")) },
];

const membres: DisperseLite[] = [
  // (a) LiveMember lié → conservé
  { id: "m1", pseudonyme: "Visiteur du live", pays: "FR", liveMemberId: "live-1", userId: null, createdAt: new Date(J("2026-05-01T09:00:00Z")) },
  // (b) userId → conservé
  { id: "m2", pseudonyme: "Nouveau membre", pays: "BJ", liveMemberId: null, userId: "u2", createdAt: new Date(J("2026-09-01T09:00:00Z")) },
  // (c) pseudonyme = nom du compte « Pam » → conservé
  { id: "m3", pseudonyme: "Pam", pays: "FR", liveMemberId: null, userId: null, createdAt: new Date(J("2026-04-01T09:00:00Z")) },
  // (c bis) pseudonyme = préfixe email « grace225 » → conservé
  { id: "m4", pseudonyme: "grace225", pays: "CI", liveMemberId: null, userId: null, createdAt: new Date(J("2026-07-01T09:00:00Z")) },
  // (d) créée 30 s après le compte u2, même pays (Bénin) → conservé
  { id: "m5", pseudonyme: "Élisée de Cotonou", pays: "BJ", liveMemberId: null, userId: null, createdAt: new Date(J("2026-08-30T12:00:30Z")) },
  // (d') créée 30 s après le compte u2 mais pays DIFFÉRENT → supprimé
  { id: "m6", pseudonyme: "Anonyme simultané", pays: "NG", liveMemberId: null, userId: null, createdAt: new Date(J("2026-08-30T12:00:30Z")) },
  // (d'') créée 6 mois après le compte u2, même pays → supprimé
  { id: "m7", pseudonyme: "Vieux point Bénin", pays: "BJ", liveMemberId: null, userId: null, createdAt: new Date(J("2026-02-01T09:00:00Z")) },
  // (e) position anonyme classique → supprimé
  { id: "m8", pseudonyme: "Sarah d'Abidjan", pays: "CI", liveMemberId: null, userId: null, createdAt: new Date(J("2026-03-15T09:00:00Z")) },
  // (f) accents/casse : « élisée » vs compte « Élisée » → conservé
  { id: "m9", pseudonyme: "  éLiSée  ", pays: "FR", liveMemberId: null, userId: null, createdAt: new Date(J("2026-01-01T09:00:00Z")) },
  // (b bis) userId d'un compte SUPPRIMÉ (orphelin) → supprimé (⭐ V3.13)
  { id: "m10", pseudonyme: "Compte supprimé", pays: "CI", liveMemberId: null, userId: "u-inexistant", createdAt: new Date(J("2026-09-01T10:00:00Z")) },
];

const attendus: Record<string, "garder" | "supprimer"> = {
  m1: "garder", m2: "garder", m3: "garder", m4: "garder", m5: "garder",
  m6: "supprimer", m7: "supprimer", m8: "supprimer", m9: "garder",
  m10: "supprimer",
};

const { aSupprimer, aConserver, raisons } = classerDisperses(membres, utilisateurs);

let echecs = 0;
for (const m of membres) {
  const garde = aConserver.includes(m.id);
  const suppr = aSupprimer.includes(m.id);
  const attendu = attendus[m.id] === "garder";
  const ok = attendu ? garde && !suppr : suppr && !garde;
  if (!ok) echecs++;
  console.log(
    `${ok ? "✓" : "✗ ÉCHEC"} ${m.id} « ${m.pseudonyme} » → ${attendu ? "GARDER" : "SUPPRIMER"} — ${raisons.get(m.id)}`
  );
}

console.log(`\nConservés : ${aConserver.length} · Supprimés : ${aSupprimer.length}`);
if (echecs === 0) {
  console.log("TOUS LES SCÉNARIOS PASSENT ✓");
} else {
  console.error(`${echecs} scénario(s) en échec`);
  process.exit(1);
}
