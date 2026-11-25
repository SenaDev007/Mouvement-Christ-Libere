import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import { envoyerEmail, CATEGORIES_EMAIL } from "@/lib/email";
import {
  templateRetraiteDecision,
  sujetRetraiteDecision,
} from "@/lib/email-templates";

/**
 * ⭐ V4.43 — PATCH /secretariat/api/retraites/[id] — Traitement d'une
 * demande de retraite spirituelle par la secrétaire.
 *
 *   action = "examiner"  — la secrétaire ouvre le dossier
 *                          (SOUMISE → EN_EXAMEN) ;
 *   action = "accepter"  — le séjour est accordé
 *                          (SOUMISE | EN_EXAMEN → ACCEPTEE) : le demandeur
 *                          est contacté par la secrétaire pour préparer
 *                          l'arrivée (email best-effort s'il a laissé
 *                          son adresse) ;
 *   action = "rejeter"   — la demande n'est pas acceptée en l'état
 *                          (SOUMISE | EN_EXAMEN → REJETEE) — un motif de
 *                          précision est vivement recommandé ;
 *   action = "rouvrir"   — réexaminer une demande déjà tranchée
 *                          (ACCEPTEE | REJETEE → EN_EXAMEN).
 *
 * Toute action est journalisée dans AuditLog (traçabilité). Les emails
 * sont best-effort : leur échec n'annule jamais la décision.
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ACTIONS = ["examiner", "accepter", "rejeter", "rouvrir"] as const;

/** Transitions autorisées par action (sinon → 409). */
const TRANSITIONS: Record<(typeof ACTIONS)[number], string[]> = {
  examiner: ["SOUMISE"],
  accepter: ["SOUMISE", "EN_EXAMEN"],
  rejeter: ["SOUMISE", "EN_EXAMEN"],
  rouvrir: ["ACCEPTEE", "REJETEE"],
};

const STATUT_APRES: Record<(typeof ACTIONS)[number], string> = {
  examiner: "EN_EXAMEN",
  accepter: "ACCEPTEE",
  rejeter: "REJETEE",
  rouvrir: "EN_EXAMEN",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;
  const { userId: acteurId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const action = String(body?.action || "").trim() as (typeof ACTIONS)[number];
    const raison = typeof body?.decisionReason === "string" ? body.decisionReason.trim().slice(0, 1000) : "";
    const note = typeof body?.secretaryNote === "string" ? body.secretaryNote.trim().slice(0, 2000) : "";

    if (!(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    const demande = await db.retreatRequest.findUnique({ where: { id } });
    if (!demande) {
      return NextResponse.json(
        { error: "Demande de retraite introuvable." },
        { status: 404 }
      );
    }
    if (!TRANSITIONS[action].includes(demande.status)) {
      return NextResponse.json(
        {
          error: `Transition impossible : la demande est au statut « ${demande.status} ».`,
        },
        { status: 409 }
      );
    }

    const statutPrecedent = demande.status;
    const statut = STATUT_APRES[action];
    const decise = action === "accepter" || action === "rejeter";

    const misAJour = await db.retreatRequest.update({
      where: { id },
      data: {
        status: statut,
        ...(raison ? { decisionReason: raison } : {}),
        ...(note ? { secretaryNote: note } : {}),
        ...(decise ? { processedAt: new Date(), handledById: acteurId } : {}),
      },
    });

    // ── Journal d'audit (best-effort, jamais bloquant) ──
    try {
      await db.auditLog.create({
        data: {
          action: `RETRAITE_${action.toUpperCase()}`,
          userId: acteurId,
          targetId: id,
          metadata: {
            demandeur: `${demande.firstName} ${demande.lastName}`,
            codeSuivi: demande.trackingCode,
            statutPrecedent,
            statut,
          } as never,
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/retraites] audit impossible :", e);
    }

    // ── Décision communiquée au demandeur (email best-effort) ──
    let courriel: { envoye: boolean; erreur?: string } | null = null;
    if (decise && demande.email) {
      try {
        const actrice = await db.user.findUnique({
          where: { id: acteurId },
          select: { email: true, name: true },
        });
        const t = templateRetraiteDecision({
          demande: {
            prenom: demande.firstName,
            nomComplet: `${demande.firstName} ${demande.lastName}`,
            trackingCode: demande.trackingCode,
          },
          acceptee: action === "accepter",
          raison: raison || null,
        });
        const resultat = await envoyerEmail({
          to: demande.email,
          subject: sujetRetraiteDecision(
            `${demande.firstName} ${demande.lastName}`,
            action === "accepter"
          ),
          html: t.html,
          text: t.text,
          category: CATEGORIES_EMAIL.RETRAITE_DECISION,
          replyTo: actrice?.email || undefined,
          sentById: acteurId,
        });
        courriel = { envoye: resultat.ok, erreur: resultat.erreur };
      } catch (e) {
        courriel = {
          envoye: false,
          erreur: e instanceof Error ? e.message : "Erreur inconnue",
        };
      }
    }

    return NextResponse.json({
      success: true,
      statut: misAJour.status,
      courriel,
    });
  } catch (error) {
    console.error("[secretariat/api/retraites] PATCH :", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de la demande." },
      { status: 500 }
    );
  }
}
