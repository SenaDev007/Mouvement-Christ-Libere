// Diagnostic de l'état du schéma PostgreSQL (Neon) vs prisma/schema.prisma
// Usage : DATABASE_URL="..." node scripts/check-db-schema.mjs
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  // 1. Colonnes attendues par le schéma Prisma (extraites du DTO généré) vs colonnes réelles
  const tables = await db.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log(`Tables en base : ${tables.length}`);
  for (const t of tables) {
    const cols = await db.$queryRawUnsafe(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${t.table_name}'
      ORDER BY ordinal_position
    `);
    console.log(`\n== ${t.table_name} (${cols.length} colonnes) ==`);
    console.log(cols.map(c => c.column_name).join(', '));
  }
  // 2. Test rapide : le findMany conversations fonctionne-t-il ?
  try {
    const channels = await db.channel.findMany({ take: 5, select: { id: true, name: true, avatarUrl: true, isPaused: false } });
    console.log(`\n✅ db.channel.findMany OK — ${channels.length} canaux`);
  } catch (e) {
    // isPaused n'existe pas dans le modèle Channel (il est sur LiveStream) — test séparé
    try {
      const channels = await db.channel.findMany({ take: 5, select: { id: true, name: true, avatarUrl: true } });
      console.log(`\n✅ db.channel.findMany (avatarUrl) OK — ${channels.length} canaux`);
    } catch (e2) {
      console.log(`\n❌ db.channel.findMany ÉCHEC : ${e2.message}`);
    }
  }
  try {
    const lives = await db.liveStream.findMany({ take: 1, select: { id: true, isPaused: true, pausedAt: true } });
    console.log(`✅ db.liveStream (isPaused/pausedAt) OK — ${lives.length} live(s)`);
  } catch (e) {
    console.log(`❌ db.liveStream isPaused ÉCHEC : ${e.message}`);
  }
}

main().catch(e => { console.error('ERREUR:', e.message); process.exit(1); }).finally(() => db.$disconnect());
