import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * POST /api/auth/login
 * Connexion membre (espace communauté).
 * Body: { pseudonyme, password }
 *
 * Le pseudonyme peut être :
 *  - l'email du compte (ex: "pam@christ-libere.org")
 *  - ou le name/pseudonyme choisi à l'inscription (ex: "Pam")
 *
 * Le compte doit être validé par un admin (isVerified = true) pour se connecter.
 */

const SESSION_SECRET =
  process.env.SESSION_SECRET || "christ-libere-session-secret-change-in-prod-2026";
const SESSION_DURATION = 1000 * 60 * 60 * 8; // 8 heures

interface MemberSessionPayload {
  userId: string;
  role: string;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

function base64Encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function createMemberSessionToken(userId: string, role: string): string {
  const payload: MemberSessionPayload = {
    userId,
    role,
    exp: Date.now() + SESSION_DURATION,
  };
  const data = base64Encode(payload);
  const signature = sign(data);
  return `${data}.${signature}`;
}

type UserWithAuth = {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  role: string;
  isVerified: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const { pseudonyme, password } = await req.json();

    if (!pseudonyme || !password) {
      return NextResponse.json(
        { error: "Pseudonyme et mot de passe requis" },
        { status: 400 }
      );
    }

    const cleanedPseudo = pseudonyme.trim();

    // Recherche par email OU par name (pseudonyme)
    let user: UserWithAuth | null = null;
    if (cleanedPseudo.includes("@")) {
      const found = await db.user.findUnique({
        where: { email: cleanedPseudo.toLowerCase() },
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
      // Recherche par name (premier match exact insensible à la casse)
      const candidates = await db.user.findMany({
        where: { name: { equals: cleanedPseudo, mode: "insensitive" } },
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
      if (typedCandidates.length > 0) {
        // Si plusieurs ont le même name, on prend le premier vérifié
        user = typedCandidates.find((c) => c.isVerified) || typedCandidates[0];
      }
    }

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Pseudonyme ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Vérification du mot de passe (bcrypt)
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Pseudonyme ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Vérification que le compte est validé par un admin
    if (!user.isVerified) {
      return NextResponse.json(
        {
          error:
            "Votre compte est en attente de validation par un administrateur. Vous recevrez un email dès qu'il sera activé.",
        },
        { status: 403 }
      );
    }

    // Création du token de session membre
    const token = createMemberSessionToken(user.id, user.role);

    const response = NextResponse.json({
      success: true,
      userId: user.id,
      name: user.name,
      role: user.role,
    });

    response.cookies.set("member_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION / 1000,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[auth/login] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}

// Export pour vérification côté serveur dans d'autres routes
export function verifyMemberSession(token: string): MemberSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSignature = sign(data);

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString()
    ) as MemberSessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
