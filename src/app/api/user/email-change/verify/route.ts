import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ensureEmailTables } from "@/lib/ensure-schema";

/**
 * ⭐ V3.81 — POST /api/user/email-change/verify
 *
 * Deuxième étape du changement d'adresse email : l'utilisateur saisit le
 * code à 6 chiffres reçu à sa NOUVELLE adresse. Le code est vérifié
 * (hach SHA-256 + expiration + 5 tentatives maximum), puis l'email du
 * compte est remplacé. La session (JWT) est rafraîchie côté client via
 * next-auth update() — le nouvel email s'affiche immédiatement.
 *
 * Sécurité :
 *  - session obligatoire — l'OTP ne concerne QUE le compte demandeur
 *    (userId lié à la création du code) : impossible de consommer le
 *    code d'un autre ;
 *  - code à usage unique, 10 minutes, 5 tentatives ;
 *  - l'adresse reste réservée au demandeur tant que le code est actif ;
 *  - journal d'audit (action EMAIL_CHANGED, ancien + nouvel email).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TENTATIVES = 5;
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await ensureEmailTables();

    const body = await request.json().catch(() => ({}));
    const { code } = body as { code?: string };
    const codeSaisi = (code || "").trim();

    if (!CODE_RE.test(codeSaisi)) {
      return NextResponse.json(
        { error: "Le code doit contenir 6 chiffres." },
        { status: 400 }
      );
    }

    const maintenant = new Date();

    // ① Dernier code EMAIL_CHANGE actif pour CE compte.
    const otp = await db.passwordResetOtp.findFirst({
      where: {
        userId: session.user.id,
        purpose: "EMAIL_CHANGE",
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        {
          error:
            "Aucun code actif — demandez un nouveau code depuis « Changer mon adresse email ».",
        },
        { status: 400 }
      );
    }

    if (otp.expiresAt < maintenant) {
      return NextResponse.json(
        {
          error:
            "Ce code a expiré — demandez un nouveau code depuis « Changer mon adresse email ».",
        },
        { status: 400 }
      );
    }

    if (otp.attempts >= MAX_TENTATIVES) {
      return NextResponse.json(
        {
          error:
            "Trop de tentatives incorrectes — demandez un nouveau code depuis « Changer mon adresse email ».",
        },
        { status: 429 }
      );
    }

    // ② Vérifier le code.
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

    // ③ Code valide → le consommer (usage unique).
    await db.passwordResetOtp.update({
      where: { id: otp.id },
      data: { consumedAt: maintenant },
    });

    // ④ Appliquer le changement (dernière garde : adresse toujours libre).
    const utilisateur = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });
    if (!utilisateur) {
      return NextResponse.json(
        { error: "Compte introuvable." },
        { status: 404 }
      );
    }

    if (otp.email === utilisateur.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Votre compte utilise déjà cette adresse." },
        { status: 400 }
      );
    }

    const dejaPris = await db.user.findUnique({
      where: { email: otp.email },
      select: { id: true },
    });
    if (dejaPris) {
      return NextResponse.json(
        {
          error:
            "Cette adresse email vient d'être attribuée à un autre compte — demandez un nouveau code avec une autre adresse.",
        },
        { status: 409 }
      );
    }

    const ancienEmail = utilisateur.email;
    await db.user.update({
      where: { id: utilisateur.id },
      data: { email: otp.email },
    });

    // ⑤ Journal d'audit (gouvernance) — ancien + nouvel email.
    try {
      await db.auditLog.create({
        data: {
          action: "EMAIL_CHANGED",
          userId: utilisateur.id,
          metadata: {
            ancienEmail,
            nouvelEmail: otp.email,
            via: "profil-otp",
          } as never,
        },
      });
    } catch (e) {
      console.warn("[api/user/email-change/verify] AuditLog impossible :", e);
    }

    return NextResponse.json({
      success: true,
      email: otp.email,
      message: `Votre adresse email est désormais ${otp.email} — c'est elle qu'il faudra utiliser pour vous connecter.`,
    });
  } catch (error) {
    console.error("[api/user/email-change/verify] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la confirmation du changement" },
      { status: 500 }
    );
  }
}
