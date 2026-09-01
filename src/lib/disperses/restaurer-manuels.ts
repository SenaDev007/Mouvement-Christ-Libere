/**
 * ⭐ V3.14 — Restauration des membres dispersés supprimés par erreur.
 * ============================================================================
 *
 * « J'ai remarqué que tu as supprimé le membre Akpovi Sènakpon de la base
 * de données, c'est pas bien. » (pasteur, 02/09/2026)
 *
 * La purge V3.12 a supprimé de la base toutes les positions créées sans
 * compte officiel (ancien formulaire anonyme « Ajouter ma position »).
 * Certaines de ces positions appartenaient à de VRAIS membres connus du
 * Mouvement — c'est le cas d'Akpovi Sènakpon. Ce module les RÉTABLIT :
 *
 *   - pour chaque membre à restaurer, on retrouve son éventuel compte
 *     officiel (nom ou préfixe d'email, insensible à la casse et aux
 *     accents) pour en déduire le pays/ville et LIER l'entrée au compte ;
 *   - l'entrée recréée porte `manuel = true` → la purge ne peut PLUS
 *     JAMAIS la supprimer (critère (e) de classerDisperses) ;
 *   - si le membre s'est entre-temps réinscrit (entrée déjà présente),
 *     celle-ci est simplement PROTÉGÉE et liée à son compte (pas de
 *     doublon) ;
 *   - si son compte a déjà sa propre position, on ne crée rien (doublon
 *     évité).
 *
 * Mêmes garanties que la purge : idempotente, mémoïsée par instance
 * serverless (un seul passage utile par lambda), concurrentielle,
 * non bloquante (échec purement loggué), branchée sur GET /api/disperses
 * AVANT purgerDispersesAnonymes.
 */
import { db } from "@/lib/db";
import { COUNTRIES } from "@/lib/data/countries";
import {
  ensureDisperseManuelColumn,
  ensureDisperseUserIdColumn,
} from "@/lib/ensure-schema";
import { normaliser } from "./classification-purge";

export interface MembreARestaurer {
  /** Nom exact tel qu'il doit figurer sur la carte. */
  pseudonyme: string;
  /** Pays par défaut (code ISO) si aucun compte ne permet de le déduire. */
  paysParDefaut: string;
  /** Ville par défaut (optionnelle). */
  ville?: string;
  /** Niveau spirituel affiché (défaut : « croyant »). */
  niveau?: string;
}

/**
 * Membres à rétablir — purge V3.12 trop large.
 * « AKPOVI Sènakpon » : membre réel du Mouvement, rétabli à la demande du
 * pasteur. ⭐ V3.15 — Le nom est EXACTEMENT celui que la personne a inscrit :
 * « AKPOVI » en majuscules (directive du pasteur : « les noms doivent être
 * affichés exactement comme la personne les a écrits »). Le module corrige
 * donc aussi la casse d'une éventuelle entrée existante réécrite autrement
 * (ex. « Akpovi Sènakpon » créé par la V3.14).
 * Pays par défaut : BJ (Bénin, foyer du Mouvement) — remplacé
 * automatiquement par le pays du compte si Akpovi en possède un.
 */
const MEMBRES_A_RESTAURER: MembreARestaurer[] = [
  { pseudonyme: "AKPOVI Sènakpon", paysParDefaut: "BJ", niveau: "croyant" },
];

/**
 * Positions de TEST à retirer de la carte publique (créées lors des
 * validations, ex. « Test Baruch Haba » en V3.13) : la carte ne doit
 * montrer que de vrais membres. Le compte de test lui-même reste
 * supprimable en 1 clic depuis /admin/users.
 */
const PSEUDONYMES_DE_TEST: string[] = ["Test Baruch Haba"];

export interface ResultatRestauration {
  restaures: number;
  detail: Array<{ pseudonyme: string; pays: string; statut: string }>;
}

const RESULTAT_VIDE: ResultatRestauration = { restaures: 0, detail: [] };

let restaurationFaite = false;
let restaurationEnCours: Promise<ResultatRestauration> | null = null;

/** Résout un pays (code ISO ou libellé, accents/casse tolérés) → code ISO. */
function resoudreCodePays(paysBrut: string | null | undefined): string | null {
  const p = (paysBrut ?? "").trim();
  if (!p) return null;
  const code = p.toUpperCase();
  const cible =
    COUNTRIES.find((c) => c.code === code) ||
    COUNTRIES.find((c) => normaliser(c.name) === normaliser(p));
  return cible ? cible.code : null;
}

