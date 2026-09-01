/**
 * V3.5 — Crée la table UserBlock (blocage entre membres, sécurité des
 * conversations privées Yeshua Connect) directement en base.
 * Idempotent (CREATE TABLE / INDEX IF NOT EXISTS) — relançable sans risque.
 * Usage : DATABASE_URL="postgresql://..." node scripts/create-userblock-table.js
 */

const { PrismaClient } = require("@prisma/client");

async function main() {
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserBlock" (
        "id" TEXT NOT NULL,
        "blockerId" TEXT NOT NULL,
        "blockedId" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log("✓ Table UserBlock vérifiée/créée");

    await db.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId")`
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId")`
    );
    console.log("✓ Index uniques vérifiés/créés");

    // FK idempotentes vers User (cascade à la suppression d'un compte)
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
    console.log("✓ Contraintes FK vérifiées/créées");

    // Vérification finale
    const tables = await db.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'UserBlock'`
    );
    const cols = await db.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'UserBlock' ORDER BY ordinal_position`
    );
    console.log("Table :", tables.map((t) => t.table_name).join(", "));
    console.log("Colonnes :", cols.map((c) => c.column_name).join(", "));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("Erreur :", e);
  process.exit(1);
});
