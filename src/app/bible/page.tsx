/**
 * ============================================================
 * PAGE /bible — Bible du Royaume
 * ============================================================
 *
 * ⭐ La logique complète vit désormais dans le composant réutilisable
 *    <BibleWorkspace /> (src/components/bible/BibleWorkspace.tsx)
 *    afin de pouvoir être EMBARQUÉE dans Yeshua Connect et dans la
 *    communauté (mode "embedded") sans quitter la conversation.
 *
 *    Cette page reste la version pleine page (navbar principale).
 */

import { BibleWorkspace } from "@/components/bible/BibleWorkspace";

export default function BiblePage() {
  return <BibleWorkspace />;
}
