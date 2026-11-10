import { NextResponse } from "next/server";
import { dispatchDueScheduledMessages } from "@/lib/dispatch-scheduled-messages";
import { autoriserCron } from "@/lib/cron-auth";

/**
 * GET /api/cron/dispatch-scheduled
 * Cron automatique (toutes les 15 min — ⭐ V4.20 : était chaque minute,
 * ce qui empêchait la base Neon de jamais s'endormir) qui envoie les
 * messages programmés dont l'heure est arrivée.
 *
 * Le système reste réactif grâce au dispatch OPPORTUNISTE (cf.
 * src/lib/dispatch-scheduled-messages.ts) appelé par les routes messages
 * et conversations : un utilisateur connecté reçoit son message
 * programmé dans les 2 minutes. Ce cron est le filet de secours
 * « personne n'est connecté » (au pire 15 min de retard).
 *
 * ⭐ V3.39 — DEUX réparations :
 *   1. AUTH : cette route exigeait le header `x-cron-secret`… or Vercel
 *      Cron envoie automatiquement `Authorization: Bearer ${CRON_SECRET}`
 *      → 401 systématique → AUCUN message programmé n'était jamais parti
 *      (« quand l'heure programmée sonne, on ne voit pas le message »).
 *      Désormais acceptés : Authorization Bearer (Vercel), X-Cron-Secret
 *      (appel manuel), et pas de secret configuré = autorisé (dev).
 *   2. Le dispatch est désormais OPPORTUNISTE (cf.
 *      src/lib/dispatch-scheduled-messages.ts) : les routes messages et
 *      conversations l'appellent aussi, de sorte que le système fonctionne
 *      même si le cron Vercel est limité (plan Hobby = 1 exécution/jour).
 *      Ce cron reste le filet de secours « personne n'est connecté ».
 *
 * Sécurité : CRON_SECRET requis si configuré (Bearer OU X-Cron-Secret).
 */
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  if (!autoriserCron(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const envoyes = await dispatchDueScheduledMessages();
    return NextResponse.json({ success: true, dispatched: envoyes });
  } catch (error) {
    console.error("[cron/dispatch-scheduled]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
