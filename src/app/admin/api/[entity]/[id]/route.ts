/**
 * API routes dynamiques pour une entité par ID.
 *   GET    /admin/api/[entity]/[id]   — détail
 *   PATCH  /admin/api/[entity]/[id]   — modification
 *   DELETE /admin/api/[entity]/[id]   — suppression
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { ensureChannelAvatarUrl, ensureChannelIsDirectColumn, ensureVoiceVideoColumns, ensureServantLocationColumns, ensureIntercessionAudioColumns, ensureIntercessionContactColumns, ensureHeroSectionsTable } from "@/lib/ensure-schema";
import { annoncerLiveProgramme, annoncerLiveAnnule } from "@/lib/live-announcement-relay";

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
  // ⭐ V3.2 — Demandes d'intercession : gestion depuis le back-office
  // (/admin/intercession) — statut, témoignage d'exaucement, suppression.
  intercessionrequests: "intercessionRequest",
  donations: "donation",
  communities: "community",
  calendar: "liturgicalEvent",
  // ⭐ V3.45 — Sections hero paramétrables (/admin/heroes)
  heroes: "heroSection",
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
    if (entity === "channels") { await ensureChannelAvatarUrl(); await ensureChannelIsDirectColumn(); }
    // ⭐ V2.7 — Auto-réparation colonnes User.phone (profil « infos complètes »)
    if (entity === "users" || entity === "servants" || entity === "channels") {
      await ensureVoiceVideoColumns();
    }
    // ⭐ V3.3 — Auto-réparation colonnes Servant.pays / Servant.ville
    if (entity === "servants") await ensureServantLocationColumns();
    // ⭐ V3.30.1 — Auto-réparation colonnes audio IntercessionRequest
    // (findUnique retourne l'objet COMPLET → P2022 sur base froide sinon).
    if (entity === "intercessionrequests") {
      await ensureIntercessionAudioColumns();
      // ⭐ V3.32 — colonnes pays/ville/telephone/email (même garde)
      await ensureIntercessionContactColumns();
    }
    // ⭐ V3.45 — Table des sections hero (création + semis idempotents)
    if (entity === "heroes") await ensureHeroSectionsTable();
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
    if (entity === "channels") { await ensureChannelAvatarUrl(); await ensureChannelIsDirectColumn(); }
    // ⭐ V2.7 — Auto-réparation colonnes V2.7 (User.phone, Channel.videoMode)
    if (entity === "users" || entity === "servants" || entity === "channels") {
      await ensureVoiceVideoColumns();
    }
    // ⭐ V3.3 — Auto-réparation colonnes Servant.pays / Servant.ville
    if (entity === "servants") await ensureServantLocationColumns();
    // ⭐ V3.30.1 — Auto-réparation colonnes audio IntercessionRequest
    // (l'update retourne l'objet complet : sans cette garde, changer le
    // statut d'une demande depuis le back-office échouait en P2022).
    if (entity === "intercessionrequests") {
      await ensureIntercessionAudioColumns();
      // ⭐ V3.32 — colonnes pays/ville/telephone/email (même garde)
      await ensureIntercessionContactColumns();
    }
    // ⭐ V3.45 — Table des sections hero (création + semis idempotents)
    if (entity === "heroes") await ensureHeroSectionsTable();

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

    // ⭐ V3.38 — capture l'état AVANT modification d'un live : nécessaire
    // pour savoir si la reprogrammation doit être annoncée (changement de
    // date/heure/serviteur/thème/description) et pour détecter une
    // annulation. Lecture ciblée (select) : aucune colonne runtime ajoutée
    // hors Prisma n'est lue → aucun risque P2022 sur base froide.
    let ancienLive: {
      id: string;
      title: string;
      description: string;
      scheduledAt: Date;
      servantId: string;
      status: string;
      thumbnailUrl: string | null;
    } | null = null;
    if (entity === "lives") {
      ancienLive = (await db.liveStream.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          scheduledAt: true,
          servantId: true,
          status: true,
          thumbnailUrl: true,
        },
      })) as typeof ancienLive;
    }

    const updated = await delegate.update({ where: { id }, data: body });

    // ⭐ V2.7 — Propagation de la photo vers l'autre « versant » de la
    // personne (Pam serviteur ↔ Pam compte : une seule photo partout).
    if (syncSide === "servant") {
      await syncServantUserPhoto("servant", (body as { portraitUrl?: string | null }).portraitUrl ?? null, syncMatch);
    } else if (syncSide === "user") {
      await syncServantUserPhoto("user", (body as { avatarUrl?: string | null }).avatarUrl ?? null, syncMatch);
    }

    // ⭐ V3.38 — ANNONCE AUTOMATIQUE À LA REPROGRAMMATION D'UN LIVE :
    // quand un admin modifie un live déjà programmé (date, heure,
    // serviteur, thème, description) via « Modifier le live », la
    // communauté est informée de la nouvelle date/heure dans le canal
    // d'annonces Yeshua Connect — même relay que la création (V3.36).
    // L'ANNULATION d'un live programmé est également annoncée. Best-effort
    // APRÈS la réponse (after) : la modification back-office ne doit jamais
    // être ralentie ni échouer à cause de l'annonce.
    if (entity === "lives" && ancienLive) {
      try {
        const liveMAJ = updated as unknown as {
          id: string;
          title: string;
          description?: string | null;
          scheduledAt: string | Date;
          servantId: string;
          status?: string | null;
          thumbnailUrl?: string | null;
        };
        const statutFinal = (liveMAJ.status || "SCHEDULED").toUpperCase();

        // Champs affichés dans l'annonce : on ne ré-annonce QUE s'ils
        // changent (anti-spam : cocher/décocher le multistream, changer la
        // seule miniature ou éditer le statut LIVE/ENDED ne ré-annonce pas).
        const dateAvant = ancienLive.scheduledAt
          ? new Date(ancienLive.scheduledAt).getTime()
          : null;
        const dateApres = liveMAJ.scheduledAt
          ? new Date(liveMAJ.scheduledAt).getTime()
          : null;
        const infosModifiees =
          dateAvant !== dateApres ||
          (liveMAJ.servantId || "") !== (ancienLive.servantId || "") ||
          (liveMAJ.title || "") !== (ancienLive.title || "") ||
          (liveMAJ.description || "") !== (ancienLive.description || "");

        if (statutFinal === "SCHEDULED" && liveMAJ.servantId && infosModifiees) {
          const servant = await db.servant.findUnique({
            where: { id: liveMAJ.servantId },
            select: { shortName: true },
          });
          after(() => {
            annoncerLiveProgramme(
              {
                liveId: liveMAJ.id,
                titre: liveMAJ.title || "Live",
                description: liveMAJ.description ?? null,
                scheduledAt: new Date(liveMAJ.scheduledAt),
                servantNom: servant?.shortName || "Serviteur de Dieu",
                thumbnailUrl: liveMAJ.thumbnailUrl ?? null,
              },
              { reprogramme: true },
            ).catch(() => {});
          });
        } else if (
          statutFinal === "CANCELLED" &&
          (ancienLive.status || "").toUpperCase() !== "CANCELLED"
        ) {
          const servantIdAnnule = liveMAJ.servantId || ancienLive.servantId;
          const servant = servantIdAnnule
            ? await db.servant.findUnique({
                where: { id: servantIdAnnule },
                select: { shortName: true },
              })
            : null;
          after(() => {
            annoncerLiveAnnule({
              liveId: liveMAJ.id,
              titre: liveMAJ.title || ancienLive.title || "Live",
              scheduledAt: new Date(liveMAJ.scheduledAt ?? ancienLive.scheduledAt),
              servantNom: servant?.shortName || "Serviteur de Dieu",
            }).catch(() => {});
          });
        }
      } catch (e) {
        console.warn(
          "[admin/api/lives] Annonce Yeshua Connect impossible :",
          e instanceof Error ? e.message : e,
        );
      }
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
    // ⭐ V3.30.1 — Auto-réparation colonnes audio IntercessionRequest
    // (le delete retourne l'objet supprimé complet → P2022 sinon).
    if (entity === "intercessionrequests") {
      await ensureIntercessionAudioColumns();
      // ⭐ V3.32 — colonnes pays/ville/telephone/email (même garde)
      await ensureIntercessionContactColumns();
    }
    // ⭐ V3.45 — Table des sections hero (création + semis idempotents)
    if (entity === "heroes") await ensureHeroSectionsTable();
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
