/**
 * Remplace toutes les occurrences de "Congo" par "Kongo" dans le contenu
 * de la base de données (teachings, testimonies, biographies, servants).
 *
 * Conserve "République Démocratique du Congo" tel quel si c'est dans un contexte
 * géographique pur, mais remplace "Pasteur Congo", "Nkosi Congo", etc.
 *
 * Usage: node scripts/rename-congo-to-kongo.js
 */
require("dotenv").config({ path: ".env", override: true });
const { PrismaClient } = require("@prisma/client");

const envDbUrl = require("dotenv").config({ path: ".env", override: true }).parsed?.DATABASE_URL;
if (envDbUrl) process.env.DATABASE_URL = envDbUrl;

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Remplacement de 'Congo' par 'Kongo' dans la DB...\n");

  let updatedCount = 0;

  // ===== 1. Teachings =====
  console.log("📖 Traitement des enseignements...");
  const teachings = await prisma.teaching.findMany({
    where: {
      OR: [
        { title: { contains: "Congo" } },
        { excerpt: { contains: "Congo" } },
        { content: { contains: "Congo" } },
      ],
    },
    select: { id: true, title: true, excerpt: true, content: true },
  });
  console.log(`   ${teachings.length} enseignements à mettre à jour`);

  for (const t of teachings) {
    await prisma.teaching.update({
      where: { id: t.id },
      data: {
        title: t.title.replaceAll("Congo", "Kongo"),
        excerpt: t.excerpt?.replaceAll("Congo", "Kongo") || "",
        content: t.content.replaceAll("Congo", "Kongo"),
      },
    });
    updatedCount++;
  }

  // ===== 2. Testimonies =====
  console.log("📖 Traitement des témoignages...");
  const testimonies = await prisma.testimony.findMany({
    where: {
      OR: [
        { title: { contains: "Congo" } },
        { short: { contains: "Congo" } },
        { content: { contains: "Congo" } },
      ],
    },
    select: { id: true, title: true, short: true, content: true },
  });
  console.log(`   ${testimonies.length} témoignages à mettre à jour`);

  for (const t of testimonies) {
    await prisma.testimony.update({
      where: { id: t.id },
      data: {
        title: t.title.replaceAll("Congo", "Kongo"),
        short: t.short?.replaceAll("Congo", "Kongo") || "",
        content: t.content.replaceAll("Congo", "Kongo"),
      },
    });
    updatedCount++;
  }

  // ===== 3. Biographies =====
  console.log("📖 Traitement des biographies...");
  const biographies = await prisma.biography.findMany({
    where: {
      OR: [
        { title: { contains: "Congo" } },
        { description: { contains: "Congo" } },
      ],
    },
    select: { id: true, title: true, description: true },
  });
  console.log(`   ${biographies.length} biographies à mettre à jour`);

  for (const b of biographies) {
    await prisma.biography.update({
      where: { id: b.id },
      data: {
        title: b.title.replaceAll("Congo", "Kongo"),
        description: b.description?.replaceAll("Congo", "Kongo") || "",
      },
    });
    updatedCount++;
  }

  // ===== 4. Servants =====
  console.log("📖 Traitement des serviteurs...");
  const servants = await prisma.servant.findMany({
    where: {
      OR: [
        { fullName: { contains: "Congo" } },
        { shortName: { contains: "Congo" } },
        { role: { contains: "Congo" } },
        { bio: { contains: "Congo" } },
      ],
    },
    select: { id: true, fullName: true, shortName: true, role: true, bio: true },
  });
  console.log(`   ${servants.length} serviteurs à mettre à jour`);

  for (const s of servants) {
    await prisma.servant.update({
      where: { id: s.id },
      data: {
        fullName: s.fullName?.replaceAll("Congo", "Kongo") || s.fullName,
        shortName: s.shortName?.replaceAll("Congo", "Kongo") || s.shortName,
        role: s.role?.replaceAll("Congo", "Kongo") || s.role,
        bio: s.bio?.replaceAll("Congo", "Kongo") || s.bio,
      },
    });
    updatedCount++;
  }

  // ===== 5. LiveStreams =====
  console.log("📖 Traitement des lives...");
  const lives = await prisma.liveStream.findMany({
    where: {
      OR: [
        { title: { contains: "Congo" } },
        { description: { contains: "Congo" } },
      ],
    },
    select: { id: true, title: true, description: true },
  });
  console.log(`   ${lives.length} lives à mettre à jour`);

  for (const l of lives) {
    await prisma.liveStream.update({
      where: { id: l.id },
      data: {
        title: l.title?.replaceAll("Congo", "Kongo") || l.title,
        description: l.description?.replaceAll("Congo", "Kongo") || l.description,
      },
    });
    updatedCount++;
  }

  // ===== Vérification =====
  const remainingTeachings = await prisma.teaching.count({
    where: { OR: [{ title: { contains: "Congo" } }, { content: { contains: "Congo" } }] },
  });
  const remainingTestimonies = await prisma.testimony.count({
    where: { OR: [{ title: { contains: "Congo" } }, { content: { contains: "Congo" } }] },
  });
  const remainingServants = await prisma.servant.count({
    where: { OR: [{ fullName: { contains: "Congo" } }, { shortName: { contains: "Congo" } }] },
  });

  console.log("\n═══════════════════════════════════════════");
  console.log("📊 RÉCAPITULATIF");
  console.log("═══════════════════════════════════════════");
  console.log(`  Enregistrements mis à jour : ${updatedCount}`);
  console.log(`  Occurrences restantes de 'Congo' :`);
  console.log(`    - Enseignements : ${remainingTeachings}`);
  console.log(`    - Témoignages   : ${remainingTestimonies}`);
  console.log(`    - Serviteurs    : ${remainingServants}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
