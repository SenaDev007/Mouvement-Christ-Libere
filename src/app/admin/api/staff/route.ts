import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { exigerSession } from "@/lib/staff-space/session";

/**
 * ⭐ V3.66 — Accréditation des espaces dédiés (back-office /admin/staff).
 *
 *   GET    /admin/api/staff            — liste des comptes secrétaire/trésorier
 *   POST   /admin/api/staff            — création d'un compte (SECRETARY|TREASURER)
 *   PATCH  /admin/api/staff            — { userId, action, password?, role? }
 *                                          · reset-password : nouveau mot de passe
 *                                          · revoke         : retire le rôle (→ MEMBER)
 *                                          · reactivate     : restaure le rôle
 *
 * ⚠️ Réservé aux SUPER_ADMIN (Pam, Pasteur Kongo) — directive : « c'est à eux
 * de pouvoir donner l'accréditation, créer un compte pour le secrétaire ou
 * la secrétaire » / « au comptable, à leur trésorier ».
 *
 * ⭐ V3.69 — ACCRÉDITATION D'UN COMPTE EXISTANT : « être membre ne veut pas
 * dire qu'on est secrétaire ou comptable » — si l'email saisi correspond
 * déjà à un compte MEMBRE, celui-ci est PROMU (même compte, même email,
 * nouveau rôle + nouveau mot de passe) au lieu d'être refusé. Seuls les
 * comptes déjà porteurs d'un rôle étendu (admin, modérateur…) sont refusés
 * avec un message explicite (un seul rôle par compte).
 *
 * Chaque action est journalisée dans AuditLog (traçabilité des accès aux
 * espaces du ministère).
 */

