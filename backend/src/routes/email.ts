/**
 * ⭐ V3.70 — ROUTES EMAIL DU BACKEND (relais Resend pour le frontend).
 *
 *   POST /api/email/send  — relais d'envoi pour les fonctions Vercel
 *   GET  /api/email/health — état du service email
 *
 * Contexte : la plateforme principale (logins, secrétariat, trésorerie) tourne
 * sur VERCEL, mais la clé RESEND_API_KEY vit sur RAILWAY (ce backend), désormais
 * servi sur https://api.mouvementchristlibere.com. Quand la clé est absente de
 * Vercel, src/lib/email.ts (frontend) relaie chaque envoi ICI, en
 * server-to-server — aucune clé n'est jamais exposée au navigateur.
 *
 * Sécurité (anti-relais ouvert) :
 *   1. Secret partagé : si EMAIL_SERVICE_SECRET est défini ici, la requête
 *      DOIT porter le header X-Email-Secret identique (à définir aussi côté
 *      Vercel pour verrouiller totalement le relais — recommandé) ;
 *   2. Anti-relais : le destinataire doit être un COMPTE existant en base
 *      (User.email — membre, secrétaire, trésorier, admin…) OU une adresse
 *      EMAIL_KONGO / EMAIL_PAM / PASTEUR_EMAIL configurée — impossible
 *      d'arbitrairement spammer depuis noreply@mouvementchristlibere.com ;
 *   3. Tailles plafonnées : objet ≤ 200, html/text ≤ 60 000 ;
 *   4. Rate-limit mémoire (fenêtre glissante) : 30/h par IP, 12/h par
 *      destinataire ;
 *   5. Expéditeur FIXE (EMAIL_EXPEDITEUR, défaut noreply@…) — jamais
 *      contrôlable par l'appelant (pas d'usurpation d'identité).
 */

import { Router, type Request, type Response } from "express";
import { db } from "../lib/db";

const router = Router();

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const EXPEDITEUR = () =>
  process.env.EMAIL_EXPEDITEUR ||
  "Mouvement Christ Libéré <noreply@mouvementchristlibere.com>";

