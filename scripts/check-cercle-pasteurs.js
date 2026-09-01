// Vérification rapide : état des canaux restreints (cercle des pasteurs)
// + rôles des utilisateurs concernés (PAM, Pasteur Kongo…).
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const channels = await db.channel.findMany({
    where: { OR: [{ isRestricted: true }, { type: "RESTRICTED" }] },
    select: {
      id: true, name: true, type: true, isRestricted: true,
      communityId: true, _count: { select: { members: true } },
    },
  });
  console.log("=== CANAUX RESTREINTS ===");
  console.log(JSON.stringify(channels, null, 2));

  const users = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
  });
  console.log("\n=== SUPER_ADMIN / ADMIN ===");
  console.log(JSON.stringify(users, null, 2));

  const roleCounts = await db.user.groupBy({ by: ["role"], _count: true });
  console.log("\n=== RÉPARTITION DES RÔLES ===");
  console.log(JSON.stringify(roleCounts, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
