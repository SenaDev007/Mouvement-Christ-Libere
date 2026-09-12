import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — PATCH /secretariat/api/demandes/[id]
 *
 * Cycle de vie de la demande de rencontre (cœur du rôle de la secrétaire) :
 *
 *   action = "transmettre" — la secrétaire transmet la demande au serviteur
 *                            de Dieu (statut RECUE → TRANSMISE) avec une
 *                            note éventuelle (contexte, priorité).
 *   action = "traiter"     — réponse donnée / rendez-vous accordé
 *                            (TRANSMISE → TRAITEE). Le serviteur lui-même
 *                            peut le faire (il a accès à l'espace).
 *   action = "archiver"    — sortie du registre actif sans traitement.
 *   action = "rouvrir"     — retour à l'état « Reçue » (erreur de saisie…).
 *
 * Toute action est journalisée dans AuditLog (qui, quoi, quand).
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["transmettre", "traiter", "archiver", "rouvrir"] as const;

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
    const body = await request.json();
    const { action, transmissionNote } = body as {
      action?: string;
      transmissionNote?: string;
    };

    if (!action || !(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json(
        { error: `Action invalide (${ACTIONS.join(" | ")})` },
        { status: 400 }
      );
    }

    const demande = await db.meetingRequest.findUnique({ where: { id } });
    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    // Transitions autorisées (le cycle reste lisible dans le registre).
    const maintenant = new Date();
    let data: Record<string, unknown>;
    switch (action) {
      case "transmettre":
        if (demande.status !== "RECUE") {
          return NextResponse.json(
            { error: "Seule une demande « Reçue » peut être transmise." },
            { status: 409 }
          );
        }
        data = {
          status: "TRANSMISE",
          transmittedAt: maintenant,
          handledById: acteurId,
          transmissionNote:
            transmissionNote?.trim()?.substring(0, 3000) ?? demande.transmissionNote,
        };
        break;
      case "traiter":
        if (demande.status !== "TRANSMISE") {
          return NextResponse.json(
            { error: "Seule une demande « Transmise » peut être marquée traitée." },
            { status: 409 }
          );
        }
        data = {
          status: "TRAITEE",
          processedAt: maintenant,
          handledById: acteurId,
        };
        break;
      case "archiver":
        if (demande.status === "TRAITEE") {
          return NextResponse.json(
            { error: "Une demande traitée est déjà close — aucune archive nécessaire." },
            { status: 409 }
          );
        }
        data = { status: "ARCHIVEE", handledById: acteurId };
        break;
      default: // "rouvrir"
        data = {
          status: "RECUE",
          transmittedAt: null,
          processedAt: null,
          handledById: acteurId,
        };
        break;
    }

    const modifiee = await db.meetingRequest.update({
      where: { id },
      data: data as never,
    });

    // Journal d'audit — traçabilité des mains par lesquelles passe la demande.
    try {
      await db.auditLog.create({
        data: {
          action: `DEMANDE_${action.toUpperCase()}`,
          userId: acteurId,
          targetId: id,
          metadata: {
            demandeur: demande.requesterName,
            serviteur: demande.servantCode,
            statutPrecedent: demande.status,
            statut: modifiee.status,
          },
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/demandes] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: modifiee });
  } catch (error) {
    console.error("[secretariat/api/demandes/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la demande" },
      { status: 500 }
    );
  }
}