/** Exécute la restauration une seule fois par instance (mémoïsée). */
export function restaurerMembresManuels(): Promise<ResultatRestauration> {
  if (restaurationFaite) return Promise.resolve(RESULTAT_VIDE);
  if (restaurationEnCours) return restaurationEnCours;

  restaurationEnCours = (async (): Promise<ResultatRestauration> => {
    // Les colonnes doivent exister avant toute écriture Prisma.
    await ensureDisperseUserIdColumn();
    await ensureDisperseManuelColumn();

    const detail: ResultatRestauration["detail"] = [];
    let restaures = 0;

    // Vue complète (petite table) : entrées existantes + comptes.
    const existants = await db.disperseMember.findMany({
      select: { id: true, pseudonyme: true, userId: true, pays: true },
    });
    const utilisateurs = await db.user.findMany({
      select: { id: true, name: true, email: true, country: true, city: true },
    });

    for (const cible of MEMBRES_A_RESTAURER) {
      const cle = normaliser(cible.pseudonyme);

      // 1. Le compte officiel correspondant (nom ou préfixe d'email).
      const compte = utilisateurs.find(
        (u) =>
          (u.name ? normaliser(u.name) === cle : false) ||
          normaliser(u.email.split("@")[0] ?? "") === cle
      );

      // 2. Une entrée du même nom existe-t-elle déjà ?
      const existant = existants.find(
        (m) => normaliser(m.pseudonyme) === cle
      );

      if (existant) {
        // L'entrée est déjà là (le membre s'est par ex. réinscrit entre
        // temps) : la PROTEGER et la lier à son compte — pas de doublon.
        // ⭐ V3.15 — CASSE EXACTE : le nom doit être affiché EXACTEMENT
        // comme la personne l'a inscrit (ex. « AKPOVI » en majuscules) —
        // si l'entrée existante porte le même nom dans une autre casse
        // (ex. « Akpovi Sènakpon »), on la réécrit avec la casse exacte.
        await db.disperseMember.update({
          where: { id: existant.id },
          data: {
            manuel: true,
            ...(compte && !existant.userId ? { userId: compte.id } : {}),
            ...(existant.pseudonyme !== cible.pseudonyme
              ? { pseudonyme: cible.pseudonyme }
              : {}),
          },
        });
        detail.push({
          pseudonyme: cible.pseudonyme,
          pays: existant.pays,
          statut:
            "déjà présent — protégé" +
            (compte ? " et lié à son compte" : "") +
            (existant.pseudonyme !== cible.pseudonyme
              ? " — casse exacte rétablie"
              : ""),
        });
        console.log(
          `[disperses/restauration V3.14] « ${cible.pseudonyme} » déjà présent → protégé (manuel = true)` +
            (existant.pseudonyme !== cible.pseudonyme
              ? ` — casse corrigée : « ${existant.pseudonyme} » → « ${cible.pseudonyme} »`
              : "")
        );
        continue;
      }

      // 3. Le compte a-t-il déjà sa propre position ? → rien à créer.
      if (compte && existants.some((m) => m.userId === compte.id)) {
        detail.push({
          pseudonyme: cible.pseudonyme,
          pays: resoudreCodePays(compte.country) ?? cible.paysParDefaut,
          statut: "déjà couvert par la position de son compte",
        });
        continue;
      }

      // 4. Rétablir l'entrée : pays du compte si connu, sinon pays par
      // défaut ; coordonnées de référence du pays (arrondies à 0,1°).
      const codePays =
        resoudreCodePays(compte?.country) ?? cible.paysParDefaut;
      const ciblePays = COUNTRIES.find((c) => c.code === codePays);
      if (!ciblePays) {
        console.error(
          `[disperses/restauration V3.14] pays inconnu « ${codePays} » pour ${cible.pseudonyme} — ignoré`
        );
        continue;
      }

      await db.disperseMember.create({
        data: {
          pseudonyme: cible.pseudonyme,
          userId: compte ? compte.id : null,
          pays: ciblePays.code,
          ville: compte?.city || cible.ville || null,
          latitude: Math.round(ciblePays.lat * 10) / 10,
          longitude: Math.round(ciblePays.lng * 10) / 10,
          langue: "FR",
          niveau: cible.niveau ?? "croyant",
          message: null,
          isPublic: true,
          manuel: true, // ⭐ V3.14 — protégé à vie de la purge
        },
      });
      restaures++;
      detail.push({
        pseudonyme: cible.pseudonyme,
        pays: ciblePays.code,
        statut: "restauré" + (compte ? " (lié à son compte)" : ""),
      });
      console.log(
        `[disperses/restauration V3.14] « ${cible.pseudonyme} » rétabli sur la carte (${ciblePays.code}${compte ? ", compte lié" : ""})`
      );
    }

    // ⭐ Nettoyage : retirer de la carte publique les positions de TEST
    // (elles survivent à la purge car liées à un compte, mais la carte ne
    // doit montrer que de vrais membres).
    for (const pseudoTest of PSEUDONYMES_DE_TEST) {
      const cleTest = normaliser(pseudoTest);
      const rangeesTest = existants.filter(
        (m) => normaliser(m.pseudonyme) === cleTest
      );
      if (rangeesTest.length > 0) {
        await db.disperseMember.deleteMany({
          where: { id: { in: rangeesTest.map((r) => r.id) } },
        });
        console.log(
          `[disperses/restauration V3.14] position de test « ${pseudoTest} » retirée de la carte (${rangeesTest.length} entrée(s))`
        );
      }
    }

    restaurationFaite = true;
    return { restaures, detail };
  })()
    .catch((e: unknown) => {
      // Non bloquant : la carte fonctionne comme avant si la restauration
      // échoue (elle sera retentée au prochain cold start).
      console.error(
        "[disperses/restauration V3.14] impossible :",
        e instanceof Error ? e.message : e
      );
      return RESULTAT_VIDE;
    })
    .finally(() => {
      restaurationEnCours = null;
    });

  return restaurationEnCours;
}
