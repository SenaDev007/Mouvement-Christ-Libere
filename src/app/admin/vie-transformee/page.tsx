import { db } from "@/lib/db";
import { ensureCroyantTestimoniesTable } from "@/lib/ensure-schema";
import { VieTransformeeActions } from "@/components/admin/vie-transformee-actions";
import {
  Heart, Hourglass, CheckCircle2, XCircle, MapPin, Mail, Phone,
  Briefcase, Church, Sparkles, Quote,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * ⭐ V3.100 — BACK-OFFICE « VIES TRANSFORMÉES » : modération des
 * témoignages des CROYANTS soumis depuis le site public.
 *
 * Distinction demandée par le pasteur : /admin/testimonies gère les
 * récits des SERVITEURS (Afrika & Pasteur Kongo) ; CE module gère les
 * témoignages des croyants dont la vie a été transformée.
 *
 * Parcours : soumission (2 modales) → statut « en_attente » → le super
 * admin relit (données personnelles + professionnelles + récit) →
 * VALIDE (publication landing + /vie-transformee) ou REJETE avec note.
 * ⚠️ Réservé aux super admins (garde proxy de /admin + session).
 */

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "bg-[#C9A227]/15 text-[#DDBE55] border-[#C9A227]/30" },
  publie: { label: "Publié", color: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25" },
  rejete: { label: "Rejeté", color: "bg-red-400/10 text-red-300/90 border-red-400/25" },
};

const LABEL_CATEGORIE: Record<string, string> = {
  vie_transformee: "Vie transformée",
  guerison: "Guérison",
  delivrance: "Délivrance",
  restauration: "Foyer restauré",
  providence: "Providence",
  appel: "Appel & consécration",
  action_graces: "Action de grâces",
};

