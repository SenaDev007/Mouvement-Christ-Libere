import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession, resoudreCodeServiteur } from "@/lib/staff-space/session";
import {
  envoyerEmail,
  CATEGORIES_EMAIL,
} from "@/lib/email";
import {
  templateDemandeValidee,
  sujetDemandeValidee,
} from "@/lib/email-templates";
import {
  SERVITEURS_RENDEZ_VOUS,
} from "@/lib/staff-space/constants";

/**
 * ⭐ V3.74 — PATCH /admin/api/demandes/[id] — Validation d'une demande
 * par le serviteur de Dieu, DEPUIS son back-office (page /admin/demandes).
 *
 *   action = "valider" — le serviteur confirme la réception/acceptation de
 *                        la demande (TRANSMISE → VALIDEE) :
 *                        · la SECRÉTAIRE reçoit une NOTIFICATION (cloche de
 *                          l'espace Secrétariat — StaffNotification) ;
 *                        · elle reçoit AUSSI un email de notification
 *                          (best-effort, n'annule pas la validation) ;
 *                        · le demandeur voit « Validée par le serviteur »
 *                          sur /rendez-vous/suivi.
 *   action = "traiter"  — réponse donnée / rendez-vous accordé
 *                         (TRANSMISE | VALIDEE → TRAITEE).
 *
 * Toute action est journalisée dans AuditLog (traçabilité).
 * ⚠️ Rôles : SUPER_ADMIN (les deux serviteurs de Dieu).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["valider", "traiter"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;
  const { userId: serviteurId } = garde.session;

  try {
    await ensureStaffSpaces();

    const { id } = await params;
    const body = await request.json();
    const { action } = body as { action?: string };

    if (!action || !(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json(
        { error: `Action invalide (${ACTIONS.join(" | ")})` },
        { status: 400 }
      );
    }

    const demande = await db.meetingRequest.findUnique({ where: { id } });
    if (!demande) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }

    // Le serviteur n'agit que sur les demandes qui lui sont destinées
    // (un compte non rattaché — secours — peut agir sur tout).
    const monCode = await resoudreCodeServiteur(serviteurId);
    if (monCode && demande.servantCode !== monCode) {
      return NextResponse.json(
        {
          error: `Cette demande est destinée à ${
            SERVITEURS_RENDEZ_VOUS[
              demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS
            ]?.libelle ?? demande.servantCode
          } — pas à votre compte.`,
        },
        { status: 403 }
      );
    }

    const maintenant = new Date();

    if (action === "valider") {
      if (demande.status !== "TRANSMISE") {
        return NextResponse.json(
          {
            error: "Seule une demande « Transmise » (non encore validée) peut être validée.",
          },
          { status: 409 }
        );
      }

      const modifiee = await db.meetingRequest.update({
        where: { id },
        data: {
          status: "VALIDEE",
          validatedAt: maintenant,
          validatedById: serviteurId,
        },
      });

      // Journal d'audit — traçabilité de la validation.
      try {
        await db.auditLog.create({
          data: {
            action: "DEMANDE_VALIDEE",
            userId: serviteurId,
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
        console.warn("[admin/api/demandes] AuditLog impossible :", e);
      }

      // ⭐ NOTIFICATION in-app de la secrétaire (cloche Secrétariat) —
      // le cœur de la directive : « quand il valide, la secrétaire reçoit
      // une notification ». Best-effort : un échec d'insertion n'annule
      // pas la validation.
      try {
        await db.staffNotification.create({
          data: {
            espace: "secretariat",
            type: "DEMANDE_VALIDEE",
            titre: `${demande.requesterName} — demande validée`,
            message: `${
              SERVITEURS_RENDEZ_VOUS[
                demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS
              ]?.libelle ?? "Le serviteur"
            } a validé la demande « ${demande.subject} »${demande.trackingCode ? ` (${demande.trackingCode})` : ""}. Elle peut être marquée traitée.`,
            lien: "/secretariat/demandes?statut=VALIDEE",
          },
        });
      } catch (e) {
        console.warn(
          "[admin/api/demandes] StaffNotification impossible :",
          e
        );
      }

      // ⭐ Email de notification aux secrétaires (best-effort).
      let courriel: { envoye: boolean; erreur?: string } | undefined;
      try {
        const serviteur = await db.user.findUnique({
          where: { id: serviteurId },
          select: { name: true },
        });
        const nomServiteur =
          SERVITEURS_RENDEZ_VOUS[
            demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS
          ]?.libelle ||
          serviteur?.name ||
          "le serviteur de Dieu";
        const secretaires = await db.user.findMany({
          where: { role: "SECRETARY" },
          select: { name: true, email: true },
          take: 5,
        });
        const { html, text } = templateDemandeValidee({
          secretaire: secretaires[0]?.name || "Secrétariat",
          serviteur: nomServiteur,
          demande: {
            requesterName: demande.requesterName,
            subject: demande.subject,
            trackingCode: demande.trackingCode,
          },
        });
        let auMoinsUn = false;
        let derniereErreur: string | undefined;
        for (const s of secretaires) {
          const resultat = await envoyerEmail({
            to: s.email,
            toName: s.name,
            subject: sujetDemandeValidee(demande.requesterName),
            html,
            text,
            category: CATEGORIES_EMAIL.DEMANDE_VALIDEE,
            sentById: serviteurId,
          });
          if (resultat.ok) auMoinsUn = true;
          else derniereErreur = resultat.erreur;
        }
        courriel =
          secretaires.length === 0
            ? undefined
            : { envoye: auMoinsUn, erreur: auMoinsUn ? undefined : derniereErreur };
      } catch (e) {
        console.warn(
          "[admin/api/demandes] Email de notification impossible :",
          e
        );
        courriel = { envoye: false, erreur: "préparation impossible" };
      }

      return NextResponse.json({ item: modifiee, ...(courriel ? { courriel } : {}) });
    }

    // action === "traiter"
    if (demande.status !== "TRANSMISE" && demande.status !== "VALIDEE") {
      return NextResponse.json(
        {
          error:
            "Seule une demande « Transmise » ou « Validée » peut être marquée traitée.",
        },
        { status: 409 }
      );
    }

    const modifiee = await db.meetingRequest.update({
      where: { id },
      data: {
        status: "TRAITEE",
        processedAt: maintenant,
        handledById: serviteurId,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          action: "DEMANDE_TRAITEE",
          userId: serviteurId,
          targetId: id,
          metadata: {
            demandeur: demande.requesterName,
            serviteur: demande.servantCode,
            statutPrecedent: demande.status,
            statut: modifiee.status,
            source: "back-office serviteur",
          } as never,
        },
      });
    } catch (e) {
      console.warn("[admin/api/demandes] AuditLog impossible :", e);
    }

    return NextResponse.json({ item: modifiee });
  } catch (error) {
    console.error("[admin/api/demandes/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la demande" },
      { status: 500 }
    );
  }
}
