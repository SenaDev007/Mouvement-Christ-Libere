/**
 * ⭐ V3.21 — CHAÎNE DE REPLI MULTIMÉDIA : LiveKit → Agora → Daily.
 * ============================================================================
 *
 * Directive du pasteur (2026-09-02) :
 *   « Nous gardons LiveKit comme la source de vérité ; si LiveKit a des
 *    problèmes, Agora prend immédiatement le relais ; et si Agora a des
 *    problèmes, Daily prend automatiquement le relais. »
 *
 * ARCHITECTURE (arbitrage SERVEUR — même décision pour tous les clients) :
 *
 *   1. CHAÎNE ORDONNÉE : livekit → agora → daily (le Plan C existant
 *      P2P WebRTC/Jitsi reste le filet de sécurité ULTIME si les 3 tombent).
 *
 *   2. SANTÉ PARTAGÉE en base (table CallProviderHealth) — pas en mémoire :
 *      Vercel est serverless, chaque lambda aurait sinon son propre état.
 *      Un fournisseur qui échoue entre en « cooldown » 5 minutes ; chaque
 *      NOUVEL appel repart de LiveKit (source de vérité) dès la fin du
 *      cooldown.
 *
 *   3. ARBITRAGE PAR APPEL (colonne CallSignal.mediaProvider) : quand
 *      l'appelant (ou un participant) signale l'échec d'un fournisseur
 *      (action « failover »), le serveur fait AVANCER l'appel au suivant
 *      et PERSITE le choix — le destinataire qui décroche, comme l'autre
 *      partie en plein appel, rejoignent le MÊME fournisseur via le
 *      polling d'état existant (2 s, champ mediaProvider ajouté).
 *
 *   4. CANAUX VOCAUX : même logique (table VoiceMediaProvider, clé =
 *      channelId) — pas de CallSignal pour les rooms persistantes.
 *
 *   5. IDENTIFIANTS (env) — un fournisseur sans identifiants est
 *      simplement SAUTÉ (chaîne dégradée propre, jamais d'erreur) :
 *      - LiveKit : LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
 *        (existant — source de vérité)
 *      - Agora   : AGORA_APP_ID / AGORA_APP_CERTIFICATE
 *      - Daily   : DAILY_API_KEY
 *
 * Tokens générés CÔTÉ SERVEUR uniquement (jamais de secret dans le client) :
 *   - LiveKit : AccessToken (livekit-server-sdk — existant)
 *   - Agora   : RtcTokenBuilder (paquet officiel agora-token — local, zéro
 *     réseau, impossible à échouer par lui-même)
 *   - Daily   : API REST (création de room + meeting-token — le seul appel
 *     réseau, dont l'échec nourrit directement la santé Daily)
 */
import { AccessToken } from "livekit-server-sdk";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { db } from "@/lib/db";
import { getLiveKitConfig } from "@/lib/livekit-config";
import { ensureCallMediaTables } from "@/lib/ensure-schema";

/** Ordre STRICT imposé : LiveKit (vérité) → Agora → Daily. */
export const MEDIA_PROVIDER_CHAIN = ["livekit", "agora", "daily"] as const;
export type MediaProviderName = (typeof MEDIA_PROVIDER_CHAIN)[number];

/** Cooldown d'un fournisseur défaillant (ms) — il redevient éligible après. */
const PROVIDER_COOLDOWN_MS = 5 * 60 * 1000;

/** Durée de validité des tokens générés (s) — 2 h couvre tout appel. */
const TOKEN_TTL_SEC = 2 * 60 * 60;

// ═══════════════════════════════════════════════════════════════════════
//  Configuration des fournisseurs (lecture env, pure, sans effet de bord)
// ═══════════════════════════════════════════════════════════════════════

