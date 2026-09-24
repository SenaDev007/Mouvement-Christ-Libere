import { cookies } from "next/headers";
import Link from "next/link";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  ShieldCheck,
  Eye,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Calendar,
  ExternalLink,
  Lock,
} from "lucide-react";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { lireSessionStaff } from "@/lib/staff-space/session";
import { calculerSituationMulticaisse } from "@/lib/staff-space/multicaisse";
import {
  formaterMontant,
  libelleCaisseType,
  libelleCategorie,
  MOUVEMENT_TYPES,
} from "@/lib/staff-space/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * ⭐ V3.74 — Trésorerie en CONSULTATION depuis le back-office des
 * serviteurs de Dieu.
 *
 * Directive : « le pasteur Congo et la sœur Afrika doivent pouvoir jeter un
 * coup d'œil à la trésorerie depuis leur back-office, sans devoir entrer
 * dans l'espace Trésorerie ou Secrétariat ». Cette page est donc :
 *  · LECTURE SEULE — aucune saisie, aucun bouton d'action ;
 *  · réservée aux SUPER_ADMIN (les deux serviteurs de Dieu) — données
 *    financières sensibles ;
 *  · calculée en direct depuis le journal (mêmes fonctions que l'espace
 *    Trésorerie : situation multicaisse, soldes jamais stockés).
 * La gestion complète (journal, caisses, transferts, rapports) reste dans
 * l'espace dédié tresorerie.mouvementchristlibere.com.
 */
