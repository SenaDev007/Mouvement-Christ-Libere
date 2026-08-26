/**
 * Cron routes — scheduled jobs (Railway cron / external scheduler).
 *   GET /api/cron/shabbat-reminder — every Friday 16:00, sends Shabbat reminders
 *
 * Protected by CRON_SECRET (Authorization: Bearer <secret>).
 */

import { Router } from "express";
import { db } from "../lib/db";
import { webpush, ensureVapidConfigured } from "../lib/push";
import { determinerAnneeBibliqueEnCours } from "../lib/calendrier/ancrage";
import { genererAnnee } from "../lib/calendrier/generation";
import { calculerFetesPourAnnee } from "../lib/calendrier/fetes";

const router = Router();

function requireCronSecret(req: any, res: any, next: any): void {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    // No secret configured → allow (development mode)
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  return next();
}

router.get("/shabbat-reminder", requireCronSecret, async (_req, res) => {
  try {
    ensureVapidConfigured();

    const now = new Date();
    const anneeBiblique = determinerAnneeBibliqueEnCours(now);
    const annee = genererAnnee(anneeBiblique);
    const fetes = calculerFetesPourAnnee(anneeBiblique, annee.jours, now);

    const inSevenDays = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const upcomingFetes = fetes.filter((f: any) => {
      const start = new Date(f.dateGregorienne);
      return start >= now && start <= inSevenDays;
    });

    const users = await db.user.findMany({
      where: {
        pushEnabled: true,
        pushSubscription: { not: null },
        notifAnnouncements: true,
        OR: [
          { dndEnabled: false },
          { dndEnabled: true, dndUntil: { lt: now } },
        ],
      },
      select: { id: true, pushSubscription: true, name: true },
    });

    let sent = 0;

    for (const user of users) {
      if (!user.pushSubscription) continue;

      if (now.getDay() === 5) {
        try {
          await webpush.sendNotification(
            JSON.parse(user.pushSubscription),
            JSON.stringify({
              title: "🕯️ Shabbat Shalom",
              body: "Le Shabbat commence ce soir à 18h00. Préparez votre cœur et votre maison.",
              url: "/calendrier",
              icon: "/icons/icon-192.png",
              tag: "shabbat",
            }),
          );
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await db.user.update({
              where: { id: user.id },
              data: { pushSubscription: null },
            });
          }
        }
      }

      for (const fete of upcomingFetes) {
        try {
          const feteDate = new Date(fete.dateGregorienne);
          const daysUntil = Math.ceil(
            (feteDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          );
          const f = fete.fete;

          await webpush.sendNotification(
            JSON.parse(user.pushSubscription),
            JSON.stringify({
              title: `📅 ${f.nomFr} ${f.nomHebrew || ""}`,
              body:
                daysUntil === 0
                  ? `Aujourd'hui : ${f.nomFr}. ${f.description.substring(0, 100)}...`
                  : `Dans ${daysUntil} jour${daysUntil > 1 ? "s" : ""} : ${f.nomFr}. Préparez-vous.`,
              url: "/calendrier",
              icon: "/icons/icon-192.png",
              tag: `fete-${fete.jourAnnee}`,
            }),
          );
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await db.user.update({
              where: { id: user.id },
              data: { pushSubscription: null },
            });
          }
          break;
        }
      }
    }

    return res.json({
      success: true,
      sent,
      usersChecked: users.length,
      upcomingFetes: upcomingFetes.length,
    });
  } catch (error) {
    console.error("[cron/shabbat-reminder] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

export default router;
