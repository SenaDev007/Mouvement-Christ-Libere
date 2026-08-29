/**
 * API Client — Centralise tous les appels vers le backend Railway avec fallback.
 *
 * Stratégie :
 * 1. Si NEXT_PUBLIC_API_URL est défini → essayer le backend Railway d'abord
 * 2. Si le backend Railway timeout (5s) ou erreur → fallback vers les APIs Next.js locales
 * 3. Si NEXT_PUBLIC_API_URL n'est pas défini → utiliser directement les APIs Next.js locales
 *
 * Cela garantit que le site fonctionne toujours, même si Railway est down.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const BACKEND_TIMEOUT = 3000; // 3s max avant fallback (réduit pour ne pas bloquer l'UI)

/**
 * Détermine si on doit utiliser le backend Railway ou les APIs locales.
 * On désactive le backend si :
 * - NEXT_PUBLIC_API_URL n'est pas défini
 * - Ou s'il pointe vers localhost (dev local)
 * - Ou si DISABLE_BACKEND est défini (pour forcer les APIs Next.js locales)
 */
function shouldUseBackend(): boolean {
  if (!API_URL) return false;
  if (API_URL.includes("localhost")) return false;
  if (process.env.NEXT_PUBLIC_DISABLE_BACKEND === "true") return false;
  return true;
}

/**
 * Wrapper fetch avec timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Wrapper fetch qui essaie le backend Railway d'abord, puis fallback Next.js local.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  if (typeof window !== "undefined") {
    headers["X-Admin-Token"] = getAdminToken();
  }

  if (isFormData) {
    delete headers["Content-Type"];
  }

  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers,
  };

  // Si pas de backend configuré → utiliser directement les APIs Next.js locales
  if (!shouldUseBackend()) {
    return fetch(path, fetchOptions);
  }

  // Essayer le backend Railway avec timeout
  const backendUrl = `${API_URL}${path}`;
  try {
    const response = await fetchWithTimeout(backendUrl, fetchOptions, BACKEND_TIMEOUT);
    return response;
  } catch {
    // Fallback : utiliser l'API Next.js locale
    console.warn(`[api-client] Backend Railway timeout pour ${path}, fallback vers API locale`);
    return fetch(path, fetchOptions);
  }
}

/**
 * Wrapper pour les appels JSON (GET par défaut).
 */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Wrapper pour les POST JSON.
 */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Wrapper pour les POST avec FormData (uploads de fichiers).
 */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Récupère le token admin depuis le cookie (pour forward vers le backend).
 */
function getAdminToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/admin_session=([^;]+)/);
  return match ? match[1] : "";
}

/**
 * Vérifie si l'API backend est configurée.
 */
export function isBackendConfigured(): boolean {
  return shouldUseBackend();
}

/**
 * Retourne l'URL de base du backend.
 */
export function getApiUrl(): string {
  return API_URL;
}

/**
 * Objet api pour la compatibilité avec l'ancien code.
 * Usage : fetch(api.url("/api/contact"))
 */
export const api = {
  url: (path: string) => {
    // Si backend configuré, retourner l'URL Railway
    // Sinon, retourner le chemin relatif (API Next.js locale)
    if (shouldUseBackend()) {
      return path.startsWith("http") ? path : `${API_URL}${path}`;
    }
    return path;
  },
};
