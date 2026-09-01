// Test fonctionnel (lecture seule) de la logique V3.7 :
// simule ce que voient les routes invitable/invite pour le canal
// RESTRICTED « Cercle des pasteurs » depuis le compte de PAM (SUPER_ADMIN).
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const CERCLE_ID = "cmta7uyes002yqckccg0rc9wx"; // Cercle des pasteurs (RESTRICTED)

async function main() {
  const pam = await db.user.findUnique({ where: { email: "pam@christ-libere.org" } });
  const kongo = await db.user.findUnique({ where: { email: "pasteur.kongo@christ-libere.org" } });
  console.log("PAM:", pam?.name, pam?.role, "| KONGO:", kongo?.name, kongo?.role);

  // 1° Invitable pour le cercle : TOUS les membres de la plateforme pas
  //    encore dans le canal (nouvelle requête V3.7 — plus de filtre communauté)
  const invitable = await db.user.findMany({
    where: {
      id: { not: pam.id },
      channelMembers: { none: { channelId: CERCLE_ID } },
    },
    select: { id: true, name: true, role: true, lastSeenAt: true, createdAt: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  console.log("\n=== INVITABLE (toute la plateforme, sans filtre communauté) ===");
  for (const u of invitable) console.log(` - ${u.name} (${u.role})`);
  console.log("Total:", invitable.length);

  // 2° Validation d'invité (Kongo + le membre simple) : existent-ils comme
  //    UTILISATEURS de la plateforme ? (l'ancienne logique exigeait la même
  //    communauté — la nouvelle accepte toute la plateforme)
  const toInvite = [kongo.id, ...invitable.filter((u) => u.role === "MEMBER").map((u) => u.id)];
  const valid = await db.user.findMany({ where: { id: { in: toInvite } }, select: { id: true, name: true } });
  console.log("\n=== VALIDATION DES INVITÉS (user.findMany) ===");
  for (const u of valid) console.log(` ✓ ${u.name}`);

  // 3° Contrôle : membres actuels du cercle
  const members = await db.channelMember.findMany({
    where: { channelId: CERCLE_ID },
    include: { user: { select: { name: true, role: true } } },
  });
  console.log("\n=== MEMBRES ACTUELS DU CERCLE ===");
  for (const m of members) console.log(` - ${m.user.name} (${m.role} dans le canal)`);

  // 4° Kongo est-il membre de la communauté du cercle ? (l'ancienne logique
  //    l'aurait REJETÉ s'il n'y était pas — la nouvelle l'accepte)
  const kongoCommunity = await db.communityMember.findFirst({
    where: { userId: kongo.id, communityId: "cmta7uw61002sqckcwo87v6pg" },
  });
  console.log("\nKongo membre de la communauté du canal ?", kongoCommunity ? "OUI" : "NON → l'ancienne logique V3.5 l'aurait refusé, la V3.7 l'accepte");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
