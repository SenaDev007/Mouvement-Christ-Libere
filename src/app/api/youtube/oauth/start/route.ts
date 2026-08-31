/**
 * Route API — /api/youtube/oauth/start
 *
 * Démarre le flux OAuth 2.0 YouTube depuis le site (option "In-app production").
 * Réservé aux admins authentifiés (cookie admin_session).
 *
 * Deux modes :
 *
 *  1. GET  (credentials = variables d'environnement Vercel)
 *     → 302 direct vers l'écran de consentement Google.
 *     Utilisé quand YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET sont déjà
 *     configurés sur Vercel.
 *
 *  2. POST (credentials fournis dans le body JSON { clientId, clientSecret })
 *     → répond { authUrl } ; le navigateur redirige ensuite vers Google.
 *     Utilisé quand les variables ne sont PAS encore sur Vercel : l'admin
 *     colle ses credentials directement dans la page /admin/youtube-setup.
 *     Les credentials sont chiffrés dans le cookie httpOnly yt_oauth_state,
 *     jamais dans l'URL.
 *
 * Le flux se termine sur /api/youtube/oauth/callback (échange du code →
 * refresh token → affichage des 4 variables à copier sur Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  YOUTUBE_OAUTH_COOKIE,
  YOUTUBE_OAUTH_COOKIE_PATH,
  YOUTUBE_OAUTH_TTL_S,
  YouTubeOAuthState,
  buildConsentUrl,
  encryptState,
  generateNonce,
  isValidClientId,
  isValidClientSecret,
} from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

const ADMIN_SETUP_URL = "/admin/youtube-setup";

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Vérifie la session admin (même garde que les autres routes admin). */
async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

/** Pose le cookie d'état chiffré (httpOnly, SameSite=Lax, 10 min, usage unique). */
function setOAuthCookie(response: NextResponse, value: string): void {
  response.cookies.set(YOUTUBE_OAUTH_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: YOUTUBE_OAUTH_TTL_S,
    path: YOUTUBE_OAUTH_COOKIE_PATH,
  });
}

/**
 * Prépare le flux : génère le nonce, chiffre l'état et construit l'URL
 * de consentement. Le redirect_uri est dérivé de l'origine de la requête
 * (production : https://mouvement-christ-libere.vercel.app — dev : localhost)
 * et stocké dans l'état pour être rejoué à l'identique au token exchange.
 */
function prepareFlow(req: NextRequest, clientId: string, clientSecret: string) {
  const redirectUri = `${req.nextUrl.origin}/api/youtube/oauth/callback`;
  const nonce = generateNonce();
  const state: YouTubeOAuthState = {
    clientId,
    clientSecret,
    redirectUri,
    nonce,
    exp: Date.now() + YOUTUBE_OAUTH_TTL_S * 1000,
  };
  return {
    consentUrl: buildConsentUrl(clientId, clientSecret, redirectUri, nonce),
    cookieValue: encryptState(state),
  };
}

// ─── GET : credentials depuis les variables d'environnement ──────────────

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    // Variables absentes → retour à la page de setup avec un message
    const url = new URL(ADMIN_SETUP_URL, req.url);
    url.searchParams.set("oauthError", "missing_credentials");
    return NextResponse.redirect(url);
  }

  const { consentUrl, cookieValue } = prepareFlow(req, clientId, clientSecret);
  const response = NextResponse.redirect(consentUrl);
  setOAuthCookie(response, cookieValue);
  return response;
}

// ─── POST : credentials fournis dans le body (ou fallback env) ───────────

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { clientId?: string; clientSecret?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body vide/invalide → fallback env vars
  }

  const clientId = (body.clientId || process.env.YOUTUBE_CLIENT_ID || "").trim();
  const clientSecret = (body.clientSecret || process.env.YOUTUBE_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "Client ID et Client Secret requis — collez-les dans le formulaire ou définissez YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET sur Vercel.",
      },
      { status: 400 }
    );
  }

  if (!isValidClientId(clientId)) {
    return NextResponse.json(
      {
        error:
          "Client ID invalide — il doit se terminer par .apps.googleusercontent.com (vérifiez le copier-coller).",
      },
      { status: 400 }
    );
  }

  if (!isValidClientSecret(clientSecret)) {
    return NextResponse.json(
      { error: "Client Secret invalide (trop court) — vérifiez le copier-coller." },
      { status: 400 }
    );
  }

  const { consentUrl, cookieValue } = prepareFlow(req, clientId, clientSecret);
  const response = NextResponse.json({ authUrl: consentUrl });
  setOAuthCookie(response, cookieValue);
  return response;
}
