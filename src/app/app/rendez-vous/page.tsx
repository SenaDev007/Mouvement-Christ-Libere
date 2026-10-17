import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Demander un rendez-vous.
 * RÉUTILISE la page du site public (formulaire + suivi de demande,
 * porte d'entrée du secrétariat).
 */
export { default } from "@/app/rendez-vous/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demander un rendez-vous",
  robots: { index: false, follow: false },
  alternates: { canonical: "/rendez-vous" },
};
