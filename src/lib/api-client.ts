/**
 * API Client — Centralise tous les appels API.
 *
 * Stratégie (inversée pour la performance) :
 * 1. Par défaut : utiliser les APIs Next.js locales (rapide, pas de délai)
 * 2. N'utiliser le backend Railway QUE si NEXT_PUBLIC_USE_BACKEND=true
 *    ET NEXT_PUBLIC_API_URL est défini
 *
 * Cela évite le délai de 3s (timeout Railway) sur chaque requête
 * quand Railway est down.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Détermine si on doit utiliser le backend Railway.
 * Par défaut : NON (utiliser les APIs Next.js locales).
 * Pour activer Railway : NEXT_PUBLIC_USE_BACKEND=true sur Vercel.
 */
function shouldUseBackend(): boolean {
  if (process.env.NEXT_PUBLIC_USE_BACKEND !== "true") return false;
  if (!API_URL) return false;
  if (API_URL.includes("localhost")) return false;
  return true;
}

/**
 * Wrapper fetch qui utilise les APIs Next.js locales par défaut.
 * Si NEXT_PUBLIC_USE_BACKEND=true, redirige vers Railway.
 *
 * TIMEOUT : tous les appels (locaux ET backend) ont un timeout de 8 s via
 * AbortController. Sans ça, un appel lent (serverless saturé, Prisma qui
 * attend un pool de connexion, etc.) peut rester pendouillé jusqu'au
 * timeout navigateur par défaut (~300 s sur Chrome) — l'utilisateur voit
 * un spinner infini. 8 s est assez large pour une DB Postgres saine, et
 * assez court pour que l'UI puisse afficher une erreur ou un fallback.
 */
const LOCAL_FETCH_TIMEOUT_MS = 8000;

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  if (isFormData) {
    delete headers["Content-Type"];
  }

  // Par défaut : API Next.js locale (rapide, pas de délai)
  // Ne PAS ajouter credentials:include ni X-Admin-Token pour les appels locaux
  // (les APIs Next.js utilisent le cookie admin_session automatiquement via same-origin)
  if (!shouldUseBackend()) {
    // (perf) Timeout local — empêche un spinner infini côté UI si la
    // serverless function est saturée ou si la DB met trop de temps à répondre.
    // Si un caller passe déjà son propre `signal`, on respecte ce signal
    // (les deux AbortControllers sont combinés).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOCAL_FETCH_TIMEOUT_MS);
    // Si le caller a passé un signal externe, le propager vers notre controller
    const externalSignal = options.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const response = await fetch(path, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      // Si c'est notre timeout qui a déclenché l'abort, on lève une erreur
      // explicite pour que l'UI puisse afficher un message clair.
      if (controller.signal.aborted && (!externalSignal || !externalSignal.aborted)) {
        throw new DOMException(`apiFetch timeout (${LOCAL_FETCH_TIMEOUT_MS}ms): ${path}`, "TimeoutError");
      }
      throw err;
    }
  }

  // Backend Railway activé : ajouter credentials + X-Admin-Token pour cross-origin
  if (typeof window !== "undefined") {
    headers["X-Admin-Token"] = getAdminToken();
  }

  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers,
  };

  // Backend Railway avec timeout 5s + fallback
  const backendUrl = `${API_URL}${path}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(backendUrl, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch {
    // Fallback : API Next.js locale
    console.warn(`[api-client] Backend Railway timeout pour ${path}, fallback local`);
    return fetch(path, { ...options, headers });
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
