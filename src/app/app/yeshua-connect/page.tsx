import { YeshuaConnect } from "@/components/yeshua-connect/YeshuaConnect";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * ⭐ V4.09 — APPLICATION MOBILE : Yeshua Connect, le canal de
 * communication — la raison d'être initiale de l'application, désormais
 * intégré à la structure complète (page principale + sections).
 *
 * ⚠️ Accès réservé aux utilisateurs connectés ; la redirection ramène
 * DANS l'application (callbackUrl=/app/yeshua-connect) après connexion.
 *
 * NB : l'en-tête de l'app fait exactement 4rem (mobile) / 5rem (md),
 * comme la navbar du site — MessagingView calcule sa hauteur sur ces
 * valeurs, le chat remplit donc l'écran sans débordement.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yeshua Connect — Chat",
  robots: { index: false, follow: false },
  alternates: { canonical: "/yeshua-connect" },
};

export default async function AppYeshuaConnectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/app/yeshua-connect");
  }

  return <YeshuaConnect />;
}
