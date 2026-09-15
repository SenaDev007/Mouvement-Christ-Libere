/**
 * ⭐ V2.6.1 — Auto-réparation légère du schéma PostgreSQL.
 *
 * Contexte : la V2.5 a ajouté `Channel.avatarUrl` (photos des canaux).
 * Si `bun run db:push` n'a pas encore été exécuté sur la base de
 * production, la simple sélection de cette colonne fait échouer TOUTE
 * la liste des conversations (erreur 500 → Yeshua Connect s'affiche
 * vide : « Aucune conversation »), ainsi que le back-office Canaux.
 *
 * Ces helpers exécutent des DDL idempotents (`IF NOT EXISTS`), au plus
 * une fois par instance de serveur (mémoïsation en mémoire module —
 * sur Vercel, chaque lambda ne paie le coût qu'une seule fois).
 *
 * Si les droits SQL manquent, l'échec est uniquement loggué en console :
 * le comportement redevient alors exactement celui d'avant (l'utilisateur
 * devra lancer `bun run db:push` manuellement).
 */
import { db } from "@/lib/db";

let channelAvatarOk = false;
let inflight: Promise<void> | null = null;
let voiceVideoOk = false;
let inflightVoice: Promise<void> | null = null;

/**
 * S'assure que la colonne `Channel.avatarUrl` (TEXT, nullable) existe.
 * - Idempotent : `ADD COLUMN IF NOT EXISTS` (PostgreSQL ≥ 9.6).
 * - Mémoïsé : après un premier succès, les appels suivants sont gratuits.
 * - Concurrentiel : un seul ALTER en vol, les requêtes simultanées
 *   attendent le même Promise.
 */
export function ensureChannelAvatarUrl(): Promise<void> {
  if (channelAvatarOk) return Promise.resolve();
  if (!inflight) {
    inflight = db
      .$executeRawUnsafe(
        'ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT'
      )
      .then(() => {
        channelAvatarOk = true;
        console.log("[ensure-schema] Colonne Channel.avatarUrl vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Channel.avatarUrl impossible :",
          e instanceof Error ? e.message : e
        );
        // Pas de relance automatique du DDL dans cette instance :
        // la requête Prisma échouera comme avant (l'erreur est alors
        // visible côté client grâce à la bannière d'erreur V2.6.1).
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * ⭐ V2.7 — S'assure que les colonnes `Channel.videoMode` (BOOLEAN) et
 * `User.phone` (TEXT) existent.
 *
 * - `Channel.videoMode` : bascule audio/vidéo des canaux vocaux Yeshua
 *   Connect (mode WhatsApp — décidée par l'administrateur, visible par tous).
 * - `User.phone` : « informations complètes » du profil des membres/viewers.
 *
 * Mêmes garanties que ensureChannelAvatarUrl : idempotent, mémoïsé,
 * concurrentiel (un seul ALTER en vol), échec DDL purement loggué.
 */
export function ensureVoiceVideoColumns(): Promise<void> {
  if (voiceVideoOk) return Promise.resolve();
  if (!inflightVoice) {
    inflightVoice = (async () => {
      // ⚠️ PostgreSQL (prepared statements) refuse plusieurs commandes en une
      // seule requête — deux ALTER distincts, exécutés séquentiellement.
      await db.$executeRawUnsafe(
        'ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "videoMode" BOOLEAN DEFAULT false'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT'
      );
    })()
      .then(() => {
        voiceVideoOk = true;
        console.log("[ensure-schema] Colonnes Channel.videoMode + User.phone vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Channel.videoMode / User.phone impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightVoice = null;
      });
  }
  return inflightVoice;
}

let callSignalOk = false;
let inflightCallSignal: Promise<void> | null = null;

/**
 * ⭐ V3.1 — S'assure que la table `CallSignal` (signalisation des appels
 * audio/vidéo Yeshua Connect) existe.
 *
 * Avant la V3.1, l'appelant rejoignait une room LiveKit `yeshua-call-<convId>`
 * et entendait sa propre sonnerie (ringback) — mais RIEN n'alertait les
 * destinataires : aucun appel entrant ne s'affichait nulle part (PC ni
 * smartphone), donc « ça sonne mais l'appel ne vient pas ».
 *
 * `CallSignal` est une table « volante » (lignes de courte durée) écrite en
 * SQL brut (le client Prisma ne la connaît pas — pas besoin de migration) :
 *   - POST /api/yeshua-connect/calls/signal { action: "start" | "accept" |
 *     "decline" | "end" } crée/met à jour un signal ;
 *   - GET  ?incoming=1 (polling 3 s) permet à CHAQUE membre de découvrir
 *     l'appel qui sonne pour lui (photo du canal, nom de l'appelant…) ;
 *   - GET  ?callId=x (polling 2 s) permet à l'appelant de suivre le statut
 *     (accepté / refusé / manqué / terminé).
 *
 * Idempotent + mémoïsé + concurrentiel comme les helpers précédents.
 */
export function ensureCallSignalTable(): Promise<void> {
  if (callSignalOk) return Promise.resolve();
  if (!inflightCallSignal) {
    inflightCallSignal = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CallSignal" (
          "id" TEXT NOT NULL,
          "conversationId" TEXT NOT NULL,
          "initiatorId" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'audio',
          "status" TEXT NOT NULL DEFAULT 'ringing',
          "acceptedAt" TIMESTAMPTZ,
          "endedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "CallSignal_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "CallSignal_conversationId_idx" ON "CallSignal"("conversationId")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "CallSignal_status_idx" ON "CallSignal"("status")'
      );
      // ⭐ V3.1 — Les journaux d'appel (« Appel manqué », « Appel terminé ·
      // 3 min ») sont des messages type CALL_LOG insérés côté serveur.
      await db.$executeRawUnsafe(
        `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'CALL_LOG'`
      );
    })()
      .then(() => {
        callSignalOk = true;
        console.log("[ensure-schema] V3.1 : table CallSignal + enum CALL_LOG vérifiés/créés ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] DDL CallSignal impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightCallSignal = null;
      });
  }
  return inflightCallSignal;
}

let webRtcSignalOk = false;
let inflightWebRtcSignal: Promise<void> | null = null;

/**
 * ⭐ V3.19 — S'assure que la table `WebRTCSignal` (signalisation des appels
 * P2P de secours — Plan C) existe.
 *
 * Plan C : si LiveKit (Cloud OU auto-hébergé) est indisponible, les appels
 * DIRECT 1-1 basculent en WebRTC peer-to-peer — AUCUN serveur multimédia,
 * le média voyage directement entre les deux navigateurs. La signalisation
 * (offre SDP, réponse, candidats ICE) transite par cette table, lue par le
 * polling HTTP existant (la sonnerie CallSignal V3.1 est inchangée).
 *
 * Table « volante » comme CallSignal (SQL brut, pas de migration Prisma) :
 *   - POST /api/yeshua-connect/calls/webrtc { callId, type, payload }
 *     → insère un signal offer / answer / ice ;
 *   - GET  ?callId=x → les signaux de l'appel (sauf les miens), pour que
 *     chaque côté découvre l'offre / la réponse / les ICE de l'autre ;
 *   - purge des lignes > 5 min (best effort, à chaque appel) : la
 *     signalisation n'a plus de sens après la fin de l'appel.
 *
 * Idempotent + mémoïsé + concurrentiel comme les helpers précédents.
 */
export function ensureWebRTCSignalTable(): Promise<void> {
  if (webRtcSignalOk) return Promise.resolve();
  if (!inflightWebRtcSignal) {
    inflightWebRtcSignal = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WebRTCSignal" (
          "id" TEXT NOT NULL,
          "callId" TEXT NOT NULL,
          "fromUserId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "payload" JSONB NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "WebRTCSignal_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "WebRTCSignal_callId_idx" ON "WebRTCSignal"("callId")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "WebRTCSignal_createdAt_idx" ON "WebRTCSignal"("createdAt")'
      );
    })()
      .then(() => {
        webRtcSignalOk = true;
        console.log("[ensure-schema] V3.19 : table WebRTCSignal (Plan C — appels P2P de secours) vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] DDL WebRTCSignal impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightWebRtcSignal = null;
      });
  }
  return inflightWebRtcSignal;
}

let messageTypeEnumOk = false;
let inflightMessageEnum: Promise<void> | null = null;

let servantLocationOk = false;
let inflightServantLocation: Promise<void> | null = null;

/**
 * ⭐ V3.3 — S'assure que les colonnes `Servant.pays` (TEXT) et
 * `Servant.ville` (TEXT) existent.
 *
 * Contexte : l'admin renseigne le pays et la ville d'un serviteur dans le
 * back-office (/admin/servants → modal). Ces coordonnées alimentent la carte
 * des dispersés (le serviteur y figure avec le niveau « pasteur ») et les
 * cartes de la page /disperses.
 *
 * Mêmes garanties que les helpers précédents : idempotent, mémoïsé,
 * concurrentiel (un seul ALTER en vol), échec DDL purement loggué.
 */
export function ensureServantLocationColumns(): Promise<void> {
  if (servantLocationOk) return Promise.resolve();
  if (!inflightServantLocation) {
    inflightServantLocation = (async () => {
      // ⚠️ PostgreSQL (prepared statements) refuse plusieurs commandes en une
      // seule requête — deux ALTER distincts, exécutés séquentiellement.
      await db.$executeRawUnsafe(
        'ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "pays" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "ville" TEXT'
      );
    })()
      .then(() => {
        servantLocationOk = true;
        console.log("[ensure-schema] V3.3 : colonnes Servant.pays + Servant.ville vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Servant.pays / Servant.ville impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightServantLocation = null;
      });
  }
  return inflightServantLocation;
}

// ⭐ V2.9 — colonnes/tables de la V2.9 (présence + chunks vidéo)
let v29Ok = false;
let inflightV29: Promise<void> | null = null;

/**
 * ⭐ V2.9 — S'assure que le schéma supporte :
 *  - `User.lastSeenAt`      : présence Yeshua Connect (heartbeat sans Socket.io)
 *  - `LiveViewer.lastSeenAt`: fraîcheur des viewers de live (comptage 90 s)
 *  - `VideoChunk` / `VideoBlob` : upload vidéo par blocs (limite 4,5 Mo Vercel)
 *
 * Idempotent + mémoïsé + concurrentiel comme les helpers précédents.
 */
export function ensureV29Schema(): Promise<void> {
  if (v29Ok) return Promise.resolve();
  if (!inflightV29) {
    inflightV29 = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "LiveViewer" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ DEFAULT now()'
      );
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "VideoChunk" (
          "id" TEXT NOT NULL,
          "videoId" TEXT NOT NULL,
          "idx" INTEGER NOT NULL,
          "data" BYTEA NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "VideoChunk_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "VideoChunk_videoId_idx_key" ON "VideoChunk"("videoId", "idx")'
      );
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "VideoBlob" (
          "videoId" TEXT NOT NULL,
          "data" BYTEA NOT NULL,
          "mime" TEXT NOT NULL DEFAULT 'video/mp4',
          "size" INTEGER NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "VideoBlob_pkey" PRIMARY KEY ("videoId")
        )`
      );
      // FK vers Video (CASCADE) — ajoutée après coup si absente.
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'VideoChunk_videoId_fkey'
          ) THEN
            ALTER TABLE "VideoChunk"
              ADD CONSTRAINT "VideoChunk_videoId_fkey"
              FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'VideoBlob_videoId_fkey'
          ) THEN
            ALTER TABLE "VideoBlob"
              ADD CONSTRAINT "VideoBlob_videoId_fkey"
              FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE;
          END IF;
        END $$;
      `);
    })()
      .then(() => {
        v29Ok = true;
        console.log("[ensure-schema] V2.9 : User.lastSeenAt + LiveViewer.lastSeenAt + VideoChunk/VideoBlob vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] DDL V2.9 impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightV29 = null;
      });
  }
  return inflightV29;
}

