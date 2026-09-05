/**
 * ⭐ V3.39 — AUTH DES CRONS NEXT.JS (routes /api/cron/*).
 * ============================================================================
 *
 * Anomalie réparée : les routes cron vérifiaient le header `x-cron-secret`…
 * or Vercel Cron envoie automatiquement `Authorization: Bearer ${CRON_SECRET}`
 * (aucun header custom) → 401 systématique → les jobs cron (messages
 * programmés, stats YouTube) ne s'exécutaient JAMAIS en production alors
 * que la configuration vercel.json était correcte.
 *
 * Cette helper accepte les DEUX conventions :
 *   - `Authorization: Bearer <CRON_SECRET>` — envoyé automatiquement par
 *     Vercel Cron (le secret est lu dans les variables du projet) ;
 *   - `X-Cron-Secret: <CRON_SECRET>` — appels manuels / planificateur
 *     externe (Railway, curl de diagnostic) ;
 *   - CRON_SECRET non configuré (dev) → autorisé, même règle que le
 *     backend Railway (requireCronSecret : « No secret configured →
 *     allow »).
 *
 * Utilisée par : /api/cron/dispatch-scheduled, /api/cron/sync-youtube-stats,
 * /api/cron/fetes-notifications.
 */
export function autoriserCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev : pas de secret configuré
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) return true; // Vercel Cron
  const custom = req.headers.get("x-cron-secret");
  if (custom === secret) return true; // manuel / externe
  return false;
}
