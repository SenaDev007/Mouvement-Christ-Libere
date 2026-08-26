/**
 * API Client — Christ Libère V2
 *
 * Wrapper around fetch() that prepends the backend URL.
 *
 * Variable d'environnement utilisée :
 *   - Côté serveur (Server Components, API routes) : `API_URL`
 *   - Côté client (Client Components)              : `NEXT_PUBLIC_API_URL`
 *
 * On combine les deux pour fonctionner dans les deux contextes.
 * Si aucune n'est définie (dev local), on utilise une URL relative (same origin).
 *
 * Usage:
 *   import { api } from "@/lib/api-client";
 *   const res = await api.get("/api/yeshua-connect/conversations");
 *   const res = await api.post("/api/auth/login", { email, password });
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||  // ⭐ client-side (Vercel)
  process.env.API_URL ||               // server-side only
  "";                                  // fallback: relative URLs

function buildUrl(path: string): string {
  if (!API_URL) return path; // relative (same origin)
  return `${API_URL}${path}`;
}

interface FetchOptions extends RequestInit {
  json?: unknown;
}

async function request<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { json, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(json);
  }

  // Include credentials (cookies) for auth
  fetchOptions.credentials = "include";

  const res = await fetch(buildUrl(path), { ...fetchOptions, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T = unknown>(path: string, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T = unknown>(path: string, json?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "POST", json }),

  put: <T = unknown>(path: string, json?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "PUT", json }),

  delete: <T = unknown>(path: string, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),

  /**
   * For file uploads (FormData) — don't set Content-Type, let the browser set it.
   */
  upload: <T = unknown>(path: string, formData: FormData, options?: FetchOptions) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: formData,
      headers: { ...((options?.headers as Record<string, string>) || {}) },
    }),

  /**
   * Get the raw URL (for use in <a href> or window.location)
   */
  url: (path: string) => buildUrl(path),

  /**
   * Get the base API URL (for Socket.io client config)
   */
  baseUrl: API_URL,
};
