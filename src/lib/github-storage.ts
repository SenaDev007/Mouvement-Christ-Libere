/**
 * lib/github-storage.ts — ⭐ V4.43 Stockage de fichiers dans le repo GitHub.
 *
 * ============================================================================
 * POURQUOI
 * ============================================================================
 * Cloudflare R2 a une limite de 10 Go sur le plan gratuit. Pour un ministère
 * qui produit beaucoup de vidéos, audio et documents, cette limite est vite
 * atteinte. GitHub n'a pas de limite de stockage totale pour les Releases
 * (jusqu'à 2 Go par fichier), et le Contents API permet des fichiers
 * jusqu'à 100 Mo dans le repo lui-même.
 *
 * ARCHITECTURE
 * ============================================================================
 * Dossier dans le repo : storage/
 *   storage/
 *     documents/
 *       bibliotheque/    ← livres PDF de la bibliothèque
 *         2026-11/
 *           28/
 *             titre-livre.pdf
 *     videos/
 *       2026-11/
 *         28/
 *             titre-video.mp4
 *     audio/
 *       vie-transformee/  ← témoignages audio des croyants
 *         2026-11/
 *           28/
 *             temoignage.webm
 *       adoration/        ← chants et louanges
 *         2026-11/
 *           28/
 *             chant.mp3
 *
 * Tout est classé par date (YYYY-MM/DD) pour faciliter la navigation.
 *
 * API GitHub utilisée :
 *   - PUT /repos/{owner}/{repo}/contents/{path} — upload (base64)
 *   - DELETE /repos/{owner}/{repo}/contents/{path} — suppression (besoin du SHA)
 *   - GET /repos/{owner}/{repo}/contents/{path} — récupération SHA + URL
 *
 * URL publique de lecture :
 *   https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
 *
 * Limites :
 *   - 100 Mo par fichier (Contents API)
 *   - Base64 encode → +33% de taille → limite effective ~75 Mo
 *   - 5 000 requêtes/heure (rate limit GitHub)
 *
 * Variables d'environnement :
 *   GITHUB_STORAGE_TOKEN — token GitHub avec accès repo (requis)
 *   GITHUB_STORAGE_OWNER — propriétaire du repo (défaut: SenaDev007)
 *   GITHUB_STORAGE_REPO  — nom du repo (défaut: Mouvement-Christ-Libere)
 *   GITHUB_STORAGE_BRANCH — branche (défaut: main)
 * ============================================================================
 */

/** Types de médias supportés. */
export type MediaType = "documents" | "videos" | "audio";

/** Limite effective : 75 Mo (100 Mo GitHub - 33% base64 overhead). */
const MAX_FILE_SIZE = 75 * 1024 * 1024;

const GITHUB_API = "https://api.github.com";

interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

function getConfig(): GithubConfig | null {
  const token = process.env.GITHUB_STORAGE_TOKEN;
  if (!token) return null;
  return {
    token,
    owner: process.env.GITHUB_STORAGE_OWNER || "SenaDev007",
    repo: process.env.GITHUB_STORAGE_REPO || "Mouvement-Christ-Libere",
    branch: process.env.GITHUB_STORAGE_BRANCH || "main",
  };
}

/** Vérifie si le stockage GitHub est configuré. */
export function isGithubStorageConfigured(): boolean {
  return !!process.env.GITHUB_STORAGE_TOKEN;
}

/**
 * Génère le chemin de stockage pour un fichier, classé par date.
 *
 * @param type     "documents" | "videos" | "audio"
 * @param subType  sous-dossier optionnel (ex: "bibliotheque", "vie-transformee")
 * @param filename nom du fichier (ex: "enseignement-2026.pdf")
 * @returns chemin complet : "storage/videos/2026-11/28/enseignement-2026.pdf"
 */
export function genererCheminStockage(
  type: MediaType,
  subType: string | null,
  filename: string
): string {
  const now = new Date();
  const anneeMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const jour = String(now.getDate()).padStart(2, "0");

  // Nettoyer le nom de fichier (supprimer caractères spéciaux)
  const nomNettoye = filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const parts = ["storage", type];
  if (subType) parts.push(subType);
  parts.push(anneeMois, jour, nomNettoye);

  return parts.join("/");
}

/**
 * Construit l'URL publique (raw.githubusercontent.com) pour lire un fichier
 * stocké dans le repo GitHub.
 */
