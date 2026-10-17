/* ============================================================
   SERVICE WORKER « CHRIST LIBÈRE » — ⭐ V4.10 MODE HORS LIGNE
   ============================================================

   Objectif (exigence du pasteur) : « le hors ligne doit fonctionner
   pour toutes les pages de l'application jusqu'à la communauté
   Yeshua Connect intégrée. Et c'est seulement pour la lecture des
   vidéos que ça va réclamer une connexion internet. »

   Stratégies :
   ─────────────
   • NAVIGATIONS (mode "navigate")  → network-first avec repli sur le
     cache PAGES : en ligne on sert la page FRAÎCHE du serveur (donc
     toute publication back-office — images comprises — apparaît
     immédiatement dans l'app) ; hors ligne on sert la copie locale.
     Repli final : /offline.html.
     ⚠ /admin, /secretariat, /tresorerie, /login… → JAMAIS mis en cache.

   • ASSETS `/_next/static/*` (JS/CSS hashés, immuables) → cache-first.

   • IMAGES (`/_next/image`, R2, jpg/png/webp/avatars…) →
     stale-while-revalidate : la copie locale s'affiche INSTANTANÉMENT
     (même hors ligne), une mise à jour est téléchargée en arrière-plan
     quand la connexion revient → les photos changées dans le back-office
     remplacent les anciennes dès que l'app est en ligne.

   • PRÉCACHE à l'installation : la page hors ligne, les icônes/logo, et
     TOUTES les pages de l'application (/app et ses 12 sections) →
     l'application est intégralement disponible hors ligne dès le
     premier lancement avec connexion.

   • VIDÉOS & flux temps réel → réseau uniquement (jamais mis en cache) :
     la lecture des vidéos exige la connexion, comme convenu.

   • POST/PUT/DELETE (envoi de messages…) → jamais interceptés : la file
     d'envoi locale (IndexedDB, cf. src/lib/offline/) gère le hors ligne
     façon WhatsApp.

   Ce fichier REMPLACE sw-push.js (dont il reprend intégralement les
   handlers de notifications push) — un seul service worker à la fois
   sur le scope /.
*/

const VERSION = "v410";
const STATIC_CACHE = `christ-libere-static-${VERSION}`;
const IMAGES_CACHE = `christ-libere-images-${VERSION}`;
const PAGES_CACHE = `christ-libere-pages-${VERSION}`;

/* Pages de l'application — précalculées dès l'installation pour que
   TOUTES les pages fonctionnent hors ligne après le premier passage
   en ligne (même jamais ouvertes auparavant). */
const APP_PAGES = [
  "/app",
  "/app/afrika",
  "/app/pasteur-kongo",
  "/app/temoignages",
  "/app/enseignements",
  "/app/videos",
  "/app/adoration-louanges",
  "/app/intercession",
  "/app/disperses",
  "/app/contribuer",
  "/app/annonces",
  "/app/rendez-vous",
];

/* Ressources essentielles (page hors ligne + identité visuelle). */
const CORE_ASSETS = [
  "/offline.html",
  "/logo-christ-libere-v3.png",
  "/manifest-192.png",
  "/manifest-512.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/badge-72.png",
  "/favicon.ico",
];

/* Pages du site public à précalculer aussi (bonus hors ligne). */
const SITE_PAGES = ["/"];

/* Zones à NE JAMAIS servir depuis le cache (auth / back-offices /
   formulaires dynamiques) — réseau uniquement. */
const NEVER_CACHE_NAV = [
  "/admin",
  "/secretariat",
  "/tresorerie",
  "/login",
  "/register",
  "/profil",
  "/api/",
];

/* ============================================================
   INSTALLATION — précache + prise de contrôle immédiate
   ============================================================ */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      const staticCache = await caches.open(STATIC_CACHE);

      // Page hors ligne + icônes : indispensables.
      await Promise.allSettled(CORE_ASSETS.map((u) => staticCache.add(u)));

      // Toutes les pages de l'app + accueil du site : best-effort (une
      // page en erreur n'empêche pas l'installation ; les 307 vers
      // /login des zones protégées sont ignorés cf. cacheCleanPage).
      await Promise.allSettled(
        [...APP_PAGES, ...SITE_PAGES].map(async (url) => {
          const res = await fetch(url, { credentials: "same-origin" });
          await putCleanPage(cache, url, res);
        })
      );

      await self.skipWaiting();
    })()
  );
});

/* ============================================================
   ACTIVATION — purge des anciens caches
   ============================================================ */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(`-${VERSION}`))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* ============================================================
   FETCH — routage par type de requête
   ============================================================ */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Seules les requêtes GET sont concernées (les POST d'envoi de
  // messages passent par la file locale — jamais par le SW).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Hors http(s) (blob:, chrome-extension:…) → laisser le navigateur.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // ── TEMPS RÉEL & VIDÉOS : réseau uniquement, JAMAIS de cache ──────
  if (isRealtimeOrVideo(url, request)) return;

  // ── APIs : réseau uniquement (les données membres hors ligne sont
  //    gérées par la base locale IndexedDB côté client) ─────────────
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  // ── ASSETS STATIQUES hashés (/_next/static) : cache-first ──────────
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── IMAGES : stale-while-revalidate (affichage instantané + maj
  //    arrière-plan → les photos back-office se rafraîchissent) ──────
  if (isImageRequest(url, request)) {
    event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE));
    return;
  }

  // ── NAVIGATIONS : network-first + repli cache + offline.html ──────
  if (request.mode === "navigate" || request.destination === "document") {
    if (shouldNeverCacheNavigation(url.pathname)) return; // réseau seul
    event.respondWith(navigationHandler(request));
    return;
  }

  // Tout le reste (polices tierces, etc.) : SWR en cache statique.
  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
  // Les requêtes same-origin restantes → navigateur (pas de cache SW).
});