export function providerConfigured(provider: MediaProviderName): boolean {
  switch (provider) {
    case "livekit": {
      // Toujours configuré : clés par défaut du Plan A (Cloud) — c'est la
      // source de vérité, jamais sautée.
      const c = getLiveKitConfig();
      return !!c.url && !!c.apiKey && !!c.apiSecret;
    }
    case "agora":
      return !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
    case "daily":
      return !!process.env.DAILY_API_KEY;
  }
}

export function agoraAppId(): string {
  return process.env.AGORA_APP_ID || "";
}

export function dailyApiKey(): string {
  return process.env.DAILY_API_KEY || "";
}

// ═══════════════════════════════════════════════════════════════════════
//  Santé partagée (table CallProviderHealth — serverless-safe)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Enregistre l'échec d'un fournisseur (appelé par l'action « failover ») :
 * incrément du compteur + cooldown de 5 minutes. Les NOUVEAUX appels
 * l'éviteront ; les appels en cours qui y sont déjà restent dessus tant
 * qu'ils ne signalent pas d'échec.
 */
export async function recordProviderFailure(
  provider: MediaProviderName,
  reason: string,
): Promise<void> {
  try {
    await ensureCallMediaTables();
    await db.$executeRawUnsafe(
      `INSERT INTO "CallProviderHealth" ("provider", "failCount", "lastFailureAt", "lastReason", "cooldownUntil")
       VALUES ($1, 1, now(), $2, now() + interval '5 minutes')
       ON CONFLICT ("provider") DO UPDATE SET
         "failCount" = "CallProviderHealth"."failCount" + 1,
         "lastFailureAt" = now(),
         "lastReason" = $2,
         "cooldownUntil" = now() + interval '5 minutes'`,
      provider,
      reason.slice(0, 300),
    );
    console.warn(`[call-providers] ${provider} en échec (${reason}) → cooldown 5 min`);
  } catch (e) {
    console.error("[call-providers] recordProviderFailure:", e);
  }
}

