/**
 * API PUBLIQUE — Sections hero paramétrables (V3.45).
 *
 *   GET /api/heroes            → toutes les configs fusionnées (défauts + DB)
 *   GET /api/heroes?page=pam   → la config d'une seule page
 *
 * Lecture seule, publique (aucune donnée sensible : textes + images des
 * bannières du site). Les modifications passent par le back-office
 * (/admin/api/heroes — protégé par la session admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllHeroes, getHero } from "@/lib/heroes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const page = new URL(request.url).searchParams.get("page");
    if (page) {
      const hero = await getHero(page);
      return NextResponse.json(hero, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const heroes = await getAllHeroes();
    return NextResponse.json(heroes, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[api/heroes] GET error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
