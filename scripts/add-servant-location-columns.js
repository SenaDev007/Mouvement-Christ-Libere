/**
 * V3.3 — Ajoute les colonnes Servant.pays / Servant.ville en base.
 * Idempotent (ADD COLUMN IF NOT EXISTS) — peut être relancé sans risque.
 * Usage : DATABASE_URL="postgresql://..." node scripts/add-servant-location-columns.js
 */

// Prisma client (généré avec le schéma incluant pays/ville — pas utilisé
// pour le DDL, on passe par $executeRawUnsafe pour rester idempotent).
const { PrismaClient } = require("@prisma/client");

async function main() {
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(
      'ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "pays" TEXT'
    );
    console.log("✓ Colonne Servant.pays vérifiée/créée");
    await db.$executeRawUnsafe(
      'ALTER TABLE "Servant" ADD COLUMN IF NOT EXISTS "ville" TEXT'
    );
    console.log("✓ Colonne Servant.ville vérifiée/créée");

    // Vérification
    const cols = await db.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Servant' AND column_name IN ('pays', 'ville')`
    );
    console.log("Colonnes présentes :", cols.map((c) => c.column_name).join(", "));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("ÉCHEC :", e.message);
  process.exit(1);
});
