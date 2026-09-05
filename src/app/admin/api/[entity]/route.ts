/**
 * API routes pour le backoffice — Christ Libère
 *
 * Routes génériques CRUD pour chaque entité :
 *   GET    /admin/api/[entity]          — liste
 *   POST   /admin/api/[entity]          — création
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureChannelAvatarUrl, ensureChannelIsDirectColumn, ensureVoiceVideoColumns, ensureServantLocationColumns, ensureIntercessionAudioColumns, ensureIntercessionContactColumns } from "@/lib/ensure-schema";
import { annoncerLiveProgramme } from "@/lib/live-announcement-relay";

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
  // ⭐ V3.2 — Demandes d'intercession (back-office /admin/intercession).
  intercessionrequests: "intercessionRequest",
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
    // ⭐ V2.6.1 — Le back-office Canaux sélectionne toutes les colonnes :
    // si la colonne avatarUrl (V2.5) manque en prod, la page échoue (500).
    if (entity === "channels") { await ensureChannelAvatarUrl(); await ensureVoiceVideoColumns(); await ensureChannelIsDirectColumn(); } else if (entity === "users" || entity === "servants") { await ensureVoiceVideoColumns(); }
    // ⭐ V3.3 — Auto-réparation colonnes Servant.pays / Servant.ville
    if (entity === "servants") await ensureServantLocationColumns();
    // ⭐ V3.30.1 — Auto-réparation colonnes audio IntercessionRequest
    // (findMany sans select → toutes les colonnes → P2022 sinon).
    if (entity === "intercessionrequests") {
      await ensureIntercessionAudioColumns();
      // ⭐ V3.32 — colonnes pays/ville/telephone/email (même garde)
      await ensureIntercessionContactColumns();
    }

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
    // ⭐ V2.6.1 — Auto-réparation colonne avatarUrl avant création (cf. ensure-schema.ts)
    if (entity === "channels") { await ensureChannelAvatarUrl(); await ensureVoiceVideoColumns(); await ensureChannelIsDirectColumn(); } else if (entity === "users" || entity === "servants") { await ensureVoiceVideoColumns(); }
    // ⭐ V3.3 — Auto-réparation colonnes Servant.pays / Servant.ville avant création
    if (entity === "servants") await ensureServantLocationColumns();
    // ⭐ V3.30.1 — Auto-réparation colonnes audio IntercessionRequest
    // (create retourne l'objet complet → P2022 sinon).
    if (entity === "intercessionrequests") {
      await ensureIntercessionAudioColumns();
      // ⭐ V3.32 — colonnes pays/ville/telephone/email (même garde)
      await ensureIntercessionContactColumns();
    }
    const delegate = getDelegate(entity as EntityName);
    const created = await delegate.create({ data: body });

    // ⭐ V3.36 — ANNONCE AUTOMATIQUE DANS YESHUA CONNECT : quand un admin
    // programme un live depuis le back-office (bouton « Programmer un live »
    // ou formulaire complet), l'information est relayée dans le canal
    // d'annonces (canal ANNOUNCEMENT) — message structuré (qui anime, thème,
    // jour, heure) + miniature intacte + push aux membres qui suivent les
    // lives. Best-effort APRÈS la réponse (after) : la programmation ne doit
    // jamais être ralentie ni échouer à cause de l'annonce.
    if (entity === "lives") {
      try {
        const liveCree = created as unknown as {
          id: string; title: string; description?: string | null;
          scheduledAt: string | Date; servantId: string;
          status?: string | null; thumbnailUrl?: string | null;
        };
        const statut = (liveCree.status || "SCHEDULED").toUpperCase();
        if (statut === "SCHEDULED" && liveCree.servantId) {
          const servant = await db.servant.findUnique({
            where: { id: liveCree.servantId },
            select: { shortName: true },
          });
          const annonce = {
            liveId: liveCree.id,
            titre: liveCree.title || "Live",
            description: liveCree.description ?? null,
            scheduledAt: new Date(liveCree.scheduledAt),
            servantNom: servant?.shortName || "Serviteur de Dieu",
            thumbnailUrl: liveCree.thumbnailUrl ?? null,
          };
          after(() => {
            annoncerLiveProgramme(annonce).catch(() => {});
          });
        }
      } catch (e) {
        console.warn("[admin/api/lives] Annonce Yeshua Connect impossible :", e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    console.error(`[admin/api/${entity}] POST error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    );
  }
}
