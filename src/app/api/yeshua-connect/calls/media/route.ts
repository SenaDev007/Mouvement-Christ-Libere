import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureCallSignalTable, ensureCallMediaTables, ensureChannelIsDirectColumn } from "@/lib/ensure-schema";
import {
  MEDIA_PROVIDER_CHAIN,
  type MediaProviderName,
  buildProviderBundle,
  getCallProvider,
  advanceCallProvider,
  getVoiceProvider,
  advanceVoiceProvider,
  setVoiceProvider,
  pickProvider,
  effectiveChain,
  providerConfigured,
} from "@/lib/call-providers";

/**
 * ⭐ V3.21 — ARBITRAGE MULTIMÉDIA DES APPELS (chaîne LiveKit → Agora → Daily).
 * ============================================================================
 *
 * Directive : « LiveKit est la source de vérité ; si LiveKit a des problèmes,
 * Agora prend immédiatement le relais ; et si Agora a des problèmes, Daily
 * prend automatiquement le relais. »
 *
 *   POST { action: "join", callId }
 *        → renvoie le bundle du FOURNISSEUR COURANT de l'appel (arbitré en
 *          base : l'appelant et le destinataire qui décroche rejoignent le
 *          MÊME réseau, même si l'appelant a déjà basculé).
 *          Réponse : { provider, roomName, chain, providersHealth,
 *                      livekit?{url,token}, agora?{appId,token,channel,uid},
 *                      daily?{url,token} }
 *          ⚠️ Si la GÉNÉRATION du bundle échoue (ex. Daily injoignable), le
 *          serveur fait TOURNER la boucle de repli LUI-MÊME (max 3 essais) —
 *          le client reçoit toujours un bundle prêt à l'emploi.
 *
 *   POST { action: "failover", callId, from, reason }
 *        → le CLIENT signale que le fournisseur `from` a échoué (connexion
 *          impossible / déconnexion en cours d'appel) : le serveur fait
 *          avancer l'appel au suivant, PERSISTE le choix (toutes les parties
 *          convergent via le polling de statut existant) et renvoie le
 *          NOUVEAU bundle. { exhausted: true } si la chaîne est vide (le
 *          client garde son Plan C P2P/Jitsi).
 *
 *   POST { action: "join-voice", conversationId }
 *   POST { action: "failover-voice", conversationId, from, reason }
 *        → même mécanique pour les CANAUX VOCAUX persistants (rooms sans
 *          CallSignal — arbitrage via la table VoiceMediaProvider).
 *
 * 🔒 Authentification NextAuth + membership vérifiés partout (mêmes règles
 *    que /calls/signal — y compris l'interdiction de toucher le privé
 *    d'autrui, sans exception de rôle).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = (session.user as { role?: string | null }).role;
    const userName = session.user.name || "Membre";

    await ensureCallMediaTables();
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ─── Photo de profil (métadonnées LiveKit / affichage des tuiles) ──
    let avatarUrl: string | null = null;
    try {
      const me = await db.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });
      avatarUrl = me?.avatarUrl ?? null;
    } catch { /* optionnel */ }

    /** Vérifie le membership (⭐ V3.20 : PRIVÉ = strictement ses 2 membres,
     *  AUCUNE exception de rôle — même règle que /calls/signal). */
    const assertMember = async (conversationId: string): Promise<boolean> => {
      await ensureChannelIsDirectColumn();
      const conv = await db.channel.findUnique({
        where: { id: conversationId },
        select: { isDirect: true },
      });
      if (conv?.isDirect) {
        const m = await db.channelMember.findUnique({
          where: { channelId_userId: { channelId: conversationId, userId } },
          select: { userId: true },
        });
        return !!m;
      }
      if (["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole || "")) return true;
      const m = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: conversationId, userId } },
        select: { role: true },
      });
      return !!m;
    };

    // ═════════════════════════════════════════════════════════════════
    //  JOIN — bundle du fournisseur courant d'un APPEL
    // ═════════════════════════════════════════════════════════════════
    if (action === "join") {
      const callId: string | undefined = body?.callId;
      if (!callId) {
        return NextResponse.json({ error: "callId requis" }, { status: 400 });
      }
      await ensureCallSignalTable();
      const rows = await db.$queryRawUnsafe<Array<{
        conversationId: string; initiatorId: string; status: string; type: string;
      }>>(
        `SELECT "conversationId", "initiatorId", "status", "type"
         FROM "CallSignal" WHERE "id" = $1`,
        callId,
      );
      if (!rows.length) {
        return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
      }
      const call = rows[0];
      if (!(await assertMember(call.conversationId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      // Boucle de repli SERVEUR : le fournisseur courant d'abord, puis les
      // suivants si la GÉNÉRATION du bundle échoue (ex. Daily injoignable).
      let provider = await getCallProvider(callId);
      if (!provider) {
        return NextResponse.json({
          exhausted: true,
          chain: effectiveChain(),
          reason: "Aucun fournisseur multimédia disponible",
        });
      }
      const tentatives: MediaProviderName[] = [provider];
      for (const p of MEDIA_PROVIDER_CHAIN) {
        if (p !== provider && providerConfigured(p) && !tentatives.includes(p)) {
          tentatives.push(p);
        }
      }
      let lastError = "";
      for (let i = 0; i < tentatives.length; i++) {
        const p = tentatives[i];
        try {
          const bundle = await buildProviderBundle(p, {
            kind: "call",
            conversationId: call.conversationId,
            userId,
            userName,
            avatarUrl,
          });
          return NextResponse.json(bundle);
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.warn(`[calls/media] join: ${p} a échoué (${lastError}) → suivant`);
          // On PERSISTE le fournisseur retenu pour que l'autre partie
          // rejoigne le même réseau (arbitrage par appel).
          provider = await advanceCallProvider(callId, p, `join: ${lastError}`);
          if (!provider) break;
          tentatives[i + 1] = provider;
        }
      }
      return NextResponse.json({
        exhausted: true,
        chain: effectiveChain(),
        reason: lastError || "Fournisseurs multimédia indisponibles",
      });
    }

    // ═════════════════════════════════════════════════════════════════
    //  FAILOVER — le client signale l'échec d'un fournisseur (APPEL)
    // ═════════════════════════════════════════════════════════════════
    if (action === "failover") {
      const callId: string | undefined = body?.callId;
      const from: string | undefined = body?.from;
      const reason: string = typeof body?.reason === "string" ? body.reason : "échec client";
      if (!callId || !from) {
        return NextResponse.json({ error: "callId et from requis" }, { status: 400 });
      }
      if (!MEDIA_PROVIDER_CHAIN.includes(from as MediaProviderName)) {
        return NextResponse.json({ error: "Fournisseur inconnu" }, { status: 400 });
      }
      const rows = await db.$queryRawUnsafe<Array<{ conversationId: string }>>(
        `SELECT "conversationId" FROM "CallSignal" WHERE "id" = $1`,
        callId,
      );
      if (!rows.length) {
        return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
      }
      if (!(await assertMember(rows[0].conversationId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      const next = await advanceCallProvider(callId, from as MediaProviderName, `client: ${reason}`);
      if (!next) {
        return NextResponse.json({
          exhausted: true,
          from,
          chain: effectiveChain(),
        });
      }
      try {
        const bundle = await buildProviderBundle(next, {
          kind: "call",
          conversationId: rows[0].conversationId,
          userId,
          userName,
          avatarUrl,
        });
        return NextResponse.json(bundle);
      } catch (e) {
        // Le remplaçant a échoué à la GÉNÉRATION → on avance encore.
        const secondReason = e instanceof Error ? e.message : String(e);
        const next2 = await advanceCallProvider(callId, next, `join: ${secondReason}`);
        if (!next2) {
          return NextResponse.json({ exhausted: true, chain: effectiveChain() });
        }
        const bundle2 = await buildProviderBundle(next2, {
          kind: "call",
          conversationId: rows[0].conversationId,
          userId,
          userName,
          avatarUrl,
        });
        return NextResponse.json(bundle2);
      }
    }

    // ═════════════════════════════════════════════════════════════════
    //  JOIN-VOICE — canal vocal persistant (sans CallSignal)
    // ═════════════════════════════════════════════════════════════════
    if (action === "join-voice") {
      const conversationId: string | undefined = body?.conversationId;
      if (!conversationId) {
        return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
      }
      if (!(await assertMember(conversationId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      let provider = await getVoiceProvider(conversationId);
      if (!provider) {
        return NextResponse.json({
          exhausted: true,
          chain: effectiveChain(),
          reason: "Aucun fournisseur multimédia disponible",
        });
      }
      // Boucle de repli serveur (identique au join d'appel).
      const tentatives: MediaProviderName[] = [provider];
      for (const p of MEDIA_PROVIDER_CHAIN) {
        if (p !== provider && providerConfigured(p) && !tentatives.includes(p)) {
          tentatives.push(p);
        }
      }
      let lastError = "";
      for (let i = 0; i < tentatives.length; i++) {
        const p = tentatives[i];
        try {
          const bundle = await buildProviderBundle(p, {
            kind: "voice",
            conversationId,
            userId,
            userName,
            avatarUrl,
          });
          await setVoiceProvider(conversationId, p);
          return NextResponse.json(bundle);
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          provider = await advanceVoiceProvider(conversationId, p, `join: ${lastError}`);
          if (!provider) break;
          tentatives[i + 1] = provider;
        }
      }
      return NextResponse.json({
        exhausted: true,
        chain: effectiveChain(),
        reason: lastError || "Fournisseurs multimédia indisponibles",
      });
    }

    // ═════════════════════════════════════════════════════════════════
    //  FAILOVER-VOICE — le client signale l'échec (CANAL VOCAL)
    // ═════════════════════════════════════════════════════════════════
    if (action === "failover-voice") {
      const conversationId: string | undefined = body?.conversationId;
      const from: string | undefined = body?.from;
      const reason: string = typeof body?.reason === "string" ? body.reason : "échec client";
      if (!conversationId || !from) {
        return NextResponse.json({ error: "conversationId et from requis" }, { status: 400 });
      }
      if (!MEDIA_PROVIDER_CHAIN.includes(from as MediaProviderName)) {
        return NextResponse.json({ error: "Fournisseur inconnu" }, { status: 400 });
      }
      if (!(await assertMember(conversationId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      const next = await advanceVoiceProvider(conversationId, from as MediaProviderName, `client: ${reason}`);
      if (!next) {
        return NextResponse.json({ exhausted: true, from, chain: effectiveChain() });
      }
      try {
        const bundle = await buildProviderBundle(next, {
          kind: "voice",
          conversationId,
          userId,
          userName,
          avatarUrl,
        });
        return NextResponse.json(bundle);
      } catch (e) {
        const secondReason = e instanceof Error ? e.message : String(e);
        const next2 = await advanceVoiceProvider(conversationId, next, `join: ${secondReason}`);
        if (!next2) {
          return NextResponse.json({ exhausted: true, chain: effectiveChain() });
        }
        const bundle2 = await buildProviderBundle(next2, {
          kind: "voice",
          conversationId,
          userId,
          userName,
          avatarUrl,
        });
        return NextResponse.json(bundle2);
      }
    }

    return NextResponse.json({ error: "action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("[calls/media POST] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  GET ?callId=x — fournisseur courant d'un appel (léger, pour diagnostics
//  ou vérification ponctuelle — la convergence temps réel passe par le
//  champ `mediaProvider` de /calls/signal?callId=, déjà pollé toutes les 2 s)
// ═══════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");
    if (!callId) {
      // État global de la chaîne (diagnostics) :
      const picked = await pickProvider();
      return NextResponse.json({
        chain: effectiveChain(),
        current: picked,
      });
    }
    await ensureCallMediaTables();
    const provider = await getCallProvider(callId);
    return NextResponse.json({
      provider,
      chain: effectiveChain(),
    });
  } catch (error) {
    console.error("[calls/media GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
