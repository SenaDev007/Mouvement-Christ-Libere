import { YeshuaConnect } from "@/components/yeshua-connect/YeshuaConnect";

export const dynamic = "force-dynamic";

/**
 * ⭐ Yeshua Connect — Page de messagerie WhatsApp-style.
 *
 * Pas de header dédié (la navbar principale TubelightNav du layout suffit).
 * Pas de footer (masqué conditionnellement dans le layout pour cette route).
 * Pas de données mock — tout vient de l'API /api/yeshua-connect/*.
 */
export default function YeshuaConnectPage() {
  return <YeshuaConnect />;
}