/**
 * ⭐ V2.8 — S'assure que l'enum `MessageType` contient les valeurs utilisées
 * par le frontend : VERSE (versets bibliques partagés depuis la Bible),
 * ANNOUNCEMENT et GIF.
 *
 * Contexte : le type TypeScript `MessageType` (src/lib/yeshua-connect/types)
 * inclut ces valeurs depuis la V2.6, mais l'enum PostgreSQL ne les a jamais
 * eues → l'envoi d'un verset depuis la Bible intégrée échouait en 500
 * (« Invalid value for argument type. Expected MessageType ») — c'est la
 * cause profonde du « bouton envoyer ne marche pas » sur les versets.
 *
 * `ALTER TYPE ... ADD VALUE IF NOT EXISTS` est idempotent (PG ≥ 9.6) et
 * n'altère pas les données existantes. ⚠️ PostgreSQL interdit ce DDL dans
 * une transaction — on l'exécute hors transaction via $executeRawUnsafe.
 */
export function ensureMessageTypeEnum(): Promise<void> {
  if (messageTypeEnumOk) return Promise.resolve();
  if (!inflightMessageEnum) {
    inflightMessageEnum = (async () => {
      await db.$executeRawUnsafe(
        `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'VERSE'`
      );
      await db.$executeRawUnsafe(
        `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT'`
      );
      await db.$executeRawUnsafe(
        `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'GIF'`
      );
      // ⭐ V3.1 — Journaux d'appel (appel manqué / terminé + durée) dans le chat.
      await db.$executeRawUnsafe(
        `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'CALL_LOG'`
      );
      // ⭐ V3.13 — Journal d'arrivée des nouveaux membres (« Baruch haba ! »
      // pastille façon WhatsApp + invitation à souhaiter shalom).
      await db.$executeRawUnsafe(
        `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'MEMBER_LOG'`
      );
    })()
      .then(() => {
        messageTypeEnumOk = true;
        console.log("[ensure-schema] Enum MessageType : valeurs VERSE/ANNOUNCEMENT/GIF/CALL_LOG/MEMBER_LOG vérifiées/ajoutées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TYPE MessageType impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightMessageEnum = null;
      });
  }
  return inflightMessageEnum;
}

let userBlockOk = false;
let inflightUserBlock: Promise<void> | null = null;

let disperseUserIdOk = false;
let inflightDisperseUserId: Promise<void> | null = null;

/**
 * ⭐ V3.12 — S'assure que la colonne `DisperseMember.userId` (TEXT,
 * nullable) existe.
 *
 * Contexte : purge des positions créées SANS compte officiel. Les entrées
 * créées par /register (ou /disperses/add connecté) portent désormais
 * l'identifiant du compte — elles sont TOUJOURS conservées par la purge.
 *
 * Mêmes garanties que les helpers précédents : idempotent, mémoïsé,
 * concurrentiel (un seul ALTER en vol), échec DDL purement loggué.
 */
export function ensureDisperseUserIdColumn(): Promise<void> {
  if (disperseUserIdOk) return Promise.resolve();
  if (!inflightDisperseUserId) {
    inflightDisperseUserId = db
      .$executeRawUnsafe(
        'ALTER TABLE "DisperseMember" ADD COLUMN IF NOT EXISTS "userId" TEXT'
      )
      .then(() => {
        disperseUserIdOk = true;
        console.log("[ensure-schema] V3.12 : colonne DisperseMember.userId vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE DisperseMember.userId impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightDisperseUserId = null;
      });
  }
  return inflightDisperseUserId;
}

let disperseManuelOk = false;
let inflightDisperseManuel: Promise<void> | null = null;

/**
 * ⭐ V3.14 — S'assure que la colonne `DisperseMember.manuel` (BOOLEAN,
 * défaut false) existe.
 *
 * Contexte : restauration d'un membre supprimé par erreur par la purge
 * V3.12 (Akpovi Sènakpon — membre réel du Mouvement, rétabli à la demande
 * du pasteur). Une entrée « manuelle » (manuel = true) est TOUJOURS
 * conservée par la purge, quels que soient les autres critères.
 *
 * Mêmes garanties que les helpers précédents : idempotent, mémoïsé,
 * concurrentiel (un seul ALTER en vol), échec DDL purement loggué.
 */
export function ensureDisperseManuelColumn(): Promise<void> {
  if (disperseManuelOk) return Promise.resolve();
  if (!inflightDisperseManuel) {
    inflightDisperseManuel = db
      .$executeRawUnsafe(
        'ALTER TABLE "DisperseMember" ADD COLUMN IF NOT EXISTS "manuel" BOOLEAN DEFAULT false'
      )
      .then(() => {
        disperseManuelOk = true;
        console.log("[ensure-schema] V3.14 : colonne DisperseMember.manuel vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE DisperseMember.manuel impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightDisperseManuel = null;
      });
  }
  return inflightDisperseManuel;
}

/**
 * ⭐ V3.5 — S'assure que la table `UserBlock` (blocage entre membres,
 * sécurité des conversations privées Yeshua Connect) existe.
 *
 * Une ligne UserBlock = « blockerId a bloqué blockedId ». Effet :
 *   - plus de messages PRIVÉS entre les deux (API dm + envoi dans un
 *     canal 2-personnes + signalisation d'appel refusés côté serveur) ;
 *   - les canaux/groupe communs restent ouverts (on bloque la personne,
 *     pas la communauté).
 *
 * Mêmes garanties que les autres helpers : idempotent (IF NOT EXISTS),
 * mémoïsé, concurrentiel, échec DDL purement loggué.
 */
export function ensureUserBlockTable(): Promise<void> {
  if (userBlockOk) return Promise.resolve();
  if (!inflightUserBlock) {
    inflightUserBlock = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserBlock" (
          "id" TEXT NOT NULL,
          "blockerId" TEXT NOT NULL,
          "blockedId" TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId")`
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId")`
      );
      // FK vers User (idempotent) — suppression en cascade si un compte part.
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'UserBlock_blockerId_fkey'
          ) THEN
            ALTER TABLE "UserBlock"
              ADD CONSTRAINT "UserBlock_blockerId_fkey"
              FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'UserBlock_blockedId_fkey'
          ) THEN
            ALTER TABLE "UserBlock"
              ADD CONSTRAINT "UserBlock_blockedId_fkey"
              FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE;
          END IF;
        END $$;
      `);
    })()
      .then(() => {
        userBlockOk = true;
        console.log("[ensure-schema] Table UserBlock (blocage des privés) vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] CREATE TABLE UserBlock impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightUserBlock = null;
      });
  }
  return inflightUserBlock;
}

let channelIsDirectOk = false;
let inflightChannelIsDirect: Promise<void> | null = null;

/**
 * ⭐ V3.20 — S'assure que la colonne `Channel.isDirect` (BOOLEAN, défaut
 * false) existe, puis RÉTRO-FIXE les conversations privées existantes.
 *
 * Contexte : correction de confidentialité — les conversations PRIVÉES 1-1
 * (créées par POST /conversations/dm) étaient listées et lisibles par
 * N'IMPORTE QUI (spectateurs ET admins). Un privé doit n'être visible que
 * de ses 2 membres, pas même des admins (directive du pasteur).
 *
 * Deux étapes :
 *  1. `ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "isDirect" ...` ;
 *  2. rétro-fixage : chaque création de privé laisse un AuditLog
 *     (action 'DM_CREATE', channelId renseigné) depuis la V3.4 → on marque
 *     ces canaux isDirect = true. Les nouveaux privés posent le drapeau
 *     à la création (route /dm). Un canal PUBLIC « Texte — groupe » avec
 *     2 inscrits n'est PAS touché (pas d'ambiguïté de comptage).
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué.
 */
export function ensureChannelIsDirectColumn(): Promise<void> {
  if (channelIsDirectOk) return Promise.resolve();
  if (!inflightChannelIsDirect) {
    inflightChannelIsDirect = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "isDirect" BOOLEAN NOT NULL DEFAULT false'
      );
      // Rétro-fixage via la piste d'audit des privés (DM_CREATE).
      try {
        await db.$executeRawUnsafe(
          `UPDATE "Channel" SET "isDirect" = true
           WHERE "id" IN (
             SELECT DISTINCT "channelId" FROM "AuditLog"
             WHERE "action" = 'DM_CREATE' AND "channelId" IS NOT NULL
           )`
        );
      } catch {
        // AuditLog absent (base très ancienne) → seuls les NOUVEAUX privés
        // porteront le drapeau — dégradation douce, pas bloquant.
      }
      // ⭐ V3.20 — PURGE des intrus : le bug d'auto-join (V2.9) inscrivait
      // en ChannelMember TOUT tiers qui ouvrait un privé listé à tort dans
      // sa sidebar (« n'importe qui voit le chat »). La paire légitime est
      // tracée par l'audit DM_CREATE (userId = créateur, targetId = cible) :
      // on retire tout membre d'un privé qui n'est ni l'un ni l'autre.
      // Idempotent (après la 1re passe, plus aucune ligne ne correspond) et
      // SÛR : la suppression ne s'applique qu'aux canaux portant une trace
      // d'audit DM_CREATE — pas de nettoyage en aveugle.
      try {
        await db.$executeRawUnsafe(
          `DELETE FROM "ChannelMember" m
           WHERE m."channelId" IN (
             SELECT "id" FROM "Channel" WHERE "isDirect" = true
           )
           AND EXISTS (
             SELECT 1 FROM "AuditLog" a
             WHERE a."action" = 'DM_CREATE' AND a."channelId" = m."channelId"
           )
           AND m."userId" NOT IN (
             SELECT a."userId" FROM "AuditLog" a
             WHERE a."action" = 'DM_CREATE' AND a."channelId" = m."channelId"
             UNION
             SELECT a2."targetId" FROM "AuditLog" a2
             WHERE a2."action" = 'DM_CREATE' AND a2."channelId" = m."channelId"
               AND a2."targetId" IS NOT NULL
           )`
        );
      } catch {
        // best effort — si AuditLog manque, les gardes d'accès bloquent
        // déjà les nouveaux intrus (l'ancien auto-join est refermé).
      }
    })()
      .then(() => {
        channelIsDirectOk = true;
        console.log("[ensure-schema] V3.20 : colonne Channel.isDirect vérifiée/créée + privés rétro-fixés ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Channel.isDirect impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightChannelIsDirect = null;
      });
  }
  return inflightChannelIsDirect;
}

let callMediaOk = false;
let inflightCallMedia: Promise<void> | null = null;

/**
 * ⭐ V3.21 — CHAÎNE DE REPLI MULTIMÉDIA (LiveKit → Agora → Daily).
 *
 * S'assure que l'infrastructure d'arbitrage serveur existe :
 *
 *  1. Colonne `CallSignal.mediaProvider` (TEXT DEFAULT 'livekit') —
 *     fournisseur actif PAR APPEL : quand un participant signale l'échec
 *     d'un fournisseur (action « failover » de /calls/media), le serveur
 *     fait avancer l'appel au suivant et PERSITE le choix — toutes les
 *     parties convergent via le polling de statut existant (2 s).
 *
 *  2. Table `CallProviderHealth` (santé PARTAGÉE, serverless-safe) :
 *     un fournisseur défaillant entre en cooldown 5 minutes → les
 *     NOUVEAUX appels/rooms l'évitent et tombent directement sur son
 *     remplaçant ; à l'expiration, LiveKit (source de vérité) redevient
 *     éligible sans intervention humaine.
 *
 *  3. Table `VoiceMediaProvider` — même arbitrage pour les CANAUX VOCAUX
 *     persistants (rooms sans CallSignal).
 *
 * Mêmes garanties que les helpers précédents : idempotent, mémoïsé,
 * concurrentiel (un seul DDL en vol), échec purement loggué.
 */
export function ensureCallMediaTables(): Promise<void> {
  if (callMediaOk) return Promise.resolve();
  if (!inflightCallMedia) {
    inflightCallMedia = (async () => {
      // Colonne d'arbitrage par appel (la table CallSignal existe depuis
      // la V3.1 — ensureCallSignalTable est appelé par les mêmes routes).
      await db.$executeRawUnsafe(
        `ALTER TABLE "CallSignal" ADD COLUMN IF NOT EXISTS "mediaProvider" TEXT DEFAULT 'livekit'`
      );
      // Santé partagée des fournisseurs (cooldown anti-tempête).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CallProviderHealth" (
          "provider" TEXT NOT NULL,
          "failCount" INTEGER NOT NULL DEFAULT 0,
          "lastFailureAt" TIMESTAMPTZ,
          "lastReason" TEXT,
          "cooldownUntil" TIMESTAMPTZ,
          CONSTRAINT "CallProviderHealth_pkey" PRIMARY KEY ("provider")
        )`
      );
      // Arbitrage des canaux vocaux persistants.
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "VoiceMediaProvider" (
          "channelId" TEXT NOT NULL,
          "provider" TEXT NOT NULL,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "VoiceMediaProvider_pkey" PRIMARY KEY ("channelId")
        )`
      );
    })()
      .then(() => {
        callMediaOk = true;
        console.log("[ensure-schema] V3.21 : CallSignal.mediaProvider + CallProviderHealth + VoiceMediaProvider vérifiés/créés ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] DDL V3.21 (call-media) impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightCallMedia = null;
      });
  }
  return inflightCallMedia;
}

let videoLikesOk = false;
let inflightVideoLikes: Promise<void> | null = null;

/**
 * ⭐ V3.26 — S'assure que la colonne `Video.likes` (INTEGER, défaut 0)
 * existe.
 *
 * Contexte : le compteur de likes était stocké dans la colonne `views`
 * (« réutilisation temporaire » historique), et le replay d'un live était
 * créé avec views = nombre de viewers du direct → un replay fraîchement
 * publié affichait « 5 likes » (ou N) sans AUCUN like réel (données
 * fictives remontées par le pasteur). Désormais :
 *   - `views` = vues (audience du live transférée, affichée « X vues ») ;
 *   - `likes` = vrais likes, incrémentés/décrémentés par
 *     /api/videos/[id]/like uniquement.
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué (la route like retombe
 * proprement sur 0).
 */
export function ensureVideoLikesColumn(): Promise<void> {
  if (videoLikesOk) return Promise.resolve();
  if (!inflightVideoLikes) {
    inflightVideoLikes = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "likes" INTEGER NOT NULL DEFAULT 0'
      );
    })()
      .then(() => {
        videoLikesOk = true;
        console.log("[ensure-schema] V3.26 : colonne Video.likes vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Video.likes impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightVideoLikes = null;
      });
  }
  return inflightVideoLikes;
}

let liveLikesOk = false;
let inflightLiveLikes: Promise<void> | null = null;

/**
 * ⭐ V3.39 — S'assure que la colonne `LiveStream.likes` (INTEGER, défaut 0)
 * existe.
 *
 * Contexte : sur la page publique d'un live, le bouton « J'aime » ne
 * faisait que basculer un état React local — aucune persistance serveur, et
 * le like disparaissait au rechargement de la page. Désormais le compteur
 * de likes des lives vit dans une vraie colonne dédiée (même règle que
 * Video.likes en V3.26), lue et incrémentée ATOMIQUEMENT par
 * /api/live/[id]/like (SQL brut : la colonne est hors modèle Prisma, cf.
 * pattern youtubeIngestUrl V3.36).
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué.
 */
export function ensureLiveLikesColumn(): Promise<void> {
  if (liveLikesOk) return Promise.resolve();
  if (!inflightLiveLikes) {
    inflightLiveLikes = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "likes" INTEGER NOT NULL DEFAULT 0'
      );
    })()
      .then(() => {
        liveLikesOk = true;
        console.log("[ensure-schema] V3.39 : colonne LiveStream.likes vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE LiveStream.likes impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightLiveLikes = null;
      });
  }
  return inflightLiveLikes;
}

let intercessionAudioOk = false;
let inflightIntercessionAudio: Promise<void> | null = null;

/**
 * ⭐ V3.30 — S'assure que les colonnes audio de `IntercessionRequest`
 * existent : audioUrl (TEXT), audioDuration (DOUBLE PRECISION), audioMime
 * (TEXT), audioSize (INTEGER).
 *
 * Contexte : la page /intercession permet désormais de joindre une NOTE
 * VOCALE en plus du texte (« possibilité de faire un audio pour permettre
 * à la personne de s'exprimer librement » — demande du pasteur). L'audio
 * est stocké sur R2 (fallback data URL ≤ 1,2 Mo) et relayé dans le canal
 * dédié « Sujets de prière » de Yeshua Connect.
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué.
 */
export function ensureIntercessionAudioColumns(): Promise<void> {
  if (intercessionAudioOk) return Promise.resolve();
  if (!inflightIntercessionAudio) {
    inflightIntercessionAudio = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "audioDuration" DOUBLE PRECISION'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "audioMime" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "audioSize" INTEGER'
      );
    })()
      .then(() => {
        intercessionAudioOk = true;
        console.log("[ensure-schema] V3.30 : colonnes IntercessionRequest.audio* vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE IntercessionRequest.audio* impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightIntercessionAudio = null;
      });
  }
  return inflightIntercessionAudio;
}

let channelIsIntercessionOk = false;
let inflightChannelIsIntercession: Promise<void> | null = null;

let intercessionContactOk = false;
let inflightIntercessionContact: Promise<void> | null = null;

/**
 * ⭐ V3.32 — S'assure que les colonnes LOCALISATION + CONTACT de
 * `IntercessionRequest` existent : pays (TEXT), ville (TEXT),
 * telephone (TEXT), email (TEXT).
 *
 * Contexte (demande du pasteur) : « savoir d'où vient la personne qui fait
 * la demande — de quel pays elle est ». Le formulaire public /intercession
 * recueille désormais le nom complet (colonne `auteur` existante), le pays,
 * la ville, le téléphone et l'email. Ces informations restent strictement
 * confidentielles (back-office + canal dédié « Sujets de prière » de
 * Yeshua Connect, jamais publiques).
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué.
 */
export function ensureIntercessionContactColumns(): Promise<void> {
  if (intercessionContactOk) return Promise.resolve();
  if (!inflightIntercessionContact) {
    inflightIntercessionContact = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "pays" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "ville" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "telephone" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "IntercessionRequest" ADD COLUMN IF NOT EXISTS "email" TEXT'
      );
    })()
      .then(() => {
        intercessionContactOk = true;
        console.log("[ensure-schema] V3.32 : colonnes IntercessionRequest.pays/ville/telephone/email vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE IntercessionRequest.pays/ville/telephone/email impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightIntercessionContact = null;
      });
  }
  return inflightIntercessionContact;
}

/**
 * ⭐ V3.30 — S'assure que la colonne `Channel.isIntercession` (BOOLEAN,
 * défaut false) existe.
 *
 * Contexte : chaque demande d'intercession déposée sur /intercession est
 * relayée dans un canal DÉDIÉ « Sujets de prière » de Yeshua Connect. Ce
 * canal n'est visible et lisible QUE par SUPER_ADMIN et ADMIN (directive
 * pasteur : « c'est seulement les admins, les super admins qui ont accès —
 * même les membres qui envoient leurs sujets ne peuvent pas voir ce qui
 * s'y passe »). Le drapeau permet de distinguer CE canal des autres canaux
 * RESTRICTED (qui restent accessibles aux MODERATORs) et garantit le
 * cloisonnement même si le canal est renommé depuis le back-office.
 *
 * Le canal lui-même est créé à la demande par la route /api/intercession
 * (find-or-create) — ce helper ne fait que poser la colonne.
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué.
 */
export function ensureChannelIsIntercessionColumn(): Promise<void> {
  if (channelIsIntercessionOk) return Promise.resolve();
  if (!inflightChannelIsIntercession) {
    inflightChannelIsIntercession = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "isIntercession" BOOLEAN NOT NULL DEFAULT false'
      );
    })()
      .then(() => {
        channelIsIntercessionOk = true;
        console.log("[ensure-schema] V3.30 : colonne Channel.isIntercession vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Channel.isIntercession impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightChannelIsIntercession = null;
      });
  }
  return inflightChannelIsIntercession;
}

let liveIngestOk = false;
let inflightLiveIngest: Promise<void> | null = null;

/**
 * ⭐ V3.36 — S'assure que les colonnes RUNTIME du flux Tier C existent sur
 * `LiveStream` :
 *  - `youtubeIngestUrl` (TEXT) : l'adresse RTMP complète du broadcast
 *    pré-créé (ingestionAddress + streamKey). L'egress l'utilise comme
 *    destination YouTube pour que le flux parte VERS le broadcast créé par
 *    l'API — sinon le site embarque un ID « zombie » jamais alimenté
 *    (anomalie « vidéo supprimée par l'utilisateur » pendant le direct).
 *  - `youtubeVerifyLastAt` (TIMESTAMP) : throttle de la passe de
 *    vérification/guérison des replays (live-replay-recovery).
 *
 * ⚠️ Écrites et lues UNIQUEMENT en SQL brut (jamais via le client Prisma) :
 * le modèle Prisma de LiveStream n'est PAS modifié, zéro risque pour les
 * requêtes existantes (les SELECT Prisma ignorent les colonnes non
 * modélisées).
 *
 * Mêmes garanties que les autres helpers : idempotent, mémoïsé,
 * concurrentiel, échec DDL purement loggué.
 */
export function ensureLiveYoutubeIngestColumn(): Promise<void> {
  if (liveIngestOk) return Promise.resolve();
  if (!inflightLiveIngest) {
    inflightLiveIngest = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "youtubeIngestUrl" TEXT'
      );
      await db.$executeRawUnsafe(
        'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "youtubeVerifyLastAt" TIMESTAMP'
      );
    })()
      .then(() => {
        liveIngestOk = true;
        console.log("[ensure-schema] V3.36 : colonnes LiveStream.youtubeIngestUrl/youtubeVerifyLastAt vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE LiveStream.youtubeIngest* impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightLiveIngest = null;
      });
  }
  return inflightLiveIngest;
}

// ============================================================
// ⭐ V3.45 — TABLE HeroSection (sections hero paramétrables)
// ============================================================

let heroSectionOk = false;
let inflightHeroSection: Promise<void> | null = null;

/**
 * ⭐ V3.45 — S'assure que la table `HeroSection` existe (une ligne par
 * page publique : landing, afrika, pasteur-kongo, temoignages, …) puis
 * SÈME les lignes manquantes avec les valeurs par défaut du code
 * (src/lib/hero-defaults.ts — import sans dépendance Prisma).
 *
 * Le back-office /admin/heroes peut ensuite modifier image
 * d'arrière-plan, accroches, titres, sous-titres, boutons, photos de
 * biographie et textes complets de chaque hero SANS toucher au code.
 *
 * Mêmes garanties que les autres helpers : idempotent (CREATE TABLE IF
 * NOT EXISTS + ON CONFLICT DO NOTHING), mémoïsé, concurrentiel, échec
 * DDL purement loggué (les pages publiques retombent alors sur les
 * valeurs par défaut du code — aucun crash).
 *
 * NB : les ids sont générés par Prisma (cuid) côté application ; les
 * graines utilisent gen_random_uuid() disponible sur PostgreSQL ≥ 13
 * (extension pgcrypto incluse par défaut sur Neon/Railway).
 */
export function ensureHeroSectionsTable(): Promise<void> {
  if (heroSectionOk) return Promise.resolve();
  if (!inflightHeroSection) {
    inflightHeroSection = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "HeroSection" (
          "id" TEXT NOT NULL,
          "page" TEXT NOT NULL,
          "kicker" TEXT,
          "title" TEXT,
          "titleAccent" TEXT,
          "titleSuffix" TEXT,
          "subtitle" TEXT,
          "backgroundImage" TEXT,
          "ctaLabel" TEXT,
          "ctaHref" TEXT,
          "cta2Label" TEXT,
          "cta2Href" TEXT,
          "dataJson" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "HeroSection_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "HeroSection_page_key" ON "HeroSection"("page")`
      );

      // ⭐ V3.76 — AVANT le semis : renomme la ligne historique page
      // « pam » en « afrika » (les personnalisations du back-office sont
      // ainsi conservées — le semis « afrika » passe en ON CONFLICT SKIP).
      await ensureRenommageAfrika();

      // ── Semis des pages connues (idempotent) ──────────────────────
      const { DEFAULT_HEROES } = await import("@/lib/hero-defaults");
      for (const def of Object.values(DEFAULT_HEROES)) {
        await db.$executeRawUnsafe(
          `INSERT INTO "HeroSection"
             ("id", "page", "kicker", "title", "titleAccent", "titleSuffix",
              "subtitle", "backgroundImage", "ctaLabel", "ctaHref",
              "cta2Label", "cta2Href", "dataJson")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT ("page") DO NOTHING`,
          def.page,
          def.kicker || null,
          def.title || null,
          def.titleAccent || null,
          def.titleSuffix || null,
          def.subtitle || null,
          def.backgroundImage || null,
          def.ctaLabel || null,
          def.ctaHref || null,
          def.cta2Label || null,
          def.cta2Href || null,
          JSON.stringify(def.data ?? {}),
        );
      }
    })()
      .then(() => {
        heroSectionOk = true;
        console.log("[ensure-schema] V3.45 : table HeroSection vérifiée/créée + pages semées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] CREATE TABLE HeroSection impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightHeroSection = null;
      });
  }
  return inflightHeroSection;
}

