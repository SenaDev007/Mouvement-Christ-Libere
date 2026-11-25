import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { getPublicUrl } from "@/lib/r2";
import { envoyerEmail, CATEGORIES_EMAIL } from "@/lib/email";
import {
  templateRetraiteRecue,
  sujetRetraiteRecue,
  templateRetraiteNotification,
  sujetRetraiteNotification,
} from "@/lib/email-templates";

/**
 * ⭐ V4.43 — SOUMISSION D'UNE DEMANDE DE RETRAITE SPIRITUELLE.
 *
 * POST /api/retreat (PUBLIQUE — site web + application mobile)
 *
 * Toute personne désireuse de venir passer quelques jours de retraite
 * spirituelle sur le lieu aménagé du ministère en Côte d'Ivoire dépose
 * ici sa demande :
 *   · informations identitaires complètes (prénom, nom, contact, pays,
 *     ville, adresse, profession, situation matrimoniale, contact d'urgence) ;
 *   · séjour souhaité (date d'arrivée facultative, nombre de jours, attentes) ;
 *   · photo lisible de sa pièce d'identité ;
 *   · capture de la preuve du paiement des frais de dossier (15 000 FCFA).
 *
 * Les deux images ont été envoyées AU PRÉALABLE directement à R2 via
 * /api/retreat/presign (PUT pré-signé) : cette route ne reçoit que du JSON
 * avec les URL publiques — vérifiées (préfixe retraite-docs/ du bucket).
 *
 * À la validation :
 *   · la demande est enregistrée avec un code de suivi « RET-XXXXXX »
 *     remis au demandeur ;
 *   · elle apparaît immédiatement dans l'espace Secrétariat
 *     (/secretariat/retraites) + cloche de notifications ;
 *   · la ou les secrétaires (role SECRETARY) reçoivent un email
 *     best-effort, et le demandeur un accusé de réception s'il a laissé
 *     son adresse.
 *
 * Garde anti-abus (même philosophie que /api/rendez-vous) :
 *   · limite 5 soumissions / 30 min / adresse IP (best-effort) ;
 *   · honeypot « siteWeb » (champ caché, rejet silencieux 201).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* ── Anti-abus best-effort (mémoire d'instance) ── */
const FENETRE_MS = 30 * 60 * 1000; // 30 min
const MAX_PAR_FENETRE = 5;
const compteurs = new Map<string, { n: number; reset: number }>();

function autoriserParIp(ip: string): boolean {
  const maintenant = Date.now();
  const c = compteurs.get(ip);
  if (!c || maintenant > c.reset) {
    compteurs.set(ip, { n: 1, reset: maintenant + FENETRE_MS });
    if (compteurs.size > 512) {
      for (const [cle, val] of compteurs) {
        if (maintenant > val.reset) compteurs.delete(cle);
      }
    }
    return true;
  }
  if (c.n >= MAX_PAR_FENETRE) return false;
  c.n += 1;
  return true;
}

/* ── Code de suivi « RET-XXXXXX » (alphabet sans caractères ambigus) ── */
const ALPHABET_RETRAITE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genererCodeRetraite(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET_RETRAITE[Math.floor(Math.random() * ALPHABET_RETRAITE.length)];
  }
  return `RET-${code}`;
}

async function genererCodeRetraiteUnique(): Promise<string | null> {
  for (let tentative = 0; tentative < 5; tentative++) {
    const code = genererCodeRetraite();
    const existante = await db.retreatRequest.findFirst({
      where: { trackingCode: code },
      select: { id: true },
    });
    if (!existante) return code;
  }
  return null;
}

/* ── Validations locales ── */

