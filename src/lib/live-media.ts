/**
 * ⭐ V3.22 — LIVES PUBLICS : MODE « YOUTUBE » + CHAÎNE DE REPLI.
 * ============================================================================
 *
 * Directive du pasteur (2026-09-02) :
 *   « Actuellement le système considère chaque viewer comme un participant du
 *    live, donc LiveKit facture le nombre de participants. Je veux que ça
 *    soit à l'instar de YouTube : LiveKit ne considère que le diffuseur
 *    comme participant ; les viewers suivent le live sans interagir et ne
 *    sont pas comptés. Et il faut vérifier que Agora et Daily prennent le
 *    relais si LiveKit est indisponible. »
 *
 * ARCHITECTURE (viewer = spectateur, pas un participant) :
 *
 *   1. MODE HLS « YOUTUBE » (chemin normal, économe) :
 *      - Le STUDIO reste le SEUL participant WebRTC de la room LiveKit
 *        (il publie caméra/micro/canvas comme avant).
 *      - Un EGRESS HLS serveur transcode la room en flux HLS (segments).
 *      - Les VIEWERS regardent ce flux dans un simple lecteur <video>
 *        (hls.js / HLS natif Safari) — ils NE REJOIGNENT JAMAIS la room :
 *        zéro participant, zéro DataChannel, zéro interaction, exactement
 *        comme YouTube. LiveKit ne facture qu'1 participant (le diffuseur)
 *        + les minutes d'egress (bien moins chères que N participants).
 *      - Repli local : si l'egress HLS échoue (quota/plan), les viewers
 *        retombent PROPREMENT en WebRTC LiveKit « subscriber » (comportement
 *        historique — la chaîne d'egress est réessayée automatiquement).
 *
 *   2. CHAÎNE DE REPLI DES LIVES (LiveKit → Agora → Daily) :
 *      - Même chaîne et MÊME table de santé que les appels (CallProviderHealth)
 *        — si LiveKit tombe, appels ET lives basculent ensemble.
 *      - Le choix du fournisseur est PERSISTÉ PAR LIVE (table
 *        LiveMediaProvider) : le studio (source du flux) décide de la
 *        bascule ; les viewers suivent via le polling GET /stream (12 s).
 *      - Studio sur Agora : client « host » (canal de diffusion), publie le
 *        canvas/caméra + micro. Viewers Agora : rôle « audience » — ils
 *        REÇOIVENT sans publier, sans DataChannel (spectateurs purs ; noté :
 *        Agora facture les utilisateurs du canal, mais uniquement pendant
 *        la panne temporaire de LiveKit).
 *      - Studio sur Daily : room Daily + tracks locales (videoSource =
 *        canvas). Viewers Daily : rejoignent en simple participant.
 *
 *   3. ÉCONOMIE DE QUOTA :
 *      - L'egress HLS est IDEMPOTENT (listEgress avant start — pas de
 *        doublon, pas de zombie) avec cache négatif 60 s en cas d'échec.
 *      - /api/live/stop arrête déjà TOUS les egress de la room (HLS inclus).
 *
 * Variables d'environnement (toutes facultatives, côté Vercel) :
 *   - LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (existant)
 *   - AGORA_APP_ID / AGORA_APP_CERTIFICATE (repli 1)
 *   - DAILY_API_KEY (repli 2)
 *   - LIVE_VIEWER_MODE = "hls" (défaut) | "webrtc" — permet de couper le
 *     mode YouTube sans redéploiement (runtime) si besoin.
 */
import { AccessToken } from "livekit-server-sdk";
import {
  EgressClient,
  SegmentedFileOutput,
  SegmentedFileProtocol,
  EncodingOptions,
  AudioCodec,
  VideoCodec,
} from "livekit-server-sdk";
import { db } from "@/lib/db";
import { getLiveKitConfig } from "@/lib/livekit-config";
import {
  MediaProviderName,
  MEDIA_PROVIDER_CHAIN,
  providerConfigured,
  isProviderCoolingDown,
  pickProvider,
  nextProviderAfter,
  recordProviderFailure,
  buildAgoraRoleCreds,
  buildDailyCredsForRoom,
} from "@/lib/call-providers";

// ═══════════════════════════════════════════════════════════════════════
//  Table d'arbitrage par live (LiveMediaProvider)
// ═══════════════════════════════════════════════════════════════════════