/** Réinitialise la santé d'un fournisseur (connexion réussie constatée). */
export async function recordProviderSuccess(provider: MediaProviderName): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "CallProviderHealth" ("provider", "failCount", "lastFailureAt", "lastReason", "cooldownUntil")
       VALUES ($1, 0, NULL, NULL, NULL)
       ON CONFLICT ("provider") DO UPDATE SET
         "failCount" = 0, "lastFailureAt" = NULL, "lastReason" = NULL, "cooldownUntil" = NULL`,
      provider,
    );
  } catch {
    // best effort
  }
}

/** Un fournisseur est-il en cooldown (dernier échec < 5 min) ? */
export async function isProviderCoolingDown(provider: MediaProviderName): Promise<boolean> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ cooling: boolean }>>(
      `SELECT ("cooldownUntil" IS NOT NULL AND "cooldownUntil" > now()) AS "cooling"
       FROM "CallProviderHealth" WHERE "provider" = $1`,
      provider,
    );
    return rows.length > 0 && rows[0].cooling === true;
  } catch {
    return false;
  }
}

/**
 * ⭐ Choix du fournisseur pour un NOUVEL appel/room : le premier de la
 * chaîne (ordre LiveKit → Agora → Daily) qui est configuré ET hors
 * cooldown. Renvoie null si TOUT est épuisé (le client garde le Plan C
 * P2P/Jitsi existant).
 */
export async function pickProvider(): Promise<MediaProviderName | null> {
  for (const p of MEDIA_PROVIDER_CHAIN) {
    if (!providerConfigured(p)) continue;
    if (await isProviderCoolingDown(p)) continue;
    return p;
  }
  return null;
}

/**
 * Fournisseur SUIVANT après `from` (échec signalé) : on avance dans la
 * chaîne en sautant les non-configurés/cooldown. `null` = épuisé.
 */
export async function nextProviderAfter(from: MediaProviderName): Promise<MediaProviderName | null> {
  const idx = MEDIA_PROVIDER_CHAIN.indexOf(from);
  for (let i = idx + 1; i < MEDIA_PROVIDER_CHAIN.length; i++) {
    const p = MEDIA_PROVIDER_CHAIN[i];
    if (!providerConfigured(p)) continue;
    if (await isProviderCoolingDown(p)) continue;
    return p;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
//  Noms de rooms/channels — MÊME espacement de noms pour les 3 fournisseurs
//  (yeshua-call-<convId> / yeshua-voice-<convId> — cohérent avec V2.3+)
// ═══════════════════════════════════════════════════════════════════════

export function roomNameFor(kind: "call" | "voice", conversationId: string): string {
  return `yeshua-${kind}-${conversationId}`;
}

// ═══════════════════════════════════════════════════════════════════════
//  Génération des identifiants (tokens) — 100 % serveur
// ═══════════════════════════════════════════════════════════════════════

/** LiveKit : même génération que /api/livekit/token (métadonnées + avatar). */
async function buildLiveKitCreds(
  roomName: string,
  identity: string,
  name: string,
  avatarUrl?: string | null,
): Promise<{ url: string; token: string }> {
  const { apiKey, apiSecret, url } = getLiveKitConfig();
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ...(avatarUrl ? { metadata: JSON.stringify({ avatarUrl }) } : {}),
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return { url, token: await at.toJwt() };
}

/** Hash djb2 → uint32 stable (uid Agora). */
function uidHash(userId: string): number {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

/** Agora : token RTC local (paquet officiel — aucun appel réseau). */
function buildAgoraCreds(
  channel: string,
  userId: string,
): { appId: string; token: string; channel: string; uid: number } {
  return buildAgoraRoleCreds(channel, userId, "publisher");
}

/**
 * ⭐ V3.22 — Agora : token RTC pour un RÔLE donné.
 * - "publisher"  : le studio qui diffuse (appels Yeshua + lives publics)
 * - "subscriber" : les VIEWERS du live (rôle audience — reçoivent, ne
 *   publient JAMAIS : aucun DataChannel, aucune interaction, exactement
 *   comme un spectateur YouTube).
 */
export function buildAgoraRoleCreds(
  channel: string,
  userId: string,
  role: "publisher" | "subscriber",
): { appId: string; token: string; channel: string; uid: number } {
  const appId = agoraAppId();
  const uid = uidHash(userId);
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    process.env.AGORA_APP_CERTIFICATE || "",
    channel,
    uid,
    role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
    TOKEN_TTL_SEC,
    TOKEN_TTL_SEC,
  );
  return { appId, token, channel, uid };
}

// ─── Daily : cache léger de rooms (une création par conversation suffit) ──
interface DailyRoomCache {
  url: string;
  createdAt: number;
}
const g = globalThis as unknown as { __dailyRoomCache?: Map<string, DailyRoomCache> };
if (!g.__dailyRoomCache) g.__dailyRoomCache = new Map();
const dailyRoomCache: Map<string, DailyRoomCache> = g.__dailyRoomCache;

/**
 * Daily : garantit l'existence de la room privée (API REST) et renvoie son
 * URL. Échec réseau = échec Daily → nourrit la santé (recordProviderFailure
 * appelé par la route media sur catch).
 */
async function ensureDailyRoom(roomName: string): Promise<string> {
  const cached = dailyRoomCache.get(roomName);
  // cache 24 h — les rooms Daily privées persistent indéfiniment tant
  // qu'aucune expiration n'est fixée, un GET de contrôle suffit alors.
  if (cached && Date.now() - cached.createdAt < 24 * 3600 * 1000) {
    return cached.url;
  }
  const headers = {
    Authorization: `Bearer ${dailyApiKey()}`,
    "Content-Type": "application/json",
  };
  // 1) La room existe-t-elle déjà ? (GET — évite le quota de création)
  const getRes = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
    headers,
    cache: "no-store",
  }).catch(() => null);
  if (getRes && getRes.ok) {
    const room = (await getRes.json()) as { url?: string };
    if (room.url) {
      dailyRoomCache.set(roomName, { url: room.url, createdAt: Date.now() });
      return room.url;
    }
  }
  // 2) Création (room PRIVÉE — meeting-token obligatoire pour rejoindre).
  const createRes = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        enable_chat: false, // le chat passe par Yeshua Connect, pas Daily
        enable_people_ui: true,
        enable_screenshare: true,
        start_video_off: true,
        start_audio_off: false,
        max_participants: 50,
      },
    }),
  });
  // 409/400 « exists » → la room existe déjà, on relit.
  if (!createRes.ok && createRes.status !== 400 && createRes.status !== 409) {
    throw new Error(`Daily room: HTTP ${createRes.status}`);
  }
  const created = (await createRes.json().catch(() => ({}))) as { url?: string };
  if (created.url) {
    dailyRoomCache.set(roomName, { url: created.url, createdAt: Date.now() });
    return created.url;
  }
  const retry = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
    headers,
    cache: "no-store",
  });
  const room = (await retry.json().catch(() => ({}))) as { url?: string };
  if (!room.url) throw new Error("Daily room introuvable après création");
  dailyRoomCache.set(roomName, { url: room.url, createdAt: Date.now() });
  return room.url;
}

/** Daily : meeting-token (owner non requis — participant simple). */
async function buildDailyCreds(roomName: string): Promise<{ url: string; token: string }> {
  return buildDailyCredsForRoom(roomName, false);
}

/**
 * ⭐ V3.22 — Daily : creds d'une room arbitraire (appels Yeshua + LIVES
 * publics). `owner` = true pour le studio qui diffuse.
 */
export async function buildDailyCredsForRoom(
  roomName: string,
  owner: boolean,
): Promise<{ url: string; token: string }> {
  const url = await ensureDailyRoom(roomName);
  const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { room_name: roomName, is_owner: owner },
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Daily token: HTTP ${tokenRes.status}`);
  }
  const { token } = (await tokenRes.json()) as { token: string };
  return { url, token };
}

