/**
 * PATCH /admin/api/youtube/accounts/<id>
 *   Body : { actif?: boolean }
 *   Active/désactive la synchro automatique pour ce compte.
 *
 * DELETE /admin/api/youtube/accounts/<id>
 *   Supprime le compte YouTube (révoque le lien). Les vidéos déjà importées
 *   ne sont PAS supprimées — elles restent visibles sur le site public.
 *
 * ⚠️ La révocation côté Google (https://myaccount.google.com/permissions)
 *    n'est PAS automatique : l'admin doit le faire manuellement s'il veut
 *    invalider immédiatement le refresh token. La suppression en base suffit
 *    à stopper la synchro automatique.
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

// ─── PATCH : activer / désactiver ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  let body: { actif?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  if (typeof body.actif !== "boolean") {
    return NextResponse.json({ error: "Champ « actif » (booléen) requis" }, { status: 400 });
  }

  try {
    const compte = await db.youtubeAccount.update({
      where: { id },
      data: { actif: body.actif },
      select: { id: true, actif: true },
    });
    return NextResponse.json(compte);
  } catch (err) {
    console.error("[admin/youtube/accounts PATCH] Erreur :", err);
    return NextResponse.json({ error: "Compte introuvable ou erreur MAJ" }, { status: 404 });
  }
}

// ─── DELETE : supprimer le lien ───────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authentifier())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.youtubeAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/youtube/accounts DELETE] Erreur :", err);
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }
}
