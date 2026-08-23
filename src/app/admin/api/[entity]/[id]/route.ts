/**
 * API routes dynamiques pour une entité par ID.
 *   GET    /admin/api/[entity]/[id]   — détail
 *   PATCH  /admin/api/[entity]/[id]   — modification
 *   DELETE /admin/api/[entity]/[id]   — suppression
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
} as const;

type EntityName = keyof typeof ENTITY_MAP;

function getDelegate(entity: EntityName) {
  const modelName = ENTITY_MAP[entity];
  return (db as unknown as Record<string, typeof db.servant>)[modelName];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  if (!(entity in ENTITY_MAP)) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });
  }

  try {
    const delegate = getDelegate(entity as EntityName);
    const item = await delegate.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] GET error:`, error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  if (!(entity in ENTITY_MAP)) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const delegate = getDelegate(entity as EntityName);
    const updated = await delegate.update({ where: { id }, data: body });
    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] PATCH error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la modification" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  if (!(entity in ENTITY_MAP)) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });
  }

  try {
    const delegate = getDelegate(entity as EntityName);
    await delegate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] DELETE error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
