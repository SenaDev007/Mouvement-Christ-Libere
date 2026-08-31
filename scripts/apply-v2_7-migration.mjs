/**
 * ⭐ V2.7 — Application de la migration V2.7 + synchronisation des photos
 * des serviteurs vers les comptes utilisateurs.
 *
 * 1. ALTER TABLE Channel ADD COLUMN IF NOT EXISTS videoMode
 *    ALTER TABLE User  ADD COLUMN IF NOT EXISTS phone
 * 2. Pour chaque Servant avec un portraitUrl : met à jour l'avatar du
 *    compte User correspondant (Pam → /pam.jpeg, Pasteur Kongo → /pasteur-kongo.jpeg)
 *    afin que les canaux vocaux / bulles de chat affichent leurs VRAIES photos.
 *
 * Correspondance Servant ↔ User : email commençant par "<code>@" ou nom
 * insensible à la casse égal au shortName / fullName.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Migration V2.7 (idempotent) — un ALTER par requête (prepared statements)
  await db.$executeRawUnsafe(
    'ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "videoMode" BOOLEAN DEFAULT false'
  );
  await db.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT'
  );
  console.log("✓ Migration V2.7 appliquée (Channel.videoMode + User.phone)");

  // 2. Synchro photos serviteurs → comptes utilisateurs
  const servants = await db.servant.findMany({
    select: { id: true, code: true, fullName: true, shortName: true, portraitUrl: true },
  });

  for (const s of servants) {
    if (!s.portraitUrl) continue;
    const users = await db.user.findMany({
      where: {
        OR: [
          { email: { startsWith: `${s.code.toLowerCase()}@`, mode: "insensitive" } },
          { name: { equals: s.shortName, mode: "insensitive" } },
          { name: { equals: s.fullName, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    for (const u of users) {
      if (u.avatarUrl === s.portraitUrl) {
        console.log(`= ${u.name} (${u.email}) a déjà la photo`);
        continue;
      }
      await db.user.update({
        where: { id: u.id },
        data: { avatarUrl: s.portraitUrl },
      });
      console.log(`✓ ${u.name} (${u.email}) → avatarUrl = ${s.portraitUrl}`);
    }
  }

  // 3. Vérification
  const users = await db.user.findMany({
    select: { name: true, email: true, avatarUrl: true, phone: true },
  });
  console.log("\nÉtat final des utilisateurs :");
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => { console.error("ERREUR:", e); process.exit(1); })
  .finally(() => db.$disconnect());
