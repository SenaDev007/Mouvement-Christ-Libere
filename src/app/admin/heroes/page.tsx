import { HeroesAdminClient } from "@/components/admin/heroes-admin-client";

export const dynamic = "force-dynamic";

/**
 * ⭐ V3.45 — BACK-OFFICE : SECTIONS HERO DU SITE (/admin/heroes).
 *
 * Paramétrage de toutes les bannières hero du site public :
 * landing (photo d'arrière-plan + photos de Pam et du Pasteur Kongo),
 * pages serviteurs (hero + photo + biographie complète éditable),
 * témoignages, enseignements, Bible, calendrier, vidéos, intercession,
 * dispersés, contribuer, contact, communauté, appels, sous-titrage.
 *
 * La logique vit dans heroes-admin-client.tsx (client) — les données
 * passent par l'API générique /admin/api/heroes (table HeroSection,
 * protégée par la session admin via src/proxy.ts).
 */
export default function AdminHeroesPage() {
  return <HeroesAdminClient />;
}