let videoCategoryOk = false;
let inflightVideoCategory: Promise<void> | null = null;

/**
 * ⭐ V3.46 — S'assure que la colonne `Video.category` (TEXT, nullable)
 * existe.
 *
 * Contexte : rubriques signatures des vidéos — « Saint-Esprit réponds-moi »
 * (Afrika), « Rhema du matin » / « Rhema du soir » (Pasteur Kongo). La
 * rubrique est assignée depuis le back-office (module Vidéos) ou héritée
 * du live (LiveStream.category) à l'archivage du replay. NULL = technique
 * historique de catégorisation par mots-clés du titre (aucune régression
 * pour le contenu existant).
 *
 * Mêmes garanties que les autres helpers : idempotent (ADD COLUMN IF NOT
 * EXISTS), mémoïsé, concurrentiel, échec DDL purement loggué.
 */
export function ensureVideoCategoryColumn(): Promise<void> {
  if (videoCategoryOk) return Promise.resolve();
  if (!inflightVideoCategory) {
    inflightVideoCategory = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "category" TEXT'
      );
    })()
      .then(() => {
        videoCategoryOk = true;
        console.log("[ensure-schema] V3.46 : colonne Video.category vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Video.category impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightVideoCategory = null;
      });
  }
  return inflightVideoCategory;
}

