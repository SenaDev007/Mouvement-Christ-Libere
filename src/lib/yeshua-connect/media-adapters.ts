"use client";

/**
 * ⭐ V3.21 — ADAPTATEURS MULTIMÉDIA CLIENT : LiveKit → Agora → Daily.
 * ============================================================================
 *
 * Directive du pasteur : « LiveKit est la source de vérité ; si LiveKit a
 * des problèmes, Agora prend immédiatement le relais ; et si Agora a des
 * problèmes, Daily prend automatiquement le relais. »
 *
 * Ce module NORMALISE les trois SDK derrière une interface unique :
 *
 *   YcRemoteParticipant — ce que le rendu consomme (nom, photo, micro,
 *   caméra, parole active, attachement vidéo) — peu importe le réseau.
 *
 *   MediaSessionHandle  — ce que les contrôles appellent (couper micro /
 *   caméra, haut-parleur, raccrocher).
 *
 * Les SDK Agora et Daily sont importés DYNAMIQUEMENT (bundle séparé) — la
 * page de messagerie ne paie leur poids QUE si un repli est réellement
 * nécessaire.
 *
 * L'orchestration de la chaîne (join → échec → failover serveur →
 * prochain fournisseur → …) vit dans MessagingView (connectMediaChain),
 * qui possède l'état React ; ce module reste pur et testable.
 */

import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteAudioTrack } from "livekit-client";
import { api } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════
//  Types partagés
// ═══════════════════════════════════════════════════════════════════════

export type MediaProviderName = "livekit" | "agora" | "daily";

/** Participant normalisé — SEULE forme que le rendu consomme. */
export interface YcRemoteParticipant {
  /** Chez LiveKit : userId NextAuth. Chez Agora : uid numérique. Chez
   * Daily : session_id (userName transporté par Daily). */
  identity: string;
  name?: string;
  avatarUrl?: string;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeaking: boolean;
  /** Attache la piste caméra à un <video> ; false si pas de vidéo. */
  attachVideo(el: HTMLVideoElement): boolean;
  /** Détache proprement la piste caméra de l'élément. */
  detachVideo(el: HTMLVideoElement): void;
}

