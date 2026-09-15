/**
 * ⭐ V3.83 — Configuration des passerelles de paiement depuis le back-office.
 *
 * Directive : « les administrateurs Pastor Congo et Afrika doivent avoir un
 * module pour paramétrer et configurer les méthodes de paiement, FedaPay
 * ainsi que Paystack — toutes les clés API et webhooks depuis le back-office ».
 *
 * Architecture (la spécification V3.82 reste la loi du code) :
 *   · la configuration back-office (table PaymentGatewayConfig) PRIME ;
 *   · les variables d'environnement restent un REPLI valable (Vercel) —
 *     une installation sans back-office fonctionne à l'identique ;
 *   · les clés ne sont JAMAIS stockées en clair : AES-256-GCM, clé maîtresse
 *     dérivée par scrypt de PAYMENTS_MASTER_KEY (recommandé) ou SESSION_SECRET ;
 *   · le secret n'est JAMAIS renvoyé au client : seuls les 4 derniers
 *     caractères servent à l'affichage masqué ;
 *   · fedapay.service.ts et paystack.service.ts continuent de ne PAS se
 *     connaître — ils appellent simplement lireConfigPasserelle().
 *
 * Cache : 15 secondes en mémoire d'instance (une initiation de don ou un
 * webhook n'excède jamais 15 s de délai de prise en compte ; un
 * enregistrement depuis /admin/paiements invalide immédiatement le cache
 * de l'instance courante).
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { db } from "@/lib/db";
import { ensurePaiementsTable } from "@/lib/ensure-schema";
import { ProviderId, PROVIDERS_VALEURS } from "./payment-types";

// ─────────────────────────────────────────────────────────────────────
// Chiffrement des secrets (AES-256-GCM)
// ─────────────────────────────────────────────────────────────────────

/**
 * Matière maîtresse du chiffrement (jamais affichée, jamais logguée) :
 * PAYMENTS_MASTER_KEY (recommandé) > SESSION_SECRET > valeur publique
 * documentée dans .env.example (simple obfuscation si aucune n'est posée).
 */
function matiereMaitresse(): string {
  return (
    process.env.PAYMENTS_MASTER_KEY ||
    process.env.SESSION_SECRET ||
    "christ-libere-session-secret-change-in-prod-2026"
  );
}

/** Chiffre un secret — format « v1:<salt>:<iv>:<tag>:<données> » (hex). */
export function chiffrerSecret(clair: string): string {
  const sel = randomBytes(16);
  const iv = randomBytes(12);
  const cle = scryptSync(matiereMaitresse(), sel.toString("hex"), 32);
  const chiffre = createCipheriv("aes-256-gcm", cle, iv);
  const donnees = Buffer.concat([
    chiffre.update(clair, "utf8"),
    chiffre.final(),
  ]);
  return [
    "v1",
    sel.toString("hex"),
    iv.toString("hex"),
    chiffre.getAuthTag().toString("hex"),
    donnees.toString("hex"),
  ].join(":");
}