/** Crée la table si absente (idempotent, mémoïsé par requête). */
let liveMediaTableEnsured = false;
export async function ensureLiveMediaTable(): Promise<void> {
  if (liveMediaTableEnsured) return;
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "LiveMediaProvider" (
       "liveId"        TEXT PRIMARY KEY,
       "provider"      TEXT NOT NULL DEFAULT 'livekit',
       "egressId"      TEXT,
       "hlsUrlsJson"   TEXT,
       "updatedAt"     TIMESTAMP NOT NULL DEFAULT now()
     )`,
  );
  liveMediaTableEnsured = true;
}

/** Mode de livraison des viewers (runtime — « hls » par défaut). */
export function liveViewerMode(): "hls" | "webrtc" {
  return process.env.LIVE_VIEWER_MODE === "webrtc" ? "webrtc" : "hls";
}

// ═══════════════════════════════════════════════════════════════════════
//  Egress HLS (idempotent + cache négatif)
// ═══════════════════════════════════════════════════════════════════════

const hlsGlobal = globalThis as unknown as {
  __hlsEgressNegative?: Map<string, number>; // roomName → timestamp du dernier échec
};
if (!hlsGlobal.__hlsEgressNegative) hlsGlobal.__hlsEgressNegative = new Map();
const hlsNegative: Map<string, number> = hlsGlobal.__hlsEgressNegative;

/** 60 s de « repos » après un échec d'egress (quota…) avant de réessayer. */
const HLS_NEGATIVE_MS = 60_000;

/** Nom de la playlist live (stable, dérivable côté client). */
const HLS_PLAYLIST_NAME = "live.m3u8";

export interface HlsEgressResult {
  egressId: string;
  /** URLs candidates de la playlist (le client essaie dans l'ordre). */
  urls: string[];
}

/** wss://host → https://host (l'URL HLS est servie en HTTPS). */
function httpsHost(livekitUrl: string): string {
  return livekitUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://").replace(/\/$/, "");
}

/**
 * Dérive les URL candidates de la playlist à partir des résultats d'egress.
 * LiveKit Cloud peut renvoyer une localisation absolue ou relative selon la
 * version — on renvoie les formes plausibles, dédupliquées ; le client
 * essaie la suivante en cas d'erreur (hls.js fatal error → fallback).
 */
function deriveHlsUrls(
  livekitUrl: string,
  roomName: string,
  segInfo?: { playlistName?: string; livePlaylistName?: string; playlistLocation?: string; livePlaylistLocation?: string; filenamePrefix?: string },
  filenamePrefix?: string,
): string[] {
  const host = httpsHost(livekitUrl);
  const prefix = segInfo?.filenamePrefix || filenamePrefix || roomName;
  const liveName = segInfo?.livePlaylistName || HLS_PLAYLIST_NAME;
  const urls: string[] = [];
  const push = (u?: string) => {
    if (!u) return;
    const clean = u.startsWith("http") ? u : `${host}/hls/${u.replace(/^\/+/, "")}`;
    if (!urls.includes(clean)) urls.push(clean);
  };
  push(segInfo?.livePlaylistLocation);
  push(segInfo?.playlistLocation);
  push(`${prefix}/${liveName}`);
  if (urls.length === 0) push(`${roomName}/${HLS_PLAYLIST_NAME}`);
  return urls.slice(0, 3);
}

/**
 * Garantit qu'un egress HLS tourne pour la room du live (idempotent) et
 * renvoie les URL de playlist. ⚠️ Peut JETER (quota/plan/room absente) —
 * l'appelant retombe alors en WebRTC viewer.
 */
export async function ensureHlsEgress(roomName: string, liveId: string): Promise<HlsEgressResult> {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const egressClient = new EgressClient(url, apiKey, apiSecret);

  // 1) Cache négatif : ne pas marteler l'API egress après un échec.
  const lastFail = hlsNegative.get(roomName);
  if (lastFail && Date.now() - lastFail < HLS_NEGATIVE_MS) {
    throw new Error("Egress HLS en échec il y a moins de 60 s (cooldown local)");
  }

  // 2) Un egress HLS ACTIF existe-t-il déjà pour cette room ? → réutiliser.
  try {
    const actives = await egressClient.listEgress({ roomName, active: true });
    for (const eg of actives) {
      const segs = (eg as unknown as { segmentResults?: Array<Record<string, string>> }).segmentResults || [];
      if (segs.length > 0) {
        const seg = segs[0];
        const egressId = (eg as unknown as { egressId: string }).egressId;
        const urls = deriveHlsUrls(url, roomName, seg);
        if (urls.length > 0) {
          return { egressId, urls };
        }
      }
    }
  } catch {
    // listEgress indisponible → on tentera le start (non bloquant)
  }

  // 3) Démarrer l'egress HLS (RoomComposite → segments).
  try {
    const filenamePrefix = `live-${liveId}`;
    const segments = new SegmentedFileOutput({
      protocol: SegmentedFileProtocol.HLS_PROTOCOL,
      filenamePrefix,
      livePlaylistName: HLS_PLAYLIST_NAME,
      // 4 s de segments → latence HLS raisonnable (~15 s, mode YouTube)
      segmentDuration: 4,
    });
    const encoding = new EncodingOptions({
      audioCodec: AudioCodec.OPUS,
      audioBitrate: 128_000,
      videoCodec: VideoCodec.H264_MAIN,
      videoBitrate: 2_500_000,
      framerate: 30,
      width: 1280,
      height: 720,
    });
    const info = await egressClient.startRoomCompositeEgress(
      roomName,
      segments,
      { layout: "speaker", encodingOptions: encoding },
    );
    const egressId = (info as unknown as { egressId: string }).egressId;
    const segs = (info as unknown as { segmentResults?: Array<Record<string, string>> }).segmentResults || [];
    const urls = deriveHlsUrls(url, roomName, segs[0], filenamePrefix);
    return { egressId, urls };
  } catch (err) {
    hlsNegative.set(roomName, Date.now());
    throw err instanceof Error ? err : new Error("Egress HLS impossible");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Arbitrage PERSISTÉ par live
// ═══════════════════════════════════════════════════════════════════════

/** Fournisseur courant d'un live (défaut : 1ᵉʳ de la chaîne hors cooldown). */
export async function getLiveProvider(liveId: string): Promise<MediaProviderName | null> {
  try {
    await ensureLiveMediaTable();
    const rows = await db.$queryRawUnsafe<Array<{ provider: string | null }>>(
      `SELECT "provider" FROM "LiveMediaProvider" WHERE "liveId" = $1`,
      liveId,
    );
    const stored = rows[0]?.provider;
    if (stored && MEDIA_PROVIDER_CHAIN.includes(stored as MediaProviderName)) {
      return stored as MediaProviderName;
    }
  } catch {
    // table absente au premier déploiement → pickProvider
  }
  return pickProvider();
}

/** Fait avancer un live au fournisseur suivant après échec de `from`. */
export async function advanceLiveProvider(
  liveId: string,
  from: MediaProviderName,
  reason: string,
): Promise<MediaProviderName | null> {
  await recordProviderFailure(from, reason);
  const next = await nextProviderAfter(from);
  if (next) {
    try {
      await ensureLiveMediaTable();
      await db.$executeRawUnsafe(
        `INSERT INTO "LiveMediaProvider" ("liveId", "provider", "updatedAt")
         VALUES ($1, $2, now())
         ON CONFLICT ("liveId") DO UPDATE SET "provider" = $2, "updatedAt" = now()`,
        liveId,
        next,
      );
    } catch (e) {
      console.error("[live-media] advanceLiveProvider:", e);
    }
  }
  return next;
}

/** Vue diagnostic (aucun secret) pour l'UI. */
export async function liveProvidersHealth(): Promise<Record<string, { configured: boolean; coolingDown: boolean }>> {
  const out: Record<string, { configured: boolean; coolingDown: boolean }> = {};
  for (const p of MEDIA_PROVIDER_CHAIN) {
    out[p] = {
      configured: providerConfigured(p),
      coolingDown: await isProviderCoolingDown(p),
    };
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
//  Bundles viewers / studio (tokens 100 % serveur)
// ═══════════════════════════════════════════════════════════════════════

/** Canal/room d'un live : MÊME nom pour les 3 fournisseurs. */
export function liveMediaRoomName(livekitRoomName: string): string {
  // les noms de room LiveKit des lives sont déjà sûrs ; on réutilise
  // le même identifiant pour Agora (canal) et Daily (room).
  return livekitRoomName;
}

/** Token LiveKit SUBSCRIBER (viewer WebRTC — repli du mode HLS). */
export async function buildLiveKitViewerCreds(
  roomName: string,
  participantName: string,
): Promise<{ url: string; token: string }> {
  const { apiKey, apiSecret, url } = getLiveKitConfig();
  const identity = `viewer-${Math.random().toString(36).substring(2, 10)}`;
  const at = new AccessToken(apiKey, apiSecret, { identity, name: participantName || "Visiteur" });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: false, // ⭐ spectateur : JAMAIS de publication
    canSubscribe: true,
    canPublishData: false, // ⭐ et JAMAIS de DataChannel (mode YouTube)
  });
  return { url, token: await at.toJwt() };
}

export interface LiveViewerBundle {
  mode: "hls" | "webrtc" | "agora" | "daily";
  provider: MediaProviderName;
  chain: MediaProviderName[];
  providersHealth: Record<string, { configured: boolean; coolingDown: boolean }>;
  /** Explication courte du mode (badge UI + diagnostics). */
  reason: string;
  hls?: { urls: string[] };
  livekit?: { url: string; token: string };
  agora?: { appId: string; token: string; channel: string; uid: number };
  daily?: { url: string; token: string };
}

/**
 * Construit le bundle de LIVRAISON pour un viewer. Ne JETTE jamais (sauf
 * 404 live introuvable) : chaque échec dégrade vers le mode suivant.
 */
export async function buildLiveViewerBundle(
  live: { id: string; livekitRoomName: string },
  participantName: string,
): Promise<LiveViewerBundle> {
  const provider = (await getLiveProvider(live.id)) || "livekit";
  const room = liveMediaRoomName(live.livekitRoomName);
  const chain = MEDIA_PROVIDER_CHAIN.filter(providerConfigured);
  const base = {
    provider,
    chain,
    providersHealth: await liveProvidersHealth(),
  };

  // ─── LIVEKIT : HLS d'abord (mode YouTube, 0 participant viewer) ───
  if (provider === "livekit") {
    if (liveViewerMode() === "hls") {
      try {
        const hls = await ensureHlsEgress(room, live.id);
        return {
          ...base,
          mode: "hls",
          reason: "Mode YouTube — spectateurs non comptés (0 participant viewer)",
          hls: { urls: hls.urls },
        };
      } catch (e) {
        console.warn("[live-media] Egress HLS indisponible → viewer WebRTC:", e instanceof Error ? e.message : e);
        const creds = await buildLiveKitViewerCreds(room, participantName);
        return {
          ...base,
          mode: "webrtc",
          reason: "HLS indisponible — spectateur WebRTC (repli, compté par LiveKit)",
          livekit: creds,
        };
      }
    }
    const creds = await buildLiveKitViewerCreds(room, participantName);
    return {
      ...base,
      mode: "webrtc",
      reason: "Mode WebRTC (LIVE_VIEWER_MODE=webrtc)",
      livekit: creds,
    };
  }

  // ─── AGORA : viewers en rôle AUDIENCE (reçoivent, n'interagissent pas) ───
  if (provider === "agora") {
    const viewerKey = `viewer-${Math.random().toString(36).substring(2, 10)}`;
    const creds = buildAgoraRoleCreds(room, viewerKey, "subscriber");
    return {
      ...base,
      mode: "agora",
      reason: "LiveKit indisponible — retransmission via Agora (audience)",
      agora: creds,
    };
  }

  // ─── DAILY (dernier repli) ───
  const creds = await buildDailyCredsForRoom(room, false);
  return {
    ...base,
    mode: "daily",
    reason: "Agora et LiveKit indisponibles — retransmission via Daily",
    daily: creds,
  };
}

export interface LivePublisherBundle {
  provider: MediaProviderName;
  chain: MediaProviderName[];
  providersHealth: Record<string, { configured: boolean; coolingDown: boolean }>;
  livekit?: { url: string; token: string };
  agora?: { appId: string; token: string; channel: string; uid: number };
  daily?: { url: string; token: string };
}

/**
 * Bundle PUBLISHER pour le studio (auth admin vérifiée par la route).
 * Le studio est l'unique source : c'est LUI qui publie, quel que soit le
 * fournisseur choisi par l'arbitrage.
 */
export async function buildLivePublisherBundle(
  live: { id: string; livekitRoomName: string },
  publisherId: string,
  publisherName: string,
): Promise<LivePublisherBundle> {
  const provider = (await getLiveProvider(live.id)) || "livekit";
  const room = liveMediaRoomName(live.livekitRoomName);
  const base = {
    provider,
    chain: MEDIA_PROVIDER_CHAIN.filter(providerConfigured),
    providersHealth: await liveProvidersHealth(),
  };

  if (provider === "livekit") {
    const { apiKey, apiSecret, url } = getLiveKitConfig();
    const at = new AccessToken(apiKey, apiSecret, { identity: publisherId, name: publisherName || "Serviteur" });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: false, // le studio n'écoute personne : 1 participant PUR
      canPublishData: true, // pause/play vers les viewers WebRTC
    });
    return { ...base, livekit: { url, token: await at.toJwt() } };
  }
  if (provider === "agora") {
    return { ...base, agora: buildAgoraRoleCreds(room, publisherId, "publisher") };
  }
  const creds = await buildDailyCredsForRoom(room, true);
  return { ...base, daily: creds };
}