let liveCategoryOk = false;
let inflightLiveCategory: Promise<void> | null = null;

/**
 * ⭐ V3.46 — S'assure que la colonne `LiveStream.category` (TEXT,
 * nullable) existe.
 *
 * Contexte : rubrique posée à la programmation d'un live (back-office,
 * module Lives) — le replay créé à l'arrêt du live HÉRITE de cette
 * rubrique (Video.category). NULL = replay auto-catégorisé par
 * mots-clés (comportement historique).
 */
export function ensureLiveCategoryColumn(): Promise<void> {
  if (liveCategoryOk) return Promise.resolve();
  if (!inflightLiveCategory) {
    inflightLiveCategory = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "category" TEXT'
      );
    })()
      .then(() => {
        liveCategoryOk = true;
        console.log("[ensure-schema] V3.46 : colonne LiveStream.category vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE LiveStream.category impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightLiveCategory = null;
      });
  }
  return inflightLiveCategory;
}

/**
 * ⭐ V3.46 — Garde combinée : colonnes rubrique Video + LiveStream.
 * À appeler en tête de toute route qui LIT ou ÉCRIT ces modèles via le
 * client Prisma (le modèle généré sélectionne désormais ces colonnes →
 * P2022 si la colonne manque sur une base froide).
 */
