import Link from "next/link";
import { db } from "@/lib/db";
import {
  Heart,
  Coins,
  TrendingUp,
  Calendar,
  MessageSquare,
  Mail,
  Clock,
  ShieldCheck,
  ArrowLeftRight,
  Wallet,
  CircleDashed,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * ⭐ V3.82 — Back-office des dons : refonte pour les passerelles réelles.
 *
 * La page publique /contribuer crée des dons catégorisés (offrande /
 * dîme / don) via FedaPay (Afrique de l'Ouest) ou Paystack
 * (international) ; le webhook signé les confirme, crée l'écriture de
 * recette correspondante dans la trésorerie (caisse « Dons en ligne »)
 * et envoie le reçu par email. Cette page rend TOUT clair : statut du
 * paiement, catégorie, passerelle, référence, montant par devise.
 */

// ── Formatage par devise ──

function formaterMontant(montant: number, devise: string): string {
  if (devise === "XOF") {
    const entier = Math.round(Math.abs(montant))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
    return `${entier}\u00A0FCFA`;
  }
  if (devise === "USD") return `${montant.toFixed(2)} $`;
  return `${montant.toFixed(2)} €`;
}

const LIBELLES_STATUT: Record<string, string> = {
  pending: "En attente",
  approved: "Confirmé",
  failed: "Échoué",
};

const COULEURS_STATUT: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  approved: "bg-state-success/15 text-state-success border-state-success/40",
  failed: "bg-red-400/15 text-red-400 border-red-400/30",
};

const LIBELLES_TYPE: Record<string, string> = {
  offrande: "Offrande",
  dime: "Dîme",
  don: "Don",
};

const COULEURS_TYPE: Record<string, string> = {
  offrande: "bg-[#C9A227]/15 text-[#DDBE55] border-[#C9A227]/40",
  dime: "bg-[#8C5FA8]/15 text-[#C9AEE3] border-[#8C5FA8]/40",
  don: "bg-[#5B7052]/15 text-[#A3C9B0] border-[#5B7052]/40",
};

const LIBELLES_PROVIDER: Record<string, string> = {
  fedapay: "FedaPay",
  paystack: "Paystack",
};

type StatutFiltre = "" | "pending" | "approved" | "failed";

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const filtre: StatutFiltre = ["pending", "approved", "failed"].includes(
    statut || ""
  )
    ? (statut as StatutFiltre)
    : "";

  const dons = await db.donation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    ...(filtre ? { where: { statut: filtre } } : {}),
  });

  // ── Statistiques (les montants ne se mélangent jamais entre devises) ──
  const maintenant = new Date();
  const parDevise = new Map<string, { total: number; nb: number }>();
  const parType = new Map<string, { total: number; nb: number }>();
  const parProvider = new Map<string, number>();
  let nbEnAttente = 0;
  let nbEchoues = 0;
  const totalCeMoisParDevise = new Map<string, number>();

  for (const d of dons) {
    if (d.statut === "approved") {
      const devise = parDevise.get(d.currency) || { total: 0, nb: 0 };
      devise.total += d.amount;
      devise.nb += 1;
      parDevise.set(d.currency, devise);

      const type = parType.get(d.typeDon || "don") || { total: 0, nb: 0 };
      type.total += d.amount;
      type.nb += 1;
      parType.set(d.typeDon || "don", type);

      if (d.provider) {
        parProvider.set(d.provider, (parProvider.get(d.provider) || 0) + 1);
      }

      const dateDon = new Date(d.createdAt);
      if (
        dateDon.getMonth() === maintenant.getMonth() &&
        dateDon.getFullYear() === maintenant.getFullYear()
      ) {
        totalCeMoisParDevise.set(
          d.currency,
          (totalCeMoisParDevise.get(d.currency) || 0) + d.amount
        );
      }
    } else if (d.statut === "pending") {
      nbEnAttente += 1;
    } else if (d.statut === "failed") {
      nbEchoues += 1;
    }
  }

  const nbConfirmes = [...parDevise.values()].reduce((somme, v) => somme + v.nb, 0);
  const resumeDevise = [...parDevise.entries()]
    .map(([devise, v]) => `${formaterMontant(v.total, devise)}`)
    .join(" + ");
  const resumeMois = [...totalCeMoisParDevise.entries()]
    .map(([devise, total]) => `${formaterMontant(total, devise)}`)
    .join(" + ");

  const totalPourRatio = [...parType.values()].reduce((s, v) => s + v.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-1">
          Contributions financières
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]"
         
        >
          Dons
        </h1>
        <p className="text-sm text-[#BDB4C9] mt-1">
          Dons reçus via la page publique « Contribuer » — offrandes, dîmes et
          dons, catégorisés dès le paiement.
        </p>
      </div>

      {/* Note trésorerie */}
      <div className="bg-[#1A0826]/70 rounded-2xl border border-[#C9A227]/40 shadow-lg p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#C9A227]/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#C9A227]" />
        </div>
        <div className="text-sm leading-relaxed">
          <p className="font-semibold text-[#FAF6EF] mb-0.5">
            Passerelles réelles : FedaPay (Afrique de l&apos;Ouest) et Paystack (international)
          </p>
          <p className="text-[#BDB4C9]">
            Chaque paiement confirmé (statut « Confirmé ») est automatiquement
            enregistré dans la trésorerie : recette catégorisée (offrande, dîme
            ou don) dans la caisse « Dons en ligne (FedaPay / Paystack) », et le
            reçu est envoyé par email au donateur.{" "}
            {/* ⭐ V3.83 — Lien corrigé : l'ancien href /tresorerie/transactions
                était réécrit en /admin/tresorerie/transactions par le proxy du
                sous-domaine admin → 404. La page de consultation (lecture
                seule, super admins) vit désormais à cette adresse. */}
            <Link
              href="/admin/tresorerie/transactions"
              className="font-semibold text-[#DDBE55] hover:underline"
            >
              Voir le journal de la trésorerie
            </Link>
          </p>
        </div>
      </div>

      {/* Stats cards premium */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <CheckCircle2 className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-2xl font-bold font-serif text-[#FAF6EF]">{nbConfirmes}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#BDB4C9] font-semibold mt-0.5">
            Dons confirmés{nbEnAttente > 0 ? ` · ${nbEnAttente} en attente` : ""}
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C]" />
          <Coins className="w-4 h-4 text-[#C9A227] mb-2" />
          <div className="text-lg md:text-2xl font-bold font-serif text-[#FAF6EF] leading-tight">
            {resumeDevise || "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[#BDB4C9] font-semibold mt-0.5">
            Total accumulé (confirmé)
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#8C5FA8]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8C5FA8] to-[#6B4480]" />
          <Calendar className="w-4 h-4 text-[#C9AEE3] mb-2" />
          <div className="text-lg md:text-2xl font-bold text-[#C9AEE3] leading-tight">
            {resumeMois || "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[#C9AEE3] font-semibold mt-0.5">
            Ce mois-ci (confirmé)
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#5B7052]/30 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5B7052] to-[#3F5039]" />
          <TrendingUp className="w-4 h-4 text-[#A3C9B0] mb-2" />
          <div className="text-lg md:text-2xl font-bold text-[#A3C9B0] leading-tight">
            {nbEchoues > 0 ? `${nbEchoues} échoué${nbEchoues > 1 ? "s" : ""}` : "Aucun échec"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[#A3C9B0] font-semibold mt-0.5">
            Paiements non aboutis
          </div>
        </div>
      </div>

      {/* Répartition par catégorie + passerelle */}
      {(parType.size > 0 || parProvider.size > 0) && (
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 md:col-span-2">
            <h2 className="font-bold text-sm text-[#FAF6EF] flex items-center gap-2 mb-3">
              <ArrowLeftRight className="w-4 h-4 text-[#C9A227]" />
              Répartition par catégorie (confirmés)
            </h2>
            <div className="space-y-2.5">
              {["offrande", "dime", "don"].map((type) => {
                const v = parType.get(type);
                const ratio =
                  v && totalPourRatio > 0 ? (v.total / totalPourRatio) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-[#FAF6EF]">
                        {LIBELLES_TYPE[type]}
                        {v ? (
                          <span className="text-[#BDB4C9] font-normal">
                            {" "}
                            · {v.nb} don{v.nb > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-bold text-[#DDBE55]">
                        {v ? formaterMontant(v.total, "XOF") : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#FAF6EF]/10 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          type === "offrande" && "bg-[#C9A227]",
                          type === "dime" && "bg-[#8C5FA8]",
                          type === "don" && "bg-[#5B7052]"
                        )}
                        style={{ width: `${Math.max(ratio, v ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
            <h2 className="font-bold text-sm text-[#FAF6EF] flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[#C9A227]" />
              Passerelles (confirmés)
            </h2>
            <div className="space-y-2">
              {["fedapay", "paystack"].map((provider) => (
                <div
                  key={provider}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-[#FAF6EF]">
                    {LIBELLES_PROVIDER[provider]}
                  </span>
                  <span className="font-bold text-[#DDBE55]">
                    {parProvider.get(provider) || 0}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-[#BDB4C9] leading-relaxed pt-1">
                Les dons sans passerelle indiquée proviennent de saisies
                antérieures à V3.82.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtre statut */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { valeur: "", libelle: "Tous" },
          { valeur: "pending", libelle: "En attente" },
          { valeur: "approved", libelle: "Confirmés" },
          { valeur: "failed", libelle: "Échoués" },
        ].map((f) => (
          <Link
            key={f.valeur || "tous"}
            href={f.valeur ? `/admin/donations?statut=${f.valeur}` : "/admin/donations"}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              filtre === f.valeur
                ? "bg-[#C9A227] text-[#FAF6EF] border-[#C9A227]"
                : "bg-[#1A0826]/70 text-[#BDB4C9] border-[#C9A227]/25 hover:border-[#C9A227]/60"
            )}
          >
            {f.libelle}
          </Link>
        ))}
      </div>

      {/* Liste complète */}
      <div className="space-y-3">
        {dons.length === 0 ? (
          <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-dashed border-[#C9A227]/30 p-12 text-center">
            <Heart className="w-10 h-10 text-[#FAF6EF]/20 mx-auto mb-3" />
            <p className="text-sm text-[#BDB4C9] italic">
              Aucun don pour l&apos;instant.
            </p>
          </div>
        ) : (
          dons.map((d) => (
            <div
              key={d.id}
              className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-3">
                {/* Icône don */}
                <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 text-[#C9A227]" />
                </div>

                {/* Contenu */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-[#FAF6EF]">
                        {d.isAnonymous ? "Don anonyme" : d.donorName || d.donorEmail || "Donateur"}
                      </h3>
                      {!d.isAnonymous && d.donorEmail && (
                        <a
                          href={`mailto:${d.donorEmail}`}
                          className="inline-flex items-center gap-1 text-xs text-[#C9AEE3] hover:underline mt-0.5"
                        >
                          <Mail className="w-3 h-3" />
                          {d.donorEmail}
                        </a>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-[#DDBE55]">
                        {formaterMontant(d.amount, d.currency)}
                      </div>
                    </div>
                  </div>

                  {/* Badges : statut · catégorie · passerelle · référence */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        COULEURS_STATUT[d.statut] || "bg-[#FAF6EF]/10 text-[#BDB4C9] border-[#C9A227]/25"
                      )}
                    >
                      {d.statut === "pending" && (
                        <CircleDashed className="w-3 h-3" />
                      )}
                      {d.statut === "approved" && (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {d.statut === "failed" && <XCircle className="w-3 h-3" />}
                      {LIBELLES_STATUT[d.statut] || d.statut}
                    </span>
                    {d.typeDon && (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          COULEURS_TYPE[d.typeDon] || "bg-[#FAF6EF]/10 text-[#BDB4C9] border-[#C9A227]/25"
                        )}
                      >
                        {LIBELLES_TYPE[d.typeDon] || d.typeDon}
                      </span>
                    )}
                    {d.provider && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3D1A54] text-[#C9A227]">
                        {LIBELLES_PROVIDER[d.provider] || d.provider}
                      </span>
                    )}
                    {d.reference && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-[#BDB4C9] bg-[#FAF6EF]/10">
                        {d.reference}
                      </span>
                    )}
                    {d.recurrent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8C5FA8]/15 text-[#C9AEE3] border border-[#8C5FA8]/30">
                        Récurrent
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  {d.message && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/10 flex items-start gap-2">
                      <MessageSquare className="w-3 h-3 text-[#BDB4C9] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#FAF6EF]/70 italic line-clamp-2">
                        {d.message}
                      </p>
                    </div>
                  )}

                  {/* Date + confirmation */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#BDB4C9] mt-2">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(d.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {d.confirmedAt && (
                      <span className="inline-flex items-center gap-1 text-state-success">
                        <CheckCircle2 className="w-3 h-3" />
                        Payé le{" "}
                        {new Date(d.confirmedAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Suppression en pied de carte, pleine largeur */}
              <div className="mt-2 pt-2 border-t border-[#C9A227]/10 flex items-center justify-end">
                <DeleteButton entity="donations" id={d.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