const ROLES_STAFF = ["SECRETARY", "TREASURER"] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;

  try {
    // Valeurs d'enum + tables des espaces — doit exister AVANT le filtre
    // WHERE role IN (...) (sinon « invalid input value for enum »).
    await ensureStaffSpaces();

    const comptes = await db.user.findMany({
      where: { role: { in: ["SECRETARY", "TREASURER"] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bio: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items: comptes });
  } catch (error) {
    console.error("[admin/api/staff] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des comptes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;
  const { userId: auteurId } = garde.session;

  try {
    await ensureStaffSpaces();

    const body = await request.json();
    const { name, email, password, role, bio } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      bio?: string;
    };

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Nom, email, mot de passe et rôle sont requis" },
        { status: 400 }
      );
    }

    if (!(ROLES_STAFF as readonly string[]).includes(role)) {
      return NextResponse.json(
        {
          error: `Rôle invalide. Rôles autorisés : ${ROLES_STAFF.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 8 caractères" },
        { status: 400 }
      );
    }

    const emailNormalise = email.toLowerCase().trim();
    const existant = await db.user.findUnique({
      where: { email: emailNormalise },
      select: { id: true, name: true, email: true, role: true },
    });

    const passwordHash = await bcrypt.hash(password, 12);

    // ⭐ V3.69 — L'email correspond déjà à un compte : au lieu de refuser,
    // on examine son rôle. Un MEMBRE peut être accrédité secrétaire ou
    // trésorier avec son propre email (directive du pasteur).
    if (existant) {
      const libelleRole = (r: string) =>
        r === "SECRETARY" ? "secrétaire" : r === "TREASURER" ? "trésorier" : r;

      // Déjà secrétaire/trésorier → selon le rôle demandé.
      if ((ROLES_STAFF as readonly string[]).includes(existant.role)) {
        return NextResponse.json(
          {
            error:
              existant.role === role
                ? `Ce compte est déjà ${libelleRole(existant.role)}.`
                : `Ce compte est déjà ${libelleRole(existant.role)} — utilisez l'action « Réactiver » de la liste ci-dessous pour lui changer de rôle.`,
          },
          { status: 409 }
        );
      }

      // Rôle étendu (super admin, admin, modérateur, animateur) : la
      // plateforme attribue UN rôle par compte — promouvoir le RÉTROGRADERAIT.
      if (
        ["SUPER_ADMIN", "ADMIN", "MODERATOR", "ANIMATOR"].includes(existant.role)
      ) {
        return NextResponse.json(
          {
            error: `Ce compte possède déjà le rôle ${existant.role} (accès étendus) : l'attribuer comme ${libelleRole(role)} le priverait de ses droits actuels. Utilisez un autre email pour créer ce compte.`,
          },
          { status: 400 }
        );
      }

      // MEMBER / MEMBER_VERIFIED / GUEST → ACCRÉDITATION : le compte est
      // conservé (email, historique, profil) et reçoit le rôle staff + le
      // mot de passe fourni. La personne reste la même, ses accès changent.
      const accredite = await db.user.update({
        where: { id: existant.id },
        data: {
          name: name.trim() || existant.name,
          role: role as "SECRETARY" | "TREASURER",
          passwordHash,
          bio: bio?.trim() || undefined,
          isVerified: true,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      // Journal d'audit — mode « accreditation » pour distinguer d'une
      // création neuve (on conserve l'ancien rôle du promu).
      try {
        await db.auditLog.create({
          data: {
            action: "STAFF_CREATE",
            userId: auteurId,
            targetId: accredite.id,
            metadata: {
              mode: "accreditation-compte-existant",
              ancienRole: existant.role,
              role,
              email: accredite.email,
              name: accredite.name,
            },
          },
        });
      } catch (e) {
        console.warn("[admin/api/staff] AuditLog impossible :", e);
      }

      return NextResponse.json(
        {
          success: true,
          accredite: true,
          ancienRole: existant.role,
          ...accredite,
        },
        { status: 200 }
      );
    }

    const nouveauCompte = await db.user.create({
      data: {
        name,
        email: emailNormalise,
        passwordHash,
        role: role as "SECRETARY" | "TREASURER",
        bio: bio || null,
        isVerified: true,
        acceptedTerms: new Date(),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    // Journal d'audit — qui a accrédité quoi.
    try {
      await db.auditLog.create({
        data: {
          action: "STAFF_CREATE",
          userId: auteurId,
          targetId: nouveauCompte.id,
          metadata: {
            role,
            email: nouveauCompte.email,
            name: nouveauCompte.name,
          },
        },
      });
    } catch (e) {
      console.warn("[admin/api/staff] AuditLog impossible :", e);
    }

    return NextResponse.json(
      {
        success: true,
        ...nouveauCompte,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/api/staff] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const garde = exigerSession(request, ["SUPER_ADMIN"]);
  if ("reponse" in garde) return garde.reponse;
  const { userId: auteurId } = garde.session;

  try {
    await ensureStaffSpaces();

    const body = await request.json();
    const { userId, action, password, role } = body as {
      userId?: string;
      action?: string;
      password?: string;
      role?: string;
    };

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId et action sont requis" },
        { status: 400 }
      );
    }

    const cible = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!cible) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    if (!(ROLES_STAFF as readonly string[]).includes(cible.role)) {
      return NextResponse.json(
        { error: "Ce compte n'est pas un compte secrétariat/trésorerie" },
        { status: 400 }
      );
    }

    if (action === "reset-password") {
      if (!password || password.length < 8) {
        return NextResponse.json(
          { error: "Nouveau mot de passe requis (8 caractères minimum)" },
          { status: 400 }
        );
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await db.user.update({ where: { id: userId }, data: { passwordHash } });
    } else if (action === "revoke") {
      // Révocation = retour au rôle membre simple (le compte est conservé,
      // l'accès aux espaces dédiés est immédiatement coupé).
      await db.user.update({ where: { id: userId }, data: { role: "MEMBER" } });
    } else if (action === "reactivate") {
      if (!role || !(ROLES_STAFF as readonly string[]).includes(role)) {
        return NextResponse.json(
          { error: "Rôle cible requis (SECRETARY ou TREASURER)" },
          { status: 400 }
        );
      }
      await db.user.update({
        where: { id: userId },
        data: { role: role as "SECRETARY" | "TREASURER" },
      });
    } else {
      return NextResponse.json(
        { error: "Action inconnue (reset-password | revoke | reactivate)" },
        { status: 400 }
      );
    }

    try {
      await db.auditLog.create({
        data: {
          action: `STAFF_${action.toUpperCase().replace(/-/g, "_")}`,
          userId: auteurId,
          targetId: userId,
          metadata: { cible: cible.email, ancienRole: cible.role, role },
        },
      });
    } catch (e) {
      console.warn("[admin/api/staff] AuditLog impossible :", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/api/staff] PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du compte" },
      { status: 500 }
    );
  }
}