/* ============================================================
   STRATÉGIES
   ============================================================ */

/** Cache-first : assets immuables (hashés dans l'URL). */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return cached || Response.error();
  }
}

/**
 * Stale-while-revalidate : copie locale immédiate, mise à jour en
 * arrière-plan — le comportement « les images changent dès que la
 * connexion est là ».
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || Response.error();
}

/**
 * Navigations : network-first (page TOUJOURS fraîche quand on est en
 * ligne → publications back-office visibles immédiatement), repli sur
 * la copie locale hors ligne, puis /offline.html.
 */
async function navigationHandler(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(url.pathname, { ignoreVary: true, ignoreSearch: true });

  try {
    let res;
    if (cached) {
      // En ligne avec copie locale → on attend le serveur max 6 s
      // (sinon on sert la copie : navigation toujours fluide).
      res = await withTimeout(fetch(request), 6000);
    } else {
      res = await fetch(request);
    }
    if (res && res.ok) {
      // Stocker une copie NETTOYÉE (sans Set-Cookie/Vary) pour que le
      // repli hors ligne matche à coup sûr. Les réponses redirects
      // (ex. zones protégées) ne sont pas stockées.
      await putCleanPage(cache, url.pathname, res.clone());
      return res;
    }
    return cached || offlineFallback();
  } catch {
    // Hors ligne (ou timeout) → copie locale, sinon page hors ligne.
    return cached || offlineFallback();
  }
}

/** Timeout maison (AbortController interromprait des fetch partagés). */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("sw-timeout")), ms)
    ),
  ]);
}

/** La page hors ligne (précalculée dans STATIC_CACHE). */
async function offlineFallback() {
  const cache = await caches.open(STATIC_CACHE);
  const page = await cache.match("/offline.html");
  return page || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * Stocke une page pour le repli hors ligne : réponse nettoyée (Content-
 * Type conservé ; Set-Cookie / Vary supprimés → match garanti), 200
 * uniquement, sans redirection (les zones auth redirigent → non cachées).
 */
async function putCleanPage(cache, url, response) {
  if (!response || !response.ok || response.redirected) return;
  const body = await response.clone().text();
  const headers = new Headers();
  const ct = response.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("x-cached-by", "christ-libere-sw");
  await cache.put(url, new Response(body, { status: 200, headers }));
}

/* ============================================================
   CLASSIFICATION
   ============================================================ */

/** Vidéos, lives, socket.io, analytics → réseau uniquement. */
function isRealtimeOrVideo(url, request) {
  const p = url.pathname;

  // Socket.io (polling long) — jamais de cache.
  if (p.startsWith("/socket.io/") || url.searchParams.has("EIO")) return true;

  // Flux vidéo / lives / chunks (nos routes + HLS/DASH génériques).
  if (p.startsWith("/api/videos/") || p.startsWith("/api/live/")) return true;
  if (/\.(m3u8|mpd|ts|m4s)$/i.test(p)) return true;

  // Fichiers vidéo/audio volumineux (les MP4 TikTok répliqués, etc.) :
  // la lecture exige la connexion — exigence explicite du pasteur.
  if (/\.(mp4|webm|mov|avi|mkv|flv)$/i.test(p)) return true;

  // Lecteurs tiers (YouTube, TikTok, Daily…).
  if (
    /youtu\.?be|googlevideo|tiktokcdn|tiktok\.com|daily\.co|agora/.test(url.hostname) ||
    (request.destination === "video" || request.destination === "audio")
  ) {
    return true;
  }

  return false;
}

/** Images (optimiseur next, R2, avatars, formats bitmap). */
function isImageRequest(url, request) {
  if (request.destination === "image") return true;
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/image")) return true;
  if (/\.(png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname)) return true;
  // Médias servis par les domaines R2 (images de chat, avatars…).
  if (/r2\.dev|r2\.cloudflarestorage|pub-[0-9a-f]+\.r2/.test(url.hostname)) return true;
  return false;
}

/** Pages auth/back-office → toujours le réseau. */
function shouldNeverCacheNavigation(pathname) {
  return NEVER_CACHE_NAV.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

/* ============================================================
   NOTIFICATIONS PUSH — repris tels quels de sw-push.js
   ============================================================ */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = JSON.parse(event.data?.text() || "{}");
  } catch {
    data = { title: "Christ Libère", body: event.data?.text() || "" };
  }

  const title = data.title || "Christ Libère";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
    tag: data.tag || "default",
    data: { url: data.url || "/app/yeshua-connect" },
    vibrate: [200, 100, 200],
    requireInteraction: data.tag === "announcements" || data.tag === "live",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/yeshua-connect";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: event.newSubscription }),
    })
  );
});
