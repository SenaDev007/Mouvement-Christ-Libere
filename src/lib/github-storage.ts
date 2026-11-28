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
export type MediaType = "documents" | "videos" | "audio" | "images";

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
  url: string;      // URL publique (raw.githubusercontent.com OU github.com/.../releases/download/...)
  path: string;     // chemin dans le repo OU tag de release
  sha: string;      // SHA du fichier (Contents) OU tag de release (Releases)
  size: number;     // taille en octets
  storage: "contents" | "release";  // méthode de stockage utilisée
}

// ─────────────────────────────────────────────────────────────────────
// ⭐ V4.44 — GITHUB RELEASES (fichiers > 75 Mo, jusqu'à 2 Go)
// ─────────────────────────────────────────────────────────────────────
// GitHub Releases permettent de stocker des fichiers jusqu'à 2 Go chacun,
// sans limite de total. Chaque fichier > 75 Mo est uploadé comme un asset
// d'une release dédiée.
//
// URL de lecture : https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}
// Création : POST /repos/{owner}/{repo}/releases
// Upload asset : POST https://uploads.github.com/repos/{owner}/{repo}/releases/{id}/assets
// Suppression : DELETE /repos/{owner}/{repo}/releases/{id} + DELETE /repos/{owner}/{repo}/git/refs/tags/{tag}
// ─────────────────────────────────────────────────────────────────────

/**
 * Upload un fichier vers GitHub Releases (pour les fichiers > 75 Mo).
 * Crée une release dédiée avec un tag unique, upload le fichier comme asset.
 *
 * @returns { url, path, sha, size, storage: "release" }
 */
async function uploadToGithubRelease(
  content: Buffer,
  type: MediaType,
  subType: string | null,
  filename: string
): Promise<ResultatUpload> {
  const config = getConfig();
  if (!config) throw new Error("GITHUB_STORAGE_TOKEN n'est pas configuré.");

  const size = content.length;
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const nomNettoye = filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Tag unique : storage-videos-20261128-1732800000
  const tag = `storage-${type}-${dateStr}-${Date.now()}`;

  // ① Créer la release
  const releaseRes = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/releases`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag_name: tag,
        name: `[${type}${subType ? "/" + subType : ""}] ${nomNettoye}`,
        body: `Fichier stocké automatiquement par le back-office.\nType: ${type}\nSous-type: ${subType || "aucun"}\nTaille: ${(size / 1024 / 1024).toFixed(2)} Mo\nDate: ${now.toISOString()}`,
        draft: false,
        prerelease: false,
      }),
    }
  );

  if (!releaseRes.ok) {
    const errBody = await releaseRes.text().catch(() => "");
    throw new Error(`GitHub release create échec (HTTP ${releaseRes.status}) : ${errBody.slice(0, 300)}`);
  }

  const release = (await releaseRes.json()) as {
    id: number;
    upload_url: string;
  };

  // ② Upload l'asset (fichier binaire)
  // L'URL d'upload est de la forme : https://uploads.github.com/.../assets{?name,label}
  const uploadUrl = release.upload_url.replace(
    /\{\?name,label\}/,
    `?name=${encodeURIComponent(nomNettoye)}`
  );

  const assetRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/octet-stream",
      "Content-Length": size.toString(),
    },
    // Buffer est accepté par undici au runtime (Node) ; le typage DOM strict
    // ne le connaît pas → cast sans copie (un new Uint8Array copierait 2 Go).
    body: content as unknown as BodyInit,
  });

  if (!assetRes.ok) {
    const errBody = await assetRes.text().catch(() => "");
    // Supprimer la release créée si l'upload échoue
    await fetch(
      `${GITHUB_API}/repos/${config.owner}/${config.repo}/releases/${release.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" } }
    ).catch(() => {});
    throw new Error(`GitHub release upload échec (HTTP ${assetRes.status}) : ${errBody.slice(0, 300)}`);
  }

  const asset = (await assetRes.json()) as {
    browser_download_url: string;
  };

  const downloadUrl = asset.browser_download_url;

  console.log(
    `[github-storage] Release upload OK : ${tag}/${nomNettoye} (${(size / 1024 / 1024).toFixed(2)} Mo)`
  );

  return {
    url: downloadUrl,
    path: tag,           // le tag sert de chemin pour la suppression
    sha: tag,            // le tag sert aussi de SHA
    size,
    storage: "release",
  };
}

/**
 * Supprime une release GitHub (et son tag) par son tag.
 */
async function deleteFromGithubRelease(tag: string): Promise<boolean> {
  const config = getConfig();
  if (!config) throw new Error("GITHUB_STORAGE_TOKEN n'est pas configuré.");

  // ① Trouver la release par son tag
  const releaseRes = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/releases/tags/${tag}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (releaseRes.status === 404) return false; // déjà supprimée

  if (!releaseRes.ok) {
    throw new Error(`GitHub release get échec (HTTP ${releaseRes.status})`);
  }

  const release = (await releaseRes.json()) as { id: number };

  // ② Supprimer la release (supprime tous les assets)
  const delRes = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/releases/${release.id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!delRes.ok) {
    console.warn(`[github-storage] Release delete échec (HTTP ${delRes.status})`);
  }

  // ③ Supprimer le tag (sinon il reste orphelin)
  await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/git/refs/tags/${tag}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
      },
    }
  ).catch(() => {
    // Le tag peut déjà être supprimé avec la release — pas une erreur
  });

  console.log(`[github-storage] Release supprimée : ${tag}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — détection automatique Contents vs Releases
// ─────────────────────────────────────────────────────────────────────

/**
 * Upload un fichier vers GitHub. Détection automatique :
 *   - ≤ 75 Mo → Contents API (dans le repo, URL raw.githubusercontent.com)
 *   - > 75 Mo → GitHub Releases (asset de release, URL releases/download)
 *
 * @param content   contenu binaire (Buffer ou ArrayBuffer)
 * @param type      "documents" | "videos" | "audio"
 * @param subType   sous-dossier (ex: "bibliotheque", "vie-transformee")
 * @param filename  nom du fichier
 * @returns { url, path, sha, size, storage }
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

  // ⭐ Détection automatique : Releases pour les gros fichiers
  if (size > MAX_FILE_SIZE) {
    console.log(
      `[github-storage] Fichier ${(size / 1024 / 1024).toFixed(1)} Mo > ${MAX_FILE_SIZE / 1024 / 1024} Mo → GitHub Releases`
    );
    return uploadToGithubRelease(buffer, type, subType, filename);
  }

  // Contents API pour les petits fichiers
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

  return { url, path, sha, size, storage: "contents" as const };
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
 * Supprime un fichier depuis son URL publique.
 * Détecte automatiquement :
 *   - raw.githubusercontent.com → Contents API (suppression par chemin)
 *   - github.com/.../releases/download/... → Releases API (suppression par tag)
 */
export async function deleteFromGithubUrl(url: string): Promise<boolean> {
  // Détecter les URLs Releases : github.com/{owner}/{repo}/releases/download/{tag}/{filename}
  const releaseMatch = url.match(
    /github\.com\/[^/]+\/[^/]+\/releases\/download\/([^/]+)\//
  );
  if (releaseMatch?.[1]) {
    return deleteFromGithubRelease(releaseMatch[1]);
  }

  // URL Contents API : raw.githubusercontent.com
  const path = extraireCheminDepuisUrl(url);
  if (!path) {
    console.warn(`[github-storage] URL non reconnue comme stockage GitHub : ${url}`);
    return false;
  }
  return deleteFromGithub(path);
}
