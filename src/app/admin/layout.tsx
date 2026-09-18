import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * ⭐ V3.80 — PWA du BACK-OFFICE : « Back-office Christ Libère ».
 *
 * L'ancien layout admin était un composant client (« use client ») — il ne
 * pouvait PAS exporter de metadata Next.js. Il est scindé :
 *  · CE fichier (serveur) porte les métadonnées PWA du back-office ;
 *  · src/components/admin/admin-shell.tsx (client) contient la sidebar et
 *    tout le rendu (code inchangé + bouton « Installer l'application »).
 *
 * Deux applications distinctes, MÊME logo (icônes du manifest = logo du site) :
 *  · site public  → manifest.webmanifest « Site public Christ Libère »
 *    (lié par le layout racine) ;
 *  · back-office  → manifest-back-office.webmanifest « Back-office Christ
 *    Libère » (lié ICI — la fusion des metadata Next.js fait gagner le
 *    manifest du segment le plus profond sur toutes les pages /admin/*,
 *    y compris /admin/login, point d'installation le plus fréquent).
 *
 * start_url = /admin/dashboard → l'app installée ouvre directement le
 * dashboard (l'hôte admin.mouvementchristlibere.com comme le www) ;
 * scope /admin/ → la navigation hors back-office s'ouvre dans un onglet
 * navigateur classique (jamais piégée dans la fenêtre de l'app).
 */
export const metadata: Metadata = {
  manifest: "/manifest-back-office.webmanifest",
  // ⭐ V3.93 — Spéc SEO : NOINDEX en plus de l'en-tête X-Robots-Tag
  // (next.config.ts). La balise meta protège même si un lien externe
  // pointe directement vers www.mouvementchristlibere.com/admin/*
  // (le header host-conditionnel ne s'applique qu'au sous-domaine admin).
  robots: { index: false, follow: false },
  appleWebApp: {
    // iOS « Ajouter à l'écran d'accueil » → ouverture plein écran (standalone)
    // avec le titre « Back-office Christ Libère ».
    capable: true,
    statusBarStyle: "default",
    title: "Back-office Christ Libère",
  },
  applicationName: "Back-office Christ Libère",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
