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

let messageTypeEnumOk = false;
let inflightMessageEnum: Promise<void> | null = null;

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
    })()
      .then(() => {
        messageTypeEnumOk = true;
        console.log("[ensure-schema] Enum MessageType : valeurs VERSE/ANNOUNCEMENT/GIF vérifiées/ajoutées ✓");
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
