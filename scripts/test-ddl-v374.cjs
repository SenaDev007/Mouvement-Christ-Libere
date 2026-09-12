/**
 * ⭐ V3.74 — Test local du DDL ensureStaffSpaces (nouvelles colonnes +
 * tables + purge ContactRequest) contre la base Postgres locale.
 * Réplique exactement les statements ajoutés (idempotents).
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  // Vérification préalable : la table ContactRequest existe-t-elle ?
  const avant = await db.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ContactRequest') AS existe`
  );
  console.log(
    "ContactRequest avant :",
    avant[0].existe ? "présente (sera droppée)" : "absente (DROP IF EXISTS = no-op)"
  );

  // ① Colonnes du flux de validation.
  await db.$executeRawUnsafe(
    `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUEL'`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMPTZ`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "MeetingRequest" ADD COLUMN IF NOT EXISTS "validatedById" TEXT`
  );
  console.log("✔ colonnes MeetingRequest source/validatedAt/validatedById");

  // ② Table StaffSetting.
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StaffSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "StaffSetting_pkey" PRIMARY KEY ("key")
    )`);
  console.log("✔ table StaffSetting");

  // ③ Table StaffNotification + index.
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
    )`);
  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "StaffNotification_espace_readAt_idx" ON "StaffNotification"("espace", "readAt")'
  );
  await db.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "StaffNotification_createdAt_idx" ON "StaffNotification"("createdAt")'
  );
  console.log("✔ table StaffNotification + index");

  // ④ Purge du module « Demandes de contact ».
  await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "ContactRequest"`);
  const apres = await db.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ContactRequest') AS existe`
  );
  console.log("ContactRequest après :", apres[0].existe ? "ENCORE LÀ ✗" : "supprimée ✔");

  // ⑤ Tests fonctionnels rapides via le client Prisma.
  await db.staffSetting.upsert({
    where: { key: "email_kongo" },
    update: { value: "test@example.com" },
    create: { key: "email_kongo", value: "test@example.com" },
  });
  const lu = await db.staffSetting.findUnique({ where: { key: "email_kongo" } });
  console.log("✔ StaffSetting upsert/read :", lu.value);

  const notif = await db.staffNotification.create({
    data: {
      espace: "secretariat",
      type: "DEMANDE_VALIDEE",
      titre: "Test — demande validée",
      message: "notification de test",
      lien: "/secretariat/demandes?statut=VALIDEE",
    },
  });
  const nonLues = await db.staffNotification.count({
    where: { espace: "secretariat", readAt: null },
  });
  console.log("✔ StaffNotification create/count non lues :", nonLues);
  await db.staffNotification.delete({ where: { id: notif.id } });
  await db.staffSetting.delete({ where: { key: "email_kongo" } });

  // ⑥ MeetingRequest : création avec source + validation.
  const demande = await db.meetingRequest.create({
    data: {
      requesterName: "Test V3.74",
      contact: "test@example.com",
      servantCode: "kongo",
      subject: "Test flux validation",
      message: "message de test",
      status: "TRANSMISE",
      source: "SITE",
      transmittedAt: new Date(),
    },
  });
  const validee = await db.meetingRequest.update({
    where: { id: demande.id },
    data: { status: "VALIDEE", validatedAt: new Date(), validatedById: "test" },
  });
  console.log(
    "✔ MeetingRequest source/validee :",
    validee.source,
    validee.status,
    validee.validatedAt ? "dated" : "—"
  );
  await db.meetingRequest.delete({ where: { id: demande.id } });
  console.log("✔ nettoyage du test");

  console.log("\n=== DDL V3.74 VALIDÉ SUR LA BASE LOCALE ===");
}

main()
  .catch((e) => {
    console.error("ÉCHEC :", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
