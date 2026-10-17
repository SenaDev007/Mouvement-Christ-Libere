import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Adoration & Louanges.
 * RÉUTILISE la page du site public (lecteur audio des chants)
 * → les louanges se lisent dans l'application, à l'identique du site.
 */
export { default } from "@/app/adoration-louanges/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Adoration & Louanges",
  robots: { index: false, follow: false },
  alternates: { canonical: "/adoration-louanges" },
};