export function getGithubRawUrl(path: string): string {
  const config = getConfig();
  if (!config) return "";
  return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${path}`;
}

/** Extrait le chemin de stockage depuis une URL raw.githubusercontent.com. */
export function extraireCheminDepuisUrl(url: string): string | null {
  const match = url.match(
    /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/
  );
  return match?.[1] || null;
}

interface ResultatUpload {
  url: string;      // URL raw.githubusercontent.com
  path: string;     // chemin dans le repo (storage/videos/...)
  sha: string;      // SHA du fichier (pour suppression/modification)
  size: number;     // taille en octets
}

/**
 * Upload un fichier dans le repo GitHub via le Contents API.
 *
 * @param content   contenu binaire du fichier (Buffer ou ArrayBuffer)
 * @param type      "documents" | "videos" | "audio"
 * @param subType   sous-dossier (ex: "bibliotheque", "vie-transformee")
 * @param filename  nom du fichier
 * @returns { url, path, sha, size } ou lance une Error
 */
export async function uploadToGithub(
  content: Buffer | ArrayBuffer,
  type: MediaType,
  subType: string | null,
  filename: string
): Promise<ResultatUpload> {
  const config = getConfig();
  if (!config) {
    throw new Error("GITHUB_STORAGE_TOKEN n'est pas configuré sur Vercel.");
  }

  const buffer = content instanceof ArrayBuffer ? Buffer.from(content) : content;
  const size = buffer.length;

  if (size > MAX_FILE_SIZE) {
    throw new Error(
      `Fichier trop volumineux (${Math.round(size / 1024 / 1024)} Mo). ` +
        `Limite GitHub Contents API : ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} Mo ` +
        `(base64 inclus). Pour les gros fichiers, utilisez R2 ou GitHub Releases.`
    );
  }

  const path = genererCheminStockage(type, subType, filename);
  const base64Content = buffer.toString("base64");

  const apiUrl = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${path}`;

  // Vérifier si le fichier existe déjà (pour récupérer le SHA et faire un update)
  let existingSha: string | undefined;
  try {
    const checkRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (checkRes.ok) {
      const existing = (await checkRes.json()) as { sha?: string };
      existingSha = existing.sha;
    }
  } catch {
    // Fichier n'existe pas encore — c'est un nouvel upload
  }

  // Upload (ou mise à jour si le fichier existe)
  const method = existingSha ? "PUT" : "PUT"; // PUT dans les deux cas
  const body: Record<string, unknown> = {
    message: `upload: ${path}`,
    content: base64Content,
    branch: config.branch,
  };
  if (existingSha) {
    body.sha = existingSha; // requis pour mettre à jour un fichier existant
  }

  const res = await fetch(apiUrl, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `GitHub upload échec (HTTP ${res.status}) : ${errorBody.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    content?: { sha?: string; download_url?: string };
  };

  const sha = data.content?.sha || "";
  const url = getGithubRawUrl(path);

  console.log(`[github-storage] Upload OK : ${path} (${size} octets, sha=${sha.slice(0, 12)}…)`);

  return { url, path, sha, size };
}

/**
 * Supprime un fichier du repo GitHub.
 *
 * @param path  chemin du fichier dans le repo (storage/videos/...)
 * @returns true si supprimé, false si introuvable
 */
export async function deleteFromGithub(path: string): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    throw new Error("GITHUB_STORAGE_TOKEN n'est pas configuré.");
  }

  const apiUrl = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${path}`;

  // ① Récupérer le SHA du fichier (requis pour la suppression)
  const checkRes = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (checkRes.status === 404) {
    // Fichier déjà supprimé — pas une erreur
    return false;
  }
  if (!checkRes.ok) {
    throw new Error(`GitHub get SHA échec (HTTP ${checkRes.status})`);
  }

  const fileData = (await checkRes.json()) as { sha?: string };
  const sha = fileData.sha;
  if (!sha) {
    throw new Error("SHA introuvable pour la suppression.");
  }

  // ② Supprimer le fichier
  const delRes = await fetch(apiUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `delete: ${path}`,
      sha,
      branch: config.branch,
    }),
  });

  if (!delRes.ok) {
    const errorBody = await delRes.text().catch(() => "");
    throw new Error(`GitHub delete échec (HTTP ${delRes.status}) : ${errorBody.slice(0, 200)}`);
  }

  console.log(`[github-storage] Suppression OK : ${path}`);
  return true;
}

/**
 * Supprime un fichier depuis son URL raw.githubusercontent.com.
 * Utile quand on a seulement l'URL stockée en base.
 */
export async function deleteFromGithubUrl(url: string): Promise<boolean> {
  const path = extraireCheminDepuisUrl(url);
  if (!path) {
    console.warn(`[github-storage] URL non reconnue comme stockage GitHub : ${url}`);
    return false;
  }
  return deleteFromGithub(path);
}
