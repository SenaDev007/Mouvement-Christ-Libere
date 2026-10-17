import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Annonces du ministère.
 * RÉUTILISE la page du site public (annonces officielles publiées
 * par le secrétariat) → mises à jour automatiques.
 */
export { default } from "@/app/annonces/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Annonces du ministère",
  robots: { index: false, follow: false },
  alternates: { canonical: "/annonces" },
};
