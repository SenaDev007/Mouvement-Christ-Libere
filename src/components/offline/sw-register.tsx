"use client";

/**
 * ⭐ V4.10 — Enregistrement du service worker « Christ Libère ».
 *
 * Monté UNE fois dans le layout racine (site + application) :
 * enregistre /sw-app.js (scope /) → mode hors ligne + notifications push.
 *
 * Le fichier /sw-app.js REMPLACE sw-push.js : il reprend ses handlers de
 * notifications ET ajoute les stratégies de cache hors ligne. Les clients
 * qui avaient sw-push.js basculent automatiquement (skipWaiting +
 * clients.claim côté SW).
 *
 * Le rendu est nul — ce composant n'a AUCUN impact visuel.
 */

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw-app.js", { scope: "/" })
        .catch((e) => {
          // Échec non bloquant : l'app fonctionne simplement sans cache
          // hors ligne (en ligne, tout marche pareil).
          console.warn("[sw] Enregistrement impossible :", e);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
