/**
 * ⭐ V2.6.1 — Auto-réparation légère du schéma PostgreSQL.
 *
 * Contexte : la V2.5 a ajouté `Channel.avatarUrl` (photos des canaux).
 * Si `bun run db:push` n'a pas encore été exécuté sur la base de
 * production, la simple sélection de cette colonne fait échouer TOUTE
 * la liste des conversations (erreur 500 → Yeshua Connect s'affiche
 * vide : « Aucune conversation »), ainsi que le back-office Canaux.
 *
 * Ces helpers exécutent des DDL idempotents (`IF NOT EXISTS`), au plus
 * une fois par instance de serveur (mémoïsation en mémoire module —
 * sur Vercel, chaque lambda ne paie le coût qu'une seule fois).
 *
 * Si les droits SQL manquent, l'échec est uniquement loggué en console :
 * le comportement redevient alors exactement celui d'avant (l'utilisateur
 * devra lancer `bun run db:push` manuellement).
 */
import { db } from "@/lib/db";

let channelAvatarOk = false;
let inflight: Promise<void> | null = null;

/**
 * S'assure que la colonne `Channel.avatarUrl` (TEXT, nullable) existe.
 * - Idempotent : `ADD COLUMN IF NOT EXISTS` (PostgreSQL ≥ 9.6).
 * - Mémoïsé : après un premier succès, les appels suivants sont gratuits.
 * - Concurrentiel : un seul ALTER en vol, les requêtes simultanées
 *   attendent le même Promise.
 */
export function ensureChannelAvatarUrl(): Promise<void> {
  if (channelAvatarOk) return Promise.resolve();
  if (!inflight) {
    inflight = db
      .$executeRawUnsafe(
        'ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT'
      )
      .then(() => {
        channelAvatarOk = true;
        console.log("[ensure-schema] Colonne Channel.avatarUrl vérifiée/créée ✓");
      })
      .catch((e: unknown) => {
        console.error(
          "[ensure-schema] ALTER TABLE Channel.avatarUrl impossible :",
          e instanceof Error ? e.message : e
        );
        // Pas de relance automatique du DDL dans cette instance :
        // la requête Prisma échouera comme avant (l'erreur est alors
        // visible côté client grâce à la bannière d'erreur V2.6.1).
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