/** Déchiffre un secret produit par chiffrerSecret (null si illisible). */
export function dechiffrerSecret(stocke: string): string | null {
  try {
    const morceaux = stocke.split(":");
    if (morceaux.length !== 5 || morceaux[0] !== "v1") return null;
    const [, selHex, ivHex, tagHex, donneesHex] = morceaux;
    // La clé est dérivée de la même matière maîtresse + le sel de l'enregistrement.
    const cle = scryptSync(matiereMaitresse(), selHex, 32);
    const dechiffre = createDecipheriv(
      "aes-256-gcm",
      cle,
      Buffer.from(ivHex, "hex")
    );
    dechiffre.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      dechiffre.update(Buffer.from(donneesHex, "hex")),
      dechiffre.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Résolution de la configuration (base → repli environnement)
// ─────────────────────────────────────────────────────────────────────

export type SourceConfig = "back-office" | "environnement" | "absente";

export interface ConfigPasserelle {
  provider: ProviderId;
  /** Où la clé effective a été trouvée (affichage admin + diagnostics). */
  source: SourceConfig;
  /** Clé secrète API utilisable (null = passerelle non configurée). */
  secretKey: string | null;
  /** Secret de vérification de webhook (null = webhook non vérifiable). */
  webhookSecret: string | null;
  /** Environnement FedaPay (sandbox | live) — indicatif pour Paystack. */
  environment: "sandbox" | "live";
  /** La ligne back-office est-elle activée ? (false → repli env) */
  activee: boolean;
}

const DUREE_CACHE_MS = 15_000;
const cacheConfig = new Map<ProviderId, { valeur: ConfigPasserelle; expire: number }>();

/** Vide le cache des configurations (après enregistrement back-office). */
export function invaliderCachePasserelles(): void {
  cacheConfig.clear();
}

function configEnv(provider: ProviderId): ConfigPasserelle {
  if (provider === "fedapay") {
    return {
      provider,
      source: process.env.FEDAPAY_SECRET_KEY ? "environnement" : "absente",
      secretKey: process.env.FEDAPAY_SECRET_KEY || null,
      webhookSecret: process.env.FEDAPAY_WEBHOOK_SECRET || null,
      environment: process.env.FEDAPAY_ENV === "live" ? "live" : "sandbox",
      activee: false,
    };
  }
  return {
    provider: "paystack",
    source: process.env.PAYSTACK_SECRET_KEY ? "environnement" : "absente",
    secretKey: process.env.PAYSTACK_SECRET_KEY || null,
    webhookSecret:
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      process.env.PAYSTACK_SECRET_KEY ||
      null,
    environment: "live",
    activee: false,
  };
}

/**
 * Résout la configuration EFFECTIVE d'une passerelle :
 *   ① ligne back-office activée avec clé déchiffrable → elle prime ;
 *   ② sinon variables d'environnement (V3.82 — Vercel) ;
 *   ③ sinon « absente » (la page /contribuer affiche le message d'activation).
 *
 * Toute erreur de base (table absente, réseau…) est silencieuse : on retombe
 * sur l'environnement — la disponibilité des paiements ne dépend jamais
 * d'une table de configuration.
 */
export async function lireConfigPasserelle(
  provider: ProviderId
): Promise<ConfigPasserelle> {
  const enCache = cacheConfig.get(provider);
  if (enCache && enCache.expire > Date.now()) return enCache.valeur;

  let valeur = configEnv(provider);
  try {
    await ensurePaiementsTable();
    const ligne = await db.paymentGatewayConfig.findUnique({
      where: { provider },
    });
    if (ligne?.enabled && ligne.secretKeyEnc) {
      const cle = dechiffrerSecret(ligne.secretKeyEnc);
      if (cle) {
        const webhookBrut = ligne.webhookSecretEnc
          ? dechiffrerSecret(ligne.webhookSecretEnc)
          : null;
        valeur = {
          provider,
          source: "back-office",
          secretKey: cle,
          // Paystack : par convention le secret de webhook = la clé du compte
          // quand il n'est pas explicitement défini.
          webhookSecret:
            provider === "paystack"
              ? webhookBrut || cle
              : webhookBrut,
          environment:
            provider === "fedapay"
              ? ligne.environment === "live"
                ? "live"
                : "sandbox"
              : "live",
          activee: true,
        };
      }
    }
  } catch (e) {
    console.warn(
      "[paiements] Lecture configuration back-office impossible — repli environnement :",
      e instanceof Error ? e.message : e
    );
  }

  cacheConfig.set(provider, { valeur, expire: Date.now() + DUREE_CACHE_MS });
  return valeur;
}

// ─────────────────────────────────────────────────────────────────────
// État pour l'affichage back-office (JAMAIS de secret complet)
// ─────────────────────────────────────────────────────────────────────

export interface EtatPasserelle {
  provider: ProviderId;
  /** Ligne back-office : activée, environnement, masques, date. */
  backOffice: {
    existe: boolean;
    activee: boolean;
    environment: "sandbox" | "live";
    cleMasquee: string | null; // « •••• 1234 »
    webhookMasque: string | null;
    webhooksSecretDefini: boolean;
    majPar: string | null; // nom du compte admin
    majLe: string | null; // date ISO
  } | null;
  /** Variables d'environnement détectées (repli — affichage informatif). */
  environnement: {
    clePresente: boolean;
    webhookPresent: boolean;
    nomVariableCle: string;
  };
  /** Configuration EFFECTIVE (celle que /api/dons/initier utilisera). */
  effective: {
    source: SourceConfig;
    prete: boolean; // une clé est disponible
    webhookPret: boolean;
  };
}

const NOMS_VARIABLES: Record<ProviderId, string> = {
  fedapay: "FEDAPAY_SECRET_KEY",
  paystack: "PAYSTACK_SECRET_KEY",
};

/** État complet des deux passerelles pour /admin/paiements (secrets masqués). */
export async function lireEtatPasserelles(): Promise<EtatPasserelle[]> {
  const etats: EtatPasserelle[] = [];

  for (const provider of PROVIDERS_VALEURS) {
    let ligne = null;
    try {
      await ensurePaiementsTable();
      ligne = await db.paymentGatewayConfig.findUnique({
        where: { provider },
      });
    } catch {
      ligne = null; // base indisponible → on affiche l'état environnement
    }

    const config = await lireConfigPasserelle(provider);

    let majPar: string | null = null;
    if (ligne?.updatedBy) {
      try {
        const admin = await db.user.findUnique({
          where: { id: ligne.updatedBy },
          select: { name: true },
        });
        majPar = admin?.name || null;
      } catch {
        majPar = null;
      }
    }

    etats.push({
      provider,
      backOffice: ligne
        ? {
            existe: true,
            activee: ligne.enabled,
            environment:
              ligne.environment === "live" ? "live" : "sandbox",
            cleMasquee: ligne.cleLast4
              ? `•••• ${ligne.cleLast4}`
              : null,
            webhookMasque: ligne.webhookLast4
              ? `•••• ${ligne.webhookLast4}`
              : null,
            webhooksSecretDefini: Boolean(ligne.webhookSecretEnc),
            majPar,
            majLe: ligne.updatedAt
              ? new Date(ligne.updatedAt).toISOString()
              : null,
          }
        : null,
      environnement: {
        clePresente:
          provider === "fedapay"
            ? Boolean(process.env.FEDAPAY_SECRET_KEY)
            : Boolean(process.env.PAYSTACK_SECRET_KEY),
        webhookPresent:
          provider === "fedapay"
            ? Boolean(process.env.FEDAPAY_WEBHOOK_SECRET)
            : Boolean(
                process.env.PAYSTACK_WEBHOOK_SECRET ||
                  process.env.PAYSTACK_SECRET_KEY
              ),
        nomVariableCle: NOMS_VARIABLES[provider],
      },
      effective: {
        source: config.source,
        prete: Boolean(config.secretKey),
        webhookPret: Boolean(config.webhookSecret),
      },
    });
  }

  return etats;
}

// ─────────────────────────────────────────────────────────────────────
// Enregistrement (API admin — validation et chiffrement ici)
// ─────────────────────────────────────────────────────────────────────

export type ResultatEnregistrement =
  | { ok: true; masque: string | null }
  | { ok: false; erreur: string };

const PREFIXES_CLES: Record<ProviderId, { live: RegExp; sandbox: RegExp }> = {
  fedapay: {
    live: /^sk_live_[A-Za-z0-9_-]+$/,
    sandbox: /^sk_sandbox_[A-Za-z0-9_-]+$/,
  },
  paystack: {
    live: /^sk_live_[A-Za-z0-9_-]+$/,
    sandbox: /^sk_test_[A-Za-z0-9_-]+$/,
  },
};

/**
 * Enregistre la configuration d'une passerelle (appelé par
 * PUT /admin/api/paiements APRÈS la garde exigerSession SUPER_ADMIN).
 *
 *   · secretKey facultatif : absent = conserver la clé actuelle ;
 *   · webhookSecret facultatif : absent = conserver ; "" = le supprimer ;
 *   · cohérence environnement ↔ préfixe de clé vérifiée (refus sinon) ;
 *   · cachet d'audit : updatedBy (id du compte), jamais le secret.
 */
export async function enregistrerConfigPasserelle(params: {
  provider: ProviderId;
  activee: boolean;
  environment: "sandbox" | "live";
  secretKey?: string | null;
  webhookSecret?: string | null;
  par: string;
}): Promise<ResultatEnregistrement> {
  let { environment } = params;
  const { provider, activee } = params;
  await ensurePaiementsTable();

  const existante = await db.paymentGatewayConfig.findUnique({
    where: { provider },
  });

  // ── Paystack : l'environnement se déduit de la CLÉ elle-même
  // (sk_live_ / sk_test_) — pas de sélecteur dédié dans l'interface. ──
  const clePrevue =
    typeof params.secretKey === "string" && params.secretKey.trim()
      ? params.secretKey.trim()
      : null;
  if (provider === "paystack") {
    if (clePrevue) {
      environment = clePrevue.startsWith("sk_live_") ? "live" : "sandbox";
    } else if (existante?.secretKeyEnc) {
      // Pas de nouvelle clé : l'environnement suit la clé enregistrée.
      const cleExistante = dechiffrerSecret(existante.secretKeyEnc);
      environment = cleExistante?.startsWith("sk_live_")
        ? "live"
        : existante.environment === "live"
          ? "live"
          : "sandbox";
    }
  }

  // ── Clé secrète : fournie, ou conservée, ou rien du tout ──
  let cleEnClair: string | null = null;
  if (clePrevue) {
    cleEnClair = clePrevue;
    if (cleEnClair.length < 20 || cleEnClair.length > 300) {
      return {
        ok: false,
        erreur: "La clé secrète paraît invalide (longueur inattendue).",
      };
    }
    if (provider === "fedapay") {
      // FedaPay : cohérence STRICTE avec l'environnement sélectionné
      // (sandbox-api ≠ api — une clé sandbox en live échouerait).
      const motif =
        environment === "live"
          ? PREFIXES_CLES.fedapay.live
          : PREFIXES_CLES.fedapay.sandbox;
      if (!motif.test(cleEnClair)) {
        return {
          ok: false,
          erreur: `Cette clé ne correspond pas à l'environnement « ${
            environment === "live" ? "Production" : "Sandbox (test)"
          } » — une clé ${
            environment === "live" ? "sk_live_…" : "sk_sandbox_…"
          } est attendue (les clés de test commencent par sk_sandbox_).`,
        };
      }
    } else {
      // Paystack : les deux environnements sont acceptés, le préfixe
      // détermine simplement le libellé (Production / Test).
      if (
        !PREFIXES_CLES.paystack.live.test(cleEnClair) &&
        !PREFIXES_CLES.paystack.sandbox.test(cleEnClair)
      ) {
        return {
          ok: false,
          erreur:
            "Cette clé ne ressemble pas à une clé secrète Paystack (sk_live_… ou sk_test_…).",
        };
      }
    }
  } else if (existante?.secretKeyEnc) {
    cleEnClair = dechiffrerSecret(existante.secretKeyEnc);
  }

  // ── Secret webhook : fourni, conservé, ou supprimé ("") ──
  let webhookEnClair: string | null = null;
  if (typeof params.webhookSecret === "string") {
    const nettoye = params.webhookSecret.trim();
    if (nettoye) {
      if (nettoye.length < 16 || nettoye.length > 300) {
        return {
          ok: false,
          erreur: "Le secret de webhook paraît invalide (longueur inattendue).",
        };
      }
      webhookEnClair = nettoye;
    }
    // "" → suppression explicite (Paystack retombera sur la clé du compte).
  } else if (existante?.webhookSecretEnc) {
    webhookEnClair = dechiffrerSecret(existante.webhookSecretEnc);
  }

  // ── Garde : activer sans clé (ni en base, ni en entrée) est interdit ──
  if (activee && !cleEnClair) {
    return {
      ok: false,
      erreur:
        "Impossible d'activer la passerelle sans clé secrète — collez d'abord votre clé API (ou laissez-la en place si elle est déjà enregistrée).",
    };
  }

  const donnees: {
    enabled: boolean;
    environment: string;
    secretKeyEnc?: string | null;
    webhookSecretEnc?: string | null;
    cleLast4?: string | null;
    webhookLast4?: string | null;
    updatedBy: string;
  } = {
    enabled: activee,
    environment,
    updatedBy: params.par,
  };

  if (cleEnClair) {
    donnees.secretKeyEnc = chiffrerSecret(cleEnClair);
    donnees.cleLast4 = cleEnClair.slice(-4);
  }
  if (webhookEnClair) {
    donnees.webhookSecretEnc = chiffrerSecret(webhookEnClair);
    donnees.webhookLast4 = webhookEnClair.slice(-4);
  } else if (
    typeof params.webhookSecret === "string" &&
    !params.webhookSecret.trim()
  ) {
    // Champ vidé exprès → suppression RÉELLE du secret enregistré
    // (sinon l'ancien resterait chiffré en base et continuerait de servir).
    donnees.webhookSecretEnc = null;
    donnees.webhookLast4 = null;
  }

  await db.paymentGatewayConfig.upsert({
    where: { provider },
    update: donnees,
    create: {
      provider,
      ...donnees,
    },
  });

  invaliderCachePasserelles();
  return { ok: true, masque: donnees.cleLast4 ? `•••• ${donnees.cleLast4}` : null };
}

// ─────────────────────────────────────────────────────────────────────
// Empreinte de configuration (comparaison sans révéler le secret)
// ─────────────────────────────────────────────────────────────────────

/**
 * Empreinte SHA-256 tronquée d'un secret — utilisée par le test de
 * connexion pour confirmer quelle clé a été essayée SANS l'afficher.
 */
export function empreinteSecret(secret: string): string {
  return createHmac("sha256", "empreinte-paiements-v383")
    .update(secret)
    .digest("hex")
    .slice(0, 8);
}
