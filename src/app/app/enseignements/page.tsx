import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Enseignements.
 * RÉUTILISE la page du site public (même vue, mêmes données
 * force-dynamic) → mise à jour automatique depuis le back-office.
 */
export { default } from "@/app/enseignements/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enseignements",
  robots: { index: false, follow: false },
  alternates: { canonical: "/enseignements" },
};