// ═══════════════════════════════════════════════════════════════════════
//  Bundle complet envoyé au client (une seule forme pour les 3)
// ═══════════════════════════════════════════════════════════════════════

export interface ProviderBundle {
  provider: MediaProviderName;
  roomName: string;
  /** Chaîne EFFECTIVE (fournisseurs configurés, dans l'ordre). */
  chain: MediaProviderName[];
  /** Vue diagnostic (aucun secret) pour l'UI « Réseau : … ». */
  providersHealth: Record<string, { configured: boolean; coolingDown: boolean }>;
  livekit?: { url: string; token: string };
  agora?: { appId: string; token: string; channel: string; uid: number };
  daily?: { url: string; token: string };
}

/** Liste des fournisseurs réellement configurés (ordre de la chaîne). */
export function effectiveChain(): MediaProviderName[] {
  return MEDIA_PROVIDER_CHAIN.filter(providerConfigured);
}

/**
 * Construit le bundle d'un fournisseur pour un utilisateur donné.
 * ⚠️ Peut JETER (ex. Daily réseau mort) — l'appelant (route media) catch
 * et bascule au suivant : c'est la boucle de repli serveur.
 */
export async function buildProviderBundle(
  provider: MediaProviderName,
  opts: {
    kind: "call" | "voice";
    conversationId: string;
    userId: string;
    userName: string;
    avatarUrl?: string | null;
  },
): Promise<ProviderBundle> {
  const roomName = roomNameFor(opts.kind, opts.conversationId);
  const bundle: ProviderBundle = {
    provider,
    roomName,
    chain: effectiveChain(),
    providersHealth: {},
  };
  for (const p of MEDIA_PROVIDER_CHAIN) {
    bundle.providersHealth[p] = {
      configured: providerConfigured(p),
      coolingDown: await isProviderCoolingDown(p),
    };
  }
  switch (provider) {
    case "livekit":
      bundle.livekit = await buildLiveKitCreds(roomName, opts.userId, opts.userName, opts.avatarUrl);
      break;
    case "agora":
      bundle.agora = buildAgoraCreds(roomName, opts.userId);
      break;
    case "daily":
      bundle.daily = await buildDailyCreds(roomName);
      break;
  }
  return bundle;
}

