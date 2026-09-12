import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureStaffSpaces, ensureEmailTables } from "@/lib/ensure-schema";
import { exigerSession, ROLES_SECRETARIAT } from "@/lib/staff-space/session";
import {
  envoyerEmail,
  listerServiteursDestinataires,
  lireEmailParametre,
  enregistrerEmailParametre,
  CATEGORIES_EMAIL,
} from "@/lib/email";
import {
  templateCourrier,
  templateTest,
  sujetCourrier,
} from "@/lib/email-templates";

/**
 * ⭐ V3.69 — Courrier du secrétariat aux serviteurs de Dieu.
 *
 *   GET  /secretariat/api/courrier — destinataires + historique des
 *        courriers envoyés + paramétrage des emails (⭐ V3.74).
 *   POST /secretariat/api/courrier
 *        · { action: "parametrer", emailKongo?, emailPam? } — ⭐ V3.74 :
 *          enregistre les VRAIES adresses des serviteurs (StaffSetting) —
 *          prioritaire sur les env vars et les comptes ;
 *        · { toUserId, sujet, message } — envoie un courriel au destinataire
 *          (id « serviteur:kongo » / « serviteur:pam » / « user:<id> ») avec
 *          Reply-To = email de la secrétaire ;
 *        · { action: "test" } — email de test à sa propre adresse.
 *
 * Chaque envoi est consigné dans OutgoingEmail + AuditLog (gouvernance).
 * ⚠️ Rôles : SECRETARY, SUPER_ADMIN.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;

  try {
    await ensureStaffSpaces();
    await ensureEmailTables();

    const destinataires = await listerServiteursDestinataires();

    // ⭐ V3.74 — paramétrage actuel des emails serviteurs (bouton
    // « Paramétrage ») + source effective de chaque adresse.
    const [paramKongo, paramPam] = await Promise.all([
      lireEmailParametre("kongo"),
      lireEmailParametre("pam"),
    ]);

    const historique = await db.outgoingEmail.findMany({
      where: { category: CATEGORIES_EMAIL.COURRIER_SERVITEUR },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        toEmail: true,
        toName: true,
        subject: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      destinataires,
      historique,
      parametres: { emailKongo: paramKongo, emailPam: paramPam },
    });
  } catch (error) {
    console.error("[secretariat/api/courrier] GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du courrier" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const garde = exigerSession(request, ROLES_SECRETARIAT);
  if ("reponse" in garde) return garde.reponse;
  const { userId: auteurId } = garde.session;

  try {
    await ensureStaffSpaces();
    await ensureEmailTables();

    const body = await request.json().catch(() => ({}));
    const { toUserId, sujet, message, action, emailKongo, emailPam } =
      body as {
        toUserId?: string;
        sujet?: string;
        message?: string;
        action?: string;
        emailKongo?: string;
        emailPam?: string;
      };

    // L'expéditrice (secrétaire connectée) — son email sert de Reply-To.
    const expeditrice = await db.user.findUnique({
      where: { id: auteurId },
      select: { id: true, name: true, email: true },
    });
    if (!expeditrice?.email) {
      return NextResponse.json(
        { error: "Votre compte n'a pas d'email — impossible de définir une adresse de réponse." },
        { status: 400 }
      );
    }

    // ── Mode « test » : email de vérification à soi-même. ────────────
    if (action === "test") {
      const { html, text } = templateTest();
      const resultat = await envoyerEmail({
        to: expeditrice.email,
        toName: expeditrice.name,
        subject: "Email de test — Christ Libère (configuration Resend)",
        html,
        text,
        category: CATEGORIES_EMAIL.TEST,
        sentById: auteurId,
      });
      if (!resultat.ok) {
        return NextResponse.json(
          { error: `Le test a échoué : ${resultat.erreur}` },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Email de test envoyé à ${expeditrice.email} — vérifiez votre boîte de réception (et vos indésirables).`,
      });
    }

    // ── ⭐ V3.74 Mode « parametrer » : les VRAIES adresses des serviteurs.
    // Les adresses par défaut (seed / env / compte) peuvent être factices
    // ou périmées : la secrétaire consigne ici les adresses à utiliser
    // pour l'envoi aux serviteurs (courriers ET transmissions de demandes).
    if (action === "parametrer") {
      const propres: string[] = [];

      for (const [code, brute] of [
        ["kongo", emailKongo],
        ["pam", emailPam],
      ] as const) {
        if (brute === undefined) continue; // champ non modifié
        const nettoyee = brute.trim();
        if (nettoyee === "") {
          // Champ vidé → on efface le paramétrage (retour à la résolution
          // env/compte par défaut).
          try {
            await db.staffSetting.delete({
              where: { key: code === "kongo" ? "email_kongo" : "email_pam" },
            });
            propres.push(code === "kongo" ? "Pasteur Kongo : paramétrage effacé" : "Sœur Pam : paramétrage effacé");
          } catch {
            // clé absente — rien à effacer.
          }
          continue;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nettoyee)) {
          return NextResponse.json(
            {
              error: `Adresse invalide pour ${code === "kongo" ? "Pasteur Kongo" : "Sœur Pam"} : ${nettoyee}`,
            },
            { status: 400 }
          );
        }
        await enregistrerEmailParametre(code, nettoyee.toLowerCase());
        propres.push(
          `${code === "kongo" ? "Pasteur Kongo" : "Sœur Pam"} : ${nettoyee}`
        );
      }

      if (propres.length === 0) {
        return NextResponse.json(
          { error: "Aucune adresse fournie (emailKongo / emailPam)." },
          { status: 400 }
        );
      }

      // Gouvernance : trace du paramétrage (sans l'adresse complète).
      try {
        await db.auditLog.create({
          data: {
            action: "COURRIER_PARAMETRAGE",
            userId: auteurId,
            metadata: {
              champs: propres.map((p) => p.split(" : ")[0]),
            } as never,
          },
        });
      } catch (e) {
        console.warn("[secretariat/api/courrier] AuditLog impossible :", e);
      }

      return NextResponse.json({
        success: true,
        message: `Paramétrage enregistré — ${propres.join(" · ")}. Les prochains courriers partiront à ces adresses.`,
        parametres: {
          emailKongo: await lireEmailParametre("kongo"),
          emailPam: await lireEmailParametre("pam"),
        },
      });
    }

    // ── Courrier au serviteur. ───────────────────────────────────────
    if (!toUserId || !sujet?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Destinataire, sujet et message sont requis." },
        { status: 400 }
      );
    }
    if (sujet.trim().length < 3 || sujet.trim().length > 150) {
      return NextResponse.json(
        { error: "Le sujet doit contenir entre 3 et 150 caractères." },
        { status: 400 }
      );
    }
    if (message.trim().length < 10 || message.trim().length > 5000) {
      return NextResponse.json(
        { error: "Le message doit contenir entre 10 et 5000 caractères." },
        { status: 400 }
      );
    }

    const destinataire = await resoudreDestinataireCourrier(toUserId);
    if (!destinataire) {
      return NextResponse.json(
        { error: "Destinataire invalide — serviteur ou compte super admin introuvable." },
        { status: 400 }
      );
    }

    const sujetPropre = sujet.trim();
    const messagePropre = message.trim();

    const { html, text } = templateCourrier({
      destinataire: destinataire.name || "Serviteur de Dieu",
      expeditrice: expeditrice.name || "Secrétariat",
      sujet: sujetPropre,
      message: messagePropre,
    });

    const resultat = await envoyerEmail({
      to: destinataire.email,
      toName: destinataire.name,
      subject: sujetCourrier(sujetPropre),
      html,
      text,
      replyTo: expeditrice.email,
      category: CATEGORIES_EMAIL.COURRIER_SERVITEUR,
      sentById: auteurId,
    });

    // Journal d'audit (gouvernance) — même en cas d'échec d'envoi.
    try {
      await db.auditLog.create({
        data: {
          action: "COURRIER_SERVITEUR",
          userId: auteurId,
          targetId: destinataire.id,
          metadata: {
            destinataire: destinataire.email,
            sujet: sujetPropre,
            statut: resultat.ok ? "ENVOYE" : "ECHOUE",
          } as never,
        },
      });
    } catch (e) {
      console.warn("[secretariat/api/courrier] AuditLog impossible :", e);
    }

    if (!resultat.ok) {
      return NextResponse.json(
        {
          error: `Le courrier n'a pas pu être envoyé à ${destinataire.email} (${resultat.erreur}).`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Courrier envoyé à ${destinataire.name} (${destinataire.email}) — il pourra vous répondre directement par email.`,
    });
  } catch (error) {
    console.error("[secretariat/api/courrier] POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du courrier" },
      { status: 500 }
    );
  }
}

/**
 * ⭐ V3.74 — Résolution d'un destinataire de courrier depuis son
 * identifiant de liste : « serviteur:kongo » / « serviteur:pam » (adresse
 * résolue : paramétrage → env → compte) ou « user:<id> » (compte
 * SUPER_ADMIN — délégués éventuels).
 */
async function resoudreDestinataireCourrier(
  identifiant: string
): Promise<{ id: string; name: string | null; email: string } | null> {
  if (identifiant.startsWith("serviteur:")) {
    const code = identifiant.slice("serviteur:".length).toLowerCase();
    if (code !== "kongo" && code !== "pam") return null;
    const resolu = await (
      await import("@/lib/email")
    ).resoudreEmailServiteur(code);
    return { id: identifiant, name: resolu.nom, email: resolu.email };
  }

  if (identifiant.startsWith("user:")) {
    const utilisateur = await db.user.findUnique({
      where: { id: identifiant.slice("user:".length) },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!utilisateur?.email || utilisateur.role !== "SUPER_ADMIN") {
      return null;
    }
    return {
      id: identifiant,
      name: utilisateur.name,
      email: utilisateur.email,
    };
  }

  // Compatibilité : ancien format (identifiant = id de compte User).
  const utilisateur = await db.user.findUnique({
    where: { id: identifiant },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!utilisateur?.email || utilisateur.role !== "SUPER_ADMIN") {
    return null;
  }
  return {
    id: utilisateur.id,
    name: utilisateur.name,
    email: utilisateur.email,
  };
}
