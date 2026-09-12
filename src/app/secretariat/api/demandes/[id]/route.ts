import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import {
  envoyerEmail,
  resoudreEmailServiteur,
  CATEGORIES_EMAIL,
} from "@/lib/email";
import {
  templateDemandeTransmise,
  sujetDemandeTransmise,
} from "@/lib/email-templates";

/**
 * ⭐ V3.66 — PATCH /secretariat/api/demandes/[id]
 *
 * Cycle de vie de la demande de rencontre (cœur du rôle de la secrétaire) :
 *
 *   action = "transmettre" — la secrétaire transmet la demande au serviteur
 *                            de Dieu (statut RECUE → TRANSMISE) avec une
 *                            note éventuelle (contexte, priorité).
 *                            ⭐ V3.69 : le serviteur reçoit AUSSI un email
 *                            automatique (noreply@… — détails + note) ;
 *                            l'échec éventuel de l'email n'annule pas la
 *                            transmission (best-effort, signalé en réponse).
 *                            ⭐ V3.74 : la demande atterrit EN PLUS dans le
 *                            back-office du serviteur (/admin/demandes) —
 *                            il la réceptionne et la VALIDE de là.
 *   action = "traiter"     — réponse donnée / rendez-vous accordé
 *                            (TRANSMISE ou VALIDEE → TRAITEE).
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
        // ⭐ V3.74 — une demande VALIDEE (par le serviteur) peut être
        // marquée traitée, comme une simple TRANSMISE.
        if (demande.status !== "TRANSMISE" && demande.status !== "VALIDEE") {
          return NextResponse.json(
            { error: "Seule une demande « Transmise » ou « Validée » peut être marquée traitée." },
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
          // ⭐ V3.74 — la validation du serviteur est aussi réinitialisée.
          validatedAt: null,
          validatedById: null,
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
          } as never,
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/demandes] AuditLog impossible :", e);
    }

    // ⭐ V3.69 — Courriel automatique au serviteur destinataire lors de la
    // transmission (directive : « envoyer des mails au pasteur depuis le
    // secrétariat ») : Pasteur Kongo / Sœur Pam reçoivent la demande dans
    // leur boîte mail, avec la note de la secrétaire. Best-effort : un échec
    // d'envoi n'annule PAS la transmission — il est signalé dans la réponse
    // pour que la secrétaire puisse prévenir autrement.
    let courriel: { envoye: boolean; erreur?: string } | undefined;
    if (action === "transmettre") {
      try {
        const serviteur = await resoudreEmailServiteur(demande.servantCode);
        const actrice = await db.user.findUnique({
          where: { id: acteurId },
          select: { name: true, email: true },
        });
        const { html, text } = templateDemandeTransmise({
          destinataire: serviteur.nom,
          serviteurLibelle: serviteur.nom,
          secretaire: actrice?.name || "le secrétariat",
          demande: {
            requesterName: demande.requesterName,
            contact: demande.contact,
            subject: demande.subject,
            message: demande.message,
            urgency: demande.urgency,
            country: demande.country,
            city: demande.city,
            trackingCode: modifiee.trackingCode ?? demande.trackingCode,
          },
          noteTransmission:
            (modifiee.transmissionNote as string | null) ??
            demande.transmissionNote ??
            null,
        });
        const resultat = await envoyerEmail({
          to: serviteur.email,
          toName: serviteur.nom,
          subject: sujetDemandeTransmise(demande.requesterName),
          html,
          text,
          replyTo: actrice?.email ?? null,
          category: CATEGORIES_EMAIL.DEMANDE_TRANSMISE,
          sentById: acteurId,
        });
        courriel = resultat.ok
          ? { envoye: true }
          : { envoye: false, erreur: resultat.erreur };
      } catch (e) {
        console.warn(
          "[secretariat/api/demandes] Courriel de transmission impossible :",
          e
        );
        courriel = { envoye: false, erreur: "préparation du courrier impossible" };
      }
    }

    return NextResponse.json({
      item: modifiee,
      ...(courriel ? { courriel } : {}),
    });
  } catch (error) {
    console.error("[secretariat/api/demandes/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la demande" },
      { status: 500 }
    );
  }
}
