/**
 * PATCH /admin/api/tiktok/accounts/<id> — met à jour username, displayName ou actif.
 *   Body : { username?: string, displayName?: string | null, actif?: boolean }
 * DELETE /admin/api/tiktok/accounts/<id> — supprime le lien TikTok.
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

// ─── PATCH ────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  let body: { username?: string; displayName?: string | null; actif?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const data: {
    username?: string;
    displayName?: string | null;
    actif?: boolean;
  } = {};

  if (typeof body.username === "string") {
    const cleaned = body.username.trim().replace(/^@+/, "").replace(/\s+/g, "");
    if (!cleaned) {
      return NextResponse.json({ error: "username ne peut pas être vide" }, { status: 400 });
    }
    data.username = cleaned;
  }

  if (body.displayName === null || typeof body.displayName === "string") {
    data.displayName = body.displayName?.trim() || null;
  }

  if (typeof body.actif === "boolean") {
    data.actif = body.actif;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  try {
    const compte = await db.tiktokAccount.update({
      where: { id },
      data,
      select: { id: true, username: true, displayName: true, actif: true },
    });
    return NextResponse.json(compte);
  } catch (err) {
    console.error("[admin/tiktok/accounts PATCH] Erreur :", err);
    return NextResponse.json({ error: "Compte introuvable ou erreur MAJ" }, { status: 404 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.tiktokAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tiktok/accounts DELETE] Erreur :", err);
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }
}
