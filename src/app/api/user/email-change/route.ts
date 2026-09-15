import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ensureEmailTables } from "@/lib/ensure-schema";
import { envoyerEmailVerification, CATEGORIES_EMAIL } from "@/lib/email";
import {
  sujetEmailOtpChangement,
  templateOtpChangementEmail,
} from "@/lib/email-templates";

/**
 * ⭐ V3.81 — POST /api/user/email-change
 *
 * Première étape du changement d'adresse email DEPUIS LE PROFIL :
 * l'utilisateur (connecté) saisit sa nouvelle adresse + son mot de passe
 * actuel. Un code à 6 chiffres (OTP « EMAIL_CHANGE ») est alors envoyé À
 * LA NOUVELLE ADRESSE — preuve qu'elle lui appartient (le code est
 * confirmé sur /api/user/email-change/verify, qui seul applique le
 * changement).
 *
 * Sécurité :
 *  - session obligatoire (NextAuth) ;
 *  - mot de passe ACTUEL exigé (preuve de propriété du compte) ;
 *  - nouvelle adresse : format valide, différente de l'actuelle, non
 *    utilisée par un autre compte ;
 *  - code HACHÉ en base (SHA-256), validité 10 minutes, usage unique ;
 *  - anti-harcèlement : 1 envoi/minute et 5/heure pour la nouvelle
 *    adresse (limites par utilisateur ET par adresse) ;
 *  - l'envoi vers une adresse sans compte passe par le relais DÉDIÉ du
 *    backend (POST /api/email/send-verification) qui vérifie l'OTP actif
 *    en base — le relais classique refuse les destinataires inconnus.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELAI_ENTRE_ENVOIS_MS = 60_000; // 1 minute
const MAX_ENVOIS_PAR_HEURE = 5;
const VALIDITE_CODE_MIN = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hacherCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Tables OTP + emails sortants — AVANT toute écriture.
    await ensureEmailTables();

    const body = await request.json().catch(() => ({}));
    const {
      newEmail,
      currentPassword,
    } = body as { newEmail?: string; currentPassword?: string };

    const nouvelEmail = (newEmail || "").trim().toLowerCase();

    if (!EMAIL_RE.test(nouvelEmail)) {
      return NextResponse.json(
        { error: "La nouvelle adresse email est invalide." },
        { status: 400 }
      );
    }
    if (
      typeof currentPassword !== "string" ||
      currentPassword.length === 0
    ) {
      return NextResponse.json(
        { error: "Votre mot de passe actuel est requis." },
        { status: 400 }
      );
    }

    const maintenant = new Date();

    // ① Compte + preuve de propriété (mot de passe actuel).
    const utilisateur = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    if (!utilisateur || !utilisateur.passwordHash) {
      return NextResponse.json(
        { error: "Compte introuvable ou sans mot de passe." },
        { status: 404 }
      );
    }

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

    // ② La nouvelle adresse doit être différente de l'actuelle…
    if (nouvelEmail === utilisateur.email.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "Cette adresse est déjà celle de votre compte — indiquez une adresse différente.",
        },
        { status: 400 }
      );
    }

    // ③ …et libre (aucun autre compte).
    const existant = await db.user.findUnique({
      where: { email: nouvelEmail },
      select: { id: true },
    });
    if (existant) {
      return NextResponse.json(
        {
          error:
            "Cette adresse email est déjà utilisée par un compte. Si elle vous appartient, connectez-vous avec elle ou utilisez « Mot de passe oublié ».",
        },
        { status: 409 }
      );
    }

    // ④ Anti-harcèlement : au moins 1 minute entre deux demandes
    // (par utilisateur ET par nouvelle adresse).
    const dernier = await db.passwordResetOtp.findFirst({
      where: {
        purpose: "EMAIL_CHANGE",
        OR: [{ userId: utilisateur.id }, { email: nouvelEmail }],
      },
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
            "Un code vient déjà d'être demandé — patientez une minute avant d'en redemander.",
        },
        { status: 429 }
      );
    }

    // ⑤ Anti-harcèlement : 5 envois max par heure.
    const envoisRecent = await db.passwordResetOtp.count({
      where: {
        purpose: "EMAIL_CHANGE",
        OR: [{ userId: utilisateur.id }, { email: nouvelEmail }],
        createdAt: {
          gte: new Date(maintenant.getTime() - 60 * 60 * 1000),
        },
      },
    });
    if (envoisRecent >= MAX_ENVOIS_PAR_HEURE) {
      return NextResponse.json(
        {
          error:
            "Trop de codes demandés au cours de la dernière heure — réessayez plus tard.",
        },
        { status: 429 }
      );
    }

    // ⑥ Invalider les codes EMAIL_CHANGE non consommés précédents,
    // puis générer et stocker le nouveau code (haché).
    await db.passwordResetOtp.updateMany({
      where: { userId: utilisateur.id, purpose: "EMAIL_CHANGE", consumedAt: null },
      data: { consumedAt: maintenant },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.passwordResetOtp.create({
      data: {
        email: nouvelEmail,
        codeHash: hacherCode(code),
        userId: utilisateur.id,
        expiresAt: new Date(maintenant.getTime() + VALIDITE_CODE_MIN * 60_000),
        purpose: "EMAIL_CHANGE",
      },
    });

    // ⑦ Envoyer le code à la NOUVELLE adresse (relais dédié si la clé
    // Resend vit sur le backend Railway).
    const { html, text } = templateOtpChangementEmail({
      nom: utilisateur.name,
      code,
      emailActuel: utilisateur.email,
      minutesValidite: VALIDITE_CODE_MIN,
    });
    const resultat = await envoyerEmailVerification({
      to: nouvelEmail,
      toName: utilisateur.name,
      subject: sujetEmailOtpChangement(),
      html,
      text,
      category: CATEGORIES_EMAIL.EMAIL_CHANGE,
      sentById: utilisateur.id,
    });

    if (!resultat.ok) {
      // L'OTP reste en base (valable) mais l'utilisateur n'a rien reçu :
      // on le consomme pour éviter toute confusion.
      await db.passwordResetOtp.updateMany({
        where: { userId: utilisateur.id, purpose: "EMAIL_CHANGE", consumedAt: null },
        data: { consumedAt: new Date() },
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: `Le code n'a pas pu être envoyé à ${nouvelEmail} (${resultat.erreur}). Réessayez dans un instant.`,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      email: nouvelEmail,
      message: `Code envoyé à ${nouvelEmail} — il est valable ${VALIDITE_CODE_MIN} minutes (pensez à consulter vos indésirables). Saisissez-le ci-dessous pour finaliser le changement.`,
    });
  } catch (error) {
    console.error("[api/user/email-change] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du code" },
      { status: 500 }
    );
  }
}