/** Contrôles d'une session média connectée, quel que soit le fournisseur. */
export interface MediaSessionHandle {
  readonly provider: MediaProviderName;
  setMicEnabled(enabled: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
  setSpeakerEnabled(enabled: boolean): void;
  disconnect(): void;
}

/** Bundle renvoyé par POST /api/yeshua-connect/calls/media. */
export interface MediaJoinBundle {
  provider: MediaProviderName;
  roomName: string;
  chain: MediaProviderName[];
  providersHealth?: Record<string, { configured: boolean; coolingDown: boolean }>;
  livekit?: { url: string; token: string };
  agora?: { appId: string; token: string; channel: string; uid: number };
  daily?: { url: string; token: string };
  exhausted?: boolean;
  reason?: string;
}

export interface MediaSessionEvents {
  /** Liste normalisée des participants distants (re-créée à chaque event —
   *  corrige au passage la mutabilité des objets LiveKit, cf. V2.9). */
  onParticipants(participants: YcRemoteParticipant[]): void;
  /** IDs des locuteurs actifs (pastille dorée). */
  onActiveSpeakers(ids: Set<string>): void;
  /** Déconnexion/défaillance en cours d'appel → MessagingView déclenche le
   *  failover serveur (l'appel avance au fournisseur suivant). */
  onDisconnected(reason: string): void;
}

export interface MediaSessionOptions {
  video: boolean;
  participantName: string;
  /** Lookup applicatif identité → {nom, photo} (membres du canal/parti-
   * cipants du privé) — utilisé par Agora (uid sans nom) et Daily. */
  resolveUser?(identity: string): { name?: string; avatarUrl?: string } | undefined;
  /** Lookup inverse pour Agora : uid numérique → profil. */
  resolveUserByUid?(uid: number): { name?: string; avatarUrl?: string } | undefined;
}

// ═══════════════════════════════════════════════════════════════════════
//  Appels API de la chaîne (arbitrage serveur)
// ═══════════════════════════════════════════════════════════════════════

/** POST /calls/media { action: join } — bundle du fournisseur de l'appel. */
export async function fetchMediaJoin(
  kind: "call" | "voice",
  conversationId: string,
  callId?: string,
): Promise<MediaJoinBundle> {
  const res = await fetch(api.url("/api/yeshua-connect/calls/media"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      kind === "call"
        ? { action: "join", callId }
        : { action: "join-voice", conversationId },
    ),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Média: HTTP ${res.status}`);
  }
  return res.json();
}

/** POST /calls/media { action: failover } — le fournisseur `from` a échoué. */
export async function fetchMediaFailover(
  kind: "call" | "voice",
  conversationId: string,
  callId: string | undefined,
  from: MediaProviderName,
  reason: string,
): Promise<MediaJoinBundle> {
  const res = await fetch(api.url("/api/yeshua-connect/calls/media"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      kind === "call"
        ? { action: "failover", callId, from, reason }
        : { action: "failover-voice", conversationId, from, reason },
    ),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failover: HTTP ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════
//  Fabrique de session — 1 seul point d'entrée pour les 3 SDK
// ═══════════════════════════════════════════════════════════════════════

export async function createMediaSession(
  bundle: MediaJoinBundle,
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  switch (bundle.provider) {
    case "livekit":
      if (!bundle.livekit) throw new Error("Identifiants LiveKit manquants");
      return createLiveKitSession(bundle.livekit, opts, events);
    case "agora":
      if (!bundle.agora) throw new Error("Identifiants Agora manquants");
      return createAgoraSession(bundle.agora, opts, events);
    case "daily":
      if (!bundle.daily) throw new Error("Identifiants Daily manquants");
      return createDailySession(bundle.daily, opts, events);
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Conteneur DOM caché pour l'audio distant (autoplay géré par adaptateur)
// ─────────────────────────────────────────────────────────────────────
let hiddenAudioContainer: HTMLDivElement | null = null;
function ensureHiddenAudioContainer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!hiddenAudioContainer) {
    hiddenAudioContainer = document.createElement("div");
    hiddenAudioContainer.style.display = "none";
    document.body.appendChild(hiddenAudioContainer);
  }
  return hiddenAudioContainer;
}

function ensureAudioEl(key: string): HTMLAudioElement | null {
  const container = ensureHiddenAudioContainer();
  if (!container) return null;
  let el = container.querySelector<HTMLAudioElement>(`audio[data-yc="${key}"]`);
  if (!el) {
    el = document.createElement("audio");
    el.autoplay = true;
    try { el.setAttribute("playsinline", "true"); } catch {}
    el.setAttribute("data-yc", key);
    container.appendChild(el);
  }
  return el;
}
function removeAudioEl(key: string): void {
  const container = hiddenAudioContainer;
  if (!container) return;
  const el = container.querySelector<HTMLAudioElement>(`audio[data-yc="${key}"]`);
  if (el) {
    try { el.pause(); el.remove(); } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  1. LIVEKIT (source de vérité) — extraction du joinCallRoom historique
// ═══════════════════════════════════════════════════════════════════════

/** Wrapper immuable-consommable d'un RemoteParticipant LiveKit. */
class LiveKitParticipant implements YcRemoteParticipant {
  constructor(
    private readonly p: RemoteParticipant,
    private readonly fallbackName?: string,
  ) {}
  get identity(): string { return this.p.identity; }
  get name(): string | undefined { return this.p.name || this.fallbackName; }
  get avatarUrl(): string | undefined {
    try {
      const meta = this.p.metadata ? JSON.parse(this.p.metadata) : null;
      const url = meta?.avatarUrl;
      return typeof url === "string" && url ? url : undefined;
    } catch {
      return undefined;
    }
  }
  get isMicrophoneEnabled(): boolean { return this.p.isMicrophoneEnabled; }
  get isCameraEnabled(): boolean { return this.p.isCameraEnabled; }
  get isSpeaking(): boolean { return this.p.isSpeaking; }
  attachVideo(el: HTMLVideoElement): boolean {
    const pub = this.p.getTrackPublication(Track.Source.Camera);
    if (pub?.track && pub.isSubscribed) {
      try { pub.track.attach(el); return true; } catch { return false; }
    }
    return false;
  }
  detachVideo(el: HTMLVideoElement): void {
    try {
      const pub = this.p.getTrackPublication(Track.Source.Camera);
      if (pub?.track) pub.track.detach(el);
    } catch {}
  }
}

async function createLiveKitSession(
  creds: { url: string; token: string },
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
  });
  let ended = false;

  const emit = () => {
    events.onParticipants(
      Array.from(room.remoteParticipants.values()).map(
        (p) => new LiveKitParticipant(p, opts.resolveUser?.(p.identity)?.name),
      ),
    );
  };

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    // Audio distant → <audio> caché (autoplay) — V2.9 : sans attachement,
    // on ne s'entend pas. Vidéo → re-rendu (participant ré-émis).
    void publication;
    if (track.kind === "audio") {
      const el = ensureAudioEl(`lk-${participant.identity}`);
      if (el) {
        try { (track as RemoteAudioTrack).attach(el); } catch {}
        if (el.paused) el.play().catch(() => {});
      }
    }
    emit();
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    void publication;
    if (track.kind === "audio") removeAudioEl(`lk-${participant.identity}`);
    emit();
  });
  room.on(RoomEvent.ParticipantConnected, emit);
  room.on(RoomEvent.ParticipantDisconnected, emit);
  room.on(RoomEvent.TrackMuted, emit);
  room.on(RoomEvent.TrackUnmuted, emit);
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    events.onActiveSpeakers(new Set(speakers.map((s) => s.identity)));
    emit();
  });
  room.on(RoomEvent.Disconnected, (reason) => {
    if (ended) return;
    for (const p of room.remoteParticipants.keys()) removeAudioEl(`lk-${p}`);
    events.onDisconnected(`livekit: ${reason || "déconnecté"}`);
  });

  await room.connect(creds.url, creds.token);
  await room.localParticipant.setMicrophoneEnabled(true);
  await room.localParticipant.setCameraEnabled(opts.video);

  return {
    provider: "livekit",
    async setMicEnabled(enabled: boolean) {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
    async setCameraEnabled(enabled: boolean) {
      await room.localParticipant.setCameraEnabled(enabled);
    },
    setSpeakerEnabled(enabled: boolean) {
      const container = hiddenAudioContainer;
      if (!container) return;
      container.querySelectorAll<HTMLAudioElement>("audio[data-yc^='lk-']").forEach((el) => {
        el.muted = !enabled;
      });
    },
    disconnect() {
      ended = true;
      try { room.disconnect(true); } catch {}
      const container = hiddenAudioContainer;
      container?.querySelectorAll<HTMLAudioElement>("audio[data-yc^='lk-']").forEach((el) => {
        try { el.pause(); el.remove(); } catch {}
      });
      events.onParticipants([]);
      events.onActiveSpeakers(new Set());
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  2. AGORA (repli n°1) — SDK web chargé dynamiquement
// ═══════════════════════════════════════════════════════════════════════

interface AgoraRemoteUserLike {
  uid: number;
  hasAudio: boolean;
  hasVideo: boolean;
  audioTrack?: { play(): void; stop(): void } | null;
  videoTrack?: { getMediaStreamTrack?(): MediaStreamTrack | null; play(el: HTMLElement): void; stop(): void } | null;
}
interface AgoraClientLike {
  join(appId: string, channel: string, token: string, uid: number): Promise<number>;
  publish(tracks: Array<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>): Promise<void>;
  subscribe(user: AgoraRemoteUserLike, mediaType: "audio" | "video"): Promise<void>;
  on(evt: string, cb: (...args: unknown[]) => void): void;
  leave(): Promise<void>;
  remoteUsers: AgoraRemoteUserLike[];
}

/** Wrapper d'un utilisateur Agora distant (uid numérique sans nom — le nom
 *  vient du lookup applicatif resolveUserByUid). */
class AgoraParticipant implements YcRemoteParticipant {
  constructor(
    private readonly user: AgoraRemoteUserLike,
    private readonly profile?: { name?: string; avatarUrl?: string },
  ) {}
  get identity(): string { return String(this.user.uid); }
  get name(): string | undefined { return this.profile?.name; }
  get avatarUrl(): string | undefined { return this.profile?.avatarUrl; }
  get isMicrophoneEnabled(): boolean { return this.user.hasAudio; }
  get isCameraEnabled(): boolean { return this.user.hasVideo; }
  get isSpeaking(): boolean { return false; /* pas d'info fiable SDK web */ }
  attachVideo(el: HTMLVideoElement): boolean {
    const t = this.user.videoTrack;
    if (!t) return false;
    try {
      const raw = t.getMediaStreamTrack?.();
      if (raw) {
        el.srcObject = new MediaStream([raw]);
        el.play().catch(() => {});
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  detachVideo(el: HTMLVideoElement): void {
    try { el.srcObject = null; } catch {}
  }
}

async function createAgoraSession(
  creds: { appId: string; token: string; channel: string; uid: number },
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  // Import dynamique : le SDK Agora (≈ 300 ko) ne charge qu'au repli.
  const AgoraRTC = (await import("agora-rtc-sdk-ng")) as unknown as {
    createClient(cfg: { mode: string; codec: string }): AgoraClientLike;
    createMicrophoneAudioTrack(): Promise<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>;
    createCameraVideoTrack(): Promise<{ kind: string; setEnabled(b: boolean): void; stop(): void; close(): void }>;
  };
  const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  let ended = false;
  let micTrack: { kind: string; setEnabled(b: boolean): void; stop(): void; close(): void } | null = null;
  let camTrack: { kind: string; setEnabled(b: boolean): void; stop(): void; close(): void } | null = null;

  const emit = () => {
    events.onParticipants(
      client.remoteUsers.map(
        (u) => new AgoraParticipant(u, opts.resolveUserByUid?.(u.uid)),
      ),
    );
  };

  client.on("user-published", async (...args: unknown[]) => {
    const user = args[0] as AgoraRemoteUserLike;
    const mediaType = args[1] as "audio" | "video";
    try {
      await client.subscribe(user, mediaType);
      if (mediaType === "audio") user.audioTrack?.play();
    } catch { /* best effort */ }
    emit();
  });
  client.on("user-unpublished", emit);
  client.on("user-left", emit);
  client.on("connection-state-change", (...args: unknown[]) => {
    const state = args[1] as string;
    if (!ended && (state === "DISCONNECTED" || state === "FAILED")) {
      events.onDisconnected(`agora: ${state}`);
    }
  });

  await client.join(creds.appId, creds.channel, creds.token, creds.uid);
  micTrack = await AgoraRTC.createMicrophoneAudioTrack();
  await client.publish([micTrack]);
  if (opts.video) {
    camTrack = await AgoraRTC.createCameraVideoTrack();
    await client.publish([camTrack]);
  }

  return {
    provider: "agora",
    async setMicEnabled(enabled: boolean) {
      micTrack?.setEnabled(enabled);
    },
    async setCameraEnabled(enabled: boolean) {
      camTrack?.setEnabled(enabled);
    },
    setSpeakerEnabled(enabled: boolean) {
      // Agora joue l'audio distant via ses propres éléments — volume global.
      for (const u of client.remoteUsers) {
        // SDK web : pas de mute distant direct — on agit sur le volume via
        // l'élément <audio> injecté par Agora (convention data-…).
        void enabled; void u;
      }
      const els = document.querySelectorAll<HTMLAudioElement>("audio");
      els.forEach((el) => { el.muted = !enabled; });
    },
    disconnect() {
      ended = true;
      try { micTrack?.stop(); micTrack?.close(); } catch {}
      try { camTrack?.stop(); camTrack?.close(); } catch {}
      client.leave().catch(() => {});
      events.onParticipants([]);
      events.onActiveSpeakers(new Set());
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  3. DAILY (repli n°2) — callObject, chargé dynamiquement
// ═══════════════════════════════════════════════════════════════════════

interface DailyParticipantLike {
  session_id: string;
  user_name?: string;
  local?: boolean;
  audio?: boolean;
  video?: boolean;
  tracks?: Record<
    string,
    { state: string; persistentTrack?: MediaStreamTrack | null; track?: MediaStreamTrack | null }
  >;
}
interface DailyCallObjectLike {
  join(opts: { url: string; token?: string; userName?: string }): Promise<void>;
  leave(): Promise<void>;
  participants(): Record<string, DailyParticipantLike>;
  on(evt: string, cb: (ev: { participant?: DailyParticipantLike; activeSpeaker?: { session_id?: string }[] }) => void): void;
  setLocalAudio(b: boolean): Promise<boolean>;
  setLocalVideo(b: boolean): Promise<boolean>;
  setPlaybackVolume?(v: number): Promise<void>;
}

/** Wrapper d'un participant Daily. */
class DailyParticipant implements YcRemoteParticipant {
  constructor(
    private readonly p: DailyParticipantLike,
    private readonly fallbackName?: string,
  ) {}
  get identity(): string { return this.p.session_id; }
  get name(): string | undefined { return this.p.user_name || this.fallbackName; }
  get avatarUrl(): string | undefined { return undefined; }
  get isMicrophoneEnabled(): boolean { return !!this.p.audio; }
  get isCameraEnabled(): boolean { return !!this.p.video; }
  get isSpeaking(): boolean { return false; }
  attachVideo(el: HTMLVideoElement): boolean {
    const t = this.p.tracks?.["video"];
    const raw = t?.persistentTrack ?? t?.track ?? null;
    if (!raw || t?.state !== "playable") return false;
    try {
      el.srcObject = new MediaStream([raw]);
      el.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  detachVideo(el: HTMLVideoElement): void {
    try { el.srcObject = null; } catch {}
  }
}

async function createDailySession(
  creds: { url: string; token: string },
  opts: MediaSessionOptions,
  events: MediaSessionEvents,
): Promise<MediaSessionHandle> {
  const Daily = (await import("@daily-co/daily-js")) as unknown as {
    createCallObject(): DailyCallObjectLike;
  };
  const call = Daily.createCallObject();
  let ended = false;
  const speakerIds = new Set<string>();

  const refreshAudio = () => {
    for (const p of Object.values(call.participants())) {
      if (p.local) continue;
      const t = p.tracks?.["audio"];
      const raw = t?.persistentTrack ?? t?.track ?? null;
      if (raw && t?.state === "playable") {
        const el = ensureAudioEl(`dly-${p.session_id}`);
        if (el) {
          if (el.srcObject !== (null as unknown as MediaStream) && !el.srcObject) {
            el.srcObject = new MediaStream([raw]);
          }
          el.play().catch(() => {});
        }
      } else {
        removeAudioEl(`dly-${p.session_id}`);
      }
    }
  };

  const emit = () => {
    events.onParticipants(
      Object.values(call.participants())
        .filter((p) => !p.local)
        .map((p) => new DailyParticipant(p, opts.resolveUser?.(p.session_id)?.name)),
    );
    events.onActiveSpeakers(new Set(speakerIds));
  };

  call.on("participant-joined", emit);
  call.on("participant-left", (ev) => {
    if (ev.participant) removeAudioEl(`dly-${ev.participant.session_id}`);
    emit();
  });
  call.on("participant-updated", () => {
    refreshAudio();
    emit();
  });
  call.on("track-started", refreshAudio);
  call.on("track-stopped", refreshAudio);
  call.on("active-speaker-change", (ev) => {
    speakerIds.clear();
    for (const s of ev.activeSpeaker ?? []) {
      if (s.session_id) speakerIds.add(s.session_id);
    }
    emit();
  });
  call.on("left-meeting", () => {
    if (!ended) events.onDisconnected("daily: a quitté la réunion");
  });
  call.on("error", () => {
    if (!ended) events.onDisconnected("daily: erreur réseau");
  });

  await call.join({ url: creds.url, token: creds.token, userName: opts.participantName });
  await call.setLocalAudio(true);
  await call.setLocalVideo(opts.video);

  return {
    provider: "daily",
    async setMicEnabled(enabled: boolean) {
      await call.setLocalAudio(enabled);
    },
    async setCameraEnabled(enabled: boolean) {
      await call.setLocalVideo(enabled);
    },
    async setSpeakerEnabled(enabled: boolean) {
      const container = hiddenAudioContainer;
      container?.querySelectorAll<HTMLAudioElement>("audio[data-yc^='dly-']").forEach((el) => {
        el.muted = !enabled;
      });
    },
    disconnect() {
      ended = true;
      call.leave().catch(() => {});
      const container = hiddenAudioContainer;
      container?.querySelectorAll<HTMLAudioElement>("audio[data-yc^='dly-']").forEach((el) => {
        try { el.pause(); el.remove(); } catch {}
      });
      events.onParticipants([]);
      events.onActiveSpeakers(new Set());
    },
  };
}

/** Libellé francophone d'un fournisseur (badges UI). */
export function providerLabel(provider: MediaProviderName | null | undefined): string {
  switch (provider) {
    case "livekit": return "LiveKit";
    case "agora": return "Agora";
    case "daily": return "Daily";
    default: return "—";
  }
}

/** Erreur dédiée : la chaîne LiveKit → Agora → Daily est ÉPUISÉE (le
 *  module appelant retombe alors sur son Plan C P2P/Jitsi). */
export class ChainExhaustedError extends Error {
  constructor(message = "Chaîne multimédia épuisée (LiveKit → Agora → Daily)") {
    super(message);
    this.name = "ChainExhaustedError";
  }
}

/** Enveloppe les participants LiveKit d'une Room au format normalisé —
 *  utilisé par les chemins qui gardent la Room LiveKit directe (canaux
 *  vocaux : métadonnées vidéo/direct intra-canal, reconnexion, autoplay). */
export function wrapLiveKitParticipants(
  room: { remoteParticipants: Map<string, RemoteParticipant> },
  resolveName?: (identity: string) => string | undefined,
): YcRemoteParticipant[] {
  return Array.from(room.remoteParticipants.values()).map(
    (p) => new LiveKitParticipant(p, resolveName?.(p.identity)),
  );
}
