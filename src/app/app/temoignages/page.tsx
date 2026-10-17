import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Témoignages.
 * RÉUTILISE la page du site public (même vue, mêmes données
 * force-dynamic) → mise à jour automatique depuis le back-office.
 */
export { default } from "@/app/temoignages/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Témoignages",
  robots: { index: false, follow: false },
  alternates: { canonical: "/temoignages" },
};
