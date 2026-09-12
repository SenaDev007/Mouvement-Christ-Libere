import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { db } from "@/lib/db";
import { ensureEmailTables } from "@/lib/ensure-schema";
import { envoyerEmail, CATEGORIES_EMAIL } from "@/lib/email";
import { sujetEmailOtp, templateOtp } from "@/lib/email-templates";

/**
 * ⭐ V3.69 — POST /api/auth/forgot-password
 *
 * « Mot de passe oublié » (pages de connexion : membre, back-office,
 * secrétariat, trésorerie) : un code à 6 chiffres (OTP) est envoyé par
 * email via Resend (noreply@mouvementchristlibere.com). L'utilisateur le
 * saisit ensuite avec son nouveau mot de passe sur /api/auth/reset-password.
 *
 * Sécurité :
 *  - code HACHÉ en base (SHA-256 — jamais en clair) ;
 *  - validité 10 minutes, usage unique (les codes précédents sont
 *    invalidés à chaque demande) ;
 *  - anti-harcèlement : 1 envoi maximum par minute et par email,
 *    5 envois maximum par heure et par email ;
 *  - le même compte sert aux quatre espaces (membre + staff) : un seul
 *    reset remet à jour le mot de passe partout.
 *
 * Public (pas de session) — comme /api/auth/login.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELAI_ENTRE_ENVOIS_MS = 60_000; // 1 minute
const MAX_ENVOIS_PAR_HEURE = 5;
const VALIDITE_CODE_MIN = 10;

function hacherCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    // Tables OTP + emails sortants — AVANT toute écriture.
    await ensureEmailTables();

    const body = await request.json().catch(() => ({}));
    const { email } = body as { email?: string };
    const emailNormalise = (email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(emailNormalise)) {
      return NextResponse.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      );
    }

    const maintenant = new Date();

    // ① Anti-harcèlement : au moins 1 minute entre deux envois.
    const dernier = await db.passwordResetOtp.findFirst({
      where: { email: emailNormalise },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      dernier &&
      maintenant.getTime() - dernier.createdAt.getTime() < DELAI_ENTRE_ENVOIS_MS
    ) {
      return NextResponse.json(
        {
          error:
            "Un code vient déjà d'être demandé pour cet email — patientez une minute avant d'en redemander.",
        },
        { status: 429 }
      );
    }

    // ② Anti-harcèlement : 5 envois max par heure et par email.
    const envoisRecent = await db.passwordResetOtp.count({
      where: {
        email: emailNormalise,
        createdAt: {
          gte: new Date(maintenant.getTime() - 60 * 60 * 1000),
        },
      },
    });
    if (envoisRecent >= MAX_ENVOIS_PAR_HEURE) {
      return NextResponse.json(
        {
          error:
            "Trop de codes demandés pour cet email au cours de la dernière heure — réessayez plus tard.",
        },
        { status: 429 }
      );
    }

    // ③ Compte concerné (l'inscription publique révèle déjà l'existence
    // d'un email — on privilégie ici la CLARTÉ pour l'utilisateur réel).
    const utilisateur = await db.user.findUnique({
      where: { email: emailNormalise },
      select: { id: true, name: true, passwordHash: true },
    });

    if (!utilisateur || !utilisateur.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Aucun compte n'est associé à cet email. Vérifiez l'orthographe ou créez un compte.",
        },
        { status: 404 }
      );
    }

    // ④ Invalider les codes non consommés précédents (usage unique, un
    // seul code actif à la fois).
    await db.passwordResetOtp.updateMany({
      where: { email: emailNormalise, consumedAt: null },
      data: { consumedAt: maintenant },
    });

    // ⑤ Générer et stocker le code (haché).
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.passwordResetOtp.create({
      data: {
        email: emailNormalise,
        codeHash: hacherCode(code),
        userId: utilisateur.id,
        expiresAt: new Date(maintenant.getTime() + VALIDITE_CODE_MIN * 60_000),
      },
    });

    // ⑥ Envoyer l'email (Resend).
    const { html, text } = templateOtp({
      nom: utilisateur.name,
      code,
      minutesValidite: VALIDITE_CODE_MIN,
    });
    const resultat = await envoyerEmail({
      to: emailNormalise,
      toName: utilisateur.name,
      subject: sujetEmailOtp(),
      html,
      text,
      category: CATEGORIES_EMAIL.OTP_RESET,
    });

    if (!resultat.ok) {
      return NextResponse.json(
        {
          error: `Le code n'a pas pu être envoyé (${resultat.erreur}). Réessayez dans un instant.`,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Code envoyé à ${emailNormalise} — il est valable ${VALIDITE_CODE_MIN} minutes (pensez à consulter vos indésirables).`,
    });
  } catch (error) {
    console.error("[api/auth/forgot-password] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du code" },
      { status: 500 }
    );
  }
}