function dateFr(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const FILTERS = [
  { id: "en_attente", label: "En attente" },
  { id: "publie", label: "Publiés" },
  { id: "rejete", label: "Rejetés" },
  { id: "tous", label: "Tous" },
];

export default async function AdminVieTransformeePage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut: statutFilter = "en_attente" } = await searchParams;

  // Auto-réparation de la table à l'entrée du module (lambda froide,
  // premier déploiement — même garde que les autres modules).
  await ensureCroyantTestimoniesTable().catch(() => {});

  const where =
    statutFilter !== "tous" && statutFilter !== "" ? { statut: statutFilter } : {};

  const [temoignages, all] = await Promise.all([
    db.croyantTestimony.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.croyantTestimony.findMany({ select: { statut: true } }),
  ]);

  const stats = {
    total: all.length,
    enAttente: all.filter((t) => t.statut === "en_attente").length,
    publies: all.filter((t) => t.statut === "publie").length,
    rejetes: all.filter((t) => t.statut === "rejete").length,
  };

  return (
    <div className="space-y-6">
      {/* Header — style Win Agro du back-office */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#BDB4C9] font-bold mb-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
          Vies transformées
        </p>
        <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#FAF6EF]">
          Témoignages des croyants
        </h1>
        <p className="text-sm text-[#BDB4C9] mt-1 max-w-3xl leading-relaxed">
          Les témoignages soumis depuis le site public arrivent ici. Relisez
          chaque récit, puis <strong className="text-[#DDBE55]">validez-le</strong> pour le
          publier (section « Vies transformées » de l&apos;accueil + page
          /vie-transformee) ou <strong className="text-red-300">rejetez-le</strong> avec une note.
          Les coordonnées des témoins restent confidentielles.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4">
          <div className="text-2xl font-bold font-serif text-[#FAF6EF]">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#BDB4C9] font-semibold mt-0.5 flex items-center gap-1">
            <Heart className="w-3 h-3" /> Total reçus
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl border border-[#C9A227]/40 shadow-lg p-4">
          <div className="text-2xl font-bold text-[#DDBE55]">{stats.enAttente}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#DDBE55] font-semibold mt-0.5 flex items-center gap-1">
            <Hourglass className="w-3 h-3" /> En attente
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-emerald-400/20 p-4">
          <div className="text-2xl font-bold text-emerald-300">{stats.publies}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Publiés
          </div>
        </div>
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-red-400/20 p-4">
          <div className="text-2xl font-bold text-red-300/90">{stats.rejetes}</div>
          <div className="text-[10px] uppercase tracking-wider text-red-300/90 font-semibold mt-0.5 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejetés
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-discrete pb-1">
        {FILTERS.map((f) => (
          <a
            key={f.id}
            href={`/admin/vie-transformee?statut=${f.id}`}
            className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statutFilter === f.id
                ? "bg-[#3D1A54] text-[#FAF6EF]"
                : "border border-[#C9A227]/25 text-[#DDBE55] hover:bg-[#3D1A54]/5"
            }`}
          >
            {f.label}
            {f.id === "en_attente" && stats.enAttente > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#C9A227] text-[#1A0826] text-[9px] font-black">
                {stats.enAttente}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Liste */}
      {temoignages.length === 0 ? (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-xl border border-dashed border-[#C9A227]/30 p-12 text-center">
          <Heart className="w-10 h-10 text-[#FAF6EF]/20 mx-auto mb-3" />
          <p className="text-sm text-[#BDB4C9] italic">
            Aucun témoignage {statutFilter !== "tous" ? "dans ce statut " : ""}pour
            l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {temoignages.map((t) => {
            const statut = STATUT_CONFIG[t.statut] || STATUT_CONFIG.en_attente;
            const localisation = [t.ville, t.pays].filter(Boolean).join(", ");
            return (
              <div
                key={t.id}
                className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 hover:shadow-md transition-shadow"
              >
                {/* En-tête : avatar + titre + statut */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white bg-gradient-to-br from-[#C9A227] to-[#A3821C]">
                    {(t.nom || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-[#FAF6EF] break-words">
                          {t.titre}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-[#BDB4C9]">
                          <span className="font-semibold text-[#DDBE55]">
                            {LABEL_CATEGORIE[t.categorie] || t.categorie}
                          </span>
                          <span className="opacity-40">·</span>
                          <span>{t.nom}</span>
                          {localisation && (
                            <>
                              <span className="opacity-40">·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {localisation}
                              </span>
                            </>
                          )}
                          <span className="opacity-40">·</span>
                          <span>reçu le {dateFr(t.createdAt)}</span>
                          {t.publishedAt && (
                            <>
                              <span className="opacity-40">·</span>
                              <span className="text-emerald-300/80">
                                publié le {dateFr(t.publishedAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${statut.color}`}
                      >
                        {statut.label}
                      </span>
                    </div>

                    {/* Récit */}
                    <div className="mt-3 bg-[#150920]/80 border border-[#C9A227]/10 rounded-xl px-4 py-3">
                      <Quote className="w-3 h-3 text-[#C9A227]/50 mb-1.5" />
                      <p className="text-[13px] text-[#FAF6EF]/85 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto scrollbar-discrete">
                        {t.contenu}
                      </p>
                    </div>

                    {/* Coordonnées (confidentielles) */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-[#BDB4C9]">
                      {t.email && (
                        <a href={`mailto:${t.email}`} className="inline-flex items-center gap-1 hover:text-[#DDBE55] transition-colors">
                          <Mail className="w-3 h-3" /> {t.email}
                        </a>
                      )}
                      {t.telephone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {t.telephone}
                        </span>
                      )}
                      {t.profession && (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {t.profession}
                        </span>
                      )}
                      {t.eglise && (
                        <span className="inline-flex items-center gap-1">
                          <Church className="w-3 h-3" /> {t.eglise}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pied : actions de modération */}
                <div className="mt-3 pt-3 border-t border-[#C9A227]/10">
                  <VieTransformeeActions id={t.id} statut={t.statut} noteAdmin={t.noteAdmin} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
