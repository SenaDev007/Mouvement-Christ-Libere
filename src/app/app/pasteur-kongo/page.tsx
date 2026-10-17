import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Pasteur Kongo.
 * RÉUTILISE la page du site public (même vue, mêmes données
 * force-dynamic) → mise à jour automatique depuis le back-office.
 */
export { default } from "@/app/pasteur-kongo/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pasteur Kongo",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pasteur-kongo" },
};
