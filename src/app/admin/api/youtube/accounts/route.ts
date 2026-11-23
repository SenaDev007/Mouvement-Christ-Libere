/**
 * GET /admin/api/youtube/accounts
 *   Liste tous les comptes YouTube liés (avec le serviteur associé).
 *   ⭐ V4.26 — multi-comptes : Afrika + Pasteur Kongo chacun avec sa chaîne.
 *
 * POST /admin/api/youtube/accounts
 *   Body : { servantCode: string }
 *   Vérifie qu'un serviteur existe et qu'il n'a pas déjà de compte YouTube
 *   lié, puis retourne l'URL de démarrage du flux OAuth pour ce serviteur.
 *   La callback /api/youtube/oauth/callback fera l'upsert réel (chiffrement
 *   des credentials).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Garde d'authentification commune (cookie session admin). */
async function authentifier(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

// ─── GET : liste des comptes ──────────────────────────────────────────────

export async function GET() {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const comptes = await db.youtubeAccount.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        servant: {
          select: { id: true, code: true, shortName: true, fullName: true },
        },
      },
    });

    // On ne retourne jamais les credentials chiffrés vers le client.
    return NextResponse.json({
      comptes: comptes.map((c) => ({
        id: c.id,
        servantId: c.servantId,
        servantCode: c.servant?.code || null,
        servantShortName: c.servant?.shortName || null,
        servantFullName: c.servant?.fullName || null,
        channelId: c.channelId,
        channelTitle: c.channelTitle,
        clientId: c.clientId,
        actif: c.actif,
        dernierSyncAt: c.dernierSyncAt?.toISOString() || null,
        derniereErreur: c.derniereErreur,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[admin/youtube/accounts GET] Erreur :", err);
    return NextResponse.json({ error: "Erreur lecture comptes" }, { status: 500 });
  }
}

// ─── POST : vérifier le serviteur et retourner l'URL OAuth ────────────────

export async function POST(request: NextRequest) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { servantCode?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const servantCode = body.servantCode?.trim();
  if (!servantCode) {
    return NextResponse.json({ error: "servantCode requis" }, { status: 400 });
  }

  try {
    const servant = await db.servant.findFirst({
      where: { code: { equals: servantCode, mode: "insensitive" } },
      select: { id: true, code: true, shortName: true },
    });
    if (!servant) {
      return NextResponse.json(
        { error: `Serviteur « ${servantCode} » introuvable en base.` },
        { status: 404 }
      );
    }

    // Existe-t-il déjà un compte pour ce serviteur ?
    const existant = await db.youtubeAccount.findUnique({
      where: { servantId: servant.id },
    });
    if (existant) {
      return NextResponse.json(
        {
          error: `Un compte YouTube est déjà lié au serviteur ${servant.shortName}. Utilisez le bouton « Relancer l'autorisation » pour le mettre à jour.`,
          compteId: existant.id,
          oauthStartUrl: `/api/youtube/oauth/start?servant=${encodeURIComponent(servant.code)}`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Prêt à lier un compte YouTube pour ${servant.shortName}. L'utilisateur va être redirigé vers Google.`,
      servantCode: servant.code,
      oauthStartUrl: `/api/youtube/oauth/start?servant=${encodeURIComponent(servant.code)}`,
    });
  } catch (err) {
    console.error("[admin/youtube/accounts POST] Erreur :", err);
    return NextResponse.json({ error: "Erreur création compte" }, { status: 500 });
  }
}
