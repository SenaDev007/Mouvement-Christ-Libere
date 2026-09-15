/**
 * ⭐ V3.84 — Test local du centrage de /admin/paiements.
 *
 * Forge un token de session super admin avec le secret PAR DÉFAUT
 * (aucun SESSION_SECRET local), pose le cookie, puis charge la page
 * et mesure la position du conteneur du module : il doit être centré
 * (marges gauche/droite équilibrées dans la zone de contenu).
 */
const { createHmac } = require("crypto");

const SECRET =
  process.env.SESSION_SECRET || "christ-libere-session-secret-change-in-prod-2026";
const payload = Buffer.from(
  JSON.stringify({
    user: "admin:test-local-v384:SUPER_ADMIN",
    exp: Date.now() + 1000 * 60 * 60,
  })
).toString("base64url");
const signature = createHmac("sha256", SECRET)
  .update(payload)
  .digest("base64url");
console.log(`${payload}.${signature}`);
