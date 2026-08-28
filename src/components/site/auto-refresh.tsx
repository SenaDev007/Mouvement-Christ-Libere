"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * AutoRefresh — rafraîchit automatiquement la page côté serveur
 * sans recharger entièrement le navigateur.
 * 
 * Utilise router.refresh() de Next.js qui régénère les Server Components
 * sans perdre l'état client.
 * 
 * @param intervalMs - intervalle en millisecondes (défaut: 30s)
 */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Rafraîchir immédiatement au montage (pour capter les changements récents)
    router.refresh();

    // Puis à intervalle régulier
    timerRef.current = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router, intervalMs]);

  return null;
}
