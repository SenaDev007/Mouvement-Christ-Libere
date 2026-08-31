/**
 * Route API — /api/youtube/oauth/callback
 *
 * Réception du callback Google après consentement, pour l'option
 * "In-app production" du flux OAuth YouTube.
 *
 * Étapes :
 *   1. Vérifie les paramètres renvoyés par Google (error / code / state)
 *   2. Déchiffre le cookie httpOnly `yt_oauth_state` (credentials + nonce)
 *      et vérifie le nonce anti-CSRF + l'expiration (10 min)
 *   3. Échange le code d'autorisation contre un access token + refresh token
 *      (redirect_uri rejoué à l'identique de celui du consentement)
 *   4. Récupère les infos de la chaîne (channels.list, mine=true)
 *   5. Rend une page HTML de succès affichant les 4 variables à copier
 *      sur Vercel — le cookie d'état est immédiatement invalidé
 *
 * Cette route est publique (pas de session admin requise) : sa sécurité
 * repose sur le cookie d'état chiffré que seul /api/youtube/oauth/start
 * (admin-only) peut émettre.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { decryptState, YOUTUBE_OAUTH_COOKIE, YOUTUBE_OAUTH_COOKIE_PATH } from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Échappe les entités HTML (titres de chaîne, credentials…). */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Invalide le cookie d'état (usage unique). */
function clearOAuthCookie(response: NextResponse): void {
  response.cookies.set(YOUTUBE_OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: YOUTUBE_OAUTH_COOKIE_PATH,
  });
}

/** Rend une page HTML (enveloppe commune, palette du site). */
function renderPage(
  html: string,
  status = 200,
  extraCookies?: (res: NextResponse) => void
): NextResponse {
  const response = new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  if (extraCookies) extraCookies(response);
  return response;
}

