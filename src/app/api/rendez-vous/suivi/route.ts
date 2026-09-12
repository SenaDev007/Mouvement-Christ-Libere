import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { SERVITEURS_RENDEZ_VOUS, DEMANDE_STATUTS } from "@/lib/staff-space/constants";

/**
 * ⭐ V3.67 — GET /api/rendez-vous/suivi?code=MCL-XXXXXX (PUBLIC).
 *
 * Suivi d'une demande de rencontre par son code remis au dépôt :
 *  · statut courant + dates clés (dépôt, transmission, traitement) ;
 *  · serviteur demandé ;
 *  · AUCUN contenu (message, contact, nom) : le code ne donne accès
 *    qu'à l'AVANCEMENT — confidentialité du demandeur.
 *
 * Garde-fous : rate-limit mémoire (20 consultations / 10 min / IP).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 20;
const consultations = new Map<string, number[]>();

function ipAutorisee(ip: string): boolean {
  const maintenant = Date.now();
  const historique = (consultations.get(ip) || []).filter(
    (t) => maintenant - t < FENETRE_MS
  );
  if (historique.length >= MAX_PAR_FENETRE) return false;
  historique.push(maintenant);
  consultations.set(ip, historique);
  if (consultations.size > 5000) {
    for (const [cle, vals] of consultations) {
      if (vals.every((t) => maintenant - t >= FENETRE_MS)) {
        consultations.delete(cle);
      }
    }
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "inconnu";

    if (!ipAutorisee(ip)) {
      return NextResponse.json(
        { error: "Trop de consultations — réessayez dans quelques minutes." },
        { status: 429 }
      );
    }

    const url = new URL(request.url);
    const code = (url.searchParams.get("code") || "").trim().toUpperCase();

    if (!/^MCL-[A-Z2-9]{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Code de suivi invalide (format attendu : MCL-XXXXXX)." },
        { status: 400 }
      );
    }

    await ensureStaffSpaces();

    const demande = await db.meetingRequest.findFirst({
      where: { trackingCode: code },
      select: {
        status: true,
        servantCode: true,
        createdAt: true,
        transmittedAt: true,
        validatedAt: true,
        processedAt: true,
      },
    });

    if (!demande) {
      return NextResponse.json(
        { error: "Aucune demande ne correspond à ce code de suivi." },
        { status: 404 }
      );
    }

    const serviteur =
      SERVITEURS_RENDEZ_VOUS[
        demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS
      ];

    return NextResponse.json({
      statut: demande.status,
      statutLibelle:
        DEMANDE_STATUTS[demande.status as keyof typeof DEMANDE_STATUTS]?.libelle ||
        demande.status,
      serviteur: serviteur?.libelle || null,
      deposeeLe: demande.createdAt,
      transmiseLe: demande.transmittedAt,
      // ⭐ V3.74 — validation par le serviteur (étape du suivi public).
      valideeLe: demande.validatedAt,
      traiteeLe: demande.processedAt,
    });
  } catch (error) {
    console.error("[api/rendez-vous/suivi] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la consultation. Réessayez." },
      { status: 500 }
    );
  }
}
