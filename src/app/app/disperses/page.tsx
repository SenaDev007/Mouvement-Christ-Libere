import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Dispersés d'Isolélé (Israël).
 * RÉUTILISE la page du site public (carte mondiale des dispersés,
 * mise à jour à chaque inscription) → identique au site public.
 */
export { default } from "@/app/disperses/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dispersés d'Isolélé (Israël)",
  robots: { index: false, follow: false },
  alternates: { canonical: "/disperses" },
};
