import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /admin/api/users/create-admin
 * Crée un nouveau compte administrateur.
 *
 * ⚠️ Réservé aux SUPER_ADMIN (Pam, Pasteur Kongo).
 *
 * Body: { name, email, password, role, bio? }
 *  - role: "ADMIN" | "MODERATOR" | "ANIMATOR"
 *  - (SUPER_ADMIN ne peut pas être créé via cette route pour éviter les abus)
 */

const CREATABLE_ROLES = ["ADMIN", "MODERATOR", "ANIMATOR"];

interface SessionPayload {
  user: string;
  exp: number;
}

function decodeSession(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const data = Buffer.from(parts[0], "base64url").toString();
    const payload = JSON.parse(data) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCurrentUserId(token: string): string | null {
  const payload = decodeSession(token);
  if (!payload?.user) return null;
  const parts = payload.user.split(":");
  if (parts.length >= 2 && parts[0] === "admin") return parts[1];
  return null;
}

function getCurrentUserRole(token: string): string | null {
  const payload = decodeSession(token);
  if (!payload?.user) return null;
  const parts = payload.user.split(":");
  if (parts.length >= 3 && parts[0] === "admin") return parts[2];
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Vérification session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const currentRole = getCurrentUserRole(sessionToken);
    const currentUserId = getCurrentUserId(sessionToken);

    if (currentRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Seuls les super administrateurs (Pam et Pasteur Kongo) peuvent créer des comptes administrateur.",
        },
        { status: 403 }
      );
    }

    // Récupération du super admin courant pour audit
    const currentAdmin = await db.user.findUnique({
      where: { id: currentUserId! },
      select: { name: true },
    });

    const body = await request.json();
    const { name, email, password, role, bio } = body;

    // Validations
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Nom, email, mot de passe et rôle sont requis" },
        { status: 400 }
      );
    }

    if (!CREATABLE_ROLES.includes(role)) {
      return NextResponse.json(
        {
          error: `Rôle invalide. Rôles autorisés : ${CREATABLE_ROLES.join(", ")}.`,
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

    // Vérifier que l'email n'existe pas déjà
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    // Créer l'utilisateur admin
    const newUser = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        bio: bio || null,
        isVerified: true,
        acceptedTerms: new Date(),
      },
    });

    console.log(
      `[admin/create-admin] ${currentAdmin?.name} (${currentRole}) a créé le compte ${name} (${email}) avec le rôle ${role}`
    );

    return NextResponse.json({
      success: true,
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error("[admin/api/users/create-admin] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}
