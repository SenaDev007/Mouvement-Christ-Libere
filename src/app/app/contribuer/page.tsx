import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Contribuer (Don & Dîme).
 * RÉUTILISE la page du site public (paiement FedaPay) → les
 * contributions se font aussi depuis l'application.
 */
export { default } from "@/app/contribuer/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contribuer",
  robots: { index: false, follow: false },
  alternates: { canonical: "/contribuer" },
};
