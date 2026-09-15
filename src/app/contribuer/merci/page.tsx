import { ContribuerMerciView } from "@/components/site/contribuer-merci-view";

/**
 * ⭐ V3.82 — Page de confirmation d'un don.
 *
 * Le donateur y revient depuis la page de paiement du prestataire
 * (callback_url) avec ?ref=<référence interne>. La vue cliente lit le
 * statut RÉEL en base via /api/dons/statut/[reference] — jamais un
 * paramètre d'URL (règle de sécurité de la spécification).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Confirmation de votre don | Christ Libère",
  description:
    "Statut de votre paiement — offrande, dîme ou don au Mouvement Christ Libère.",
  robots: { index: false, follow: false },
};

export default function ContribuerMerciPage() {
  return <ContribuerMerciView />;
}
