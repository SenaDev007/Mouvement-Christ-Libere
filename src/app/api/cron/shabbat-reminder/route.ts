import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushNotification } from "@/app/api/push/vapid/route";
import { determinerAnneeBibliqueEnCours } from "@/lib/calendrier/ancrage";
import { genererAnnee } from "@/lib/calendrier/generation";
import { calculerFetesPourAnnee } from "@/lib/calendrier/fetes";

/**
 * GET /api/cron/shabbat-reminder
 * Cron job (Vercel cron) — runs every Friday at 16:00.
 * Sends Shabbat reminders to all subscribed users.
 *
 * Configure in vercel.json:
 *   "crons": [{ "path": "/api/cron/shabbat-reminder", "schedule": "0 16 * * 5" }]
 *
 * ⭐ Uses sendPushNotification() which lazily configures VAPID.
 *    If VAPID keys are not set, push notifications are skipped gracefully.
 */
export async function GET() {
  try {
    const now = new Date();
    const anneeBiblique = determinerAnneeBibliqueEnCours(now);
    const annee = genererAnnee(anneeBiblique);
    const fetes = calculerFetesPourAnnee(anneeBiblique, annee.jours, now);

    // Find upcoming feasts in the next 7 days
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingFetes = fetes.filter((f: any) => {
      const start = new Date(f.dateGregorienne);
      return start >= now && start <= inSevenDays;
    });

    // Get all users with push subscription + announcements enabled + not DND
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
    let skipped = 0;

    for (const user of users) {
      if (!user.pushSubscription) continue;
      const subscription = JSON.parse(user.pushSubscription);

      // Send Shabbat reminder (every Friday)
      if (now.getDay() === 5) {
        try {
          const ok = await sendPushNotification(
            subscription,
            JSON.stringify({
              title: "🕯️ Shabbat Shalom",
              body: "Le Shabbat commence ce soir à 18h00. Préparez votre cœur et votre maison.",
              url: "/calendrier",
              icon: "/icons/icon-192.png",
              tag: "shabbat",
            })
          );
          if (ok) sent++; else skipped++;
        } catch (e: any) {
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await db.user.update({
              where: { id: user.id },
              data: { pushSubscription: null },
            });
          }
          skipped++;
        }
      }

      // Send feast reminders
      for (const fete of upcomingFetes) {
        try {
          const feteDate = new Date(fete.dateGregorienne);
          const daysUntil = Math.ceil((feteDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          const f = fete.fete;

          const ok = await sendPushNotification(
            subscription,
            JSON.stringify({
              title: `📅 ${f.nomFr} ${f.nomHebrew || ""}`,
              body: daysUntil === 0
                ? `Aujourd'hui : ${f.nomFr}. ${f.description.substring(0, 100)}...`
                : `Dans ${daysUntil} jour${daysUntil > 1 ? "s" : ""} : ${f.nomFr}. Préparez-vous.`,
              url: "/calendrier",
              icon: "/icons/icon-192.png",
              tag: `fete-${fete.jourAnnee}`,
            })
          );
          if (ok) sent++; else skipped++;
        } catch (e: any) {
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await db.user.update({
              where: { id: user.id },
              data: { pushSubscription: null },
            });
          }
          break; // subscription invalid, skip remaining fetes for this user
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      usersChecked: users.length,
      upcomingFetes: upcomingFetes.length,
    });
  } catch (error) {
    console.error("[cron/shabbat-reminder] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