export function ensureRubriquesColumns(): Promise<void> {
  return Promise.all([ensureVideoCategoryColumn(), ensureLiveCategoryColumn()]).then(() => {});
}

let biographyPhotoOk = false;
let inflightBiographyPhoto: Promise<void> | null = null;

/**
 * ⭐ V3.47 — S'assure que la colonne `Biography.photoUrl` (TEXT,
 * nullable) existe.
 *
 * Contexte : photo de chaque jalon de la frise biographique, uploadée
 * depuis le modal du back-office (/admin/biographies) et affichée sur
 * les pages publiques /afrika et /pasteur-kongo. NULL = jalon sans photo.
 * Le client Prisma généré sélectionne désormais cette colonne (findMany
 * / findUnique / create / update) → P2022 sur une base froide sans
 * cette garde (même pattern que Video.category, V3.46).
 */
export function ensureBiographyPhotoColumn(): Promise<void> {
  if (biographyPhotoOk) return Promise.resolve();
  if (!inflightBiographyPhoto) {
    inflightBiographyPhoto = (async () => {
      await db.$executeRawUnsafe(
        'ALTER TABLE "Biography" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT'
      );
    })()
      .then(() => {
        biographyPhotoOk = true;
        console.log("[ensure-schema] V3.47 : colonne Biography.photoUrl vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Biography.photoUrl impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightBiographyPhoto = null;
      });
  }
  return inflightBiographyPhoto;
}

// ============================================================
// ⭐ V3.66 — SECRÉTARIAT & TRÉSORERIE (sous-domaines dédiés)
// ============================================================

let staffSpacesOk = false;
let inflightStaffSpaces: Promise<void> | null = null;

/**
 * ⭐ V3.66 — S'assure que tout l'outillage des deux espaces dédiés
 * existe sur la base :
 *
 *  1. Valeurs d'enum `UserRole` : SECRETARY (secrétariat) et TREASURER
 *     (trésorerie) — sans elles, toute requête filtrant sur ces rôles
 *     échoue (« invalid input value for enum UserRole »).
 *  2. Tables `MeetingRequest` (demandes de rencontre), `MinistryAnnouncement`
 *     (annonces du ministère) et `TreasuryTransaction` (journal financier)
 *     avec leurs index.
 *  ⭐ V3.74 : colonnes du flux de validation (source, validatedAt…),
 *     tables `StaffSetting` (paramétrage des emails serviteurs) et
 *     `StaffNotification` (notifications in-app), et SUPPRESSION de la
 *     table `ContactRequest` (module « Demandes de contact » retiré du
 *     back-office — le Secrétariat et la Trésorerie couvrent le besoin).
 *
 * À appeler en tête de CHAQUE route API des espaces (login, dashboards,
 * CRUD, rapports) : idempotent, mémoïsé, un seul DDL en vol — exactement
 * le pattern V3.45 (ensureHeroSectionsTable) qui a déjà fait ses preuves
 * sur la base de production.
 */
export function ensureStaffSpaces(): Promise<void> {
  if (staffSpacesOk) return Promise.resolve();
  if (!inflightStaffSpaces) {
    inflightStaffSpaces = (async () => {
      // ① Valeurs d'enum (⚠️ PostgreSQL : ADD VALUE hors transaction —
      // $executeRawUnsafe ne s'exécute pas dans un bloc transactionnel,
      // même mécanisme que CallSignal → MessageType 'CALL_LOG', V3.1).
      await db.$executeRawUnsafe(
        `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECRETARY'`
      );
      await db.$executeRawUnsafe(
        `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TREASURER'`
      );

      // ② Secrétariat — demandes de rencontre avec les serviteurs.
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MeetingRequest" (
          "id" TEXT NOT NULL,
          "requesterName" TEXT NOT NULL,
          "contact" TEXT NOT NULL,
          "servantCode" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "urgency" TEXT NOT NULL DEFAULT 'normale',
          "country" TEXT,
          "city" TEXT,
          "status" TEXT NOT NULL DEFAULT 'RECUE',
          "transmissionNote" TEXT,
          "transmittedAt" TIMESTAMPTZ,
          "processedAt" TIMESTAMPTZ,
          "handledById" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "MeetingRequest_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MeetingRequest_status_idx" ON "MeetingRequest"("status")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MeetingRequest_servantCode_idx" ON "MeetingRequest"("servantCode")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MeetingRequest_urgency_idx" ON "MeetingRequest"("urgency")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MeetingRequest_createdAt_idx" ON "MeetingRequest"("createdAt")'
      );

      // ③ Secrétariat — annonces officielles du ministère.
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MinistryAnnouncement" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "category" TEXT NOT NULL DEFAULT 'generale',
          "isPublished" BOOLEAN NOT NULL DEFAULT false,
          "publishedAt" TIMESTAMPTZ,
          "authorId" TEXT,
          "relayedToYeshua" BOOLEAN NOT NULL DEFAULT false,
          "relayedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "MinistryAnnouncement_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MinistryAnnouncement_isPublished_idx" ON "MinistryAnnouncement"("isPublished")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MinistryAnnouncement_category_idx" ON "MinistryAnnouncement"("category")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MinistryAnnouncement_publishedAt_idx" ON "MinistryAnnouncement"("publishedAt")'
      );

      // ④ Trésorerie — journal des recettes et dépenses.
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TreasuryTransaction" (
          "id" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "amount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'EUR',
          "method" TEXT,
          "label" TEXT NOT NULL,
          "date" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "reference" TEXT,
          "donorName" TEXT,
          "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
          "note" TEXT,
          "createdBy" TEXT,
          "updatedBy" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "TreasuryTransaction_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryTransaction_type_idx" ON "TreasuryTransaction"("type")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryTransaction_category_idx" ON "TreasuryTransaction"("category")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryTransaction_date_idx" ON "TreasuryTransaction"("date")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryTransaction_currency_idx" ON "TreasuryTransaction"("currency")'
      );
      // ⑤ V3.67 — Trésorerie : MULTICAISSE. Table des caisses (solde
      // d'ouverture inclus — jamais de total stocké) + colonnes de
      // rattachement sur le journal (caisseId = caisse concernée ou
      // SOURCE d'un transfert ; caisseDestinationId = destination).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TreasuryCashAccount" (
          "id" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'especes',
          "currency" TEXT NOT NULL DEFAULT 'EUR',
          "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "description" TEXT,
          "createdBy" TEXT,
          "updatedBy" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "TreasuryCashAccount_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryCashAccount_code_key" ON "TreasuryCashAccount"("code")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryCashAccount_isActive_idx" ON "TreasuryCashAccount"("isActive")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryCashAccount_currency_idx" ON "TreasuryCashAccount"("currency")'
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "TreasuryTransaction" ADD COLUMN IF NOT EXISTS "caisseId" TEXT`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "TreasuryTransaction" ADD COLUMN IF NOT EXISTS "caisseDestinationId" TEXT`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "TreasuryTransaction_caisseId_idx" ON "TreasuryTransaction"("caisseId")'
      );

      // ⑥ V3.67 — Secrétariat : code de suivi public des demandes.
      await db.$executeRawUnsafe(
        `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "trackingCode" TEXT`
      );
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "MeetingRequest_trackingCode_key" ON "MeetingRequest"("trackingCode")'
      );

      // ⑦ V3.67 — Annonces : publication planifiée (publishAt).
      await db.$executeRawUnsafe(
        `ALTER TABLE "MinistryAnnouncement" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMPTZ`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "MinistryAnnouncement_publishAt_idx" ON "MinistryAnnouncement"("publishAt")'
      );

      // ⑧ V3.74 — Flux de bout en bout des demandes de rencontre :
      //    · source (SITE = formulaire public pré-rempli / MANUEL =
      //      présentiel, saisie secrétaire) ;
      //    · validatedAt / validatedById : validation par le serviteur
      //      depuis SON back-office → notification à la secrétaire.
      await db.$executeRawUnsafe(
        `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUEL'`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMPTZ`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "validatedById" TEXT`
      );

      // ⑨ V3.74 — Paramétrage des espaces (clé/valeur). Clés actuelles :
      // email_kongo / email_afrika (bouton « Paramétrage » du Courrier).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StaffSetting" (
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "StaffSetting_pkey" PRIMARY KEY ("key")
        )
      `);

      // ⑩ V3.74 — Notifications in-app des espaces (cloche Secrétariat :
      // validation d'une demande par le serviteur, etc.).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StaffNotification" (
          "id" TEXT NOT NULL,
          "espace" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "titre" TEXT NOT NULL,
          "message" TEXT,
          "lien" TEXT,
          "readAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
        )
      `);
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "StaffNotification_espace_readAt_idx" ON "StaffNotification"("espace", "readAt")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "StaffNotification_createdAt_idx" ON "StaffNotification"("createdAt")'
      );

      // ⑪ V3.74 — Module « Demandes de contact » RETIRÉ du back-office
      // (obsolète : le Secrétariat couvre les demandes de rencontre, la
      // Trésorerie les finances). La table et son contenu disparaissent —
      // la page publique /contact redirige vers /rendez-vous.
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "ContactRequest"`);

      // ⑫ ⭐ V3.76 — Renommage « Pam » → « Afrika » des données (une fois
      // les tables ci-dessus garanties exister — MeetingRequest/StaffSetting).
      await ensureRenommageAfrika();
    })()
      .then(() => {
        staffSpacesOk = true;
        console.log("[ensure-schema] V3.66 : rôles SECRETARY/TREASURER + tables secrétariat/trésorerie vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] V3.66 : création tables/rôles staff impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightStaffSpaces = null;
      });
  }
  return inflightStaffSpaces;
}

// ═══════════════════════════════════════════════════════════════════════
// ⭐ V3.69 — Emails transactionnels (Resend) : tables de l'OTP et du
// journal des envois.
// ═══════════════════════════════════════════════════════════════════════

let emailTablesOk = false;
let inflightEmailTables: Promise<void> | null = null;

/**
 * S'assure que les tables de l'OTP de réinitialisation (`PasswordResetOtp`)
 * et du journal des emails sortants (`OutgoingEmail`) existent.
 *
 * Mêmes garanties que les autres helpers : idempotent (CREATE TABLE IF NOT
 * EXISTS / CREATE INDEX IF NOT EXISTS), mémoïsé en mémoire module, un seul
 * DDL en vol — à appeler en tête des routes /api/auth/forgot-password,
 * /api/auth/reset-password, /secretariat/api/courrier.
 */
export function ensureEmailTables(): Promise<void> {
  if (emailTablesOk) return Promise.resolve();
  if (!inflightEmailTables) {
    inflightEmailTables = (async () => {
      // ① OTP de réinitialisation de mot de passe (code haché).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PasswordResetOtp" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "codeHash" TEXT NOT NULL,
          "userId" TEXT,
          "expiresAt" TIMESTAMPTZ NOT NULL,
          "consumedAt" TIMESTAMPTZ,
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
        )`
      );
      // ⭐ V3.81 — colonne « purpose » (PASSWORD_RESET | EMAIL_CHANGE)
      // pour la table préexistante : ALTER idempotent.
      await db.$executeRawUnsafe(
        `ALTER TABLE "PasswordResetOtp"
           ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET'`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "PasswordResetOtp_email_createdAt_idx" ON "PasswordResetOtp"("email", "createdAt")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "PasswordResetOtp_userId_purpose_idx" ON "PasswordResetOtp"("userId", "purpose")'
      );

      // ② Journal des emails sortants (traçabilité des expéditions).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OutgoingEmail" (
          "id" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "toEmail" TEXT NOT NULL,
          "toName" TEXT,
          "subject" TEXT NOT NULL,
          "body" TEXT,
          "status" TEXT NOT NULL DEFAULT 'ENVOYE',
          "errorMessage" TEXT,
          "resendId" TEXT,
          "sentById" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "OutgoingEmail_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "OutgoingEmail_category_createdAt_idx" ON "OutgoingEmail"("category", "createdAt")'
      );
      await db.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "OutgoingEmail_toEmail_idx" ON "OutgoingEmail"("toEmail")'
      );
    })()
      .then(() => {
        emailTablesOk = true;
        console.log("[ensure-schema] V3.69 : tables OTP + emails sortants vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] V3.69 : création tables emails impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightEmailTables = null;
      });
  }
  return inflightEmailTables;
}

