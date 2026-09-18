import type { Metadata } from "next";
import { TresorerieLayoutClient } from "@/components/staff-space/tresorerie-layout-client";

/**
 * ⭐ V3.89 — PWA de la TRÉSORERIE : « Trésorerie Christ Libère ».
 *
 * Même mécanisme que le back-office (V3.80) : le layout historique était
 * un composant client (« use client ») — il ne pouvait PAS exporter de
 * metadata Next.js. Il est scindé :
 *  · CE fichier (serveur) porte les métadonnées PWA de l'espace ;
 *  · src/components/staff-space/tresorerie-layout-client.tsx (client)
 *    contient la navigation et tout le rendu (code inchangé).
 *
 * Manifest dédié public/manifest-tresorerie.webmanifest :
 *  · name « Trésorerie Christ Libère », start_url /tresorerie/dashboard,
 *    scope /tresorerie/ → l'app installée ouvre directement le tableau de
 *    bord de la trésorerie ; la navigation hors de l'espace s'ouvre dans
 *    un onglet navigateur classique (jamais piégée dans la fenêtre).
 *  · Installable sur smartphone ET desktop (bouton « Installer
 *    l'application » dans le pied de la sidebar — V3.89).
 *  · iOS : appleWebApp capable → « Ajouter à l'écran d'accueil » ouvre
 *    l'espace plein écran (standalone).
 */
export const metadata: Metadata = {
  manifest: "/manifest-tresorerie.webmanifest",
  // ⭐ V3.93 — Spéc SEO : NOINDEX (meta) en plus de l'en-tête X-Robots-Tag
  // (next.config.ts) — journal financier hautement confidentiel.
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trésorerie Christ Libère",
  },
  applicationName: "Trésorerie Christ Libère",
};

export default function TresorerieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TresorerieLayoutClient>{children}</TresorerieLayoutClient>;
}