export default async function AdminTresorerieConsultationPage() {
  // Garde de rôle : seuls les serviteurs de Dieu (SUPER_ADMIN) consultent.
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
          Consultation réservée aux serviteurs de Dieu
        </h1>
        <p className="text-sm text-[#BDB4C9] leading-relaxed">
          La situation de trésorerie n&apos;est visible que par les comptes
          super administrateurs (Pasteur Kongo et Sœur Afrika). Le trésorier
          gère les mouvements depuis l&apos;espace Trésorerie dédié.
        </p>
      </div>
    );
  }

  await ensureStaffSpaces();

  const [situation, dernieres] = await Promise.all([
    calculerSituationMulticaisse(),
    db.treasuryTransaction.findMany({
      orderBy: { date: "desc" },
      take: 12,
      select: {
        id: true,
        type: true,
        category: true,
        amount: true,
        currency: true,
        label: true,
        date: true,
        caisseId: true,
      },
    }),
  ]);

  // Totaux du MOIS en cours (mouvements réels, transferts exclus).
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const mouvementsMois = await db.treasuryTransaction.findMany({
    where: { date: { gte: debutMois }, type: { in: ["RECETTE", "DEPENSE"] } },
    select: { type: true, amount: true },
  });
  const recettesMois = mouvementsMois
    .filter((m) => m.type === "RECETTE")
    .reduce((s, m) => s + m.amount, 0);
  const depensesMois = mouvementsMois
    .filter((m) => m.type === "DEPENSE")
    .reduce((s, m) => s + m.amount, 0);

  const nomsCaisses = new Map(situation.caisses.map((c) => [c.id, c.name]));
  const caissesActives = situation.caisses.filter((c) => c.isActive);

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] bg-grain-dark p-6 md:p-8 text-white shadow-xl border border-[#C9A227]/15">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none animate-pulse-slow" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Consultation — lecture seule
            </p>
            <h1 className="text-2xl md:text-3xl font-bold font-serif mb-1">
              Trésorerie du ministère
            </h1>
            <p className="text-sm text-white/70 max-w-xl">
              Situation consolidée des caisses, calculée en direct depuis le
              journal comptable — {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
            </p>
          </div>
          <a
            href="https://tresorerie.mouvementchristlibere.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A0826]/10 backdrop-blur-sm border border-white/10 text-xs font-semibold hover:bg-[#1A0826]/15 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Espace Trésorerie (gestion)
          </a>
        </div>
      </div>

      {/* Bandeau lecture seule */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/30 text-sm text-[#FAF6EF]/80">
        <ShieldCheck className="w-4 h-4 text-[#DDBE55] flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Vous consultez la trésorerie en simple coup d&apos;œil. La saisie
          des mouvements, les transferts entre caisses et les rapports
          officiels se gèrent dans l&apos;<strong>espace Trésorerie</strong>{" "}
          (connexion séparée du trésorier).
        </p>
      </div>

      {/* Soldes consolidés par devise */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-3 px-1">
          Soldes consolidés
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {situation.consolide.length === 0 && (
            <div className="col-span-full bg-[#1A0826]/70 rounded-2xl shadow-lg border border-dashed border-[#C9A227]/30 p-8 text-center">
              <PiggyBank className="w-8 h-8 text-[#FAF6EF]/25 mx-auto mb-2" />
              <p className="text-sm text-[#BDB4C9]">
                Aucune caisse enregistrée pour l&apos;instant.
              </p>
            </div>
          )}
          {situation.consolide.map((c) => (
            <div
              key={c.devise}
              className="group relative bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A227] to-[#A3821C] opacity-80" />
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-[#C9A227]/10">
                  <Wallet className="w-4 h-4 text-[#FAF6EF]" />
                </div>
                <span className="text-[10px] text-[#BDB4C9] font-semibold">
                  {c.nbCaisses} caisse{c.nbCaisses > 1 ? "s" : ""}
                </span>
              </div>
              <div className="text-2xl font-bold font-serif text-[#FAF6EF] leading-tight">
                {formaterMontant(c.solde, c.devise)}
              </div>
              <div className="text-[11px] text-[#BDB4C9] mt-0.5">
                Total {c.devise}
                {c.soldeNonAffecte !== 0 && (
                  <span className="block text-[10px] text-[#DDBE55]">
                    dont {formaterMontant(c.soldeNonAffecte, c.devise)} non affecté
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {!situation.coherent && (
          <p className="text-[11px] text-[#E08B6D] mt-2 px-1">
            ⚠ Contrôle de cohérence interne en écart — le trésorier doit
            vérifier le journal.
          </p>
        )}
      </div>

      {/* Mois en cours */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#5B7052]/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-[#5B7052]/10">
              <TrendingUp className="w-3.5 h-3.5 text-[#A3C9B0]" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-[#A3C9B0] font-bold">
              Recettes du mois
            </span>
          </div>
          <p className="text-xl font-bold text-[#A3C9B0]">
            {formaterMontant(recettesMois, "EUR")}
          </p>
          <p className="text-[10px] text-[#BDB4C9] mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {debutMois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#B3452E]/25 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-[#B3452E]/10">
              <TrendingDown className="w-3.5 h-3.5 text-[#E08B6D]" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-[#E08B6D] font-bold">
              Dépenses du mois
            </span>
          </div>
          <p className="text-xl font-bold text-[#E08B6D]">
            {formaterMontant(depensesMois, "EUR")}
          </p>
          <p className="text-[10px] text-[#BDB4C9] mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {debutMois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-[#FAF6EF]/10">
              <PiggyBank className="w-3.5 h-3.5 text-[#BDB4C9]" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-[#BDB4C9] font-bold">
              Caisses actives
            </span>
          </div>
          <p className="text-xl font-bold font-serif text-[#FAF6EF]">
            {caissesActives.length}
          </p>
          <p className="text-[10px] text-[#BDB4C9] mt-0.5">
            sur {situation.caisses.length} au total
          </p>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl border border-[#C9A227]/40 shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-[#C9A227]/10">
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#DDBE55]" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-[#DDBE55] font-bold">
              Écritures totales
            </span>
          </div>
          <p className="text-xl font-bold font-serif text-[#FAF6EF]">
            {situation.caisses.reduce((s, c) => s + c.nbMouvements, 0) +
              situation.nonAffecte.reduce((s, n) => s + n.nbMouvements, 0)}
          </p>
          <p className="text-[10px] text-[#BDB4C9] mt-0.5">
            depuis l&apos;ouverture des caisses
          </p>
        </div>
      </div>

      {/* Caisses */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-3 px-1">
          Situation par caisse
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {situation.caisses.map((c) => (
            <div
              key={c.id}
              className={`bg-[#1A0826]/70 rounded-2xl shadow-lg border p-4 ${
                c.isActive ? "border-[#C9A227]/15" : "border-dashed border-[#C9A227]/25 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#C9A227]/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 text-[#FAF6EF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold font-serif text-[#FAF6EF] truncate">
                      {c.name}
                      {!c.isActive && (
                        <span className="ml-1.5 text-[10px] font-semibold text-[#BDB4C9]">
                          (fermée)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#BDB4C9]">
                      {libelleCaisseType(c.type)} · {c.currency}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold font-serif text-[#FAF6EF] leading-tight">
                    {formaterMontant(c.solde, c.currency)}
                  </p>
                  <p className="text-[10px] text-[#BDB4C9]">
                    ouverture {formaterMontant(c.openingBalance, c.currency)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#5B7052]/5 py-1.5">
                  <p className="text-[10px] text-[#A3C9B0] font-bold">
                    + {formaterMontant(c.recettes, c.currency)}
                  </p>
                  <p className="text-[9px] text-[#BDB4C9]">recettes</p>
                </div>
                <div className="rounded-lg bg-[#B3452E]/5 py-1.5">
                  <p className="text-[10px] text-[#E08B6D] font-bold">
                    − {formaterMontant(c.depenses, c.currency)}
                  </p>
                  <p className="text-[9px] text-[#BDB4C9]">dépenses</p>
                </div>
                <div className="rounded-lg bg-[#FAF6EF]/5 py-1.5">
                  <p className="text-[10px] text-[#BDB4C9] font-bold">
                    {c.transfertsEntrants - c.transfertsSortants >= 0 ? "+" : ""}
                    {formaterMontant(c.transfertsEntrants - c.transfertsSortants, c.currency)}
                  </p>
                  <p className="text-[9px] text-[#BDB4C9]">transferts nets</p>
                </div>
              </div>
            </div>
          ))}
          {situation.nonAffecte.map((n) => (
            <div
              key={`na-${n.devise}`}
              className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-dashed border-[#C9A227]/25 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold font-serif text-[#FAF6EF]">
                    Écritures non affectées
                  </p>
                  <p className="text-[11px] text-[#BDB4C9]">
                    antérieures à la multicaisse · {n.devise}
                  </p>
                </div>
                <p className="text-lg font-bold text-[#BDB4C9]">
                  {formaterMontant(n.solde, n.devise)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Derniers mouvements */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 px-1 flex-wrap">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold">
            Derniers mouvements
          </h2>
          {/* ⭐ V3.83 — Journal complet consultable depuis le back-office
              (lecture seule) — remplace l'ancien lien vers l'espace dédié. */}
          <Link
            href="/admin/tresorerie/transactions"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DDBE55] hover:underline"
          >
            Tout le journal
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-[11px] text-[#BDB4C9] mb-3 px-1">
          12 dernières écritures du journal
        </p>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 overflow-hidden">
          {dernieres.length === 0 ? (
            <p className="text-sm text-[#BDB4C9] italic p-6 text-center">
              Aucun mouvement enregistré pour l&apos;instant.
            </p>
          ) : (
            <div className="divide-y divide-[#C9A227]/10">
              {dernieres.map((t) => {
                const type = MOUVEMENT_TYPES[t.type as keyof typeof MOUVEMENT_TYPES];
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[#C9A227]/15 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${type?.couleur ?? "#8A8378"}18` }}
                    >
                      {t.type === "RECETTE" ? (
                        <ArrowUpRight
                          className="w-4 h-4"
                          style={{ color: type?.couleur }}
                        />
                      ) : t.type === "DEPENSE" ? (
                        <ArrowDownRight
                          className="w-4 h-4"
                          style={{ color: type?.couleur }}
                        />
                      ) : (
                        <ArrowLeftRight
                          className="w-4 h-4"
                          style={{ color: type?.couleur }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#FAF6EF] truncate">
                        {t.label}
                      </p>
                      <p className="text-xs text-[#BDB4C9] truncate">
                        {type?.libelle ?? t.type} ·{" "}
                        {libelleCategorie(t.category, t.type)}
                        {t.caisseId && nomsCaisses.get(t.caisseId)
                          ? ` · ${nomsCaisses.get(t.caisseId)}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className="text-sm font-bold"
                        style={{
                          color:
                            t.type === "RECETTE"
                              ? "#5B7052"
                              : t.type === "DEPENSE"
                                ? "#B3452E"
                                : "#8A8378",
                        }}
                      >
                        {t.type === "DEPENSE" ? "−" : t.type === "RECETTE" ? "+" : ""}
                        {formaterMontant(t.amount, t.currency)}
                      </p>
                      <p className="text-[10px] text-[#BDB4C9]">
                        {new Date(t.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lien retour dashboard */}
      <div className="text-center">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#BDB4C9] hover:text-[#DDBE55] transition-colors"
        >
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
