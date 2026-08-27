import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/auth";

/**
 * POST /admin/api/login
 * Connexion back-office.
 * Body: { name, password }
 *
 * Authentifie l'utilisateur contre la table User en DB.
 * Rôles autorisés à se connecter au back-office :
 *  - SUPER_ADMIN (Pam, Pasteur Kongo)
 *  - ADMIN (délégués créés par un super admin)
 *  - MODERATOR (bénévoles modération)
 *
 * Le `name` peut être :
 *  - le nom du compte (ex: "Pam", "Pasteur Kongo")
 *  - ou l'email (ex: "pam@christ-libere.org")
 */
const ALLOWED_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];

type UserWithAuth = {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  role: string;
  isVerified: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json(
        { error: "Nom et mot de passe requis" },
        { status: 400 }
      );
    }

    const cleanedName = name.trim();

    // Recherche par email OU par name (insensible à la casse)
    let user: UserWithAuth | null = null;
    if (cleanedName.includes("@")) {
      const found = await db.user.findUnique({
        where: { email: cleanedName.toLowerCase() },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          role: true,
          isVerified: true,
        },
      });
      user = found as unknown as UserWithAuth | null;
    } else {
      const candidates = await db.user.findMany({
        where: { name: { equals: cleanedName, mode: "insensitive" } },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          role: true,
          isVerified: true,
        },
      });
      const typedCandidates = candidates as unknown as UserWithAuth[];
      // Parmi les candidats, on prend celui qui a un rôle admin
      user =
        typedCandidates.find((c) => ALLOWED_ADMIN_ROLES.includes(c.role)) ||
        typedCandidates[0] ||
        null;
    }

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Nom ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Vérification du rôle
    if (!ALLOWED_ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          error:
            "Votre compte n'a pas les permissions nécessaires pour accéder au back-office.",
        },
        { status: 403 }
      );
    }

    // Vérification du mot de passe (bcrypt)
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Nom ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Création du token de session admin
    // Le payload contient le userId et le rôle pour vérifications ultérieures
    const token = createSessionToken(`admin:${user.id}:${user.role}`);

    const response = NextResponse.json({
      success: true,
      userId: user.id,
      name: user.name,
      role: user.role,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[admin/api/login] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}
