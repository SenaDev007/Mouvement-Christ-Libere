/**
 * ⭐ V4.10 — MOTEUR HORS LIGNE de l'application « Christ Libère ».
 *
 * Deux missions, exigées par le pasteur :
 *
 * ① MESSAGES HORS LIGNE (comportement WhatsApp) — « même on peut envoyer
 *   les messages et quand la connexion sera rétablie, les messages vont
 *   charger et être envoyés » :
 *     - `queueOutboxMessage()`   : rédigé hors ligne → stocké dans la base
 *                                  locale (IndexedDB), bulle « en attente ».
 *     - `flushOutbox()`          : dès que la connexion revient (événement
 *                                  `online`, intervalle, retour au premier
 *                                  plan), chaque message est envoyé au
 *                                  serveur DANS L'ORDRE de rédaction.
 *                                  Succès → la bulle devient un vrai message
 *                                  (id serveur). Échec réseau → il reste en
 *                                  file. Abandon après MAX_ATTEMPTS.
 *
 * ② SYNCHRO TEMPS RÉEL DU CONTENU — « lorsque les images changent depuis
 *   le back-office, ça doit changer également au niveau de l'application
 *   mobile dès lors qu'il y a la connexion internet » :
 *     - Poll léger de `/api/app/content` (toutes les 60 s en ligne, au
 *       retour de connexion et au retour au premier plan).
 *     - Le hash de version change → le bundle est mis à jour dans la base
 *       locale + événement `ycl:content-updated` → la coquille appelle
 *       `router.refresh()` → les composants serveur (mêmes que le site
 *       public) se re-rendent avec les nouvelles données/photos, SANS
 *       recharger la page.
 *
 * Bus d'événements (window.dispatchEvent) :
 *   - "ycl:online" / "ycl:offline"           — état de la connexion
 *   - "ycl:content-updated" {hash}           — contenu back-office changé
 *   - "ycl:outbox-updated" {pending}        — file d'envoi (re)comptée
 *   - "ycl:outbox-sent" {localId, message}  — message parti ✓
 *   - "ycl:outbox-dropped" {localId}        — abandonné après N échecs
 *
 * ⚠ « use client » uniquement. Toutes les fonctions sont sans effet si
 *   IndexedDB n'est pas disponible (SSR, vieux navigateur).
 */

import {
  offlineDb,
  type OutboxMessage,
  type ContentBundleRow,
} from "./db";
import { api } from "@/lib/api-client";

/* ============================================================
   Constantes
   ============================================================ */

/** Abandon définitif d'un message après ce nombre d'échecs serveur. */
const MAX_OUTBOX_ATTEMPTS = 6;
/** Intervalle du poll de contenu (ms) — même cadence que la barre des lives. */
const CONTENT_POLL_INTERVAL_MS = 60_000;
/** Intervalle de vidage de la file d'envoi quand on est en ligne (ms). */
const OUTBOX_FLUSH_INTERVAL_MS = 15_000;