// ============================================================
// ⭐ V3.76 — RENOMMAGE « Pam » → « Afrika » (données existantes)
// ============================================================

let renommageAfrikaOk = false;
let inflightRenommageAfrika: Promise<void> | null = null;

/**
 * ⭐ V3.76 — Migration des DONNÉES existantes vers le renommage de la
 * servante de Dieu : son prénom réel « Afrika » (Afrika Alkebulane
 * Pamela Dali) remplace partout le surnom « Pam » (décision du
 * 2026-09-14 — landing, navbar, back-office, Yeshua Connect, base).
 *
 * Portée (idempotent — chaque statement ne matche que les valeurs
 * pré-V3.76) :
 *  · Servant : code « pam » → « afrika » + textes (shortName / fullName /
 *    role / bio — frontière de mot \y, « Pamela » et les clés internes
 *    pamPhoto/pamName… du hero ne sont PAS touchées) ;
 *  · User : compte de la servante → name « Afrika » (⚠️ l'email de
 *    connexion pam@christ-libere.org et le mot de passe sont INCHANGÉS) ;
 *  · MeetingRequest : servantCode « pam » → « afrika » ;
 *  · HeroSection : page « pam » → « afrika », ctaHref « /pam » →
 *    « /afrika », textes affichés + dataJson ;
 *  · StaffSetting : clé « email_pam » → « email_afrika » (l'adresse
 *    réelle paramétrée par le secrétariat est conservée) ;
 *  · Contenus : Biography / Testimony / Teaching / Video / LiveStream —
 *    mot « Pam » → « Afrika » (élision « de Pam » → « d'Afrika »).
 *
 * ⚠️ Les journaux (AuditLog, OutgoingEmail, StaffNotification) gardent
 * leur texte historique : trace d'audit intangible.
 *
 * Mêmes garanties que les autres helpers : mémoïsé, un seul vol en
 * concurrence, chaque statement protégé (échec loggué, jamais de crash
 * de page — les statements ratés seront rejoués au prochain cold start).
 */
