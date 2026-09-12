/**
 * ⭐ V3.66 — Seed local de vérification (PostgreSQL embarqué).
 *
 * Crée :
 *  · les deux super admins (Pam, Pasteur Kongo) — cf. seed-super-admins ;
 *  · les serviteurs pam/kongo (pages publiques dépendantes) ;
 *  · un compte SECRÉTAIRE et un compte TRÉSORIER de test, comme si Pam
 *    les avait accrédités depuis /admin/staff.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

config({ path: ".env", override: true });

const db = new PrismaClient();

const COMPTES = [
  {
    name: "Pam",
    email: "pam@christ-libere.org",
    password: "PamChristLibere2026!",
    role: "SUPER_ADMIN",
    bio: "Servante de l'Éternel — Afrika Alkebulane Pamela Dali. Fondatrice du Mouvement Christ Libère.",
  },
  {
    name: "Pasteur Kongo",
    email: "pasteur.kongo@christ-libere.org",
    password: "KongoChristLibere2026!",
    role: "SUPER_ADMIN",
    bio: "Pasteur Kongo — Ministère pastoral complémentaire, soin des brebis et enseignement.",
  },
  {
    name: "Grace Secretaire",
    email: "secretaire@christ-libere.org",
    password: "Secretaire2026!",
    role: "SECRETARY",
    bio: "Secrétaire du Mouvement Christ Libère (compte de vérification locale).",
  },
  {
    name: "Daniel Tresorier",
    email: "tresorier@christ-libere.org",
    password: "Tresorier2026!",
    role: "TREASURER",
    bio: "Trésorier du Mouvement Christ Libère (compte de vérification locale).",
  },
];

async function main() {
  console.log("🌱 Seed V3.66 (vérification locale)…\n");

  for (const compte of COMPTES) {
    const existant = await db.user.findUnique({
      where: { email: compte.email },
    });
    const passwordHash = await bcrypt.hash(compte.password, 12);
    if (existant) {
      await db.user.update({
        where: { id: existant.id },
        data: {
          name: compte.name,
          passwordHash,
          role: compte.role,
          isVerified: true,
          bio: compte.bio,
        },
      });
      console.log(`✅ mis à jour : ${compte.name} (${compte.role})`);
    } else {
      await db.user.create({
        data: {
          name: compte.name,
          email: compte.email,
          passwordHash,
          role: compte.role,
          isVerified: true,
          bio: compte.bio,
          acceptedTerms: new Date(),
        },
      });
      console.log(`✅ créé : ${compte.name} (${compte.role})`);
    }
  }

  // Serviteurs (pages publiques + transmissions).
  for (const s of [
    {
      code: "pam",
      fullName: "Afrika Alkebulane Pamela Dali",
      shortName: "Sœur Pam",
      role: "Servante de l'Éternel",
      bio: "Fondatrice du Mouvement Christ Libère.",
    },
    {
      code: "kongo",
      fullName: "Pasteur Kongo",
      shortName: "Pasteur Kongo",
      role: "Pasteur",
      bio: "Soin des brebis et enseignement.",
    },
  ]) {
    const existant = await db.servant.findUnique({ where: { code: s.code } });
    if (!existant) {
      await db.servant.create({ data: s });
      console.log(`✅ serviteur créé : ${s.shortName}`);
    } else {
      console.log(`✅ serviteur existant : ${s.ShortName ?? existant.shortName}`);
    }
  }

  console.log("\nIdentifiants de test :");
  console.log("  Secrétariat  : Grace Secretaire / Secretaire2026!");
  console.log("  Trésorerie   : Daniel Tresorier / Tresorier2026!");
  console.log("  Super admin  : Pam / PamChristLibere2026!");
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
