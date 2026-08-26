"use client";

import { usePathname } from "next/navigation";
import { CinematicFooter } from "@/components/ui/motion-footer";

/**
 * Affiche le CinematicFooter SAUF sur les routes où on ne le veut pas.
 *
 * Routes sans footer :
 *   - /yeshua-connect  (le chat remplit tout l'écran, pas de footer)
 */
export function ConditionalFooter() {
  const pathname = usePathname();

  // Pas de footer sur Yeshua Connect (chat plein écran)
  if (pathname?.startsWith("/yeshua-connect")) {
    return null;
  }

  return <CinematicFooter />;
}
