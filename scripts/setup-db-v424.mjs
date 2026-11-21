/**
 * setup-db-v424.mjs — Base PostgreSQL LOCALE (embedded-postgres, port 5433)
 * pour la vérification navigateur du module Vidéos V4.24 dans le bac.
 *
 * ⚠️ Bac uniquement — JAMAIS la base Neon de production (la page
 * /admin/videos exécute recupererReplaysManquants(), qui ÉCRIT).
 *
 * Étapes : init cluster → start → create db → prisma db push → seed
 * (2 serviteurs + 4 vidéos : TikTok avec/sans miniature, YouTube avec/sans).
 */
import EmbeddedPostgres from "embedded-postgres";

const PORT = 5433;
const DB = "christlibere";
const DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORT}/${DB}?schema=public`;

const pg = new EmbeddedPostgres({
  databaseDir: "./db/local-v424",
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
});

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);
  console.log(`Postgres local prêt sur :${PORT}, base « ${DB} » créée.`);
} catch (e) {
  // Cluster déjà initialisé (relance) → tenter un start simple.
  console.log("initialise/createDatabase:", e.message);
  try {
    await pg.start();
    console.log("Postgres local relancé.");
  } catch (e2) {
    console.error("Impossible de démarrer Postgres local :", e2.message);
    process.exit(1);
  }
}

// Laisser le serveur tourner : ce script est lancé en arrière-plan
// (l'interval maintient le processus — donc le Postgres enfant — en vie).
setInterval(() => {}, 1 << 30);
console.log("Postgres local EN COURS (persistent) sur le port", PORT);
