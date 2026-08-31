/**
 * API routes dynamiques pour une entité par ID.
 *   GET    /admin/api/[entity]/[id]   — détail
 *   PATCH  /admin/api/[entity]/[id]   — modification
 *   DELETE /admin/api/[entity]/[id]   — suppression
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureChannelAvatarUrl, ensureVoiceVideoColumns } from "@/lib/ensure-schema";

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

/**
 * ⭐ V2.7 — SYNCHRO PHOTO serviteur ↔ compte utilisateur.
 *
 * Une seule « personne » possède UNE photo (ex. Pam) : quand le back-office
 * modifie la photo du serviteur (Servant.portraitUrl), le compte User
 * correspondant reçoit la même photo (User.avatarUrl) — c'est elle qui
 * s'affiche dans les canaux vocaux Yeshua Connect et les bulles de chat.
 * Et réciproquement quand la photo est modifiée depuis /admin/users.
 *
 * Correspondance pragmatique : email commençant par "<code>@" OU nom
 * insensible à la casse égal au shortName / fullName (Pam, Pasteur Kongo).
 */
async function syncServantUserPhoto(
  side: "servant" | "user",
  photoUrl: string | null,
  match: { code?: string; shortName?: string; fullName?: string; email?: string; name?: string },
): Promise<void> {
  try {
    if (side === "servant") {
      // Portrait serviteur → avatar du compte User correspondant
      if (!match.code && !match.shortName && !match.fullName) return;
      await db.user.updateMany({
        where: {
          OR: [
            ...(match.code
              ? [{ email: { startsWith: `${match.code.toLowerCase()}@`, mode: "insensitive" as const } }]
              : []),
            ...(match.shortName
              ? [{ name: { equals: match.shortName, mode: "insensitive" as const } }]
              : []),
            ...(match.fullName
              ? [{ name: { equals: match.fullName, mode: "insensitive" as const } }]
              : []),
          ],
        },
        data: { avatarUrl: photoUrl },
      });
    } else {
      // Avatar du compte User → portrait du serviteur correspondant
      if (!match.name && !match.email) return;
      const emailPrefix = match.email?.split("@")[0];
      await db.servant.updateMany({
        where: {
          OR: [
            ...(emailPrefix ? [{ code: { equals: emailPrefix, mode: "insensitive" as const } }] : []),
            ...(match.name
              ? [
                  { shortName: { equals: match.name, mode: "insensitive" as const } },
                  { fullName: { equals: match.name, mode: "insensitive" as const } },
                ]
              : []),
          ],
        },
        data: { portraitUrl: photoUrl ?? undefined },
      });
    }
  } catch (e) {
    // Synchro best effort — la photo principale est déjà enregistrée
    console.error("[admin/api] syncServantUserPhoto failed:", e);
  }
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
    // ⭐ V2.6.1 — Auto-réparation colonne avatarUrl (cf. ensure-schema.ts)
    if (entity === "channels") await ensureChannelAvatarUrl();
    // ⭐ V2.7 — Auto-réparation colonnes User.phone (profil « infos complètes »)
    if (entity === "users" || entity === "servants" || entity === "channels") {
      await ensureVoiceVideoColumns();
    }
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
    // ⭐ V2.6.1 — Auto-réparation colonne avatarUrl (cf. ensure-schema.ts)
    if (entity === "channels") await ensureChannelAvatarUrl();
    // ⭐ V2.7 — Auto-réparation colonnes V2.7 (User.phone, Channel.videoMode)
    if (entity === "users" || entity === "servants" || entity === "channels") {
      await ensureVoiceVideoColumns();
    }

    // ⭐ V2.7 — SYNCHRO PHOTO serviteur ↔ compte utilisateur : on capture
    // les infos de correspondance AVANT l'écriture (le code/nom/email peut
    // être modifié dans la même requête).
    let syncSide: "servant" | "user" | null = null;
    let syncMatch: { code?: string; shortName?: string; fullName?: string; email?: string; name?: string } = {};
    if (entity === "servants" && "portraitUrl" in body) {
      const current = await db.servant.findUnique({
        where: { id },
        select: { code: true, shortName: true, fullName: true },
      });
      syncSide = "servant";
      syncMatch = current ?? {};
    } else if (entity === "users" && "avatarUrl" in body) {
      const current = await db.user.findUnique({
        where: { id },
        select: { email: true, name: true },
      });
      syncSide = "user";
      syncMatch = current ?? {};
    }

    const delegate = getDelegate(entity as EntityName);
    const updated = await delegate.update({ where: { id }, data: body });

    // ⭐ V2.7 — Propagation de la photo vers l'autre « versant » de la
    // personne (Pam serviteur ↔ Pam compte : une seule photo partout).
    if (syncSide === "servant") {
      await syncServantUserPhoto("servant", (body as { portraitUrl?: string | null }).portraitUrl ?? null, syncMatch);
    } else if (syncSide === "user") {
      await syncServantUserPhoto("user", (body as { avatarUrl?: string | null }).avatarUrl ?? null, syncMatch);
    }

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
