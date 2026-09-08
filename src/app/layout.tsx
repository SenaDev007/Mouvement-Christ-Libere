import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServantProvider } from "@/components/site/servant-context";
import { ScrollProgress } from "@/components/magic/scroll-progress";
import { NextAuthProvider } from "@/components/auth/next-auth-provider";
import { LayoutShell } from "@/components/site/layout-shell";
import { PageLoader } from "@/components/site/page-loader";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // ⭐ V3.50 — Domaine canonique pour résoudre les URLs relatives des
  // métadonnées (og:image, twitter:image) en URLs absolues.
  metadataBase: new URL("https://www.mouvementchristlibere.com"),
  title: "Afrika Alkebulane Pamela Dali & Pasteur Kongo — Témoignages, enseignements",
  description:
    "Biographies, témoignages, enseignements et communauté de foi autour du ministère de Pam et du Pasteur Kongo.",
  keywords: [
    "Pam",
    "Pasteur Kongo",
    "Afrika Alkebulane Pamela Dali",
    "Yeshoua",
    "témoignages",
    "enseignements bibliques",
    "communauté de foi",
  ],
  authors: [{ name: "Mouvement Christ Libère" }],
  // ⭐ V3.50 — NOUVEAU LOGO (2026) : favicon + icônes PWA + manifest ENFIN
  // LIÉS. Le suffixe ?v=2026-09 force le re-téléchargement par les navigateurs
  // qui avaient mis en cache l'ancienne icône (cache immutable 1 an de la
  // config précédente) : le lien <link rel="icon"> émis par Next.js prend le
  // pas sur la requête conventionnelle /favicon.ico.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2026-09", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon-32.png?v=2026-09", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png?v=2026-09", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Pam & Pasteur Kongo — Au son du chofar",
    description:
      "Enseignements, témoignages et vie de communauté. Un espace de foi centralisé.",
    type: "website",
    locale: "fr_FR",
    siteName: "Mouvement Christ Libère",
    // ⭐ V3.50 — Image de partage (WhatsApp / Facebook / X) : 1200x630
    // régénérée avec le nouveau logo (avant : og-image.png jamais référencé).
    images: [
      {
        url: "/og-image.png?v=2026-09",
        width: 1200,
        height: 630,
        alt: "Mouvement Christ Libère — Pam & Pasteur Kongo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pam & Pasteur Kongo — Au son du chofar",
    description:
      "Enseignements, témoignages et vie de communauté. Un espace de foi centralisé.",
    images: ["/og-image.png?v=2026-09"],
  },
};

// ⭐ V3.41 — CLAVIER MOBILE (Yeshua Connect + tous les formulaires du
// site) : par défaut, Android Chrome fait « resizes-visual » — le clavier
// recouvre la mise en page sans la redimensionner (dvh ne suit pas le
// clavier). `interactiveWidget: "resizes-content"` fait redimensionner le
// LAYOUT (et les unités dvh) à l'ouverture du clavier → la zone de saisie
// remonte au-dessus du clavier au lieu d'être recouverte. iOS Safari
// ignore cette option (le hook visualViewport de MessagingView prend le
// relais). Aucun effet sur desktop.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  // ⭐ V3.50 — Couleur de la barre d'outils du navigateur mobile (Android
  // Chrome / Windows Phone) : pourpre profond du Mouvement, aligné sur le
  // theme_color du manifest PWA.
  themeColor: "#2A0E3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        className={`${cormorant.variable} ${inter.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <ScrollProgress />
        <PageLoader />
        <NextAuthProvider>
          <ServantProvider>
            <LayoutShell>
              {children}
            </LayoutShell>
          </ServantProvider>
        </NextAuthProvider>
        {/* ⭐ V3.24 — DOUBLE Toaster :
            1. Toaster shadcn/Radix (hook use-toast) — existant.
            2. Toaster SONNER — AJOUTÉ : les pages qui appellent
               `toast()` depuis "sonner" (ex. /register) n'étaient
               JAMAIS affichées car ce composant n'était pas monté.
               Conséquence : les erreurs de validation du formulaire
               d'inscription étaient invisibles (« le bouton Créer ne
               fait rien »). Le Toaster sonner est désormais rendu
               pour TOUS les appels toast de sonner de l'application. */}
        <Toaster />
        <SonnerToaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
