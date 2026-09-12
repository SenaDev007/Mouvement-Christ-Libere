import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { SERVITEUR_CODES, DEMANDE_URGENCE_VALEURS } from "@/lib/staff-space/constants";
import { genererCodeSuiviUnique } from "@/lib/staff-space/multicaisse";

/**
 * ⭐ V3.66 — POST /api/rendez-vous (PUBLIC — sans authentification).
 *
 * Entrée publique du secrétariat : « quand quelqu'un veut rencontrer le
 * pasteur Congo ou la sœur Pam, c'est par le secrétaire ». La demande
 * atterrit directement dans le registre du secrétariat
 * (secretariat.mouvementchristlibere.com → Demandes) au statut RECUE.
 *
 * Garde-fous :
 *  · validation stricte des champs + longueurs bornées ;
 *  · rate-limit mémoire (10 demandes / 10 min / IP) contre le spam ;
 *  · honeypot anti-robots (champ « site » caché — rempli = rejet silencieux).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Rate limit mémoire (même pattern simple que les routes publiques) ──
const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 10;
const soumissions = new Map<string, number[]>();

function ipAutorisee(ip: string): boolean {
  const maintenant = Date.now();
  const historique = (soumissions.get(ip) || []).filter(
    (t) => maintenant - t < FENETRE_MS
  );
  if (historique.length >= MAX_PAR_FENETRE) return false;
  historique.push(maintenant);
  soumissions.set(ip, historique);
  // Nettoyage opportuniste (pas de fuite mémoire infinie).
  if (soumissions.size > 5000) {
    for (const [cle, vals] of soumissions) {
      if (vals.every((t) => maintenant - t >= FENETRE_MS)) {
        soumissions.delete(cle);
      }
    }
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "inconnu";

    if (!ipAutorisee(ip)) {
      return NextResponse.json(
        { error: "Trop de demandes — réessayez dans quelques minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      requesterName,
      contact,
      servantCode,
      subject,
      message,
      urgency,
      country,
      city,
      site,
    } = body as {
      requesterName?: string;
      contact?: string;
      servantCode?: string;
      subject?: string;
      message?: string;
      urgency?: string;
      country?: string;
      city?: string;
      site?: string;
    };

    // Honeypot : les robots remplissent le champ caché.
    if (site && site.trim().length > 0) {
      return NextResponse.json({ success: true }, { status: 201 });
    }

    if (
      !requesterName?.trim() ||
      !contact?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return NextResponse.json(
        { error: "Nom, contact, objet et message sont requis." },
        { status: 400 }
      );
    }

    if (requesterName.trim().length > 120) {
      return NextResponse.json(
        { error: "Le nom est trop long." },
        { status: 400 }
      );
    }
    if (contact.trim().length > 160) {
      return NextResponse.json(
        { error: "Le contact est trop long." },
        { status: 400 }
      );
    }
    if (message.trim().length > 5000) {
      return NextResponse.json(
        { error: "Le message est trop long (5000 caractères maximum)." },
        { status: 400 }
      );
    }

    if (!servantCode || !SERVITEUR_CODES.includes(servantCode)) {
      return NextResponse.json(
        { error: "Serviteur de Dieu demandé invalide." },
        { status: 400 }
      );
    }

    const urgenceFinale =
      urgency && DEMANDE_URGENCE_VALEURS.includes(urgency) ? urgency : "normale";

    // Tables du secrétariat (première demande après déploiement).
    await ensureStaffSpaces();

    // ⭐ V3.67 — code de suivi : la demanderesse ou le demandeur consulte
    // l'avancement sur /rendez-vous/suivi (statut + dates, jamais le contenu).
    const codeSuivi = await genererCodeSuiviUnique();

    const demande = await db.meetingRequest.create({
      data: {
        requesterName: requesterName.trim(),
        contact: contact.trim(),
        servantCode,
        subject: subject.trim().substring(0, 200),
        message: message.trim(),
        urgency: urgenceFinale,
        country: country?.trim()?.substring(0, 60) || null,
        city: city?.trim()?.substring(0, 60) || null,
        status: "RECUE",
        // ⭐ V3.74 — origine SITE : la demande arrive PRÉ-REMPLIE dans le
        // flux de la secrétaire (toutes les infos déjà renseignées) —
        // elle suit le flux et transmet SANS ré-éditer ; la ré-édition
        // (modal de saisie) reste réservée aux demandes en présentiel.
        source: "SITE",
        trackingCode: codeSuivi,
      },
      select: { id: true },
    });

    return NextResponse.json(
      {
        success: true,
        codeSuivi,
        message:
          "Votre demande a bien été reçue par le secrétariat du Mouvement Christ Libère. La secrétaire l'examinera et la transmettra au serviteur de Dieu concerné.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/rendez-vous] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de votre demande. Réessayez." },
      { status: 500 }
    );
  }
}
