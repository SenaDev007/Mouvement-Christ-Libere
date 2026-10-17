/**
 * ⭐ V4.10 — BASE DE DONNÉES LOCALE DE L'APPLICATION (IndexedDB via Dexie).
 *
 * Exigence du pasteur : « l'application doit avoir une base de données
 * locale. Pourquoi base de données locale ? Parce qu'on doit pouvoir
 * l'utiliser en hors ligne. Le hors ligne doit fonctionner pour toutes les
 * pages de l'application jusqu'à la communauté Yeshua Connect intégrée. »
 *
 * Structure (tables) :
 *
 *  1. content       — Miroir local du contenu public (bundle /api/app/content)
 *                     + hash de version : sert au temps réel (détection de
 *                     changements back-office) et à l'affichage hors ligne.
 *
 *  2. outbox        — FILE D'ENVOI des messages Yeshua Connect rédigés hors
 *                     ligne (comportement WhatsApp) : le message est écrit
 *                     ici avec une bulle « en attente » (horloge), puis est
 *                     envoyé AUTOMATIQUEMENT dès que la connexion revient.
 *
 *  3. convCache     — Dernier état connu des conversations du membre
 *                     (lecture hors ligne de la liste des canaux).
 *
 *  4. msgCache      — Dernier état connu des messages de chaque conversation
 *                     ouverte (lecture hors ligne de l'historique).
 *
 *  5. meta          — Clés techniques : hash de contenu courant, date du
 *                     dernier passage en ligne, etc.
 *
 * ⚠ STRICTEMENT « use client » : à n'importer QUE depuis des composants
 *   clients. Toutes les méthodes sont protégées par `isOfflineDbReady()`
 *   (SSR / navigateurs sans IndexedDB → no-op silencieux, le site/app
 *   fonctionnent en ligne normalement).
 */

import Dexie, { type Table } from "dexie";

/* ============================================================
   Schéma
   ============================================================ */

/** Bundle de contenu public versionné (cf. /api/app/content). */
export interface ContentBundleRow {
  /** Toujours "current" — une seule ligne, écrasée à chaque synchro. */
  key: string;
  /** Hash de version du contenu (change quand le back-office publie). */
  hash: string;
  /** Date de génération côté serveur (ISO). */
  generatedAt: string;
  /** Date locale de la dernière écriture (ISO). */
  cachedAt: string;
  /** Charge utile complète (JSON tel que renvoyé par l'API). */
  data: unknown;
}

/** Message Yeshua Connect rédigé hors ligne (file d'envoi). */
export interface OutboxMessage {
  /** Identifiant local unique (remplacé par l'id serveur après envoi). */
  localId: string;
  conversationId: string;
  userId: string;
  content: string;
  type: string;
  replyToId?: string;
  verseRef?: string;
  verseText?: string;
  /** Date de rédaction locale (ISO) — sert d'ordre d'envoi FIFO. */
  createdAt: string;
  /** Nb de tentatives d'envoi échouées (au-delà de MAX → abandon). */
  attempts: number;
}

/** Cache de la liste des conversations (lecture hors ligne). */
export interface ConvCacheRow {
  userId: string;
  conversations: unknown;
  cachedAt: string;
}

/** Cache des derniers messages d'une conversation (lecture hors ligne). */
export interface MsgCacheRow {
  conversationId: string;
  messages: unknown;
  cachedAt: string;
}

/** Clés techniques. */
export interface MetaRow {
  key: string;
  value: string;
}

/* ============================================================
   Base
   ============================================================ */

class OfflineDatabase extends Dexie {
  content!: Table<ContentBundleRow, string>;
  outbox!: Table<OutboxMessage, string>;
  convCache!: Table<ConvCacheRow, string>;
  msgCache!: Table<MsgCacheRow, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("christ-libere-app");
    this.version(1).stores({
      // Index primaire uniquement là où c'est nécessaire.
      content: "key",
      outbox: "localId, conversationId, createdAt",
      convCache: "userId",
      msgCache: "conversationId",
      meta: "key",
    });
  }
}

/** Instance unique — créée paresseusement côté navigateur uniquement. */
let dbInstance: OfflineDatabase | null = null;

/** Vrai si IndexedDB est disponible (navigateur, pas SSR). */
export function isOfflineDbReady(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

/** Ouvre (une seule fois) la base locale. Null si indisponible. */
export function offlineDb(): OfflineDatabase | null {
  if (!isOfflineDbReady()) return null;
  if (!dbInstance) dbInstance = new OfflineDatabase();
  return dbInstance;
}

/* ============================================================
   Nettoyage au changement de compte (déconnexion)
   ============================================================ */

/**
 * Efface les données PERSONNELLES du membre (outbox + caches de
 * conversations/messages) — appelé à la déconnexion depuis la coquille de
 * l'app pour qu'aucun message en attente d'un compte ne parte sous un autre.
 */
export async function wipePersonalLocalData(): Promise<void> {
  const db = offlineDb();
  if (!db) return;
  try {
    await Promise.all([
      db.outbox.clear(),
      db.convCache.clear(),
      db.msgCache.clear(),
    ]);
  } catch (e) {
    console.warn("[offline] Nettoyage local impossible :", e);
  }
}
