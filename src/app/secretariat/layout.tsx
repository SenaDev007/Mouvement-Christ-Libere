import type { Metadata } from "next";
import { SecretariatLayoutClient } from "@/components/staff-space/secretariat-layout-client";

/**
 * ⭐ V3.89 — PWA du SECRÉTARIAT : « Secrétariat Christ Libère ».
 *
 * Même mécanisme que le back-office (V3.80) : le layout historique était
 * un composant client (« use client ») — il ne pouvait PAS exporter de
 * metadata Next.js. Il est scindé :
 *  · CE fichier (serveur) porte les métadonnées PWA de l'espace ;
 *  · src/components/staff-space/secretariat-layout-client.tsx (client)
 *    contient la navigation, le badge de demandes et tout le rendu
 *    (code inchangé).
 *
 * Manifest dédié public/manifest-secretariat.webmanifest :
 *  · name « Secrétariat Christ Libère », start_url
 *    /secretariat/dashboard, scope /secretariat/ → l'app installée ouvre
 *    directement le tableau de bord du secrétariat ; la navigation hors
 *    de l'espace s'ouvre dans un onglet navigateur classique.
 *  · Installable sur smartphone ET desktop (bouton « Installer
 *    l'application » dans le pied de la sidebar — V3.89).
 *  · iOS : appleWebApp capable → « Ajouter à l'écran d'accueil » ouvre
 *    l'espace plein écran (standalone).
 */
export const metadata: Metadata = {
  manifest: "/manifest-secretariat.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Secrétariat Christ Libère",
  },
  applicationName: "Secrétariat Christ Libère",
};

export default function SecretariatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SecretariatLayoutClient>{children}</SecretariatLayoutClient>;
}
