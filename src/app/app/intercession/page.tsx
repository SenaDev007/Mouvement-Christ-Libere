import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : page Intercession.
 * RÉUTILISE la page du site public — y compris l'OPTION AUDIO
 * (note vocale enregistrée depuis le micro, transmise au
 * back-office) : tout fonctionne dans l'application.
 */
export { default } from "@/app/intercession/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intercession",
  robots: { index: false, follow: false },
  alternates: { canonical: "/intercession" },
};
