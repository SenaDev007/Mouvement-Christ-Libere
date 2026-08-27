/**
 * Seed des super admins — Christ Libère
 *
 * Crée les deux comptes super admin :
 *  - Pam (Afrika Alkebulane Pamela Dali)
 *  - Pasteur Kongo
 *
 * Exécuter avec : bun run db:seed:admins
 *
 * ⚠️ Les mots de passe par défaut ci-dessous DOIVENT être changés
 *    lors de la première connexion via le back-office.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env", override: true });

const db = new PrismaClient();

// Mots de passe initiaux — à changer impérativement après première connexion
const PAM_PASSWORD = process.env.PAM_INITIAL_PASSWORD || "PamChristLibere2026!";
const KONGO_PASSWORD =
  process.env.KONGO_INITIAL_PASSWORD || "KongoChristLibere2026!";

const SUPER_ADMINS = [
  {
    name: "Pam",
    email: "pam@christ-libere.org",
    password: PAM_PASSWORD,
    bio: "Servante de l'Éternel — Afrika Alkebulane Pamela Dali. Fondatrice du Mouvement Christ Libère.",
  },
  {
    name: "Pasteur Kongo",
    email: "pasteur.kongo@christ-libere.org",
    password: KONGO_PASSWORD,
    bio: "Pasteur Kongo — Ministère pastoral complémentaire, soin des brebis et enseignement.",
  },
];

async function main() {
  console.log("🌱 Début du seed des super admins...\n");

  for (const admin of SUPER_ADMINS) {
    const existing = await db.user.findUnique({
      where: { email: admin.email },
    });

    const passwordHash = await bcrypt.hash(admin.password, 12);

    if (existing) {
      // Mise à jour du compte existant
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: admin.name,
          passwordHash,
          role: "SUPER_ADMIN",
          isVerified: true,
          bio: admin.bio,
        },
      });
      console.log(`✅ Compte mis à jour : ${admin.name} (${admin.email})`);
    } else {
      // Création du compte
      await db.user.create({
        data: {
          name: admin.name,
          email: admin.email,
          passwordHash,
          role: "SUPER_ADMIN",
          isVerified: true,
          bio: admin.bio,
          acceptedTerms: new Date(),
        },
      });
      console.log(`✅ Compte créé : ${admin.name} (${admin.email})`);
    }
  }

  console.log("\n📋 Récapitulatif des identifiants initiaux :");
  console.log("─────────────────────────────────────────────");
  for (const admin of SUPER_ADMINS) {
    console.log(`  Nom           : ${admin.name}`);
    console.log(`  Email         : ${admin.email}`);
    console.log(`  Mot de passe  : ${admin.password}`);
    console.log(`  Rôle          : SUPER_ADMIN`);
    console.log("─────────────────────────────────────────────");
  }
  console.log(
    "\n⚠️  IMPORTANT : Changez ces mots de passe dès la première connexion !"
  );
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
