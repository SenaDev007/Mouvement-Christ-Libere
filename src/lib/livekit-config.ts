/**
 * ⭐ V3.19 — Configuration LiveKit lue AU MOMENT DE LA REQUÊTE (Plan B).
 * ============================================================================
 * Centralise les 3 variables de bascule LiveKit :
 *   LIVEKIT_URL        (ex. wss://live.votre-domaine.tld — kit deploy/livekit-failover)
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 *
 * Priorité : LIVEKIT_URL AVANT NEXT_PUBLIC_LIVEKIT_URL — la variable runtime
 * doit gagner sur la valeur « baked » au build, sinon une bascule
 * (Vercel → Settings → Environment Variables → Redeploy) ne prendrait jamais
 * effet sur les routes serveur. Les clients Yeshua Connect reçoivent de toute
 * façon l'URL depuis la réponse de /api/livekit/token (jamais depuis leur env).
 *
 * Fallback : wss://christ-libere.livekit.cloud (LiveKit Cloud actuel — Plan A).
 */
export interface LiveKitRuntimeConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export function getLiveKitConfig(): LiveKitRuntimeConfig {
  return {
    url:
      process.env.LIVEKIT_URL ||
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      "wss://christ-libere.livekit.cloud",
    apiKey: process.env.LIVEKIT_API_KEY || "dev-key",
    apiSecret: process.env.LIVEKIT_API_SECRET || "dev-secret",
  };
}
