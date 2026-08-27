import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServantProvider } from "@/components/site/servant-context";
import { ScrollProgress } from "@/components/magic/scroll-progress";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";
import { NextAuthProvider } from "@/components/auth/next-auth-provider";
import { LiveAnnouncementBar } from "@/components/site/live-announcement-bar";

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
        className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col`}
        style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', var(--font-inter), sans-serif" }}
      >
        <ScrollProgress />
        <NextAuthProvider>
          <ServantProvider>
            {/* Navbar fixe en haut */}
            <ContextualNav />
            {/* Barre d'annonce live — positionnée sous la navbar fixe */}
            <div className="fixed top-16 md:top-20 left-0 right-0 z-40">
              <LiveAnnouncementBar />
            </div>
            {/* Padding-top compense navbar (64-80px) + barre live (~49px si visible) */}
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
