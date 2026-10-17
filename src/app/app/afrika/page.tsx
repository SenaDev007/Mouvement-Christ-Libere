import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Afrika.
 * RÉUTILISE la page du site public (même vue, mêmes données
 * force-dynamic) → mise à jour automatique depuis le back-office.
 */
export { default } from "@/app/afrika/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Afrika",
  robots: { index: false, follow: false },
  alternates: { canonical: "/afrika" },
};
