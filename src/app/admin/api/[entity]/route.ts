/**
 * API routes pour le backoffice — Christ Libère
 *
 * Routes génériques CRUD pour chaque entité :
 *   GET    /admin/api/[entity]          — liste
 *   POST   /admin/api/[entity]          — création
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Force runtime Node.js (pas edge) pour Prisma
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTITY_MAP = {
  servants: "servant",
  biographies: "biography",
  testimonies: "testimony",
  teachings: "teaching",
  videos: "video",
  lives: "liveStream",
  channels: "channel",
  users: "user",
  contactrequests: "contactRequest",
  donations: "donation",
  communities: "community",
  calendar: "liturgicalEvent",
} as const;

type EntityName = keyof typeof ENTITY_MAP;

function getDelegate(entity: EntityName) {
  const modelName = ENTITY_MAP[entity];
  return (db as unknown as Record<string, typeof db.servant>)[modelName];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  if (!(entity in ENTITY_MAP)) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const delegate = getDelegate(entity as EntityName);
    const items = await delegate.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    const total = await delegate.count();

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error(`[admin/api/${entity}] GET error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;
  if (!(entity in ENTITY_MAP)) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const delegate = getDelegate(entity as EntityName);
    const created = await delegate.create({ data: body });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    console.error(`[admin/api/${entity}] POST error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    );
  }
}
