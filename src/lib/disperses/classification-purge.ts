/**
 * ⭐ V3.12 — Classification des positions de la carte des dispersés.
 *
 * Purge demandée par le pasteur : « ceux qu'on avait inscrits au niveau de
 * la page dispersée, tu vas les supprimer de la base de données, en dehors
 * de ceux qui sont officiellement inscrits et ceux qui ont officiellement
 * créé leur compte ». L'ancien formulaire anonyme « Ajouter ma position »
 * (supprimé en V3.11) a laissé des positions sans compte derrière elles.
 *
 * Ce module est une fonction PURE (aucun accès base) : les entrées
 * correspondant à une inscription OFFICIELLE sont conservées si l'un des
 * critères suivants est rempli :
 *   (a) `liveMemberId` renseigné — la personne s'est officiellement inscrite
 *       via le système des lives (LiveMember) ;
 *   (b) `userId` renseigné — la position a été créée par /register ou
 *       /disperses/add avec un compte connecté (V3.12+) ;
 *   (c) le pseudonyme correspond à un compte User existant (nom affiché ou
 *       préfixe d'email, insensible à la casse et aux accents) ;
 *   (d) la position a été créée dans la MÊME requête qu'un compte User
 *       (fenêtre de ±90 s + même pays) — signature exacte du placement
 *       automatique de /register (V3.11+), où le pseudonyme « Nom sur la
 *       carte des dispersés » peut différer du nom du compte.
 *
 * Tout le reste (positions soumises anonymement par l'ancien formulaire)
 * est à supprimer.
 *
 * Testé par scripts/test-purge-disperses.ts.
 */
import { COUNTRIES } from "../data/countries";

// ── Types légers ─────────────────────────────────────────────────────────

export interface DisperseLite {
  id: string;
  pseudonyme: string;
  pays: string;
  liveMemberId: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface UtilisateurLite {
  id: string;
  name: string | null;
  email: string;
  country: string | null;
  createdAt: Date;
}

export interface ClassificationPurge {
  /** ids des DisperseMember à SUPPRIMER (positions anonymes). */
  aSupprimer: string[];
  /** ids des DisperseMember à CONSERVER (inscriptions officielles). */
  aConserver: string[];
  /** justification lisible par id (journalisation). */
  raisons: Map<string, string>;
}

// ── Helpers de comparaison ───────────────────────────────────────────────

/** Minuscules + sans accents + espaces simples. */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** /register crée le User PUIS sa position dans la même requête HTTP. */
export const FENETRE_REGISTER_MS = 90_000;

/** Vrai si le pays du compte (libellé ou code) correspond au code ISO. */
export function paysCoherent(countryUser: string | null, codeDisperse: string): boolean {
  if (!countryUser) return false;
  const c = normaliser(countryUser);
  const code = codeDisperse.trim().toUpperCase();
  if (c === normaliser(code)) return true;
  const pays = COUNTRIES.find((p) => p.code === code);
  return !!pays && c === normaliser(pays.name);
}

// ── Classification ───────────────────────────────────────────────────────

export function classerDisperses(
  membres: DisperseLite[],
  utilisateurs: UtilisateurLite[]
): ClassificationPurge {
  const raisons = new Map<string, string>();
  const aSupprimer: string[] = [];
  const aConserver: string[] = [];

  // Index des comptes par nom affiché et par préfixe d'email (normalisés).
  const parNom = new Map<string, UtilisateurLite>();
  const parEmail = new Map<string, UtilisateurLite>();
  for (const u of utilisateurs) {
    if (u.name) parNom.set(normaliser(u.name), u);
    parEmail.set(normaliser(u.email.split("@")[0] ?? ""), u);
  }
  const utilisateursTries = [...utilisateurs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const m of membres) {
    // (a) Inscrit officiellement via le système des lives
    if (m.liveMemberId) {
      aConserver.push(m.id);
      raisons.set(m.id, "liveMemberId (inscription officielle aux lives)");
      continue;
    }
    // (b) Position créée par un compte (register / disperses/add connecté)
    if (m.userId) {
      aConserver.push(m.id);
      raisons.set(m.id, "userId (compte officiel)");
      continue;
    }
    const cle = normaliser(m.pseudonyme);
    // (c) Pseudonyme = nom affiché d'un compte existant
    if (cle && parNom.has(cle)) {
      aConserver.push(m.id);
      raisons.set(m.id, `pseudonyme = compte « ${parNom.get(cle)!.name ?? parNom.get(cle)!.email} »`);
      continue;
    }
    // (c bis) Pseudonyme = préfixe d'email d'un compte existant
    if (cle && parEmail.has(cle)) {
      aConserver.push(m.id);
      raisons.set(m.id, `pseudonyme = email de « ${parEmail.get(cle)!.email} »`);
      continue;
    }
    // (d) Placement automatique de /register : compte créé dans la même
    // requête (±90 s) et même pays.
    const t = m.createdAt.getTime();
    const candidat = utilisateursTries.find(
      (u) =>
        Math.abs(u.createdAt.getTime() - t) <= FENETRE_REGISTER_MS &&
        paysCoherent(u.country, m.pays)
    );
    if (candidat) {
      aConserver.push(m.id);
      raisons.set(m.id, `créée avec le compte « ${candidat.name ?? candidat.email} » (±90 s, même pays)`);
      continue;
    }
    // Aucun critère → position anonyme de l'ancien formulaire → purge.
    aSupprimer.push(m.id);
    raisons.set(m.id, "position anonyme (ancien formulaire « Ajouter ma position »)");
  }

  return { aSupprimer, aConserver, raisons };
}
