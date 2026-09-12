import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces, ensureEmailTables } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import {
  envoyerEmail,
  listerServiteursDestinataires,
  CATEGORIES_EMAIL,
} from "@/lib/email";
import {
  templateCourrier,
  templateTest,
  sujetCourrier,
} from "@/lib/email-templates";

/**
 * ⭐ V3.69 — Courrier du secrétariat aux serviteurs de Dieu.
 *
 *   GET  /secretariat/api/courrier — destinataires (SUPER_ADMIN : Pam,
 *        Pasteur Kongo) + historique des courriers envoyés.
 *   POST /secretariat/api/courrier
 *        · { toUserId, sujet, message } — envoie un courriel au serviteur
 *          choisi (Reply-To = email de la secrétaire : la réponse lui
 *          revient directement) ;
 *        · { action: "test" } — email de test à sa propre adresse, pour
 *          vérifier la configuration Resend (noreply@…).
 *
 * Chaque envoi est consigné dans OutgoingEmail + AuditLog (gouvernance).
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();
    await ensureEmailTables();

    const destinataires = await listerServiteursDestinataires();

    const historique = await db.outgoingEmail.findMany({
      where: { category: CATEGORIES_EMAIL.COURRIER_SERVITEUR },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        toEmail: true,
        toName: true,
        subject: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ destinataires, historique });
  } catch (error) {
    console.error("[secretariat/api/courrier] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du courrier" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;
  const { userId: auteurId } = garde.session;

  try {
    await ensureStaffSpaces();
    await ensureEmailTables();

    const body = await request.json().catch(() => ({}));
    const { toUserId, sujet, message, action } = body as {
      toUserId?: string;
      sujet?: string;
      message?: string;
      action?: string;
    };

    // L'expéditrice (secrétaire connectée) — son email sert de Reply-To.
    const expeditrice = await db.user.findUnique({
      where: { id: auteurId },
      select: { id: true, name: true, email: true },
    });
    if (!expeditrice?.email) {
      return NextResponse.json(
        { error: "Votre compte n'a pas d'email — impossible de définir une adresse de réponse." },
        { status: 400 }
      );
    }

    // ── Mode « test » : email de vérification à soi-même. ────────────
    if (action === "test") {
      const { html, text } = templateTest();
      const resultat = await envoyerEmail({
        to: expeditrice.email,
        toName: expeditrice.name,
        subject: "Email de test — Christ Libère (configuration Resend)",
        html,
        text,
        category: CATEGORIES_EMAIL.TEST,
        sentById: auteurId,
      });
      if (!resultat.ok) {
        return NextResponse.json(
          { error: `Le test a échoué : ${resultat.erreur}` },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Email de test envoyé à ${expeditrice.email} — vérifiez votre boîte de réception (et vos indésirables).`,
      });
    }

    // ── Courrier au serviteur. ───────────────────────────────────────
    if (!toUserId || !sujet?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Destinataire, sujet et message sont requis." },
        { status: 400 }
      );
    }
    if (sujet.trim().length < 3 || sujet.trim().length > 150) {
      return NextResponse.json(
        { error: "Le sujet doit contenir entre 3 et 150 caractères." },
        { status: 400 }
      );
    }
    if (message.trim().length < 10 || message.trim().length > 5000) {
      return NextResponse.json(
        { error: "Le message doit contenir entre 10 et 5000 caractères." },
        { status: 400 }
      );
    }

    const destinataire = await db.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!destinataire?.email || destinataire.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Destinataire invalide — seuls les serviteurs de Dieu (super admins) peuvent recevoir un courrier." },
        { status: 400 }
      );
    }

    const sujetPropre = sujet.trim();
    const messagePropre = message.trim();

    const { html, text } = templateCourrier({
      destinataire: destinataire.name || "Serviteur de Dieu",
      expeditrice: expeditrice.name || "Secrétariat",
      sujet: sujetPropre,
      message: messagePropre,
    });

    const resultat = await envoyerEmail({
      to: destinataire.email,
      toName: destinataire.name,
      subject: sujetCourrier(sujetPropre),
      html,
      text,
      replyTo: expeditrice.email,
      category: CATEGORIES_EMAIL.COURRIER_SERVITEUR,
      sentById: auteurId,
    });

    // Journal d'audit (gouvernance) — même en cas d'échec d'envoi.
    try {
      await db.auditLog.create({
        data: {
          action: "COURRIER_SERVITEUR",
          userId: auteurId,
          targetId: destinataire.id,
          metadata: {
            destinataire: destinataire.email,
            sujet: sujetPropre,
            statut: resultat.ok ? "ENVOYE" : "ECHOUE",
          } as never,
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/courrier] AuditLog impossible :", e);
    }

    if (!resultat.ok) {
      return NextResponse.json(
        {
          error: `Le courrier n'a pas pu être envoyé à ${destinataire.email} (${resultat.erreur}).`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Courrier envoyé à ${destinataire.name} (${destinataire.email}) — il pourra vous répondre directement par email.`,
    });
  } catch (error) {
    console.error("[secretariat/api/courrier] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du courrier" },
      { status: 500 }
    );
  }
}
