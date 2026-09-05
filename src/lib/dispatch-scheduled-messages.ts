import { db } from "@/lib/db";

/**
 * ⭐ V3.39 — DISPATCH DES MESSAGES PROGRAMMÉS (partagé + opportuniste).
 * ============================================================================
 *
 * Anomalie remontée par le pasteur : « quand on programme un message dans
 * Yeshua Connect et que l'heure programmée sonne, on ne voit pas le
 * message — la programmation ne marche pas. »
 *
 * CAUSES RACINES (deux, cumulées) :
 *   1. Le cron Vercel /api/cron/dispatch-scheduled vérifiait le header
 *      `x-cron-secret`… or Vercel Cron envoie automatiquement
 *      `Authorization: Bearer ${CRON_SECRET}` → 401 systématique → les
 *      messages PENDING n'étaient JAMAIS envoyés (corrigé côté routes).
 *   2. Sur le plan Vercel gratuit (Hobby), les crons sont limités à une
 *      exécution par jour — même avec l'auth réparée, un schedule
 *      `* * * * *` ne tourne pas à la minute.
 *
 * SOLUTION (cette lib) : dispatch OPPORTUNISTE, indépendant du cron —
 *   - appelé par GET /api/yeshua-connect/conversations (sidebar, poll 10 s)
 *     sans channelId → envoie TOUT ce qui est dû, tous canaux ;
 *   - appelé par GET /api/yeshua-connect/conversations/:id/messages (poll
 *     3 s du canal actif) avec channelId → le message programmé apparaît
 *     en direct dans le canal ouvert, à la minute prévue ;
 *   - appelé par le cron (route /api/cron/dispatch-scheduled) réparé —
 *     best-effort de secours si personne n'est connecté.
 *
 * Garanties :
 *   - ANTI-DOUBLE-ENVOI : chaque ScheduledMessage est « réclamé » via un
 *     updateMany atomique `WHERE id = … AND status = 'PENDING'` → une seule
 *     instance serveur gagne la course, les autres voient count = 0 et
 *     passent leur chemin (_poll toutes les 3 s + instances multiples…) ;
 *   - THROTTLE mémoire (10 s par instance) : le poll clients reste léger —
 *     au pire une requête indexée toutes les 10 s par instance ;
 *   - BEST-EFFORT : n'JETTE JAMAIS — un échec loggué n'échoue pas la route
 *     appelante (l'affichage des messages prime).
 *   - Le canal reçoit lastMessageAt = date d'envoi (tri + aperçu sidebar
 *     corrects), et le message est signé par l'auteur de la programmation.
 */

/** Throttle mémoire : minimum entre deux dispatches par instance serveur. */
const THROTTLE_MS = 10_000;
let dernierDispatch = 0;
let dispatchEnCours: Promise<number> | null = null;

/**
 * Envoie les messages programmés dont l'heure est arrivée.
 * @param channelId optionnel — limite au canal consulté (poll du canal
 *        actif) ; omit = tous les canaux (sidebar / cron).
 * @returns nombre de messages effectivement envoyés (0 si throttle actif).
 */
export async function dispatchDueScheduledMessages(
  channelId?: string,
): Promise<number> {
  // Throttle par instance : le poll clients (3 s / 10 s) ne doit pas
  // transformer chaque requête en scan de table. La fenêtre de 10 s est
  // imperceptible pour l'utilisateur final (le message apparaît au pire
  // 10 s après l'heure programmée).
  if (Date.now() - dernierDispatch < THROTTLE_MS) return 0;
  if (dispatchEnCours) return dispatchEnCours;

  dispatchEnCours = (async () => {
    let envoyes = 0;
    try {
      const maintenant = new Date();
      const dus = await db.scheduledMessage.findMany({
        where: {
          status: "PENDING",
          scheduledAt: { lte: maintenant },
          ...(channelId ? { channelId } : {}),
        },
        select: {
          id: true,
          channelId: true,
          userId: true,
          content: true,
          scheduledAt: true,
        },
        take: 50,
      });
      if (dus.length === 0) return 0;

      for (const sm of dus) {
        try {
          // ─── Réclamation atomique : la première instance qui bascule
          // PENDING → SENT gagne ; les concurrents obtiennent count = 0.
          // (Si la création du Message échoue juste après, on repasse la
          // ligne en FAILED — même sémantique que l'ancien cron.)
          const claim = await db.scheduledMessage.updateMany({
            where: { id: sm.id, status: "PENDING" },
            data: { status: "SENT" },
          });
          if (claim.count === 0) continue; // déjà pris par une autre instance

          const message = await db.message.create({
            data: {
              channelId: sm.channelId,
              userId: sm.userId,
              content: sm.content,
              type: "TEXT",
            },
          });

          await db.scheduledMessage.update({
            where: { id: sm.id },
            data: { sentMessageId: message.id },
          }).catch(() => {
            // déjà marqué SENT — le lien sentMessageId est un bonus
          });

          // Tri sidebar + horodatage du canal (aperçu correct).
          await db.channel
            .update({
              where: { id: sm.channelId },
              data: { lastMessageAt: message.createdAt },
            })
            .catch(() => {});

          envoyes++;
          console.log(
            `[dispatch-scheduled] Message programmé ${sm.id} envoyé dans le canal ${sm.channelId}`,
          );
        } catch (e) {
          // Échec d'envoi → FAILED (comportement historique du cron), la
          // route appelante continue normalement.
          await db.scheduledMessage
            .update({ where: { id: sm.id }, data: { status: "FAILED" } })
            .catch(() => {});
          console.error(
            "[dispatch-scheduled] Envoi impossible :",
            e instanceof Error ? e.message : e,
          );
        }
      }
      return envoyes;
    } catch (e) {
      // findMany global échoué (base froide, etc.) → silencieux côté route.
      console.error(
        "[dispatch-scheduled] Lecture des messages dus impossible :",
        e instanceof Error ? e.message : e,
      );
      return 0;
    } finally {
      dernierDispatch = Date.now();
    }
  })();

  try {
    return await dispatchEnCours;
  } finally {
    dispatchEnCours = null;
  }
}
