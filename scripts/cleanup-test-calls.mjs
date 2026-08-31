import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const d1 = await db.$executeRawUnsafe(`DELETE FROM "Message" WHERE "type" = 'CALL_LOG'`);
  const d2 = await db.$executeRawUnsafe(`DELETE FROM "CallSignal"`);
  const left = await db.$queryRawUnsafe(`SELECT (SELECT COUNT(*)::int FROM "Message" WHERE "type" = 'CALL_LOG') AS logs, (SELECT COUNT(*)::int FROM "CallSignal") AS signals`);
  console.log(`Supprimé ${d1} CALL_LOG + ${d2} signal(s). Restant →`, JSON.stringify(left));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
