/**
 * API routes dynamiques pour une entité par ID.
 *   GET    /admin/api/[entity]/[id]   — détail
 *   PATCH  /admin/api/[entity]/[id]   — modification
 *   DELETE /admin/api/[entity]/[id]   — suppression
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { isR2Configured, purgerArtefactsR2 } from "@/lib/r2";
import { ensureChannelAvatarUrl, ensureChannelIsDirectColumn, ensureVoiceVideoColumns, ensureServantLocationColumns, ensureIntercessionAudioColumns, ensureIntercessionContactColumns, ensureHeroSectionsTable, ensureVideoCategoryColumn, ensureLiveCategoryColumn, ensureBiographyPhotoColumn, ensureCroyantTestimoniesTable, ensureTiktokMp4UrlColumn } from "@/lib/ensure-schema";
import { annoncerLiveProgramme, annoncerLiveAnnule } from "@/lib/live-announcement-relay";
// ⭐ V3.85 — Miniature TikTok automatique à la modification d'une vidéo.
// ⭐ V4.24 — liens courts vm./vt.tiktok.com + miniature recalculée quand
// l'URL change (TikTok ET YouTube) — corriger une URL mal saisie met à
// jour la miniature au lieu de conserver celle de l'ancienne vidéo.
import { estUrlTiktok, estLienCourtTiktok, resoudreLienCourtTiktok } from "@/lib/tiktok";
import { recupererMiniatureTiktok } from "@/lib/tiktok-miniature";
import { extractYoutubeId, getYoutubeThumbnailUrl } from "@/lib/youtube";
// ⭐ V3.86 — Suppression définitive : mémoire des vidéos supprimées
// (anti-résurrection à la modification + mémorisation à la suppression).
import { enregistrerSuppressionVideo, verifierSuppressionVideo, leverSuppressionVideo, cleMediaDe } from "@/lib/suppression-video";

const ENTITY_MAP = {
  servants: "servant",
  biographies: "biography",
  testimonies: "testimony",
  teachings: "teaching",
  videos: "video",
  lives: "liveStream",
  channels: "channel",
  users: "user",
  // ⭐ V3.2 — Demandes d'intercession : gestion depuis le back-office
  // (/admin/intercession) — statut, témoignage d'exaucement, suppression.
  intercessionrequests: "intercessionRequest",
  donations: "donation",
  communities: "community",
  calendar: "liturgicalEvent",
  // ⭐ V3.45 — Sections hero paramétrables (/admin/heroes)
  heroes: "heroSection",
  // ⭐ V3.100 — Témoignages des croyants « Vies transformées » :
  // validation / rejet / suppression depuis /admin/vie-transformee
  // (statut en_attente → publie, noteAdmin, publishedAt).
  croyantstemoignages: "croyantTestimony",
} as const;

type EntityName = keyof typeof ENTITY_MAP;

function getDelegate(entity: EntityName) {
  const modelName = ENTITY_MAP[entity];
  return (db as unknown as Record<string, typeof db.servant>)[modelName];
}

/**
 * ⭐ V2.7 — SYNCHRO PHOTO serviteur ↔ compte utilisateur.
 *
 * Une seule « personne » possède UNE photo (ex. Afrika) : quand le back-office
 * modifie la photo du serviteur (Servant.portraitUrl), le compte User
 * correspondant reçoit la même photo (User.avatarUrl) — c'est elle qui
 * s'affiche dans les canaux vocaux Yeshua Connect et les bulles de chat.
 * Et réciproquement quand la photo est modifiée depuis /admin/users.
 *
 * Correspondance pragmatique : email commençant par "<code>@" OU nom
 * insensible à la casse égal au shortName / fullName (Afrika, Pasteur Kongo).
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
    // ⭐ V3.46 — colonnes rubrique Video/LiveStream.category : le client
    // Prisma les sélectionne (GET) et le PATCH peut les écrire (sélecteur
    // de rubrique en ligne du module Vidéos) → garde systématique.
    if (entity === "videos") await ensureVideoCategoryColumn();
    // ⭐ V4.04 — colonne Video.tiktokMp4Url.
    if (entity === "videos") await ensureTiktokMp4UrlColumn().catch(() => {});
    if (entity === "lives") await ensureLiveCategoryColumn();
    // ⭐ V3.47 — colonne photo des jalons biographiques (GET/PATCH/DELETE
    // retournent l'objet complet → P2022 sur base froide sinon).
    if (entity === "biographies") await ensureBiographyPhotoColumn();
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
    // ⭐ V3.86 — drapeau de contrôle (réintégration confirmée) : JAMAIS
    // transmis à Prisma (champ inconnu du modèle → erreur update sinon).
    // Le reste du corps passe tel quel à l'update.
    const { reintegration, ...donnees } = body;
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
    // ⭐ V3.46 — colonnes rubrique Video/LiveStream.category : le client
    // Prisma les sélectionne (GET) et le PATCH peut les écrire (sélecteur
    // de rubrique en ligne du module Vidéos) → garde systématique.
    if (entity === "videos") await ensureVideoCategoryColumn();
    // ⭐ V4.04 — colonne Video.tiktokMp4Url.
    if (entity === "videos") await ensureTiktokMp4UrlColumn().catch(() => {});
    if (entity === "lives") await ensureLiveCategoryColumn();
    // ⭐ V3.47 — colonne photo des jalons biographiques (même pattern).
    if (entity === "biographies") await ensureBiographyPhotoColumn();
    // ⭐ V3.100 — table des témoignages des croyants (le client Prisma la
    // sélectionne dans l'update : sans cette garde, le premier PATCH après
    // un déploiement pourrait tomber en P2021/P2022 sur une base fraîche).
    if (entity === "croyantstemoignages") await ensureCroyantTestimoniesTable();

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

    // ─── ⭐ V4.24 — LIEN COURT TIKTOK → URL CANONIQUE (modification) ───
    // Même normalisation qu'à la création : le lien vm./vt. collé par le
    // bouton « Partager » de l'app est remplacé par l'URL complète.
    if (
      entity === "videos" &&
      typeof donnees.videoUrl === "string" &&
      estLienCourtTiktok(donnees.videoUrl)
    ) {
      const canonique = await resoudreLienCourtTiktok(donnees.videoUrl);
      if (canonique) donnees.videoUrl = canonique;
    }

    // ─── ⭐ V3.86 — GARDE ANTI-RÉSURRECTION (modification) ───
    // Si la modification change l'URL d'une vidéo vers le média d'une
    // vidéo précédemment SUPPRIMÉE, refuser (sauf réintégration explicite
    // reintegration: true) : sans cette garde, « modifier » une autre vidéo
    // en collant l'URL supprimée ferait revenir le média supprimé.
    // ⭐ V4.24 — on capture AUSSI la miniature actuelle : elle sert au
    // recalcul automatique quand l'URL change (l'ancienne miniature
    // correspondrait à l'ancienne vidéo — image trompeuse).
    let videoAvantEdition: { videoUrl: string | null; thumbnailUrl: string | null } | null = null;
    if (entity === "videos" && typeof donnees.videoUrl === "string" && donnees.videoUrl) {
      const videoActuelle = await db.video.findUnique({
        where: { id },
        select: { videoUrl: true, thumbnailUrl: true },
      });
      videoAvantEdition = videoActuelle;
      // Clé du média CIBLE (celle qu'on veut poser) vs clé ACTUELLE :
      // même média (autre forme d'URL) → pas un changement → pas de garde.
      const cleCible = cleMediaDe(donnees.videoUrl);
      const cleActuelle = cleMediaDe(videoActuelle?.videoUrl);
      if (cleCible && cleCible !== cleActuelle) {
        const suppressionConnue = await verifierSuppressionVideo(donnees.videoUrl);
        if (suppressionConnue && !reintegration) {
          return NextResponse.json(
            {
              error:
                "Cette URL correspond à une vidéo supprimée de la plateforme le " +
                new Date(suppressionConnue.supprimeLe).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "long", year: "numeric",
                }) +
                ". Confirmez la réintégration pour l'utiliser à nouveau.",
              code: "VIDEO_SUPPRIMEE",
              supprimeLe: suppressionConnue.supprimeLe,
              titreExistant: suppressionConnue.titre,
            },
            { status: 409 }
          );
        }
        if (reintegration) {
          await leverSuppressionVideo(donnees.videoUrl);
        }
      }
    }

    const updated = await delegate.update({ where: { id }, data: donnees });

    // ⭐ V3.85 + ⭐ V4.24 — MINIATURE AUTOMATIQUE (modification) :
    //   ① URL TikTok sans miniature (ou remise à null par le modal quand
    //      l'URL change) → récupérer la VRAIE miniature (R2 permanent,
    //      repli URL signée) ;
    //   ② URL CHANGÉE vers un autre média (TikTok ou YouTube) SANS
    //      miniature explicite dans la requête → recalculer : l'ancienne
    //      miniature montrait l'ancienne vidéo (image trompeuse). C'est le
    //      cas « j'ai mal collé l'URL, je corrige » — la miniature suit.
    //   ③ Si la requête transporte une miniature explicite (image
    //      personnalisée uploadée), elle est TOUJOURS respectée.
    if (entity === "videos") {
      const videoMAJ = updated as unknown as {
        id: string;
        videoUrl?: string | null;
        thumbnailUrl?: string | null;
      };
      const miniatureExplicite = "thumbnailUrl" in donnees;
      const mediaAChange =
        !!videoAvantEdition &&
        cleMediaDe(videoMAJ?.videoUrl) !== cleMediaDe(videoAvantEdition.videoUrl);

      let miniatureAuto: string | null = null;
      let remplacerMiniature = false;

      if (videoMAJ?.videoUrl && estUrlTiktok(videoMAJ.videoUrl)) {
        // ①/② TikTok : miniature absente (création historique, URL
        // fraîchement corrigée) OU URL changée vers une AUTRE vidéo
        // TikTok → (re)calculer la vraie miniature (R2 permanent, repli
        // URL signée). Une miniature explicite (image uploadée) prime.
        const doitRecalculer =
          !videoMAJ.thumbnailUrl || (mediaAChange && !miniatureExplicite);
        if (doitRecalculer) {
          miniatureAuto = await recupererMiniatureTiktok(
            videoMAJ.id,
            videoMAJ.videoUrl
          );
          if (miniatureAuto) {
            remplacerMiniature = true;
          } else if (mediaAChange) {
            // oEmbed indisponible ET vidéo changée : l'ancienne miniature
            // est trompeuse → on l'efface ; le cron quotidien la récupérera.
            remplacerMiniature = true;
          }
        }
      } else if (
        mediaAChange &&
        !miniatureExplicite &&
        videoMAJ?.videoUrl &&
        extractYoutubeId(videoMAJ.videoUrl)
      ) {
        // ② YouTube : l'URL vient de changer vers une autre vidéo YouTube
        // → miniature YouTube standard de la NOUVELLE vidéo.
        miniatureAuto = getYoutubeThumbnailUrl(
          extractYoutubeId(videoMAJ.videoUrl) as string
        );
        remplacerMiniature = true;
      } else if (mediaAChange && !miniatureExplicite) {
        // ② Autre plateforme inconnue : effacer l'ancienne miniature
        // (elle ne correspond plus à la vidéo affichée).
        miniatureAuto = null;
        remplacerMiniature = true;
      }

      if (remplacerMiniature) {
        try {
          await db.video.update({
            where: { id: videoMAJ.id },
            data: { thumbnailUrl: miniatureAuto },
          });
          (updated as { thumbnailUrl?: string | null }).thumbnailUrl =
            miniatureAuto;
        } catch (e) {
          console.warn(
            "[admin/api/videos] Enregistrement de la miniature automatique impossible :",
            e instanceof Error ? e.message : e
          );
        }
      }
    }

    // ⭐ V2.7 — Propagation de la photo vers l'autre « versant » de la
    // personne (Afrika serviteur ↔ Afrika compte : une seule photo partout).
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
    // ⭐ V3.46 — colonnes rubrique Video/LiveStream.category : le client
    // Prisma les sélectionne (GET) et le PATCH peut les écrire (sélecteur
    // de rubrique en ligne du module Vidéos) → garde systématique.
    if (entity === "videos") await ensureVideoCategoryColumn();
    // ⭐ V4.04 — colonne Video.tiktokMp4Url.
    if (entity === "videos") await ensureTiktokMp4UrlColumn().catch(() => {});
    if (entity === "lives") await ensureLiveCategoryColumn();
    // ⭐ V3.47 — colonne photo des jalons biographiques (le delete retourne
    // l'objet supprimé complet → P2022 sinon).
    if (entity === "biographies") await ensureBiographyPhotoColumn();

    // ⭐ V3.58 — PURGE R2 SYNCHRONISÉE : supprimer une vidéo / un live /
    // une demande d'intercession du back-office supprime AUSSI ses fichiers
    // sur le stockage Cloudflare R2 (directive du pasteur : « quand on
    // supprime une vidéo uploadée sur R2, la vidéo doit se supprimer
    // également sur R2 »).
    //   ① AVANT la suppression en base : capture des URLs et PRÉFIXES
    //      d'artefacts (fichier principal, rendus post-production, replays,
    //      miniatures) — la ligne doit encore exister pour être lue.
    //   ② SUPPRESSION en base (source de vérité).
    //   ③ APRÈS : purge R2 best-effort — une erreur R2 ne bloque JAMAIS la
    //      suppression (le fichier resterait orphelin, signalé dans les logs
    //      serveur, pas la fiche) ; les préfixes sont scellés sur l'id de CET
    //      enregistrement → aucun fichier d'un autre enregistrement n'est
    //      concerné.
    let urlsPurge: (string | null | undefined)[] = [];
    let prefixesPurge: string[] = [];
    let purgeR2: Awaited<ReturnType<typeof purgerArtefactsR2>> | null = null;
    // ⭐ V3.86 — Lecture TOUJOURS effectuée pour les vidéos (même sans R2) :
    // l'URL supprimée est MÉMORISÉE (table SuppressionVideo) pour qu'aucun
    // flux de re-création (script d'import, récupération de replay, POST
    // manuel) ne puisse faire « revenir » cette vidéo sans confirmation
    // explicite — c'est la garantie demandée : « supprimée = supprimée ».
    let videoSupprimee: {
      videoUrl: string | null;
      hlsUrl: string | null;
      thumbnailUrl: string | null;
      title: string;
      servantId: string;
    } | null = null;
    if (entity === "videos") {
      videoSupprimee = await db.video.findUnique({
        where: { id },
        select: {
          videoUrl: true,
          hlsUrl: true,
          thumbnailUrl: true,
          title: true,
          servantId: true,
        },
      });
    }
    if (isR2Configured()) {
      if (entity === "videos") {
        const v = videoSupprimee;
        if (v) {
          urlsPurge = [v.videoUrl, v.hlsUrl, v.thumbnailUrl];
          // Fichier principal + rendus post-production (rendered-videos/…).
          prefixesPurge = [`videos/video-${id}`, `rendered-videos/video-${id}`];
        }
      } else if (entity === "lives") {
        const l = await db.liveStream.findUnique({
          where: { id },
          select: { recordingUrl: true, hlsUrl: true, thumbnailUrl: true },
        });
        if (l) {
          urlsPurge = [l.recordingUrl, l.hlsUrl, l.thumbnailUrl];
          // Replay + miniature du live.
          prefixesPurge = [`replays/${id}`, `thumbnails/live-${id}`];
        }
      } else if (entity === "intercessionrequests") {
        const r = await db.intercessionRequest.findUnique({
          where: { id },
          select: { audioUrl: true },
        });
        if (r) {
          // Note vocale : key exacte depuis l'URL (pas de préfixe — les
          // audios d'intercession partagent le préfixe intercession/).
          urlsPurge = [r.audioUrl];
        }
      }
    }

    const delegate = getDelegate(entity as EntityName);
    await delegate.delete({ where: { id } });

    // ⭐ V3.86 — MÉMORISATION DE LA SUPPRESSION (après le DELETE physique,
    // best-effort absolu : la ligne est déjà supprimée, la mémoire ne sert
    // qu'à empêcher les re-créations futures). Couvre les liens YouTube
    // (clé canonique youtube:<id> — toutes formes d'URL confondues) et
    // TikTok (tiktok:<id> — /video/ comme /photo/).
    if (entity === "videos" && videoSupprimee) {
      await enregistrerSuppressionVideo({
        videoId: id,
        videoUrl: videoSupprimee.videoUrl,
        titre: videoSupprimee.title,
        servantId: videoSupprimee.servantId,
      });
    }

    if (urlsPurge.length > 0 || prefixesPurge.length > 0) {
      try {
        purgeR2 = await purgerArtefactsR2({ urls: urlsPurge, prefixes: prefixesPurge });
        console.log(
          `[admin/api/${entity}/${id}] Purge R2 : ${purgeR2.supprimes}/${purgeR2.trouves} fichier(s) supprimé(s) du stockage` +
            (purgeR2.erreurs.length > 0 ? ` — erreurs : ${purgeR2.erreurs.join(" ; ")}` : "")
        );
      } catch (e) {
        // La purge ne doit JAMAIS faire échouer une suppression déjà réussie.
        console.error(`[admin/api/${entity}/${id}] Purge R2 impossible :`, e);
      }
    }

    return NextResponse.json({ success: true, purgeR2 });
  } catch (error) {
    console.error(`[admin/api/${entity}/${id}] DELETE error:`, error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
