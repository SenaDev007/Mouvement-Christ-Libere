import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Vidéos & Lives.
 * RÉUTILISE la page du site public (lecteur vidéo, catégories,
 * lives) → les vidéos se lisent dans l'application, et tout ce qui
 * est publié au back-office apparaît automatiquement.
 */
export { default } from "@/app/videos/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vidéos & Lives",
  robots: { index: false, follow: false },
  alternates: { canonical: "/videos" },
};