function texte(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** L'URL doit pointer vers notre bucket R2 (préfixe retraite-docs/). */
function urlR2Valide(url: string): boolean {
  const attendu = getPublicUrl("retraite-docs/");
  return url.startsWith(attendu) && url.length < 2048;
}

export async function POST(request: NextRequest) {
  try {
    // ── Anti-abus ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "inconnu";
    if (!autoriserParIp(ip)) {
      return NextResponse.json(
        { error: "Trop de soumissions depuis cette adresse. Réessayez plus tard." },
        { status: 429 }
      );
    }

    await ensureStaffSpaces();

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // ── Honeypot : champ caché rempli = robot → rejet silencieux ──
    if (texte(body.siteWeb, 100)) {
      return NextResponse.json({ success: true, codeSuivi: "RET-XXXXXX" }, { status: 201 });
    }

    // ── Champs obligatoires ──
    const firstName = texte(body.firstName, 60);
    const lastName = texte(body.lastName, 60);
    const phone = texte(body.phone, 30);
    const country = texte(body.country, 60);
    const city = texte(body.city, 60);
    const idDocumentUrl = texte(body.idDocumentUrl, 2048);
    const paymentProofUrl = texte(body.paymentProofUrl, 2048);

    if (!firstName || !lastName || !phone || !country || !city) {
      return NextResponse.json(
        { error: "Prénom, nom, téléphone, pays et ville sont obligatoires." },
        { status: 400 }
      );
    }
    if (!idDocumentUrl || !paymentProofUrl) {
      return NextResponse.json(
        {
          error:
            "La photo de la pièce d'identité et la preuve de paiement sont obligatoires.",
        },
        { status: 400 }
      );
    }
    if (!urlR2Valide(idDocumentUrl) || !urlR2Valide(paymentProofUrl)) {
      return NextResponse.json(
        { error: "Pièces jointes invalides. Rechargez-les puis renvoyez le formulaire." },
        { status: 400 }
      );
    }

    // ── Nombre de jours : 1 à 90 ──
    const numberOfDays = Number(body.numberOfDays);
    if (!Number.isInteger(numberOfDays) || numberOfDays < 1 || numberOfDays > 90) {
      return NextResponse.json(
        { error: "Le nombre de jours doit être compris entre 1 et 90." },
        { status: 400 }
      );
    }

    // ── Email facultatif mais valide si présent ──
    const email = texte(body.email, 120).toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "L'adresse email saisie n'est pas valide." },
        { status: 400 }
      );
    }

    // ── Champs facultatifs bornés ──
    const genderRaw = texte(body.gender, 20).toUpperCase();
    const gender =
      genderRaw === "HOMME" || genderRaw === "FEMME" ? genderRaw : "NON_PRECISE";

    let arrivalDate: Date | null = null;
    const arriveeBrute = texte(body.arrivalDate, 40);
    if (arriveeBrute) {
      const d = new Date(arriveeBrute);
      if (!Number.isNaN(d.getTime())) arrivalDate = d;
    }

    const hasBeenBefore = body.hasBeenBefore === true;
    const address = texte(body.address, 200) || null;
    const profession = texte(body.profession, 80) || null;
    const maritalStatus = texte(body.maritalStatus, 40) || null;
    const emergencyContact = texte(body.emergencyContact, 120) || null;
    const expectations = texte(body.expectations, 2000) || null;
    const paymentMethod = texte(body.paymentMethod, 40) || null;
    const source = texte(body.source, 10).toUpperCase() === "MOBILE" ? "MOBILE" : "SITE";

    // ── Code de suivi + enregistrement ──
    const trackingCode = await genererCodeRetraiteUnique();
    if (!trackingCode) {
      return NextResponse.json(
        { error: "Impossible de générer un code de suivi. Réessayez dans un instant." },
        { status: 500 }
      );
    }

    const demande = await db.retreatRequest.create({
      data: {
        trackingCode,
        firstName,
        lastName,
        gender,
        email: email || null,
        phone,
        country,
        city,
        address,
        profession,
        maritalStatus,
        emergencyContact,
        arrivalDate,
        numberOfDays,
        expectations,
        hasBeenBefore,
        idDocumentUrl,
        paymentProofUrl,
        paymentMethod,
        status: "SOUMISE",
        source,
      },
    });

    const nomComplet = `${firstName} ${lastName}`.trim();

    // ── Cloche de l'espace Secrétariat (best-effort, jamais bloquant) ──
    // (Pas d'AuditLog ici : la soumission est anonyme et AuditLog.userId
    // est requis — la demande elle-même constitue la trace. Les actions
    // de la secrétaire sont, elles, journalisées.)
    try {
      await db.staffNotification.create({
        data: {
          espace: "secretariat",
          type: "RETRAITE_SOUMISE",
          titre: `${nomComplet} — retraite spirituelle`,
          message: `Nouvelle demande de ${numberOfDays} jour(s) depuis ${
            source === "MOBILE" ? "l'application mobile" : "le site web"
          } (${country} — ${city}). Pièce d'identité et preuve de paiement à vérifier.`,
          lien: "/secretariat/retraites?statut=SOUMISE",
        },
      });
    } catch (e) {
      console.warn("[api/retreat] notification secrétariat impossible :", e);
    }

    // ── Email aux secrétaires (role SECRETARY — best-effort) ──
    try {
      const secretaires = await db.user.findMany({
        where: { role: "SECRETARY" },
        select: { name: true, email: true },
        take: 5,
      });
      const dateArrivee = arrivalDate
        ? arrivalDate.toLocaleDateString("fr-FR")
        : null;
      for (const s of secretaires) {
        if (!s.email) continue;
        const t = templateRetraiteNotification({
          secretaire: s.name || "Secrétaire",
          demande: {
            nomComplet,
            pays: country,
            ville: city,
            nombreDeJours: numberOfDays,
            trackingCode,
            source,
          },
        });
        await envoyerEmail({
          to: s.email,
          toName: s.name || undefined,
          subject: sujetRetraiteNotification(nomComplet),
          html: t.html,
          text: t.text,
          category: CATEGORIES_EMAIL.RETRAITE_SOUMISE,
        });
      }
    } catch (e) {
      console.warn("[api/retreat] email secrétaire(s) impossible :", e);
    }

    // ── Accusé de réception au demandeur (best-effort) ──
    if (email) {
      try {
        const t = templateRetraiteRecue({
          demande: {
            prenom: firstName,
            nomComplet,
            trackingCode,
            pays: country,
            ville: city,
            nombreDeJours: numberOfDays,
            dateArrivee: arrivalDate
              ? arrivalDate.toLocaleDateString("fr-FR")
              : null,
          },
        });
        await envoyerEmail({
          to: email,
          subject: sujetRetraiteRecue(nomComplet),
          html: t.html,
          text: t.text,
          category: CATEGORIES_EMAIL.RETRAITE_RECUE,
        });
      } catch (e) {
        console.warn("[api/retreat] accusé demandeur impossible :", e);
      }
    }

    return NextResponse.json(
      { success: true, codeSuivi: trackingCode },
      { status: 201 }
    );
  } catch (e) {
    console.error("[api/retreat] POST :", e);
    return NextResponse.json(
      {
        error:
          "L'enregistrement de votre demande a échoué. Réessayez dans un instant ou contactez la secrétaire.",
      },
      { status: 500 }
    );
  }
}
