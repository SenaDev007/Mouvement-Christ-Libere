import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
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
      "Enseignements, témoignements et vie de communauté. Un espace de foi centralisé.",
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
        <PageLoader />
        <NextAuthProvider>
          <ServantProvider>
            <LayoutShell>
              {children}
            </LayoutShell>
          </ServantProvider>
        </NextAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
