import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureEmailTables } from "@/lib/ensure-schema";

/**
 * ⭐ V3.69 — POST /api/auth/reset-password
 *
 * Deuxième temps du « Mot de passe oublié » : l'utilisateur saisit l'email,
 * le code à 6 chiffres reçu par mail et son NOUVEAU mot de passe. Le code
 * est vérifié (hach SHA-256 + expiration + 5 tentatives maximum), le mot
 * de passe est réinitialisé (bcrypt 12) — le même compte servant aux
 * espaces membre, back-office, secrétariat et trésorerie, le reset vaut
 * partout.
 *
 * Public (pas de session) — comme /api/auth/forgot-password.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TENTATIVES = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

function hacherCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function memesHachages(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureEmailTables();

    const body = await request.json().catch(() => ({}));
    const { email, code, newPassword } = body as {
      email?: string;
      code?: string;
      newPassword?: string;
    };

    const emailNormalise = (email || "").trim().toLowerCase();
    const codeSaisi = (code || "").trim();

    if (!EMAIL_RE.test(emailNormalise)) {
      return NextResponse.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      );
    }
    if (!CODE_RE.test(codeSaisi)) {
      return NextResponse.json(
        { error: "Le code doit contenir 6 chiffres." },
        { status: 400 }
      );
    }
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit faire au moins 8 caractères." },
        { status: 400 }
      );
    }

    // ① Dernier code actif pour cet email.
    const otp = await db.passwordResetOtp.findFirst({
      where: { email: emailNormalise, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        {
          error:
            "Aucun code actif pour cet email — demandez un nouveau code (« Mot de passe oublié »).",
        },
        { status: 400 }
      );
    }

    const maintenant = new Date();

    if (otp.expiresAt < maintenant) {
      return NextResponse.json(
        {
          error:
            "Ce code a expiré — demandez un nouveau code (« Mot de passe oublié »).",
        },
        { status: 400 }
      );
    }

    if (otp.attempts >= MAX_TENTATIVES) {
      return NextResponse.json(
        {
          error: `Trop de tentatives incorrectes — demandez un nouveau code (« Mot de passe oublié »).`,
        },
        { status: 429 }
      );
    }

    // ② Vérifier le code (hach + comparaison en temps constant).
    if (!memesHachages(hacherCode(codeSaisi), otp.codeHash)) {
      await db.passwordResetOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      const restantes = MAX_TENTATIVES - otp.attempts - 1;
      return NextResponse.json(
        {
          error:
            restantes > 0
              ? `Code incorrect — ${restantes} tentative${restantes > 1 ? "s" : ""} restante${restantes > 1 ? "s" : ""}.`
              : "Code incorrect — trop de tentatives, demandez un nouveau code.",
        },
        { status: 400 }
      );
    }

    // ③ Code valide → le consommer (usage unique) et invalider les autres.
    await db.passwordResetOtp.update({
      where: { id: otp.id },
      data: { consumedAt: maintenant },
    });
    await db.passwordResetOtp.updateMany({
      where: { email: emailNormalise, consumedAt: null },
      data: { consumedAt: maintenant },
    });

    // ④ Réinitialiser le mot de passe.
    const utilisateur = await db.user.findUnique({
      where: { email: emailNormalise },
      select: { id: true, name: true },
    });
    if (!utilisateur) {
      // Cas limite : compte supprimé entre la demande et le reset.
      return NextResponse.json(
        { error: "Aucun compte n'est associé à cet email." },
        { status: 404 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: utilisateur.id },
      data: { passwordHash },
    });

    // ⑤ Journal d'audit (gouvernance V3.67) — jamais le code ni le mot de
    // passe : uniquement l'identité du compte réinitialisé.
    try {
      await db.auditLog.create({
        data: {
          action: "PASSWORD_RESET",
          userId: utilisateur.id,
          metadata: {
            email: emailNormalise,
            via: "otp-email",
          } as never,
        },
      });
    } catch (e) {
      console.warn("[api/auth/reset-password] AuditLog impossible :", e);
    }

    return NextResponse.json({
      success: true,
      message:
        "Mot de passe mis à jour — vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
    });
  } catch (error) {
    console.error("[api/auth/reset-password] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation" },
      { status: 500 }
    );
  }
}
