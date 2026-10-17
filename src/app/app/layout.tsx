import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

/**
 * ⭐ V4.09 — APPLICATION MOBILE « CHRIST LIBÈRE » (/app/*).
 *
 * L'application complète du Mouvement : page principale + toutes les
 * sections du site public (Serviteurs, Témoignages, Enseignements,
 * Vidéos & Lives, Adoration & Louanges, Intercession, Dispersés
 * d'Isolélé (Israël), Contribuer, Annonces, Rendez-vous) + Yeshua
 * Connect (le canal de communication), le tout connecté au back-office.
 *
 * Les pages de sections RÉUTILISENT les composants du site public
 * (mêmes vues, mêmes données force-dynamic) : ce qui est publié dans le
 * back-office se met à jour automatiquement, à l'identique du site.
 *
 * SEO : les pages /app/* ne sont PAS indexées (le site public est la
 * version canonique) — robots noindex + canonical vers la page public.
 */
export const metadata: Metadata = {
  title: {
    default: "Christ Libère — Application",
    template: "%s | Christ Libère",
  },
  applicationName: "Christ Libère",
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
