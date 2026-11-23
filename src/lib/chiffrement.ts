/**
 * lib/chiffrement.ts — Chiffrement symétrique AES-256-GCM pour les secrets
 * persistés en base (refresh tokens OAuth, etc.).
 *
 * ⭐ V4.26 — Créé pour supporter le multi-comptes YouTube : on persiste
 * un refresh_token par serviteur dans la table `YoutubeAccount`. On ne
 * peut pas le stocker en clair — d'où ce helper.
 *
 * Détails techniques (alignés sur src/lib/youtube-oauth.ts) :
 *   - Algorithme : AES-256-GCM (authentifié, résistant à la réordonnance)
 *   - Clé dérivée du SESSION_SECRET via SHA-256, sel par usage pour isoler
 *     les contextes (un ciphertext d'un usage ne peut pas être déchiffré
 *     par un autre usage même si la clé maître est la même)
 *   - Format : <iv.base64url>.<ciphertext.base64url>.<tag.base64url>
 *   - IV : 12 octets aléatoires (recommandation NIST pour GCM)
 *   - Tag : 16 octets
 *
 * Aucune exception ne sort de ces fonctions en cas d'entrée invalide :
 * `dechiffrerSecret` renvoie null (l'appelant décide quoi faire).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** Longueur de l'IV pour AES-GCM (12 octets — standard NIST). */
const IV_LENGTH = 12;

/** Longueur du tag d'authentification GCM (16 octets — maximum). */
const TAG_LENGTH = 16;

/**
 * Dérive la clé maître 256 bits à partir du SESSION_SECRET + un sel d'usage.
 * Le sel isole les contextes : un ciphertext chiffré pour l'usage "youtube-account"
 * ne peut pas être déchiffré avec l'usage "tiktok-account".
 */
function deriveKey(usage: string): Buffer {
  const secret =
    process.env.SESSION_SECRET || "christ-libere-session-secret-change-in-prod-2026";
  return createHash("sha256")
    .update(`${secret}:${usage}`)
    .digest();
}

/** Encode en base64url (sans padding). */
function toB64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Décode la base64url (avec ou sans padding). */
function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Chiffre une chaîne avec AES-256-GCM pour un usage donné.
 *
 * @param valeur  secret en clair (refresh token, mot de passe…)
 * @param usage   contexte ("youtube-account", "tiktok-account", …) — isolant
 * @returns        ciphertext au format "iv.ct.tag" en base64url
 */
export function chiffrerSecret(valeur: string, usage: string): string {
  const key = deriveKey(usage);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(valeur, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toB64url(iv)}.${toB64url(ct)}.${toB64url(tag)}`;
}

/**
 * Déchiffre une chaîne AES-256-GCM produite par `chiffrerSecret`.
 *
 * @param ciphertext  format "iv.ct.tag" en base64url
 * @param usage        contexte (DOIT correspondre à celui du chiffrement)
 * @returns            secret en clair, ou null si le format/tag est invalide
 */
export function dechiffrerSecret(ciphertext: string, usage: string): string | null {
  try {
    const parts = ciphertext.split(".");
    if (parts.length !== 3) return null;
    const [ivB64, ctB64, tagB64] = parts;
    const iv = fromB64url(ivB64);
    const ct = fromB64url(ctB64);
    const tag = fromB64url(tagB64);
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

    const key = deriveKey(usage);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Vérifie qu'un ciphertext est déchiffrable avec l'usage donné (sans le
 * déchiffrer réellement — utile pour les diagnostics).
 */
export function estChiffrementValide(ciphertext: string, usage: string): boolean {
  return dechiffrerSecret(ciphertext, usage) !== null;
}
