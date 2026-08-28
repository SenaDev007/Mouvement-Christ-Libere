import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * POST /api/auth/register
 * Register a new user.
 * Body: { name, email, password, isMinor }
 */
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, isMinor } = await req.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 8 caractères" },
        { status: 400 },
      );
    }

    if (isMinor) {
      return NextResponse.json(
        { error: "Vous devez être majeur pour créer un compte" },
        { status: 403 },
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 },
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    // Les membres (rôle MEMBER) sont auto-validés — pas besoin d'approbation admin.
    // Seuls les rôles supérieurs (ADMIN, MODERATOR, ANIMATOR) nécessitent validation.
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "MEMBER",
        isVerified: true, // Auto-validation pour les membres
        isMinor: false,
        acceptedTerms: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      autoVerified: true,
    });
  } catch (error) {
    console.error("[auth/register] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription" },
      { status: 500 },
    );
  }
}
