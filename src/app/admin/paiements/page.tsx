import { cookies } from "next/headers";
import { Lock } from "lucide-react";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { lireSessionStaff } from "@/lib/staff-space/session";
import { lireEtatPasserelles } from "@/lib/payments/gateway-config";
import { urlSite } from "@/lib/payments/payment-types";
import { PaiementsClient } from "@/components/admin/paiements-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * ⭐ V3.83 — Back-office : configuration des passerelles de paiement.
 *
 * Directive : « les administrateurs Pastor Congo et Afrika doivent avoir
 * un module pour paramétrer et configurer les méthodes de paiement,
 * FedaPay ainsi que Paystack. On doit pouvoir configurer toutes les clés
 * API et webhooks depuis le back-office ».
 *
 * Réservé aux SUPER_ADMIN (les deux serviteurs de Dieu) : les clés
 * secrètes sont chiffrées (AES-256-GCM) et ne sont JAMAIS réaffichées —
 * seuls leurs 4 derniers caractères servent de rappel visuel.
 */
export default async function AdminPaiementsPage() {
  // Garde de rôle : seuls les serviteurs de Dieu configurent les paiements.
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? lireSessionStaff(token) : null;

  if (!session || session.role !== "SUPER_ADMIN") {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[#DDBE55]" />
        </div>
        <h1 className="text-xl font-bold font-serif text-[#FAF6EF] mb-2">
          Configuration réservée aux serviteurs de Dieu
        </h1>
        <p className="text-sm text-[#BDB4C9] leading-relaxed">
          Seuls les comptes super administrateurs (Pasteur Kongo et Sœur
          Afrika) peuvent configurer les clés des passerelles de paiement.
        </p>
      </div>
    );
  }

  const etats = await lireEtatPasserelles();

  return (
    <PaiementsClient
      etats={etats}
      webhooks={{
        fedapay: `${urlSite()}/api/webhooks/fedapay`,
        paystack: `${urlSite()}/api/webhooks/paystack`,
      }}
    />
  );
}
