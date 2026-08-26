import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServantProvider } from "@/components/site/servant-context";
import { ScrollProgress } from "@/components/magic/scroll-progress";
import { TubelightNav } from "@/components/site/tubelight-nav";
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
  openGraph: {
    title: "Pam & Pasteur Kongo — Au son du chofar",
    description:
      "Enseignements, témoignages et vie de communauté. Un espace de foi centralisé.",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pam & Pasteur Kongo — Au son du chofar",
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
            {/* ⭐ Padding: 0 sur mobile (navbar en bas), pt-20 sur desktop (navbar en haut fixe) */}
            <main className="flex-1 pt-0 sm:pt-20">{children}</main>
            <ConditionalFooter />
            <TubelightNav />
          </ServantProvider>
        </NextAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
