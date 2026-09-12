/**
 * ⭐ V3.69 — Moteur d'envoi d'emails transactionnels via Resend.
 * ⭐ V3.70 — DOUBLE CHEMIN d'envoi : direct (Vercel) OU RELAIS BACKEND.
 *
 * Expéditeur : noreply@mouvementchristlibere.com (domaine du mouvement,
 * à vérifier dans le dashboard Resend — enregistrements SPF/DKIM).
 *
 * ⭐ V3.70 — OÙ CONFIGURER LA CLÉ (deux options désormais) :
 *   ① Option A (direct) : RESEND_API_KEY déclarée sur VERCEL → envoi
 *      direct depuis les fonctions Vercel (comme en V3.69).
 *   ② Option B (relais — clé sur Railway) : RESEND_API_KEY posée sur le
 *      backend Railway, désormais servi sur https://api.mouvementchristlibere.com
 *      → si la clé est ABSENTE de Vercel, chaque envoi est relayé au
 *      backend (POST /api/email/send, appel server-to-server, aucune clé
 *      exposée au navigateur). C'est le choix actuel du pasteur : la clé
 *      vit sur Railway.
 *      URL du relais : BACKEND_URL, sinon NEXT_PUBLIC_API_URL, sinon le
 *      domaine officiel par défaut (constante BACKEND_EMAIL_URL_PAR_DEFAUT).
 *      Durcissement optionnel : EMAIL_SERVICE_SECRET identique sur Vercel
 *      et Railway → header X-Email-Secret exigé par le relais.
 *
 * Chaque expédition est consignée dans la table OutgoingEmail (statut,
 * erreur éventuelle, identifiant Resend) — en best-effort : un problème de
 * journal n'empêche jamais l'envoi, et réciproquement.
 */

import { db } from "@/lib/db";
import { ensureEmailTables } from "@/lib/ensure-schema";

/** Catégories d'emails sortants (colonne OutgoingEmail.category). */
export const CATEGORIES_EMAIL = {
  OTP_RESET: "OTP_RESET",
  COURRIER_SERVITEUR: "COURRIER_SERVITEUR",
  DEMANDE_TRANSMISE: "DEMANDE_TRANSMISE",
  TEST: "TEST",
} as const;

export type CategorieEmail = (typeof CATEGORIES_EMAIL)[keyof typeof CATEGORIES_EMAIL];

/** Expéditeur par défaut (surchargable via EMAIL_EXPEDITEUR). */
const EXPEDITEUR_PAR_DEFAUT = "Mouvement Christ Libéré <noreply@mouvementchristlibere.com>";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * ⭐ V3.70 — URL officielle du backend Railway (domaine dédié).
 * Utilisée comme repli quand ni BACKEND_URL ni NEXT_PUBLIC_API_URL n'est
 * défini : les emails partent quand le relais est la seule option.
 */
export const BACKEND_EMAIL_URL_PAR_DEFAUT = "https://api.mouvementchristlibere.com";

/** URL complète du relais d'envoi du backend (POST /api/email/send). */
function urlRelaisBackend(): string {
  const base = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    BACKEND_EMAIL_URL_PAR_DEFAUT
  ).replace(/\/$/, "");
  return `${base}/api/email/send`;
}

export interface ResultatEnvoi {
  ok: boolean;
  /** Identifiant renvoyé par Resend en cas de succès. */
  resendId?: string;
  /** Message d'erreur lisible (clé absente, rejet Resend, timeout…). */
  erreur?: string;
}

export interface OptionsEnvoi {
  /** Adresse du destinataire (nue ou « Nom <adresse> »). */
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string;
  /** Adresse Reply-To (ex. email de la secrétaire pour un courrier). */
  replyTo?: string | null;
  category: CategorieEmail;
  /** Compte à l'origine de l'envoi (journal + audit). */
  sentById?: string | null;
}