export function ensureRenommageAfrika(): Promise<void> {
  if (renommageAfrikaOk) return Promise.resolve();
  if (!inflightRenommageAfrika) {
    inflightRenommageAfrika = (async () => {
      let echecs = 0;
      const pas = async (libelle: string, sql: string) => {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (e: unknown) {
          echecs++;
          console.warn(
            `[ensure-schema] V3.76 (${libelle}) :`,
            e instanceof Error ? e.message : e
          );
        }
      };

      // ── 1. Servant : code serviteur + textes ──────────────────────
      await pas(
        "Servant.code",
        `UPDATE "Servant" SET code = 'afrika' WHERE code = 'pam'`
      );
      await pas(
        "Servant.PAM",
        `UPDATE "Servant" SET
           "shortName" = regexp_replace("shortName", '\\yPAM\\y', 'Afrika', 'g'),
           "fullName"  = regexp_replace("fullName",  '\\yPAM\\y', 'Afrika', 'g'),
           "role"      = regexp_replace("role",      '\\yPAM\\y', 'Afrika', 'g'),
           "bio"       = regexp_replace("bio",       '\\yPAM\\y', 'Afrika', 'g')
         WHERE "shortName" ~ '\\yPAM\\y' OR "fullName" ~ '\\yPAM\\y'
            OR "role" ~ '\\yPAM\\y' OR "bio" ~ '\\yPAM\\y'`
      );
      // ⭐ V3.76-bis — élision MAJUSCULE (« de PAM » → « d'Afrika » — la bio
      // de Pasteur Kongo en base contient « ministère prophétique de PAM »).
      await pas(
        "Servant.elisionPAM",
        `UPDATE "Servant" SET
           "shortName" = regexp_replace("shortName", '\\yde PAM\\y', 'd''Afrika', 'g'),
           "fullName"  = regexp_replace("fullName",  '\\yde PAM\\y', 'd''Afrika', 'g'),
           "role"      = regexp_replace("role",      '\\yde PAM\\y', 'd''Afrika', 'g'),
           "bio"       = regexp_replace("bio",       '\\yde PAM\\y', 'd''Afrika', 'g')
         WHERE "shortName" ~ '\\yde PAM\\y' OR "fullName" ~ '\\yde PAM\\y'
            OR "role" ~ '\\yde PAM\\y' OR "bio" ~ '\\yde PAM\\y'`
      );
      // Élision française d'abord (« de Pam » → « d'Afrika »)…
      await pas(
        "Servant.elision",
        `UPDATE "Servant" SET
           "shortName" = regexp_replace("shortName", '\\yde Pam\\y', 'd''Afrika', 'g'),
           "fullName"  = regexp_replace("fullName",  '\\yde Pam\\y', 'd''Afrika', 'g'),
           "role"      = regexp_replace("role",      '\\yde Pam\\y', 'd''Afrika', 'g'),
           "bio"       = regexp_replace("bio",       '\\yde Pam\\y', 'd''Afrika', 'g')
         WHERE "shortName" ~ '\\yde Pam\\y' OR "fullName" ~ '\\yde Pam\\y'
            OR "role" ~ '\\yde Pam\\y' OR "bio" ~ '\\yde Pam\\y'`
      );
      // …puis le mot isolé (« Pamela » intact : frontière de mot).
      await pas(
        "Servant.textes",
        `UPDATE "Servant" SET
           "shortName" = regexp_replace("shortName", '\\yPam\\y', 'Afrika', 'g'),
           "fullName"  = regexp_replace("fullName",  '\\yPam\\y', 'Afrika', 'g'),
           "role"      = regexp_replace("role",      '\\yPam\\y', 'Afrika', 'g'),
           "bio"       = regexp_replace("bio",       '\\yPam\\y', 'Afrika', 'g')
         WHERE "shortName" ~ '\\yPam\\y' OR "fullName" ~ '\\yPam\\y'
            OR "role" ~ '\\yPam\\y' OR "bio" ~ '\\yPam\\y'`
      );

      // ── 2. User : nom d'affichage (email + mot de passe inchangés) ─
      await pas(
        "User.name",
        `UPDATE "User" SET name = 'Afrika'
         WHERE email = 'pam@christ-libere.org' AND name IS DISTINCT FROM 'Afrika'`
      );

      // ── 3. MeetingRequest : code serviteur des demandes ───────────
      await pas(
        "MeetingRequest.servantCode",
        `UPDATE "MeetingRequest" SET "servantCode" = 'afrika' WHERE "servantCode" = 'pam'`
      );

      // ── 4. HeroSection : clé de page + liens + textes ─────────────
      await pas(
        "HeroSection.page",
        `UPDATE "HeroSection" SET page = 'afrika' WHERE page = 'pam'`
      );
      await pas(
        "HeroSection.liens",
        `UPDATE "HeroSection" SET
           "ctaHref"  = '/afrika' WHERE "ctaHref"  = '/pam'`
      );
      await pas(
        "HeroSection.liens2",
        `UPDATE "HeroSection" SET
           "cta2Href" = '/afrika' WHERE "cta2Href" = '/pam'`
      );
      await pas(
        "HeroSection.elision",
        `UPDATE "HeroSection" SET
           "kicker"     = regexp_replace("kicker",     '\\yde Pam\\y', 'd''Afrika', 'g'),
           "title"      = regexp_replace("title",      '\\yde Pam\\y', 'd''Afrika', 'g'),
           "titleAccent"= regexp_replace("titleAccent",'\\yde Pam\\y', 'd''Afrika', 'g'),
           "titleSuffix"= regexp_replace("titleSuffix",'\\yde Pam\\y', 'd''Afrika', 'g'),
           "subtitle"   = regexp_replace("subtitle",   '\\yde Pam\\y', 'd''Afrika', 'g'),
           "ctaLabel"   = regexp_replace("ctaLabel",   '\\yde Pam\\y', 'd''Afrika', 'g'),
           "cta2Label"  = regexp_replace("cta2Label",  '\\yde Pam\\y', 'd''Afrika', 'g'),
           "dataJson"   = regexp_replace("dataJson",   '\\yde Pam\\y', 'd''Afrika', 'g')
         WHERE "kicker" ~ '\\yde Pam\\y' OR "title" ~ '\\yde Pam\\y' OR "titleAccent" ~ '\\yde Pam\\y'
            OR "titleSuffix" ~ '\\yde Pam\\y' OR "subtitle" ~ '\\yde Pam\\y'
            OR "ctaLabel" ~ '\\yde Pam\\y' OR "cta2Label" ~ '\\yde Pam\\y' OR "dataJson" ~ '\\yde Pam\\y'`
      );
      await pas(
        "HeroSection.textes",
        `UPDATE "HeroSection" SET
           "kicker"     = regexp_replace("kicker",     '\\yPam\\y', 'Afrika', 'g'),
           "title"      = regexp_replace("title",      '\\yPam\\y', 'Afrika', 'g'),
           "titleAccent"= regexp_replace("titleAccent",'\\yPam\\y', 'Afrika', 'g'),
           "titleSuffix"= regexp_replace("titleSuffix",'\\yPam\\y', 'Afrika', 'g'),
           "subtitle"   = regexp_replace("subtitle",   '\\yPam\\y', 'Afrika', 'g'),
           "ctaLabel"   = regexp_replace("ctaLabel",   '\\yPam\\y', 'Afrika', 'g'),
           "cta2Label"  = regexp_replace("cta2Label",  '\\yPam\\y', 'Afrika', 'g'),
           "dataJson"   = regexp_replace("dataJson",   '\\yPam\\y', 'Afrika', 'g')
         WHERE "kicker" ~ '\\yPam\\y' OR "title" ~ '\\yPam\\y' OR "titleAccent" ~ '\\yPam\\y'
            OR "titleSuffix" ~ '\\yPam\\y' OR "subtitle" ~ '\\yPam\\y'
            OR "ctaLabel" ~ '\\yPam\\y' OR "cta2Label" ~ '\\yPam\\y' OR "dataJson" ~ '\\yPam\\y'`
      );
      // ⭐ V3.76-bis — HeroSection en MAJUSCULES aussi.
      await pas(
        "HeroSection.elisionPAM",
        `UPDATE "HeroSection" SET
           "kicker"     = regexp_replace("kicker",     '\\yde PAM\\y', 'd''Afrika', 'g'),
           "title"      = regexp_replace("title",      '\\yde PAM\\y', 'd''Afrika', 'g'),
           "titleAccent"= regexp_replace("titleAccent",'\\yde PAM\\y', 'd''Afrika', 'g'),
           "titleSuffix"= regexp_replace("titleSuffix",'\\yde PAM\\y', 'd''Afrika', 'g'),
           "subtitle"   = regexp_replace("subtitle",   '\\yde PAM\\y', 'd''Afrika', 'g'),
           "ctaLabel"   = regexp_replace("ctaLabel",   '\\yde PAM\\y', 'd''Afrika', 'g'),
           "cta2Label"  = regexp_replace("cta2Label",  '\\yde PAM\\y', 'd''Afrika', 'g'),
           "dataJson"   = regexp_replace("dataJson",   '\\yde PAM\\y', 'd''Afrika', 'g')
         WHERE "kicker" ~ '\\yde PAM\\y' OR "title" ~ '\\yde PAM\\y' OR "titleAccent" ~ '\\yde PAM\\y'
            OR "titleSuffix" ~ '\\yde PAM\\y' OR "subtitle" ~ '\\yde PAM\\y'
            OR "ctaLabel" ~ '\\yde PAM\\y' OR "cta2Label" ~ '\\yde PAM\\y' OR "dataJson" ~ '\\yde PAM\\y'`
      );
      await pas(
        "HeroSection.PAM",
        `UPDATE "HeroSection" SET
           "kicker"     = regexp_replace("kicker",     '\\yPAM\\y', 'Afrika', 'g'),
           "title"      = regexp_replace("title",      '\\yPAM\\y', 'Afrika', 'g'),
           "titleAccent"= regexp_replace("titleAccent",'\\yPAM\\y', 'Afrika', 'g'),
           "titleSuffix"= regexp_replace("titleSuffix",'\\yPAM\\y', 'Afrika', 'g'),
           "subtitle"   = regexp_replace("subtitle",   '\\yPAM\\y', 'Afrika', 'g'),
           "ctaLabel"   = regexp_replace("ctaLabel",   '\\yPAM\\y', 'Afrika', 'g'),
           "cta2Label"  = regexp_replace("cta2Label",  '\\yPAM\\y', 'Afrika', 'g'),
           "dataJson"   = regexp_replace("dataJson",   '\\yPAM\\y', 'Afrika', 'g')
         WHERE "kicker" ~ '\\yPAM\\y' OR "title" ~ '\\yPAM\\y' OR "titleAccent" ~ '\\yPAM\\y'
            OR "titleSuffix" ~ '\\yPAM\\y' OR "subtitle" ~ '\\yPAM\\y'
            OR "ctaLabel" ~ '\\yPAM\\y' OR "cta2Label" ~ '\\yPAM\\y' OR "dataJson" ~ '\\yPAM\\y'`
      );

      // ── 5. StaffSetting : clé du paramétrage email ────────────────
      await pas(
        "StaffSetting.key",
        `UPDATE "StaffSetting" SET key = 'email_afrika'
         WHERE key = 'email_pam'
           AND NOT EXISTS (SELECT 1 FROM "StaffSetting" s2 WHERE s2.key = 'email_afrika')`
      );

      // ── 6. Contenus (mot « Pam » ; élision puis mot isolé) ────────
      const tablesTextes: Array<[string, string[]]> = [
        ["Biography", ["title", "description"]],
        ["Testimony", ["title", "short", "content"]],
        ["Teaching", ["title", "excerpt", "content"]],
        ["Video", ["title", "description"]],
        ["LiveStream", ["title", "description"]],
        // ⭐ V3.76-bis — chaînes (description « Communications officielles
        // de PAM… » du seed) et annonces officielles du ministère.
        ["Channel", ["name", "description"]],
        ["MinistryAnnouncement", ["title", "content"]],
      ];
      for (const [table, cols] of tablesTextes) {
        // ⭐ V3.76-bis — 4 passes : élisions + mots isolés, casse mixte ET
        // MAJUSCULES (« de Pam », « de PAM », « Pam », « PAM »).
        const variantes: Array<[string, string]> = [
          ["de Pam", "d''Afrika"],
          ["de PAM", "d''Afrika"],
          ["Pam", "Afrika"],
          ["PAM", "Afrika"],
        ];
        for (const [motif, remplacement] of variantes) {
          const set = cols
            .map((c) => `"${c}" = regexp_replace("${c}", '\\y${motif}\\y', '${remplacement}', 'g')`)
            .join(",\n           ");
          const where = cols
            .map((c) => `"${c}" ~ '\\y${motif}\\y'`)
            .join(" OR ");
          await pas(
            `${table}.${motif.replace(/\s/g, "_")}`,
            `UPDATE "${table}" SET ${set} WHERE ${where}`
          );
        }
      }

      if (echecs === 0) {
        console.log(
          "[ensure-schema] V3.76 : renommage Pam → Afrika appliqué (Servant, User, MeetingRequest, HeroSection, StaffSetting, contenus) ✓"
        );
      } else {
        console.warn(
          `[ensure-schema] V3.76 : ${echecs} statement(s) en échec — rejoués au prochain cold start`
        );
        throw new Error(`renommage V3.76 incomplet (${echecs} échecs)`);
      }
    })()
      .then(() => {
        renommageAfrikaOk = true;
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] V3.76 : migration renommage Afrika impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightRenommageAfrika = null;
      });
  }
  return inflightRenommageAfrika;
}

