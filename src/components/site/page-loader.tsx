"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * PageLoader — barre de progression fine en haut de l'écran.
 *
 * AVANT : overlay plein écran z-[9999] qui masquait toute la page pendant
 * un setTimeout hardcoded de 5 secondes à chaque changement de pathname.
 * Conséquence : quand l'utilisateur cliquait sur "Rejoindre le live",
 * il voyait un écran violet pendant 5 s — perçu comme "ça ne répond pas".
 *
 * MAINTENANT : une simple barre dorée de 2 px en haut, qui apparaît
 * immédiatement à chaque navigation et disparaît dès que la nouvelle
 * page a fini de se rendre (au pire ~800 ms, assez court pour ne pas
 * bloquer l'utilisateur).
 *
 * Comportement :
 *  - Au montage initial : pas de barre (évite le flash au premier load)
 *  - À chaque changement de pathname : barre visible
 *  - Se retire après 800 ms (correspond à la durée typique d'une navigation
 *    App Router côté client) ou dès qu'un nouveau changement arrive
 */
export function PageLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const isFirstLoadRef = useRef(true);
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Ne pas déclencher la barre au tout premier rendu (la page est en cours
    // de chargement côté navigateur, ce n'est pas une navigation utilisateur).
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevPathRef.current = pathname;
      return;
    }
    // Ne pas déclencher si le pathname n'a pas réellement changé
    // (effet qui se ré-exécute pour une autre raison).
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    setLoading(true);
    // Durée courte : la navigation App Router est généralement < 500 ms.
    // On garde une marge pour les cas où la SSR est un peu lente, mais
    // sans bloquer l'UI — la barre est juste un indicateur visuel en haut.
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-[#C9A227] origin-left"
          style={{ boxShadow: "0 0 8px rgba(201, 162, 39, 0.6)" }}
        >
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-[#C9A227] via-[#DDBE55] to-[#C9A227]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
