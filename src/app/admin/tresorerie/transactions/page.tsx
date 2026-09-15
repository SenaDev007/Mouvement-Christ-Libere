import { cookies } from "next/headers";
import Link from "next/link";
import {
  BookOpen,
  Lock,
  Eye,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { lireSessionStaff } from "@/lib/staff-space/session";
import {
  formaterMontant,
  libelleCaisseType,
  libelleCategorie,
  libelleMethode,
  MOUVEMENT_TYPES,
  RECETTE_CATEGORIES,
  DEPENSE_CATEGORIES,
  DEVISE_CODES,
} from "@/lib/staff-space/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * ⭐ V3.83 — Journal des transactions, en CONSULTATION depuis le
 * back-office des serviteurs de Dieu (/admin/tresorerie/transactions).
 *
 * Correction du 404 : depuis admin.mouvementchristlibere.com, l'ancien
 * lien relatif /tresorerie/transactions était réécrit par le proxy vers
 * /admin/tresorerie/transactions — une route qui n'existait pas. Le
 * pasteur disposait d'aucun journal lisible hors de l'espace Trésorerie
 * (connexion séparée du trésorier). Cette page comble le manque :
 *   · LECTURE SEULE — aucun bouton de saisie, de correction ni de
 *     suppression (la gestion reste dans l'espace Trésorerie dédié) ;
 *   · réservée aux SUPER_ADMIN (Pasteur Kongo et Sœur Afrika) ;
 *   · filtres complets (type, catégorie, devise, caisse, période,
 *     recherche) + pagination — mêmes données que le journal du
 *     trésorier, calculées en direct depuis la base.
 */

const TAILLE_PAGE = 25;

const TYPES_VALIDES = ["RECETTE", "DEPENSE", "TRANSFERT"];
const CATEGORIES_VALIDES = [
  ...Object.keys(RECETTE_CATEGORIES),
  ...Object.keys(DEPENSE_CATEGORIES),
  "transfert",
];

function parametreContenu(
  params: Record<string, string | string[] | undefined>,
  cle: string
): string {
  const valeur = params[cle];
  return (Array.isArray(valeur) ? valeur[0] : valeur)?.trim() || "";
}

function construireQuery(
  courant: Record<string, string>,
  page: number
): string {
  const morceaux = Object.entries(courant)
    .filter(([cle, valeur]) => cle !== "page" && valeur)
    .map(([cle, valeur]) => `${cle}=${encodeURIComponent(valeur)}`);
  morceaux.push(`page=${page}`);
  return morceaux.length ? `?${morceaux.join("&")}` : "";
}

export default async function AdminJournalTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Garde de rôle : seuls les serviteurs de Dieu (SUPER_ADMIN) consultent.
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? lireSessionStaff(token) : null;

  if (!session || session.role !== "SUPER_ADMIN") {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-white rounded-2xl border border-[#8A8378]/15 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[#A3821C]" />
        </div>
        <h1 className="text-xl font-bold text-[#1E0F2B] mb-2">
          Journal réservé aux serviteurs de Dieu
        </h1>
        <p className="text-sm text-[#8A8378] leading-relaxed">
          Le journal des mouvements n&apos;est visible que par les comptes
          super administrateurs (Pasteur Kongo et Sœur Afrika). Le
          trésorier gère les écritures depuis l&apos;espace Trésorerie dédié.
        </p>
      </div>
    );
  }

  await ensureStaffSpaces();

  // ── Lecture et validation des filtres ──
  const params = await searchParams;
  const type = TYPES_VALIDES.includes(parametreContenu(params, "type"))
    ? parametreContenu(params, "type")
    : "";
  const categorie = CATEGORIES_VALIDES.includes(
    parametreContenu(params, "categorie")
  )
    ? parametreContenu(params, "categorie")
    : "";
  const devise = DEVISE_CODES.includes(parametreContenu(params, "devise"))
    ? parametreContenu(params, "devise")
    : "";
  const recherche = parametreContenu(params, "q").slice(0, 80);
  const du = /^\d{4}-\d{2}-\d{2}$/.test(parametreContenu(params, "du"))
    ? parametreContenu(params, "du")
    : "";
  const au = /^\d{4}-\d{2}-\d{2}$/.test(parametreContenu(params, "au"))
    ? parametreContenu(params, "au")
    : "";

  const caisses = await db.treasuryCashAccount.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, currency: true, isActive: true },
  });
  const idsCaisses = new Set(caisses.map((c) => c.id));
  const caisse = idsCaisses.has(parametreContenu(params, "caisse"))
    ? parametreContenu(params, "caisse")
    : "";

  const pageDemandee = parseInt(parametreContenu(params, "page"), 10);
  const page = Number.isInteger(pageDemandee) && pageDemandee > 0 ? pageDemandee : 1;

  // ── Clause where (mêmes règles que le journal du trésorier) ──
  // ⚠️ caisse et recherche combinables SANS s'écraser : chaque filtre
  // multi-champs devient une entrée AND distincte (sinon le dernier OR
  // remplace le précédent et un filtre serait silencieusement perdu).
  const where: {
    type?: string;
    category?: string;
    currency?: string;
    AND?: Array<Record<string, unknown>>;
    date?: { gte?: Date; lt?: Date };
  } = {};
  if (type) where.type = type;
  if (categorie) where.category = categorie;
  if (devise) where.currency = devise;
  if (caisse) {
    // Un transfert touche DEUX caisses : la caisse filtrée compte comme
    // source OU comme destination.
    where.AND = where.AND || [];
    where.AND.push({
      OR: [{ caisseId: caisse }, { caisseDestinationId: caisse }],
    });
  }
  if (recherche) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { label: { contains: recherche, mode: "insensitive" } },
        { reference: { contains: recherche, mode: "insensitive" } },
        { donorName: { contains: recherche, mode: "insensitive" } },
      ],
    });
  }
  if (du || au) {
    const plage: { gte?: Date; lt?: Date } = {};
    if (du) plage.gte = new Date(`${du}T00:00:00`);
    if (au) {
      const fin = new Date(`${au}T00:00:00`);
      fin.setDate(fin.getDate() + 1); // jour de fin inclus
      plage.lt = fin;
    }
    where.date = plage;
  }

  // ① Compte d'abord → page BORNÉE avant la lecture (page 999 d'un
  // signet ancien ne doit jamais produire un skip impossible).
  const total = await db.treasuryTransaction.count({ where });
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  const pageSure = Math.min(page, pages);

  const [transactions, totauxGroupes] = await Promise.all([
    db.treasuryTransaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (pageSure - 1) * TAILLE_PAGE,
      take: TAILLE_PAGE,
    }),
    db.treasuryTransaction.groupBy({
      by: ["type", "currency"],
      where,
      _sum: { amount: true },
    }),
  ]);

  // Totaux de la sélection par devise (les transferts ne changent pas le
  // total consolidé — ils restent comptés à part, comme au dashboard).
  const recettesParDevise = new Map<string, number>();
  const depensesParDevise = new Map<string, number>();
  for (const g of totauxGroupes) {
    if (g.type === "RECETTE" && g._sum.amount) {
      recettesParDevise.set(
        g.currency,
        (recettesParDevise.get(g.currency) || 0) + g._sum.amount
      );
    } else if (g.type === "DEPENSE" && g._sum.amount) {
      depensesParDevise.set(
        g.currency,
        (depensesParDevise.get(g.currency) || 0) + g._sum.amount
      );
    }
  }

  const nomsCaisses = new Map(caisses.map((c) => [c.id, c]));

  // Filtres actifs pour les liens de pagination (et le bouton Réinitialiser).
  const filtresCourants: Record<string, string> = {
    ...(type ? { type } : {}),
    ...(categorie ? { categorie } : {}),
    ...(devise ? { devise } : {}),
    ...(caisse ? { caisse } : {}),
    ...(recherche ? { q: recherche } : {}),
    ...(du ? { du } : {}),
    ...(au ? { au } : {}),
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Consultation — lecture seule
            </p>
            <h1
              className="text-2xl md:text-3xl font-bold mb-1 flex items-center gap-3"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            >
              <BookOpen className="w-6 h-6 text-[#C9A227]" />
              Journal des transactions
            </h1>
            <p className="text-sm text-white/70 max-w-xl">
              Toutes les écritures de la trésorerie du ministère —
              {total > 0
                ? ` ${total} mouvement${total > 1 ? "s" : ""} correspondant aux filtres.`
                : " aucun mouvement pour ces filtres."}
            </p>
          </div>
          <Link
            href="/admin/tresorerie"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold hover:bg-white/15 transition-colors"
          >
            ← Situation de trésorerie
          </Link>
        </div>
      </div>

      {/* Bandeau lecture seule */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/30 text-sm text-[#1E0F2B]/80">
        <ShieldCheck className="w-4 h-4 text-[#A3821C] flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Vous consultez le journal en simple coup d&apos;œil. La saisie, la
          correction et la suppression des écritures (avec leurs traces
          d&apos;audit) se gèrent dans l&apos;<strong>espace Trésorerie</strong>{" "}
          (connexion du trésorier) — les dons payés en ligne y arrivent
          automatiquement, déjà catégorisés.
        </p>
      </div>

      {/* Filtres */}
      <form
        method="GET"
        className="bg-white rounded-xl border border-[#8A8378]/15 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label
            htmlFor="f-type"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Type
          </label>
          <select
            id="f-type"
            name="type"
            defaultValue={type}
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          >
            <option value="">Tous</option>
            <option value="RECETTE">Recettes</option>
            <option value="DEPENSE">Dépenses</option>
            <option value="TRANSFERT">Transferts</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="f-categorie"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Catégorie
          </label>
          <select
            id="f-categorie"
            name="categorie"
            defaultValue={categorie}
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          >
            <option value="">Toutes</option>
            <optgroup label="Recettes">
              {Object.entries(RECETTE_CATEGORIES).map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </optgroup>
            <optgroup label="Dépenses">
              {Object.entries(DEPENSE_CATEGORIES).map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label
            htmlFor="f-devise"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Devise
          </label>
          <select
            id="f-devise"
            name="devise"
            defaultValue={devise}
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          >
            <option value="">Toutes</option>
            {DEVISE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="f-caisse"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Caisse
          </label>
          <select
            id="f-caisse"
            name="caisse"
            defaultValue={caisse}
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          >
            <option value="">Toutes</option>
            {caisses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label
            htmlFor="f-q"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Recherche
          </label>
          <input
            id="f-q"
            name="q"
            type="text"
            defaultValue={recherche}
            maxLength={80}
            placeholder="Libellé, référence, donateur…"
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] placeholder:text-[#8A8378]/50 focus:outline-none focus:border-[#C9A227]"
          />
        </div>
        <div>
          <label
            htmlFor="f-du"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Du
          </label>
          <input
            id="f-du"
            name="du"
            type="date"
            defaultValue={du}
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          />
        </div>
        <div>
          <label
            htmlFor="f-au"
            className="block text-[10px] uppercase tracking-wider font-bold text-[#8A8378] mb-1"
          >
            Au
          </label>
          <input
            id="f-au"
            name="au"
            type="date"
            defaultValue={au}
            className="w-full px-3 py-2.5 rounded-lg border border-[#8A8378]/30 bg-white text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
          />
        </div>
        <div className="col-span-2 md:col-span-4 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors"
          >
            <Search className="w-4 h-4 text-[#C9A227]" />
            Filtrer
          </button>
          <Link
            href="/admin/tresorerie/transactions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#8A8378]/30 text-[#8A8378] text-sm font-semibold hover:border-[#C9A227]/60 hover:text-[#A3821C] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser
          </Link>
        </div>
      </form>

      {/* Totaux de la sélection */}
      {(recettesParDevise.size > 0 || depensesParDevise.size > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-[#5B7052]/30 p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#5B7052] font-bold mb-1">
              Recettes de la sélection
            </p>
            <p className="text-lg font-bold text-[#3F5039] leading-tight">
              {[...recettesParDevise.entries()]
                .map(([d, m]) => formaterMontant(m, d))
                .join(" + ") || "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#B3452E]/25 p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#B3452E] font-bold mb-1">
              Dépenses de la sélection
            </p>
            <p className="text-lg font-bold text-[#B3452E] leading-tight">
              {[...depensesParDevise.entries()]
                .map(([d, m]) => formaterMontant(m, d))
                .join(" + ") || "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 col-span-2 md:col-span-1">
            <p className="text-[10px] uppercase tracking-wider text-[#8A8378] font-bold mb-1">
              Solde (par devise)
            </p>
            <p className="text-lg font-bold text-[#1E0F2B] leading-tight">
              {[
                ...new Set([
                  ...recettesParDevise.keys(),
                  ...depensesParDevise.keys(),
                ]),
              ]
                .map((d) =>
                  formaterMontant(
                    (recettesParDevise.get(d) || 0) -
                      (depensesParDevise.get(d) || 0),
                    d
                  )
                )
                .join(" + ") || "—"}
            </p>
            <p className="text-[10px] text-[#8A8378] mt-0.5">
              transferts internes exclus
            </p>
          </div>
        </div>
      )}

      {/* Journal */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-sm text-[#8A8378] italic p-10 text-center">
            Aucune écriture ne correspond à ces filtres.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[#2A0E3D]/[0.03] border-b border-[#8A8378]/15 text-left">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-[#8A8378]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-[#8A8378]">
                    Mouvement
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-[#8A8378]">
                    Catégorie
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-[#8A8378]">
                    Caisse
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-[#8A8378] text-right">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8A8378]/10">
                {transactions.map((t) => {
                  const meta = MOUVEMENT_TYPES[
                    t.type as keyof typeof MOUVEMENT_TYPES
                  ];
                  const caisseSource = t.caisseId
                    ? nomsCaisses.get(t.caisseId)
                    : null;
                  const caisseDestination = t.caisseDestinationId
                    ? nomsCaisses.get(t.caisseDestinationId)
                    : null;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-[#FAF6EF]/60 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-[#8A8378] align-top">
                        {new Date(t.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `${meta?.couleur ?? "#8A8378"}18`,
                            }}
                          >
                            {t.type === "RECETTE" ? (
                              <ArrowUpRight
                                className="w-3.5 h-3.5"
                                style={{ color: meta?.couleur }}
                              />
                            ) : t.type === "DEPENSE" ? (
                              <ArrowDownRight
                                className="w-3.5 h-3.5"
                                style={{ color: meta?.couleur }}
                              />
                            ) : (
                              <ArrowLeftRight
                                className="w-3.5 h-3.5"
                                style={{ color: meta?.couleur }}
                              />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-[#1E0F2B] leading-snug">
                              {t.label}
                            </p>
                            <p className="text-[11px] text-[#8A8378] mt-0.5">
                              {meta?.libelle ?? t.type} ·{" "}
                              {libelleMethode(t.method)}
                              {t.reference ? ` · réf. ${t.reference}` : ""}
                              {t.donorName && !t.isAnonymous
                                ? ` · ${t.donorName}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap"
                          style={{
                            color: meta?.couleur,
                            backgroundColor: `${meta?.couleur ?? "#8A8378"}15`,
                            borderColor: `${meta?.couleur ?? "#8A8378"}40`,
                          }}
                        >
                          {libelleCategorie(t.category, t.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-[#8A8378]">
                        {t.type === "TRANSFERT" && caisseSource && caisseDestination ? (
                          <span className="leading-snug">
                            {caisseSource.name} → {caisseDestination.name}
                          </span>
                        ) : caisseSource ? (
                          <span className="leading-snug">
                            {caisseSource.name}
                            <span className="block text-[10px]">
                              {libelleCaisseType(caisseSource.type)}
                            </span>
                          </span>
                        ) : (
                          <span className="italic">Non affectée</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        <p
                          className="font-bold"
                          style={{ color: meta?.couleur ?? "#1E0F2B" }}
                        >
                          {t.type === "DEPENSE" ? "−" : t.type === "RECETTE" ? "+" : ""}
                          {formaterMontant(t.amount, t.currency)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#8A8378]/15 bg-[#2A0E3D]/[0.02] flex-wrap">
            <p className="text-[11px] text-[#8A8378]">
              Page {pageSure} sur {pages} — {total} écritures
            </p>
            <div className="flex items-center gap-1.5">
              {pageSure > 1 && (
                <Link
                  href={construireQuery(filtresCourants, pageSure - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#8A8378]/25 text-[#8A8378] hover:border-[#C9A227]/60 hover:text-[#A3821C] transition-colors"
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter(
                  (n) =>
                    n === 1 ||
                    n === pages ||
                    Math.abs(n - pageSure) <= 2
                )
                .map((n, index, liste) => {
                  const precedente = liste[index - 1];
                  const trou =
                    precedente !== undefined && n - precedente > 1;
                  return (
                    <span key={n} className="flex items-center gap-1.5">
                      {trou && (
                        <span className="text-[#8A8378]/60 text-xs px-0.5">
                          …
                        </span>
                      )}
                      <Link
                        href={construireQuery(filtresCourants, n)}
                        className={cn(
                          "w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold border transition-colors",
                          n === pageSure
                            ? "bg-[#C9A227] text-[#1E0F2B] border-[#C9A227]"
                            : "border-[#8A8378]/25 text-[#8A8378] hover:border-[#C9A227]/60 hover:text-[#A3821C]"
                        )}
                      >
                        {n}
                      </Link>
                    </span>
                  );
                })}
              {pageSure < pages && (
                <Link
                  href={construireQuery(filtresCourants, pageSure + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#8A8378]/25 text-[#8A8378] hover:border-[#C9A227]/60 hover:text-[#A3821C] transition-colors"
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lien retour */}
      <div className="text-center">
        <Link
          href="/admin/tresorerie"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8A8378] hover:text-[#A3821C] transition-colors"
        >
          ← Situation de trésorerie
        </Link>
      </div>
    </div>
  );
}