const LIMITES = {
  sujet: 200,
  html: 60_000,
  texte: 60_000,
  parIp: 30,
  parDestinataire: 12,
  fenetreMs: 60 * 60 * 1000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ------------------------------------------------------------------
// Rate-limit mémoire — fenêtre glissante (le backend est un process
// unique et persistant sur Railway : le comptage en mémoire est fiable).
// ------------------------------------------------------------------
const fenetres = new Map<string, number[]>();

function autoriser(cle: string, max: number, fenetreMs: number): boolean {
  const maintenant = Date.now();
  const instants = (fenetres.get(cle) || []).filter(
    (t) => maintenant - t < fenetreMs,
  );
  if (instants.length >= max) {
    fenetres.set(cle, instants);
    return false;
  }
  instants.push(maintenant);
  fenetres.set(cle, instants);
  if (fenetres.size > 5000) {
    for (const [k, v] of fenetres) if (v.length === 0) fenetres.delete(k);
  }
  return true;
}

function ipDe(req: Request): string {
  const brute = req.headers["x-forwarded-for"];
  if (typeof brute === "string" && brute.length > 0) {
    return brute.split(",")[0].trim();
  }
  return req.ip || "inconnu";
}

// ------------------------------------------------------------------
// Anti-relais : destinataire connu de la plateforme ?
// ------------------------------------------------------------------
async function destinataireAutorise(adresse: string): Promise<boolean> {
  const autorises = new Set(
    [
      process.env.PASTEUR_EMAIL,
      process.env.EMAIL_KONGO,
      process.env.EMAIL_PAM,
    ].filter((v): v is string => Boolean(v && v.trim())),
  );
  if (autorises.has(adresse)) return true;
  try {
    const compte = await db.user.findFirst({
      where: { email: adresse },
      select: { id: true },
    });
    return Boolean(compte);
  } catch {
    // Base indisponible : on REFUSE (jamais de relais ouvert par prudence).
    return false;
  }
}

// ------------------------------------------------------------------
// POST /api/email/send
// Body: { to, subject, html, text?, replyTo?, category? }
// ------------------------------------------------------------------
router.post("/send", async (req: Request, res: Response) => {
  try {
    // 1) Secret partagé (si configuré).
    if (process.env.EMAIL_SERVICE_SECRET) {
      const secret = req.headers["x-email-secret"];
      if (
        typeof secret !== "string" ||
        secret !== process.env.EMAIL_SERVICE_SECRET
      ) {
        return res.status(401).json({ error: "Secret de service invalide" });
      }
    }

    const { to, subject, html, text, replyTo } = req.body || {};

    // 2) Validations de forme.
    const destinataire = typeof to === "string" ? to.trim().toLowerCase() : "";
    // Tolère « Nom <adresse> » envoyé par le frontend.
    const adresseNue = destinataire.match(/<([^>]+)>/)?.[1] ?? destinataire;
    if (!EMAIL_RE.test(adresseNue)) {
      return res.status(400).json({ error: "Adresse destinataire invalide" });
    }
    if (typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({ error: "Objet requis" });
    }
    if (typeof html !== "string" || !html.trim()) {
      return res.status(400).json({ error: "Contenu html requis" });
    }
    if (subject.length > LIMITES.sujet) {
      return res
        .status(400)
        .json({ error: `Objet trop long (max ${LIMITES.sujet})` });
    }
    if (html.length > LIMITES.html) {
      return res
        .status(400)
        .json({ error: `Contenu trop long (max ${LIMITES.html})` });
    }
    if (text && String(text).length > LIMITES.texte) {
      return res
        .status(400)
        .json({ error: `Texte trop long (max ${LIMITES.texte})` });
    }
    if (replyTo && !EMAIL_RE.test(String(replyTo).trim())) {
      return res.status(400).json({ error: "Reply-To invalide" });
    }

    // 3) Rate-limits.
    if (!autoriser(`relay-ip:${ipDe(req)}`, LIMITES.parIp, LIMITES.fenetreMs)) {
      return res
        .status(429)
        .json({ error: "Trop d'envois depuis cette adresse — réessayez plus tard." });
    }
    if (
      !autoriser(
        `relay-to:${adresseNue}`,
        LIMITES.parDestinataire,
        LIMITES.fenetreMs,
      )
    ) {
      return res
        .status(429)
        .json({ error: "Trop d'envois vers ce destinataire — réessayez plus tard." });
    }

    // 4) Anti-relais : destinataire connu de la plateforme.
    const autorise = await destinataireAutorise(adresseNue);
    if (!autorise) {
      return res
        .status(403)
        .json({ error: "Destinataire inconnu de la plateforme" });
    }

    // 5) Clé présente ?
    const cle = process.env.RESEND_API_KEY;
    if (!cle) {
      return res.status(503).json({
        error:
          "RESEND_API_KEY absente de ce backend (Railway) — ajoutez la variable sur Railway",
      });
    }

    // 6) Envoi via Resend (expéditeur FIXE, jamais contrôlé par l'appelant).
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), 12_000);
    try {
      const reponse = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cle}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EXPEDITEUR(),
          to: [destinataire],
          subject: subject.trim(),
          html,
          ...(typeof text === "string" && text.trim() ? { text } : {}),
          ...(typeof replyTo === "string" && replyTo.trim()
            ? { reply_to: replyTo.trim() }
            : {}),
        }),
        signal: controle.signal,
      });

      const corps = (await reponse.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };

      if (!reponse.ok) {
        console.error(
          `[email/send] Resend a refusé (${reponse.status}) : ${corps.message || corps.name || "?"}`,
        );
        return res.status(502).json({
          error: "Resend a refusé l'envoi",
          detail: corps.message || corps.name || `HTTP ${reponse.status}`,
        });
      }

      console.log(
        `[email/send] Email relayé vers ${adresseNue} (objet « ${subject.trim().slice(0, 80)} ») — id Resend ${corps.id ?? "?"}`,
      );
      return res.json({ success: true, id: corps.id });
    } finally {
      clearTimeout(minuteur);
    }
  } catch (error) {
    console.error("[email/send] Error:", error);
    return res.status(500).json({ error: "Erreur interne du relais email" });
  }
});

// ------------------------------------------------------------------
// GET /api/email/health — état du service (clé, secret, expéditeur).
// ------------------------------------------------------------------
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    service: "email",
    resend: process.env.RESEND_API_KEY
      ? "configuré ✓"
      : "ABSENT — RESEND_API_KEY à ajouter sur Railway",
    secret: process.env.EMAIL_SERVICE_SECRET
      ? "actif (X-Email-Secret exigé)"
      : "inactif (relais protégé par anti-relais + rate-limit)",
    expediteur: EXPEDITEUR(),
    domaine: "https://api.mouvementchristlibere.com",
  });
});

export default router;