// ═══════════════════════════════════════════════════════════════════════
//  Arbitrage persisté : par APPEL (CallSignal) et par CANAL VOCAL
// ═══════════════════════════════════════════════════════════════════════

/** Fournisseur courant d'un appel (défaut : le premier de la chaîne). */
export async function getCallProvider(callId: string): Promise<MediaProviderName | null> {
  try {
    await ensureCallMediaTables();
    const rows = await db.$queryRawUnsafe<Array<{ mediaProvider: string | null }>>(
      `SELECT "mediaProvider" FROM "CallSignal" WHERE "id" = $1`,
      callId,
    );
    const stored = rows[0]?.mediaProvider;
    if (stored && MEDIA_PROVIDER_CHAIN.includes(stored as MediaProviderName)) {
      return stored as MediaProviderName;
    }
    return pickProvider();
  } catch {
    return pickProvider();
  }
}

/** Fait avancer un appel au fournisseur suivant après échec de `from`. */
export async function advanceCallProvider(
  callId: string,
  from: MediaProviderName,
  reason: string,
): Promise<MediaProviderName | null> {
  await recordProviderFailure(from, reason);
  const next = await nextProviderAfter(from);
  if (next) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE "CallSignal" SET "mediaProvider" = $2 WHERE "id" = $1`,
        callId,
        next,
      );
    } catch (e) {
      console.error("[call-providers] advanceCallProvider UPDATE:", e);
    }
  }
  return next;
}

/** Fournisseur courant d'un canal vocal (table VoiceMediaProvider). */
export async function getVoiceProvider(channelId: string): Promise<MediaProviderName | null> {
  try {
    await ensureCallMediaTables();
    const rows = await db.$queryRawUnsafe<Array<{ provider: string | null }>>(
      `SELECT "provider" FROM "VoiceMediaProvider" WHERE "channelId" = $1`,
      channelId,
    );
    const stored = rows[0]?.provider;
    if (stored && MEDIA_PROVIDER_CHAIN.includes(stored as MediaProviderName)) {
      return stored as MediaProviderName;
    }
  } catch {
    // table absente au tout premier déploiement → pickProvider
  }
  return pickProvider();
}

/** Fait avancer un canal vocal au suivant après échec de `from`. */
export async function advanceVoiceProvider(
  channelId: string,
  from: MediaProviderName,
  reason: string,
): Promise<MediaProviderName | null> {
  await recordProviderFailure(from, reason);
  const next = await nextProviderAfter(from);
  if (next) {
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "VoiceMediaProvider" ("channelId", "provider", "updatedAt")
         VALUES ($1, $2, now())
         ON CONFLICT ("channelId") DO UPDATE SET "provider" = $2, "updatedAt" = now()`,
        channelId,
        next,
      );
    } catch (e) {
      console.error("[call-providers] advanceVoiceProvider:", e);
    }
  }
  return next;
}

/** Écrit le fournisseur choisi pour un canal vocal (join initial). */
export async function setVoiceProvider(
  channelId: string,
  provider: MediaProviderName,
): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "VoiceMediaProvider" ("channelId", "provider", "updatedAt")
       VALUES ($1, $2, now())
       ON CONFLICT ("channelId") DO UPDATE SET "provider" = $2, "updatedAt" = now()`,
      channelId,
      provider,
    );
  } catch {
    // best effort — l'arbitrage retombera sur pickProvider au prochain join
  }
}
