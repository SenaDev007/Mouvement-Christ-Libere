/**
 * API Client — Centralise tous les appels vers le backend Railway.
 *
 * Le frontend Next.js (Vercel) appelle ce client qui route vers le backend
 * Express (Railway) via NEXT_PUBLIC_API_URL.
 *
 * Avantages :
 * - Pas de limite de body size (Railway = illimité vs Vercel = 4.5MB)
 * - Variables d'environnement centralisées sur Railway (R2, DB, LiveKit)
 * - Pas de cold start serverless (Railway garde le process en vie)
 * - WebSockets natifs pour le temps réel
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Wrapper fetch qui ajoute automatiquement credentials: 'include'
 * pour envoyer les cookies d'auth cross-origin vers le backend Railway.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  // Pour FormData, ne pas forcer Content-Type (le navigateur le fait avec boundary)
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  // Forwarder le token admin si présent (pour les routes admin)
  if (typeof window !== "undefined") {
    headers["X-Admin-Token"] = getAdminToken();
  }

  // Supprimer Content-Type pour FormData (le navigateur le définit avec boundary)
  if (isFormData) {
    delete headers["Content-Type"];
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  return response;
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
    // Ne pas définir Content-Type pour FormData (le navigateur le fait avec boundary)
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
  return !!API_URL;
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
  url: (path: string) => path.startsWith("http") ? path : `${API_URL}${path}`,
};