function cleResendPresente(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Construit le champ « to » au format Resend (« Nom <adresse> » si fourni). */
function formaterDestinataire(to: string, toName?: string | null): string {
  const adresse = to.trim();
  if (!toName || adresse.includes("<")) return adresse;
  return `${toName.replace(/[<>]/g, "").trim()} <${adresse}>`;
}

/** Journalise l'expédition dans OutgoingEmail (best-effort, jamais bloquant). */
async function journaliser(
  options: OptionsEnvoi,
  resultat: ResultatEnvoi
): Promise<void> {
  try {
    await ensureEmailTables();
    await db.outgoingEmail.create({
      data: {
        category: options.category,
        toEmail: options.to,
        toName: options.toName ?? null,
        subject: options.subject,
        body: options.html,
        status: resultat.ok ? "ENVOYE" : "ECHOUE",
        errorMessage: resultat.erreur ?? null,
        resendId: resultat.resendId ?? null,
        sentById: options.sentById ?? null,
      },
    });
  } catch (e) {
    console.warn("[email] Journalisation OutgoingEmail impossible :", e);
  }
}

/**
 * Envoie un email via l'API REST de Resend (fetch natif — zéro dépendance).
 * Retourne { ok: false, erreur } si la clé est absente ou si Resend refuse :
 * l'APPELANT décide si l'échec bloque l'opération (reset de mot de passe)
 * ou s'il est toléré (courrier best-effort).
 */
export async function envoyerEmail(options: OptionsEnvoi): Promise<ResultatEnvoi> {
  // ⭐ V3.70 — clé absente sur Vercel ? RELAIS vers le backend Railway
  // (api.mouvementchristlibere.com), détenteur de RESEND_API_KEY.
  if (!cleResendPresente()) {
    return envoyerViaRelaisBackend(options);
  }

  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), 12_000);

  try {
    const reponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_EXPEDITEUR || EXPEDITEUR_PAR_DEFAUT,
        to: [formaterDestinataire(options.to, options.toName)],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
      signal: controle.signal,
    });

    const corps = (await reponse.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!reponse.ok) {
      // Resend renvoie { name, message } en cas d'erreur (401 clé invalide,
      // 403 domaine non vérifié, 422 destinataire invalide…).
      const erreur = `Resend a refusé l'envoi (${reponse.status}) : ${
        corps.message || corps.name || "raison inconnue"
      }`;
      console.error("[email] " + erreur);
      const resultat: ResultatEnvoi = { ok: false, erreur };
      await journaliser(options, resultat);
      return resultat;
    }

    const resultat: ResultatEnvoi = { ok: true, resendId: corps.id };
    await journaliser(options, resultat);
    return resultat;
  } catch (e) {
    const abort = e instanceof Error && e.name === "AbortError";
    const erreur = abort
      ? "L'envoi a expiré (pas de réponse de Resend sous 12 s)."
      : `Échec réseau vers Resend : ${e instanceof Error ? e.message : String(e)}`;
    console.error("[email] " + erreur);
    const resultat: ResultatEnvoi = { ok: false, erreur };
    await journaliser(options, resultat);
    return resultat;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * ⭐ V3.70 — Envoi via le RELAIS du backend Railway (server-to-server).
 *
 * POST {BACKEND_URL|NEXT_PUBLIC_API_URL|api.mouvementchristlibere.com}/api/email/send
 * Le backend détient RESEND_API_KEY et transmet à Resend. Aucun CORS (appel
 * serveur→serveur), aucune clé dans le navigateur. Le relais applique ses
 * propres garde-fous (anti-relais : destinataire connu de la base ou email
 * serviteur ; rate-limit ; tailles plafonnées ; secret X-Email-Secret si
 * EMAIL_SERVICE_SECRET est partagé).
 */
async function envoyerViaRelaisBackend(options: OptionsEnvoi): Promise<ResultatEnvoi> {
  const url = urlRelaisBackend();
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), 12_000);

  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EMAIL_SERVICE_SECRET
          ? { "X-Email-Secret": process.env.EMAIL_SERVICE_SECRET }
          : {}),
      },
      body: JSON.stringify({
        to: formaterDestinataire(options.to, options.toName),
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
        category: options.category,
      }),
      signal: controle.signal,
    });

    const corps = (await reponse.json().catch(() => ({}))) as {
      success?: boolean;
      id?: string;
      error?: string;
      detail?: string;
    };

    if (!reponse.ok || !corps.success) {
      const erreur = `Relais backend (${url}) a refusé l'envoi (${reponse.status}) : ${
        corps.error || corps.detail || "raison inconnue"
      }`;
      console.error("[email] " + erreur);
      const resultat: ResultatEnvoi = { ok: false, erreur };
      await journaliser(options, resultat);
      return resultat;
    }

    const resultat: ResultatEnvoi = { ok: true, resendId: corps.id };
    await journaliser(options, resultat);
    return resultat;
  } catch (e) {
    const abort = e instanceof Error && e.name === "AbortError";
    const erreur = abort
      ? `Le relais backend n'a pas répondu sous 12 s (${url}).`
      : `Échec réseau vers le relais backend (${url}) : ${
          e instanceof Error ? e.message : String(e)
        }`;
    console.error("[email] " + erreur);
    const resultat: ResultatEnvoi = { ok: false, erreur };
    await journaliser(options, resultat);
    return resultat;
  } finally {
    clearTimeout(minuteur);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Résolution des destinataires « serviteurs de Dieu »
// ═══════════════════════════════════════════════════════════════════════

/** Fallbacks historiques (seed prisma/seed-super-admins.ts). */
const EMAILS_SERVITEURS_DEFAUT: Record<string, string> = {
  kongo: "pasteur.kongo@christ-libere.org",
  pam: "pam@christ-libere.org",
};

/**
 * Résout l'adresse email du serviteur destinataire d'une demande
 * (« pam » | « kongo ») :
 *   ① variable d'environnement EMAIL_KONGO / EMAIL_PAM (prioritaire) ;
 *   ② compte SUPER_ADMIN correspondant en base (recherche par nom) ;
 *   ③ adresse historique du seed (dernier recours).
 */
export async function resoudreEmailServiteur(
  servantCode: string
): Promise<{ email: string; nom: string }> {
  const code = servantCode?.trim().toLowerCase() || "kongo";

  // ① Variable d'environnement explicite.
  const envVar =
    code === "pam" ? process.env.EMAIL_PAM : process.env.EMAIL_KONGO;
  if (envVar && envVar.includes("@")) {
    return {
      email: envVar,
      nom: code === "pam" ? "Sœur Pam" : "Pasteur Kongo",
    };
  }

  // ② Comptes SUPER_ADMIN en base — l'email réel prime sur le seed.
  try {
    const supers = await db.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { name: true, email: true },
      take: 20,
    });
    const correspondance = supers.find((s) => {
      const nom = (s.name || "").toLowerCase();
      return code === "pam"
        ? nom === "pam" || nom.startsWith("pam") || nom.includes("pam")
        : nom.includes("kongo");
    });
    if (correspondance?.email) {
      return {
        email: correspondance.email,
        nom: correspondance.name || (code === "pam" ? "Sœur Pam" : "Pasteur Kongo"),
      };
    }
  } catch (e) {
    console.warn("[email] Recherche SUPER_ADMIN impossible :", e);
  }

  // ③ Dernier recours.
  return {
    email: EMAILS_SERVITEURS_DEFAUT[code] || EMAILS_SERVITEURS_DEFAUT.kongo,
    nom: code === "pam" ? "Sœur Pam" : "Pasteur Kongo",
  };
}

/**
 * Liste des destinataires « serviteurs » pour le courrier du secrétariat :
 * les comptes SUPER_ADMIN (Pam, Pasteur Kongo) disposant d'un email.
 */
export async function listerServiteursDestinataires(): Promise<
  Array<{ id: string; nom: string; email: string }>
> {
  try {
    const supers = await db.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 10,
    });
    return supers.map((s) => ({ id: s.id, nom: s.name || s.email, email: s.email }));
  } catch (e) {
    console.warn("[email] Liste des serviteurs impossible :", e);
    return [];
  }
}
