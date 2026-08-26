import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServantProvider } from "@/components/site/servant-context";
import { ScrollProgress } from "@/components/magic/scroll-progress";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";
import { NextAuthProvider } from "@/components/auth/next-auth-provider";

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
        className={`${cormorant.variable} ${inter.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <ScrollProgress />
        <NextAuthProvider>
          <ServantProvider>
            {/* ⭐ Nouvelle navbar fixe en haut (h-14 = 56px) */}
            <ContextualNav />
            {/* Padding-top pour la navbar fixe (56px + 8px marge) */}
            <main className="flex-1 pt-16">{children}</main>
            <ConditionalFooter />
          </ServantProvider>
        </NextAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