// ============================================================
// ⭐ V3.82 — PASSERELLES DE PAIEMENT (DONS EN LIGNE)
// ============================================================

let donsTablesOk = false;
let inflightDonsTables: Promise<void> | null = null;

/**
 * ⭐ V3.82 — Colonnes de la table « dons » (modèle Donation) + journal
 * des webhooks paiement (WebhookLog).
 *
 * Donation existait déjà (page /contribuer antérieure) : les colonnes de
 * la passerelle (reference, provider, providerRef, typeDon, statut,
 * recurrent, confirmedAt) sont ajoutées par ALTER idempotent.
 *
 * Les éventuelles lignes saisies AVANT V3.82 (page de simulation — elle
 * n'écrivait jamais en base, mais par précaution) sont marquées
 * « approved » : elles ne doivent pas apparaître « en attente » dans le
 * back-office (la colonne reference reste NULL = non issues de la
 * passerelle).
 *
 * La caisse trésorerie « Dons en ligne » est également créée si elle
 * n'existe pas encore : c'est là que le webhook dispatch chaque don
 * approuvé (TreasuryTransaction RECETTE, catégorie offrande/dime/don).
 */
export function ensureDonsTables(): Promise<void> {
  if (donsTablesOk) return Promise.resolve();
  if (!inflightDonsTables) {
    inflightDonsTables = (async () => {
      // ① Colonnes de la passerelle sur Donation.
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "reference" TEXT`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "provider" TEXT`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "providerRef" TEXT`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "typeDon" TEXT`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "statut" TEXT NOT NULL DEFAULT 'pending'`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "recurrent" BOOLEAN NOT NULL DEFAULT false`
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMPTZ`
      );

      // ② Index (reference est UNIQUE — les lignes antérieures restent NULL,
      // Postgres autorise plusieurs NULL dans un index unique).
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Donation_reference_key" ON "Donation"("reference")`
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Donation_providerRef_idx" ON "Donation"("providerRef")`
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Donation_statut_idx" ON "Donation"("statut")`
      );

      // ③ Lignes antérieures à V3.82 : jamais passées par la passerelle →
      // considérées comme traitées (no-op après la première exécution).
      await db.$executeRawUnsafe(
        `UPDATE "Donation" SET "statut" = 'approved' WHERE "reference" IS NULL AND "statut" = 'pending'`
      );

      // ④ Journal des webhooks paiement (rejeu manuel en cas d'incident).
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "WebhookLog" (
          "id" TEXT NOT NULL,
          "provider" TEXT NOT NULL,
          "event" TEXT NOT NULL,
          "statut" TEXT NOT NULL,
          "reference" TEXT,
          "providerRef" TEXT,
          "erreur" TEXT,
          "payload" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
        )`
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "WebhookLog_provider_createdAt_idx" ON "WebhookLog"("provider", "createdAt")`
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "WebhookLog_reference_idx" ON "WebhookLog"("reference")`
      );

      // ⑤ Caisse trésorerie dédiée aux dons en ligne (code stable "dons-en-ligne").
      await db.$executeRawUnsafe(`
        INSERT INTO "TreasuryCashAccount"
          ("id", "code", "name", "type", "currency", "openingBalance", "isActive", "description", "createdBy", "createdAt", "updatedAt")
        VALUES (
          'caisse-dons-en-ligne-v382',
          'dons-en-ligne',
          'Dons en ligne (FedaPay / Paystack)',
          'autre',
          'XOF',
          0,
          true,
          'Encaissements automatiques de la page /contribuer : offrandes, dîmes et dons payés via FedaPay (Afrique de l''Ouest) ou Paystack (international). Écritures créées automatiquement à l''approbation du paiement.',
          'system-v382',
          now(),
          now()
        )
        ON CONFLICT ("code") DO NOTHING
      `);
    })()
      .then(() => {
        donsTablesOk = true;
        console.log("[ensure-schema] V3.82 : table dons (passerelle) + WebhookLog + caisse « Dons en ligne » vérifiées/créées ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] V3.82 : migration table dons impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightDonsTables = null;
      });
  }
  return inflightDonsTables;
}

// ─────────────────────────────────────────────────────────────────────
// ⭐ V3.83 — Configuration des passerelles de paiement (back-office).
// ─────────────────────────────────────────────────────────────────────

let paiementsTableOk = false;
let inflightPaiementsTable: Promise<void> | null = null;

/**
 * S'assure que la table PaymentGatewayConfig existe (config FedaPay /
 * Paystack depuis /admin/paiements). Même contrat que ensureDonsTables :
 * DDL idempotent, mémoïsé, échec loggué sans casser la requête courante
 * (repli sur les variables d'environnement V3.82).
 */
export function ensurePaiementsTable(): Promise<void> {
  if (paiementsTableOk) return Promise.resolve();
  if (!inflightPaiementsTable) {
    inflightPaiementsTable = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PaymentGatewayConfig" (
          "provider" TEXT NOT NULL,
          "enabled" BOOLEAN NOT NULL DEFAULT false,
          "environment" TEXT NOT NULL DEFAULT 'sandbox',
          "secretKeyEnc" TEXT,
          "webhookSecretEnc" TEXT,
          "cleLast4" TEXT,
          "webhookLast4" TEXT,
          "updatedBy" TEXT,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("provider")
        )`
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "PaymentGatewayConfig_updatedAt_idx" ON "PaymentGatewayConfig"("updatedAt")`
      );
    })()
      .then(() => {
        paiementsTableOk = true;
        console.log("[ensure-schema] V3.83 : table PaymentGatewayConfig vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] V3.83 : migration PaymentGatewayConfig impossible :",
          e instanceof Error ? e.message : e
        );
      })
      .finally(() => {
        inflightPaiementsTable = null;
      });
  }
  return inflightPaiementsTable;
}
