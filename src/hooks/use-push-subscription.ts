"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";

/**
 * usePushSubscription — Hook pour gérer l'abonnement aux notifications push.
 *
 * - Récupère la clé publique VAPID depuis /api/push/vapid
 * - Enregistre le service worker /sw-app.js ⭐ V4.10 (qui remplace
 *   sw-push.js : il reprend ses handlers push ET ajoute le mode hors
 *   ligne — un seul service worker à la fois sur le scope /)
 * - Subscribe l'utilisateur via PushManager
 * - Envoie la subscription au backend via /api/push/subscribe
 * - Fournit des méthodes subscribe() / unsubscribe()
 *
 * Usage:
 *   const { isSubscribed, subscribe, unsubscribe } = usePushSubscription();
 */

export function usePushSubscription() {
  const { data: session } = useSession();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!session?.user?.id || typeof window === "undefined") return;

    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-app.js");
      if (!reg) return;

      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      // SW not supported
    }
  }, [session]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const subscribe = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch VAPID public key
      const vapidRes = await fetch(api.url("/api/push/vapid"));
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error("Clé VAPID non disponible");

      // 2. Register service worker (⭐ V4.10 : sw-app.js — push + hors ligne)
      const reg = await navigator.serviceWorker.register("/sw-app.js", {
        scope: "/",
      });

      // 3. Subscribe via PushManager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Send subscription to backend
      const res = await fetch(api.url("/api/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });

      if (!res.ok) throw new Error("Échec de l'enregistrement");
      setIsSubscribed(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'abonnement");
    } finally {
      setLoading(false);
    }
  }, [session]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-app.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      await fetch(api.url("/api/push/subscribe"), { method: "DELETE" });
      setIsSubscribed(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSubscribed, loading, error, subscribe, unsubscribe };
}

// Helper: convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
