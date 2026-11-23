/**
 * GET /admin/api/tiktok/accounts — liste des comptes TikTok liés.
 * POST /admin/api/tiktok/accounts — crée un nouveau lien TikTok.
 *   Body : { servantCode: string, username: string, displayName?: string }
 *
 * ⭐ V4.26 — Pas de flux OAuth (TikTok n'expose pas d'API read publique) :
 * l'admin saisit directement le username TikTok du serviteur. La synchro
 * se fait par scraping du feed public via tikwm.com.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    const comptes = await db.tiktokAccount.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        servant: { select: { id: true, code: true, shortName: true, fullName: true } },
      },
    });

    return NextResponse.json({
      comptes: comptes.map((c) => ({
        id: c.id,
        servantId: c.servantId,
        servantCode: c.servant?.code || null,
        servantShortName: c.servant?.shortName || null,
        servantFullName: c.servant?.fullName || null,
        username: c.username,
        displayName: c.displayName,
        actif: c.actif,
        dernierSyncAt: c.dernierSyncAt?.toISOString() || null,
        derniereErreur: c.derniereErreur,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[admin/tiktok/accounts GET] Erreur :", err);
    return NextResponse.json({ error: "Erreur lecture comptes" }, { status: 500 });
  }
}

// ─── POST : créer un lien ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { servantCode?: string; username?: string; displayName?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const servantCode = body.servantCode?.trim();
  const username = body.username?.trim().replace(/^@+/, "").replace(/\s+/g, "");
  const displayName = body.displayName?.trim() || null;

  if (!servantCode) {
    return NextResponse.json({ error: "servantCode requis" }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json({ error: "username TikTok requis" }, { status: 400 });
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

    // Un compte TikTok par serviteur (contrainte @unique servantId).
    const existant = await db.tiktokAccount.findUnique({
      where: { servantId: servant.id },
    });
    if (existant) {
      return NextResponse.json(
        {
          error: `Un compte TikTok est déjà lié au serviteur ${servant.shortName}. Supprimez-le d'abord ou modifiez le username ci-dessous.`,
        },
        { status: 409 }
      );
    }

    const compte = await db.tiktokAccount.create({
      data: {
        servantId: servant.id,
        username,
        displayName,
        actif: true,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, compteId: compte.id });
  } catch (err) {
    console.error("[admin/tiktok/accounts POST] Erreur :", err);
    return NextResponse.json({ error: "Erreur création compte" }, { status: 500 });
  }
}