const PAGE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
         background: #2A0E3D; color: #FAF6EF; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; margin: 0; padding: 16px;
         box-sizing: border-box; }
  .card { background: #FAF6EF; color: #1E0F2B; border-radius: 16px; padding: 32px;
          max-width: 640px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          box-sizing: border-box; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  p  { font-size: 14px; line-height: 1.6; color: #1E0F2B; }
  .gold { color: #C9A227; font-weight: 700; }
  .muted { color: #8A8378; font-size: 12px; }
  .vars { background: #1A0826; color: #C9A227; padding: 16px; border-radius: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
          white-space: pre-wrap; word-break: break-all; margin: 12px 0; }
  .btn { display: inline-flex; align-items: center; gap: 8px; background: #C9A227;
         color: #1E0F2B; border: none; border-radius: 10px; padding: 12px 20px;
         font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none;
         margin-top: 8px; }
  .btn:hover { background: #DDBE55; }
  .btn-outline { background: transparent; color: #C9A227; border: 1.5px solid #C9A227; }
  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
          font-weight: 700; padding: 6px 12px; border-radius: 999px; }
  .chip-ok { background: #DCFCE7; color: #166534; }
  .chip-err { background: #FEE2E2; color: #991B1B; }
  ol { font-size: 13px; line-height: 1.8; color: #1E0F2B; padding-left: 20px; }
  a { color: #C9A227; font-weight: 600; }
  .copy-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .icon-title { display: flex; align-items: center; gap: 10px; }
`;

/** Petite page HTML compacte (succès ou erreur). */
function page(title: string, bodyHtml: string, status = 200): NextResponse {
  return renderPage(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${esc(title)}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`,
    status
  );
}

// ─── Route ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const googleError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  // 1. Google a renvoyé une erreur (consentement refusé, etc.)
  if (googleError) {
    const refused = googleError === "access_denied";
    const response = page(
      "Autorisation refusée",
      `<h1>❌ Autorisation ${refused ? "refusée" : "interrompue"}</h1>
       <p>Google a renvoyé l'erreur : <code>${esc(googleError)}</code>.</p>
       ${refused ? "<p>Vous avez probablement fermé l'écran de consentement sans cliquer sur « Continuer ». Aucun dommage — vous pouvez relancer le flux.</p>" : ""}
       <a class="btn btn-outline" href="/admin/youtube-setup">← Retour à la configuration YouTube</a>`,
      400
    );
    clearOAuthCookie(response);
    return response;
  }

  // 2. Code manquant
  if (!code) {
    const response = page(
      "Code manquant",
      `<h1>❌ Code d'autorisation manquant</h1>
       <p>Cette page est le point de retour du flux OAuth YouTube. Elle doit être
          atteinte après l'écran de consentement Google, pas directement.</p>
       <a class="btn btn-outline" href="/admin/youtube-setup">← Retour à la configuration YouTube</a>`,
      400
    );
    clearOAuthCookie(response);
    return response;
  }

  // 3. Cookie d'état : présent, valide, non expiré
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(YOUTUBE_OAUTH_COOKIE)?.value;
  const state = cookieValue ? decryptState(cookieValue) : null;

  if (!state) {
    return page(
      "Session OAuth expirée",
      `<h1>⏱️ Session OAuth introuvable ou expirée</h1>
       <p>Le flux OAuth est limité à <strong>10 minutes</strong> et à un seul usage.
          Si vous avez attendu trop longtemps sur l'écran de consentement, ou si
          cette page a été rechargée, il suffit de relancer le flux.</p>
       <a class="btn btn-outline" href="/admin/youtube-setup">← Relancer depuis la configuration YouTube</a>`,
      400
    );
  }

  // 4. Vérification anti-CSRF (nonce)
  if (!stateParam || stateParam !== state.nonce) {
    const response = page(
      "Jeton de sécurité invalide",
      `<h1>🔒 Jeton de sécurité invalide</h1>
       <p>Le paramètre <code>state</code> renvoyé par Google ne correspond pas au
          jeton émis au démarrage du flux (protection anti-CSRF). Relancez le flux
          depuis la page de configuration.</p>
       <a class="btn btn-outline" href="/admin/youtube-setup">← Retour à la configuration YouTube</a>`,
      400
    );
    clearOAuthCookie(response);
    return response;
  }

  // 5. Échange du code contre les tokens
  try {
    const oauth2Client = new google.auth.OAuth2(
      state.clientId,
      state.clientSecret,
      state.redirectUri
    );
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    // Invalider immédiatement le cookie d'état (usage unique) sur TOUTES les
    // réponses suivantes — même en cas d'erreur partielle.
    const invalidate = (res: NextResponse) => clearOAuthCookie(res);

    if (!refreshToken) {
      return renderPage(
        `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Refresh token manquant</title><style>${PAGE_STYLE}</style></head>
<body><div class="card">
  <h1>⚠️ Aucun refresh token reçu</h1>
  <p>Google n'a renvoyé qu'un access token. Cela arrive quand l'application a
     <strong>déjà été autorisée</strong> auparavant sans émission d'un refresh token,
     ou sans <code>prompt=consent</code>.</p>
  <p><strong>Solution :</strong> révoquez l'accès de « Christ Libère » sur
     <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
     myaccount.google.com/permissions</a>, puis relancez le flux.</p>
  <a class="btn btn-outline" href="/admin/youtube-setup">← Relancer le flux</a>
</div></body></html>`,
        400,
        invalidate
      );
    }

    // 6. Infos de la chaîne (non bloquant)
    let channelId = "";
    let channelTitle = "";
    let channelThumbnail = "";
    try {
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const channelResponse = await youtube.channels.list({
        part: ["snippet"],
        mine: true,
      });
      const channel = channelResponse.data.items?.[0];
      channelId = channel?.id || "";
      channelTitle = channel?.snippet?.title || "";
      channelThumbnail = channel?.snippet?.thumbnails?.default?.url || "";
    } catch (err) {
      console.warn("[youtube-oauth] channels.list a échoué (non bloquant) :", err);
    }

    // 7. Page de succès — les 4 variables à copier sur Vercel
    const varsBlock =
      `YOUTUBE_CLIENT_ID=${state.clientId}\n` +
      `YOUTUBE_CLIENT_SECRET=${state.clientSecret}\n` +
      `YOUTUBE_REFRESH_TOKEN=${refreshToken}\n` +
      `YOUTUBE_CHANNEL_ID=${channelId || "(non récupéré — voir note)"}`;

    return renderPage(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>OAuth YouTube — Succès</title><style>${PAGE_STYLE}</style></head>
<body><div class="card">
  <div class="icon-title">
    ${channelThumbnail ? `<img src="${esc(channelThumbnail)}" alt="" style="width:44px;height:44px;border-radius:12px;">` : ""}
    <div>
      <h1>✅ Autorisation accordée !</h1>
      ${channelTitle ? `<p>Chaîne YouTube : <strong>${esc(channelTitle)}</strong></p>` : ""}
    </div>
  </div>
  <p>Copiez ces <span class="gold">4 variables</span> sur Vercel
     (<strong>Settings → Environment Variables</strong>) pour le projet
     <em>Mouvement-Christ-Libere</em> :</p>
  <div class="vars" id="vars">${esc(varsBlock)}</div>
  <div class="copy-row">
    <button class="btn" onclick="copyVars()">📋 Copier les 4 variables</button>
    <a class="btn btn-outline" href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">
      Ouvrir Vercel ↗</a>
  </div>
  <ol style="margin-top:16px">
    <li>Collez chaque variable (Production <em>et</em> Preview)</li>
    <li>Redeployez : <code>git commit --allow-empty -m "redeploy" && git push origin main</code>
        ou bouton « Redeploy » dans Vercel</li>
    <li>Vérifiez sur <a href="/admin/youtube-setup">/admin/youtube-setup</a> :
        le badge doit passer à <span class="chip chip-ok">✓ OAuth configuré</span></li>
  </ol>
  ${channelId ? "" : `<p class="muted">⚠️ Channel ID non récupéré : trouvez-le sur
     youtube.com → Paramètres → Avancé (il commence par <code>UC…</code>).
     YOUTUBE_CHANNEL_ID est optionnel (fallback de recherche) — les Tiers B et C
     fonctionnent sans.</p>`}
  <p class="muted">🔒 Le refresh token est sensible : ne le partagez jamais. Cette page
     n'est plus accessible au rechargement (usage unique).</p>
</div>
<script>
  function copyVars() {
    var text = document.getElementById('vars').textContent;
    var done = function(){ /* feedback visuel */ };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){
        var b = document.querySelector('.btn');
        var old = b.textContent;
        b.textContent = '✅ Copié !';
        setTimeout(function(){ b.textContent = old; }, 2000);
        done();
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      alert('Variables copiées !');
    }
  }
</script>
</body></html>`,
      200,
      invalidate
    );
  } catch (err) {
    // 8. Échec de l'échange — diagnostics ciblés
    const message = err instanceof Error ? err.message : String(err);
    console.error("[youtube-oauth] Erreur token exchange :", message);

    let diagnostic = "";
    if (message.includes("redirect_uri_mismatch")) {
      diagnostic = `
        <p><strong>💡 Cause la plus fréquente :</strong> l'URI de retour n'est pas
           déclarée chez Google. Ajoutez exactement :</p>
        <div class="vars">${esc(state.redirectUri)}</div>
        <p>dans <strong>Google Cloud Console → APIs &amp; Services → Credentials →
           votre OAuth 2.0 Client ID → Authorized redirect URIs</strong>, puis
           relancez le flux.</p>`;
    } else if (message.includes("invalid_grant")) {
      diagnostic = `
        <p>Le code d'autorisation a expiré ou a déjà été utilisé (le flux est à
           usage unique). Relancez simplement le flux.</p>`;
    } else if (message.includes("invalid_client")) {
      diagnostic = `
        <p>Le Client ID ou le Client Secret est incorrect. Vérifiez-les dans
           Google Cloud Console → Credentials, puis relancez le flux.</p>`;
    }

    const response = renderPage(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Erreur OAuth</title><style>${PAGE_STYLE}</style></head>
<body><div class="card">
  <h1>❌ Erreur lors de l'échange du code</h1>
  <p class="muted" style="font-family:monospace">${esc(message.substring(0, 500))}</p>
  ${diagnostic}
  <a class="btn btn-outline" href="/admin/youtube-setup">← Relancer depuis la configuration</a>
</div></body></html>`,
      502,
      (res) => clearOAuthCookie(res)
    );
    return response;
  }
}
