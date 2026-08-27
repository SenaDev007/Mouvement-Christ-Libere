import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServantProvider } from "@/components/site/servant-context";
import { ScrollProgress } from "@/components/magic/scroll-progress";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";
import { NextAuthProvider } from "@/components/auth/next-auth-provider";
import { LiveAnnouncementBar } from "@/components/site/live-announcement-bar";

const playfair = Playfair_Display({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Christ Libère — Pam & Pasteur Kongo | Témoignages, enseignements, communauté",
  description:
    "Christ Libère : biographies, témoignages, enseignements et communauté de foi autour du ministère de Pam et du Pasteur Kongo.",
  keywords: [
    "Christ Libère",
    "Pam",
    "Pasteur Kongo",
    "Afrika Alkebulane Pamela Dali",
    "Yeshoua",
    "témoignages",
    "enseignements bibliques",
    "communauté de foi",
  ],
  authors: [{ name: "Christ Libère" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Christ Libère — Pam & Pasteur Kongo",
    description:
      "Enseignements, témoignages et vie de communauté. Un espace de foi centralisé.",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Christ Libère — Pam & Pasteur Kongo",
    description:
      "Enseignements, témoignages et vie de communauté. Un espace de foi centralisé.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${inter.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <ScrollProgress />
        <NextAuthProvider>
          <ServantProvider>
            {/* ⭐ Navbar fixe en haut */}
            <ContextualNav />
            {/* ⭐ Barre d'annonce live (entre navbar et contenu) */}
            <LiveAnnouncementBar />
            {/* Padding-top pour la navbar fixe */}
            <main className="flex-1 pt-16 md:pt-20">{children}</main>
            <ConditionalFooter />
          </ServantProvider>
        </NextAuthProvider>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
