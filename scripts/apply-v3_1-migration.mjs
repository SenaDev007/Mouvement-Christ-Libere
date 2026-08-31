/**
 * ⭐ V3.1 — Application de la migration V3.1 (appels + direct intra-canal).
 *
 * 1. CREATE TABLE IF NOT EXISTS "CallSignal" (+ index) — signalisation des
 *    appels audio/vidéo Yeshua Connect : c'est elle qui fait SONNER l'appel
 *    chez les destinataires (polling 3 s), ce qui manquait totalement avant.
 * 2. ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'CALL_LOG' — journaux
 *    d'appel dans le chat (« Appel manqué », « Appel terminé · 3 min 12 s »).
 *
 * Idempotent — sans risque si déjà appliqué (l'ensure-schema le re-vérifie
 * à chaud au premier appel API de chaque lambda Vercel).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
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
  await db.$executeRawUnsafe(
    `ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'CALL_LOG'`
  );
  console.log("✓ Migration V3.1 appliquée (table CallSignal + enum CALL_LOG)");
}

main()
  .catch((e) => {
    console.error("✗ Migration V3.1 échouée :", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
