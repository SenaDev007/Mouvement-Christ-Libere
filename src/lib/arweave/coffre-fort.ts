/**
 * Coffre-fort Arweave — Mouvement Christ Libère (V3)
 *
 * Ancre les contenus (témoignages, enseignements, vidéos) sur la blockchain
 * Arweave pour immutabilité. Même si le site est censuré ou compromis,
 * les contenus restent vérifiables et accessibles via Arweave.
 *
 * Deux modes :
 * 1. Mode démo (sans clé Arweave) : hash SHA-256 (preuve d'existence)
 * 2. Mode production (avec clé) : ancrage réel sur Arweave
 *
 * Documentation déploiement Arweave : docs/ARWEAVE-DEPLOYMENT.md
 */

import { createHash } from "crypto";

export interface ContenuAncrable {
  id: string;
  type: "temoignage" | "enseignement" | "video" | "biographie";
  titre: string;
  contenu: string;
  auteur: string;
  dateCreation: string; // ISO
}

export interface AncreArweave {
  contenuId: string;
  hash: string; // SHA-256 du contenu
  hashAlgorithme: "sha256";
  arweaveTxId: string | null; // ID transaction Arweave (null si mode démo)
  arweaveUrl: string | null; // URL d'accès (https://arweave.net/txId)
  dateAncrage: string; // ISO
  taille: number; // en bytes
  mode: "demo" | "production";
  verified: boolean;
}

/**
 * Calcule le hash SHA-256 d'un contenu.
 * Ce hash sert de preuve d'existence et d'intégrité.
 */
export function calculerHash(contenu: ContenuAncrable): string {
  // Normaliser le contenu pour cohérence
  const donnees = JSON.stringify({
    id: contenu.id,
    type: contenu.type,
    titre: contenu.titre,
    contenu: contenu.contenu,
    auteur: contenu.auteur,
    dateCreation: contenu.dateCreation,
  });

  return createHash("sha256").update(donnees).digest("hex");
}

/**
 * Vérifie si Arweave est configuré.
 */
export function isArweaveConfigured(): boolean {
  return !!process.env.ARWEAVE_WALLET_KEY;
}

/**
 * Ancre un contenu sur Arweave.
 *
 * En mode production (avec ARWEAVE_WALLET_KEY) : upload réel sur Arweave.
 * En mode démo : hash SHA-256 seulement (preuve d'existence).
 */
export async function ancrerContenu(contenu: ContenuAncrable): Promise<AncreArweave> {
  const hash = calculerHash(contenu);
  const taille = Buffer.byteLength(contenu.contenu, "utf-8");

  if (!isArweaveConfigured()) {
    // Mode démo : hash seulement
    return {
      contenuId: contenu.id,
      hash,
      hashAlgorithme: "sha256",
      arweaveTxId: null,
      arweaveUrl: null,
      dateAncrage: new Date().toISOString(),
      taille,
      mode: "demo",
      verified: true,
    };
  }

  // Mode production : upload sur Arweave
  try {
    const ancre = await uploaderVersArweave(contenu, hash);
    return ancre;
  } catch (error) {
    console.error("[arweave] Erreur upload:", error);
    // Fallback vers mode démo
    return {
      contenuId: contenu.id,
      hash,
      hashAlgorithme: "sha256",
      arweaveTxId: null,
      arweaveUrl: null,
      dateAncrage: new Date().toISOString(),
      taille,
      mode: "demo",
      verified: true,
    };
  }
}

/**
 * Upload réel vers Arweave.
 * Nécessite ARWEAVE_WALLET_KEY (clé privée du wallet au format JSON).
 */
async function uploaderVersArweave(
  contenu: ContenuAncrable,
  hash: string
): Promise<AncreArweave> {
  // Import dynamique pour éviter les erreurs en mode démo
  const Arweave = (await import("arweave")).default;

  const walletKey = JSON.parse(process.env.ARWEAVE_WALLET_KEY!);

  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  // Créer la transaction
  const data = JSON.stringify({
    type: "mouvement-christ-libere",
    contenu,
    hash,
    dateAncrage: new Date().toISOString(),
  });

  const transaction = await arweave.createTransaction({ data }, walletKey);

  // Tags Arweave (métadonnées recherchables)
  transaction.addTag("Content-Type", "application/json");
  transaction.addTag("App-Name", "Mouvement-Christ-Libere");
  transaction.addTag("Content-Type-App", contenu.type);
  transaction.addTag("Content-Id", contenu.id);
  transaction.addTag("Content-Hash", hash);
  transaction.addTag("Content-Auteur", contenu.auteur);

  // Signer et envoyer
  await arweave.transactions.sign(transaction, walletKey);
  const response = await arweave.transactions.post(transaction);

  if (response.status !== 200) {
    throw new Error(`Erreur Arweave: ${response.status} ${response.statusText}`);
  }

  return {
    contenuId: contenu.id,
    hash,
    hashAlgorithme: "sha256",
    arweaveTxId: transaction.id,
    arweaveUrl: `https://arweave.net/${transaction.id}`,
    dateAncrage: new Date().toISOString(),
    taille: Buffer.byteLength(data, "utf-8"),
    mode: "production",
    verified: true,
  };
}

/**
 * Vérifie l'intégrité d'un contenu par rapport à son ancre.
 */
export function verifierIntegrite(
  contenu: ContenuAncrable,
  ancre: AncreArweave
): boolean {
  const hashActuel = calculerHash(contenu);
  return hashActuel === ancre.hash;
}

/**
 * Génère un identifiant de contenu unique.
 */
export function genererIdContenu(type: string, titre: string): string {
  const timestamp = Date.now();
  const slug = titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .substring(0, 50);
  return `${type}-${slug}-${timestamp}`;
}
