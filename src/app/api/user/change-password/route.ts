import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * ⭐ V3.81 — POST /api/user/change-password
 *
 * Changement de mot de passe DEPUIS LE PROFIL (utilisateur connecté) —
 * complète le parcours « Mot de passe oublié » (OTP par email) qui reste
 * la porte de secours quand on n'est PAS connecté.
 *
 * Sécurité :
 *  - session obligatoire (NextAuth) ;
 *  - le mot de passe ACTUEL est exigé (preuve de propriété du compte) ;
 *  - nouveau mot de passe ≥ 8 caractères, haché bcrypt (12 tours) ;
 *  - journal d'audit (action PASSWORD_CHANGED) — jamais le mot de passe.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_LONGUEUR = 8;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      currentPassword,
      newPassword,
    } = body as { currentPassword?: string; newPassword?: string };

    if (
      typeof currentPassword !== "string" ||
      currentPassword.length === 0
    ) {
      return NextResponse.json(
        { error: "Votre mot de passe actuel est requis." },
        { status: 400 }
      );
    }
    if (
      typeof newPassword !== "string" ||
      newPassword.length < MIN_LONGUEUR
    ) {
      return NextResponse.json(
        {
          error: `Le nouveau mot de passe doit faire au moins ${MIN_LONGUEUR} caractères.`,
        },
        { status: 400 }
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        {
          error:
            "Le nouveau mot de passe doit être différent de l'actuel.",
        },
        { status: 400 }
      );
    }

    const utilisateur = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!utilisateur || !utilisateur.passwordHash) {
      return NextResponse.json(
        { error: "Compte introuvable ou sans mot de passe." },
        { status: 404 }
      );
    }

    // Preuve de propriété : mot de passe actuel.
    const motDePasseValide = await bcrypt.compare(
      currentPassword,
      utilisateur.passwordHash
    );
    if (!motDePasseValide) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: utilisateur.id },
      data: { passwordHash },
    });

    // Journal d'audit (gouvernance) — jamais le mot de passe.
    try {
      await db.auditLog.create({
        data: {
          action: "PASSWORD_CHANGED",
          userId: utilisateur.id,
          metadata: { via: "profil" } as never,
        },
      });
    } catch (e) {
      console.warn("[api/user/change-password] AuditLog impossible :", e);
    }

    return NextResponse.json({
      success: true,
      message:
        "Mot de passe mis à jour — il vaut pour tous les espaces (membre, secrétariat, trésorerie, back-office).",
    });
  } catch (error) {
    console.error("[api/user/change-password] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors du changement de mot de passe" },
      { status: 500 }
    );
  }
}
