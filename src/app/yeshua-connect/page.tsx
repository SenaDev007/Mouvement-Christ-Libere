import { YeshuaConnect } from "@/components/yeshua-connect/YeshuaConnect";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const revalidate = 30; // Cache 30s au lieu de force-dynamic (évite cold start DB)

/**
 * Yeshua Connect — Page de messagerie.
 * ⚠️ Accès réservé aux utilisateurs connectés uniquement.
 * Redirection vers /login si non authentifié.
 */
export default async function YeshuaConnectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/yeshua-connect");
  }

  return <YeshuaConnect />;
}