/* ============================================================
   Utilitaires
   ============================================================ */

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function dispatch(name: string, detail?: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Id local unique pour une bulle « en attente ». */
export function newLocalMessageId(): string {
  return `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ============================================================
   ① FILE D'ENVOI — messages hors ligne (comportement WhatsApp)
   ============================================================ */

export type QueuedMessage = OutboxMessage & { localId: string };

/** Couleur du type de payload attendu par l'API messages (cf. MessagingView). */
export interface OutboxPayload {
  conversationId: string;
  userId: string;
  content: string;
  type?: string;
  replyToId?: string;
  verseRef?: string;
  verseText?: string;
}

/**
 * Range un message dans la base locale — appelé quand l'envoi est
 * impossible MAINTENANT (hors ligne ou échec réseau). La bulle s'affiche
 * avec l'horloge ⏱ ; `flushOutbox()` s'en occupe à la reconnexion.
 */
export async function queueOutboxMessage(payload: OutboxPayload): Promise<QueuedMessage> {
  const row: OutboxMessage = {
    localId: newLocalMessageId(),
    conversationId: payload.conversationId,
    userId: payload.userId,
    content: payload.content,
    type: payload.type || "TEXT",
    replyToId: payload.replyToId,
    verseRef: payload.verseRef,
    verseText: payload.verseText,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const db = offlineDb();
  if (db) {
    try {
      await db.outbox.put(row);
    } catch (e) {
      console.warn("[offline] Mise en file impossible :", e);
    }
    void countPending().then((pending) => dispatch("ycl:outbox-updated", { pending }));
  }
  return row as QueuedMessage;
}

/** Tous les messages en attente, dans l'ordre de rédaction (FIFO). */
export async function getOutboxMessages(): Promise<QueuedMessage[]> {
  const db = offlineDb();
  if (!db) return [];
  try {
    return (await db.outbox.orderBy("createdAt").toArray()) as QueuedMessage[];
  } catch {
    return [];
  }
}

/** Nb de messages en attente (badge éventuel). */
export async function countPending(): Promise<number> {
  const db = offlineDb();
  if (!db) return 0;
  try {
    return await db.outbox.count();
  } catch {
    return 0;
  }
}

/**
 * Tente d'envoyer TOUS les messages en attente, dans l'ordre.
 * - Succès  : retire de la file + événement `ycl:outbox-sent` (l'UI remplace
 *   la bulle en attente par le vrai message renvoyé par le serveur).
 * - Erreur réseau : la file reste intacte — on retentera plus tard.
 * - Erreur serveur définitive (4xx/5xx) : incrémente `attempts` ; au-delà
 *   de MAX_OUTBOX_ATTEMPTS le message est abandonné (`ycl:outbox-dropped`).
 *
 * → Utilisé par le moteur (événement `online` + intervalle) ET par
 *   MessagingView (au montage, pour repartir proprement).
 */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const db = offlineDb();
  if (!db || !isOnline()) return { sent: 0, failed: 0 };

  const queue = await getOutboxMessages();
  let sent = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(
        api.url(`/api/yeshua-connect/conversations/${item.conversationId}/messages`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: item.userId,
            content: item.content,
            type: item.type,
            replyToId: item.replyToId,
            verseRef: item.verseRef,
            verseText: item.verseText,
          }),
        }
      );

      if (res.ok) {
        const serverMessage = await res.json();
        await db.outbox.delete(item.localId);
        sent++;
        dispatch("ycl:outbox-sent", { localId: item.localId, message: serverMessage });
      } else {
        // Erreur applicative (403, 404, 500…) — pas un problème réseau.
        const attempts = item.attempts + 1;
        if (attempts >= MAX_OUTBOX_ATTEMPTS) {
          await db.outbox.delete(item.localId);
          dispatch("ycl:outbox-dropped", { localId: item.localId, status: res.status });
        } else {
          await db.outbox.update(item.localId, { attempts });
        }
        failed++;
      }
    } catch {
      // Réseau à nouveau coupé au milieu du vidage → on arrête, on
      // gardera le reste pour la prochaine fenêtre de connexion.
      break;
    }
  }

  if (queue.length > 0) {
    void countPending().then((pending) => dispatch("ycl:outbox-updated", { pending }));
  }
  return { sent, failed };
}

/* ============================================================
   ② SYNCHRO DU CONTENU PUBLIC (temps réel back-office → app)
   ============================================================ */

export interface ContentBundle {
  hash: string;
  generatedAt: string;
  data: Record<string, unknown>;
}

/** Hash de version actuellement stocké dans la base locale (null si aucun). */
export async function getStoredContentHash(): Promise<string | null> {
  const db = offlineDb();
  if (!db) return null;
  try {
    const row = await db.content.get("current");
    return row?.hash ?? null;
  } catch {
    return null;
  }
}

/** Dernier bundle stocké localement (affichage / diagnostics). */
export async function getStoredContentBundle(): Promise<ContentBundleRow | null> {
  const db = offlineDb();
  if (!db) return null;
  try {
    return (await db.content.get("current")) ?? null;
  } catch {
    return null;
  }
}

/**
 * Interroge `/api/app/content`, compare le hash à la copie locale et —
 * si le contenu back-office a changé (nouvelle photo, nouvelle vidéo,
 * nouvelle annonce…) — met à jour la base locale et émet
 * `ycl:content-updated` (la coquille de l'app fait alors un
 * `router.refresh()` : la page courante se re-rend avec les données
 * fraîches, exactement comme le site public).
 */
export async function syncContent(): Promise<{ changed: boolean; hash: string | null }> {
  if (!isOnline()) return { changed: false, hash: null };
  const db = offlineDb();

  try {
    const res = await fetch(api.url("/api/app/content"), { cache: "no-store" });
    if (!res.ok) return { changed: false, hash: null };
    const bundle = (await res.json()) as ContentBundle;
    if (!bundle?.hash) return { changed: false, hash: null };

    const storedHash = await getStoredContentHash();
    const changed = storedHash !== bundle.hash;

    if (db) {
      await db.content.put({
        key: "current",
        hash: bundle.hash,
        generatedAt: bundle.generatedAt,
        cachedAt: new Date().toISOString(),
        data: bundle.data,
      });
      await db.meta.put({
        key: "last-online-sync",
        value: new Date().toISOString(),
      });
    }

    if (changed) dispatch("ycl:content-updated", { hash: bundle.hash });
    return { changed, hash: bundle.hash };
  } catch {
    // Hors ligne / serveur injoignable → rien à faire, la copie locale sert.
    return { changed: false, hash: null };
  }
}

/* ============================================================
   INITIALISATION DU MOTEUR (une seule fois par onglet)
   ============================================================ */

let engineStarted = false;

/**
 * Démarre le moteur hors ligne : écoute online/offline, poll du contenu,
 * vidage périodique de la file d'envoi. Appelé par la coquille de l'app
 * (montée une fois, garde-fou `engineStarted`).
 */
export function initOfflineEngine(): void {
  if (typeof window === "undefined" || engineStarted) return;
  engineStarted = true;

  /* Passage HORS LIGNE → l'UI réagit (bandeau, bulles en attente…) */
  window.addEventListener("offline", () => dispatch("ycl:offline"));

  /* Retour EN LIGNE → WhatsApp : on envoie la file d'attente, on
     recharge les conversations/messages et on resynchronise le contenu. */
  window.addEventListener("online", () => {
    dispatch("ycl:online");
    void flushOutbox();
    void syncContent();
  });

  /* Poll de contenu (toutes les 60 s en ligne) — détection des
     publications du back-office pendant que l'app est ouverte. */
  window.setInterval(() => {
    if (isOnline() && document.visibilityState === "visible") {
      void syncContent();
    }
  }, CONTENT_POLL_INTERVAL_MS);

  /* Vidage périodique de la file (file créée pendant que l'onglet était
     ouvert mais l'événement online est déjà passé, etc.). */
  window.setInterval(() => {
    if (isOnline()) void flushOutbox();
  }, OUTBOX_FLUSH_INTERVAL_MS);

  /* Retour au premier plan → resynchro immédiate. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isOnline()) {
      void syncContent();
      void flushOutbox();
    }
  });

  /* Premier lancement en ligne : synchro initiale + vidage d'une
     éventuelle file héritée de la session précédente. */
  if (isOnline()) {
    void syncContent();
    void flushOutbox();
  }
}
