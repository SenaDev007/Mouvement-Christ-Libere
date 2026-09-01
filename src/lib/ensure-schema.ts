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
