#!/usr/bin/env node

/**
 * scripts/youtube-oauth-setup.js
 *
 * Script one-time pour générer le YOUTUBE_REFRESH_TOKEN.
 *
 * Usage :
 *   1. Créez un OAuth 2.0 Client ID sur Google Cloud Console :
 *      - https://console.cloud.google.com/apis/credentials
 *      - Type : "Web application"
 *      - Authorized redirect URIs : http://localhost:3001/callback
 *      - Activez YouTube Data API v3
 *
 *   2. Lancez le script :
 *      node scripts/youtube-oauth-setup.js
 *
 *   3. Suivez les instructions — le navigateur s'ouvre pour le consentement.
 *
 *   4. Copiez les 4 valeurs affichées à la fin et ajoutez-les sur Vercel :
 *      YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET,
 *      YOUTUBE_REFRESH_TOKEN, YOUTUBE_CHANNEL_ID
 */

const http = require("http");
const { google } = require("googleapis");
const { exec } = require("child_process");

const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
];

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  YouTube OAuth Setup — Mouvement Christ Libère");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Lire les credentials depuis les args ou les env vars
  const clientId = process.argv[2] || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.argv[3] || process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("❌ Credentials manquants.\n");
    console.log("Usage :");
    console.log("  node scripts/youtube-oauth-setup.js <CLIENT_ID> <CLIENT_SECRET>\n");
    console.log("Ou définissez les variables d'environnement :");
    console.log("  export YOUTUBE_CLIENT_ID='...' && export YOUTUBE_CLIENT_SECRET='...'\n");
    console.log("📝 Pour obtenir ces credentials :");
    console.log("  1. Allez sur https://console.cloud.google.com/apis/credentials");
    console.log("  2. Créez un OAuth 2.0 Client ID (type: Web application)");
    console.log("  3. Ajoutez http://localhost:3001/callback dans 'Authorized redirect URIs'");
    console.log("  4. Activez YouTube Data API v3 dans la console\n");
    process.exit(1);
  }

  console.log("✓ Client ID :", clientId.substring(0, 20) + "...");
  console.log("✓ Client Secret :", "*".repeat(clientSecret.length));
  console.log("✓ Redirect URI :", REDIRECT_URI);
  console.log("✓ Scopes :", SCOPES.join(", "));
  console.log("");

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Générer l'URL de consentement
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force le consent pour obtenir un refresh token
  });

  console.log("🌐 Ouverture du navigateur pour le consentement Google...");
  console.log("   Si le navigateur ne s'ouvre pas, copiez cette URL :\n");
  console.log("   " + authUrl + "\n");

  // Ouvrir le navigateur
  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
      ? "start"
      : "xdg-open";
  exec(`${openCmd} "${authUrl}"`);

  console.log("⏳ En attente de l'autorisation sur http://localhost:" + PORT + "...\n");

  // Démarrer un serveur local pour recevoir le callback
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.log("❌ Erreur d'autorisation :", error);
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<h1>❌ Autorisation refusée</h1><p>Erreur: ${error}</p><p>Vous pouvez fermer cet onglet.</p>`
      );
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400);
      res.end("Code manquant");
      return;
    }

    console.log("✓ Code d'autorisation reçu, échange contre un refresh token...");

    try {
      // Échanger le code contre un refresh token
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        console.log("❌ Aucun refresh token reçu. Vous avez probablement déjà autorisé cette app.");
        console.log("   Solution : révoquez l'accès sur https://myaccount.google.com/permissions");
        console.log("   puis relancez ce script.\n");
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<h1>❌ Refresh token manquant</h1><p>Vous avez déjà autorisé cette app. Révoquez l'accès sur <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a> puis relancez le script.</p>`
        );
        server.close();
        process.exit(1);
      }

      // Récupérer le channel ID
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const channelResponse = await youtube.channels.list({
        part: ["snippet,contentDetails"],
        mine: true,
      });
      const channelId = channelResponse.data.items?.[0]?.id || "(non trouvé)";
      const channelTitle = channelResponse.data.items?.[0]?.snippet?.title || "(non trouvé)";

      console.log("\n═══════════════════════════════════════════════════════════════");
      console.log("  ✅ SUCCÈS — Configuration OAuth terminée !");
      console.log("═══════════════════════════════════════════════════════════════\n");
      console.log("  Chaîne YouTube :", channelTitle);
      console.log("  Channel ID    :", channelId);
      console.log("");
      console.log("  📋 Ajoutez ces 4 variables sur Vercel (Settings → Environment Variables) :\n");
      console.log("  YOUTUBE_CLIENT_ID=" + clientId);
      console.log("  YOUTUBE_CLIENT_SECRET=" + clientSecret);
      console.log("  YOUTUBE_REFRESH_TOKEN=" + refreshToken);
      console.log("  YOUTUBE_CHANNEL_ID=" + channelId);
      console.log("");
      console.log("  Après avoir ajouté les variables, redeployez (push un commit ou");
      console.log("  cliquez 'Redeploy' sur Vercel) pour activer le Tier B + C.\n");
      console.log("═══════════════════════════════════════════════════════════════\n");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>OAuth YouTube — Succès</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; background: #2A0E3D; color: #FAF6EF; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #FAF6EF; color: #1E0F2B; border-radius: 16px; padding: 32px; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
            h1 { color: #16a34a; margin-top: 0; }
            .vars { background: #1A0826; color: #C9A227; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; margin: 16px 0; }
            .note { font-size: 13px; color: #8A8378; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✅ Configuration OAuth terminée !</h1>
            <p>Chaîne YouTube : <strong>${channelTitle}</strong></p>
            <p>Channel ID : <code>${channelId}</code></p>
            <p>Ajoutez ces 4 variables sur Vercel (Settings → Environment Variables) :</p>
            <div class="vars">YOUTUBE_CLIENT_ID=${clientId}
YOUTUBE_CLIENT_SECRET=${clientSecret}
YOUTUBE_REFRESH_TOKEN=${refreshToken}
YOUTUBE_CHANNEL_ID=${channelId}</div>
            <p class="note">Après avoir ajouté les variables, redeployez sur Vercel pour activer le Tier B (auto-récupération) et Tier C (broadcast pré-créé).</p>
            <p class="note">Vous pouvez fermer cet onglet.</p>
          </div>
        </body>
        </html>
      `);

      server.close();
      process.exit(0);
    } catch (err) {
      console.error("❌ Erreur lors de l'échange du code :", err.message);
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>❌ Erreur</h1><p>${err.message}</p>`);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    // Serveur prêt, en attente du callback
  });

  // Timeout après 5 minutes
  setTimeout(() => {
    console.log("\n⏰ Timeout — aucune réponse après 5 minutes. Relancez le script.");
    server.close();
    process.exit(1);
  }, 5 * 60 * 1000);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
