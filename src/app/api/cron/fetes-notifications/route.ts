import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushNotification } from "@/app/api/push/vapid/route";
import { calculerEvenementsShofar } from "@/lib/calendrier/evenements-shofar";

/**
 * GET /api/cron/fetes-notifications
 *
 * ⭐ V3.6 — Cron quotidien (09:00 UTC) : notifications PUSH des fêtes de
 * l'Éternel, envoyées même quand la communauté est fermée.
 *
 * Pour chaque grande solennité à venir :
 *   - à 7 jours  → « Dans 7 jours : Pessah… préparez vos cœurs »
 *   - à 3 jours  → « Dans 3 jours : Pessah… »
 *   - à 24 h     → « Demain soir : le shofar retentira à l'entrée »
 *   - le jour J  → « Ce soir : le shofar retentit au coucher du soleil »
 *
 * Chaque vendredi : rappel du Shabbat avec l'heure réelle du coucher de
 * soleil à Jérusalem (calculée par le moteur, pas un « 18h » fixe).
 *
 * Configure dans vercel.json :
 *   { "path": "/api/cron/fetes-notifications", "schedule": "0 9 * * *" }
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const maintenant = new Date();
    const evenements = calculerEvenementsShofar(maintenant);

    // ── Destinataires : membres avec push actif, annonces autorisées,
    //    hors mode « ne pas déranger » (même filtre que shabbat-reminder)
    const users = await db.user.findMany({
      where: {
        pushEnabled: true,
        pushSubscription: { not: null },
        notifAnnouncements: true,
        OR: [
          { dndEnabled: false },
          { dndEnabled: true, dndUntil: { lt: maintenant } },
        ],
      },
      select: { id: true, pushSubscription: true, name: true },
    });

    let envoyees = 0;
    let ignorees = 0;
    let desabonnes = 0;

    // Notifications invalides → on purge l'abonnement (pattern shabbat-reminder)
    const purgerAbonnement = async (userId: string) => {
      try {
        await db.user.update({ where: { id: userId }, data: { pushSubscription: null } });
        desabonnes++;
      } catch {
        /* utilisateur supprimé entre-temps */
      }
    };

    // ── 1. Fêtes : J-7, J-3, J-24h, jour J ───────────────────────────────
    for (const evenement of evenements) {
      if (evenement.type !== "fete") continue;

      const entree = new Date(evenement.entree);
      const joursRestants = Math.floor((entree.getTime() - maintenant.getTime()) / JOUR_MS);
      if (![7, 3, 1, 0].includes(joursRestants)) continue;

      let titre: string;
      let corps: string;
      const nomHebreu = evenement.titreHebreu ? ` ${evenement.titreHebreu}` : "";

      if (joursRestants === 7) {
        titre = `📅 Dans 7 jours — ${evenement.titre}`;
        corps = `La fête de l'Éternel ${evenement.titre}${nomHebreu} approche : elle entre ${new Date(evenement.entree).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} au coucher du soleil. Préparez vos cœurs. ${evenement.reference ?? ""}`;
      } else if (joursRestants === 3) {
        titre = `📅 Dans 3 jours — ${evenement.titre}`;
        corps = `Nous sommes à 3 jours de ${evenement.titre}${nomHebreu}. Le shofar retentira dans Yeshua Connect à l'entrée de la solennité, au coucher du soleil.`;
      } else if (joursRestants === 1) {
        titre = `📯 Demain soir — ${evenement.titre}`;
        corps = `Dans 24 heures, ${evenement.titre}${nomHebreu} entre au coucher du soleil (${new Date(evenement.entree).toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })} à Jérusalem). Le shofar retentira dans la communauté.`;
      } else {
        titre = `📯 Ce soir — ${evenement.titre}`;
        corps = `La solennité de l'Éternel entre ce soir au coucher du soleil (${new Date(evenement.entree).toLocaleTimeString("fr-FR", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })} à Jérusalem). Ouvrez la communauté pour entendre le shofar. ${evenement.reference ?? ""}`;
      }

      for (const user of users) {
        if (!user.pushSubscription) continue;
        try {
          const ok = await sendPushNotification(
            JSON.parse(user.pushSubscription),
            JSON.stringify({
              title: titre,
              body: corps,
              url: "/communaute",
              icon: "/icons/icon-192.png",
              tag: `fete-${evenement.id}-${joursRestants}`,
            })
          );
          if (ok) envoyees++; else ignorees++;
        } catch (e: unknown) {
          const statut = (e as { statusCode?: number })?.statusCode;
          if (statut === 410 || statut === 404) {
            await purgerAbonnement(user.id);
          }
          ignorees++;
        }
      }
    }

    // ── 2. Rappel du Shabbat, chaque vendredi ────────────────────────────
    if (maintenant.getUTCDay() === 5) {
      const shabbat = evenements.find((e) => e.type === "shabbat");
      const heureJerusalem = shabbat
        ? new Date(shabbat.entree).toLocaleTimeString("fr-FR", {
            timeZone: "Asia/Jerusalem",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "au coucher du soleil";

      for (const user of users) {
        if (!user.pushSubscription) continue;
        try {
          const ok = await sendPushNotification(
            JSON.parse(user.pushSubscription),
            JSON.stringify({
              title: "🕯️ Shabbat Shalom",
              body: `Le Shabbat entre ce soir au coucher du soleil (${heureJerusalem} à Jérusalem). Le shofar retentira dans Yeshua Connect — préparez votre cœur et votre maison.`,
              url: "/communaute",
              icon: "/icons/icon-192.png",
              tag: "shabbat-v36",
            })
          );
          if (ok) envoyees++; else ignorees++;
        } catch (e: unknown) {
          const statut = (e as { statusCode?: number })?.statusCode;
          if (statut === 410 || statut === 404) {
            await purgerAbonnement(user.id);
          }
          ignorees++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      envoyees,
      ignorees,
      desabonnes,
      membresNotifies: users.length,
    });
  } catch (error) {
    console.error("[cron/fetes-notifications] Erreur:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
