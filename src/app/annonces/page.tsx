import Link from "next/link";
import type { Metadata } from "next";
import {
  Megaphone,
  Radio,
  Calendar,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ensureStaffSpaces } from "@/lib/ensure-schema";
import {
  publierAnnoncesEchues,
  listerAnnoncesPubliees,
} from "@/lib/staff-space/annonces";
import { ANNONCE_CATEGORIES } from "@/lib/staff-space/constants";

/**
 * ⭐ V3.67 — Page publique « Annonces du ministère ».
 *
 * La voix officielle du Mouvement Christ Libère : annonces publiées par le
 * secrétariat (lives programmés, événements, communiqués, urgences).
 * Les publications PLANIFIÉES basculent automatiquement à leur échéance
 * (publierAnnoncesEchues — sans cron : la consultation déclenche la bascule).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Annonces du ministère | Christ Libère",
  description:
    "Lives programmés, événements et communiqués officiels du Mouvement Christ Libère — publiés par le secrétariat.",
};

const PAR_PAGE = 10;

const ICONE_CATEGORIES: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  generale: Megaphone,
  live: Radio,
  evenement: Calendar,
  urgence: AlertTriangle,
};

function formaterDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; categorie?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1") || 1);
  const categorie =
    params.categorie && params.categorie in ANNONCE_CATEGORIES
      ? params.categorie
      : undefined;

  // ⭐ Colonnes V3.67 garanties avant toute lecture (publishAt notamment —
  // un visiteur peut être le PREMIER à consulter après le déploiement).
  await ensureStaffSpaces();

  // ⭐ Bascule des publications planifiées arrivées à échéance.
  await publierAnnoncesEchues();

  const { items, total } = await listerAnnoncesPubliees(
    PAR_PAGE,
    (page - 1) * PAR_PAGE,
    categorie
  );

  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const construireLien = (pageCible: number, categorieActive?: string) => {
    const p = new URLSearchParams();
    if (pageCible > 1) p.set("page", String(pageCible));
    if (categorieActive) p.set("categorie", categorieActive);
    const qs = p.toString();
    return qs ? `/annonces?${qs}` : "/annonces";
  };

  return (
    <div>
      <PageHero
        kicker="Secrétariat du mouvement"
        title="Annonces"
        titleAccent="du ministère"
        subtitle="Lives programmés, événements et communiqués officiels — la voix publique du Mouvement Christ Libère, tenue par le secrétariat."
        imageSrc="/pam-kongo-hero.webp"
      />

      <section className="py-12 md:py-16 bg-[#FAF6EF]">
        <div className="container mx-auto max-w-4xl px-4">
          {/* Filtres catégories */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            <Link
              href="/annonces"
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                !categorie
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "bg-white border border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40 hover:text-[#A3821C]"
              }`}
            >
              Toutes
            </Link>
            {Object.entries(ANNONCE_CATEGORIES).map(([v, c]) => {
              const actif = categorie === v;
              return (
                <Link
                  key={v}
                  href={construireLien(1, v)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                    actif
                      ? "bg-[#2A0E3D] text-[#FAF6EF]"
                      : "bg-white border border-[#8A8378]/15 text-[#8A8378] hover:border-[#C9A227]/40 hover:text-[#A3821C]"
                  }`}
                >
                  {c.libelle}
                </Link>
              );
            })}
          </div>

          {total === 0 ? (
            <div className="bg-white rounded-2xl border border-[#8A8378]/15 px-6 py-16 text-center">
              <Megaphone className="w-10 h-10 text-[#8A8378]/40 mx-auto mb-4" />
              <p className="text-sm text-[#8A8378]">
                Aucune annonce publiée pour le moment — les communiqués du
                ministère apparaîtront ici dès leur publication par le
                secrétariat.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[#8A8378] text-center mb-6">
                {total} annonce{total > 1 ? "s" : ""}
                {categorie
                  ? ` · ${ANNONCE_CATEGORIES[categorie as keyof typeof ANNONCE_CATEGORIES].libelle}`
                  : ""}
              </p>

              <div className="space-y-4">
                {items.map((a) => {
                  const categorieInfo =
                    ANNONCE_CATEGORIES[
                      a.category as keyof typeof ANNONCE_CATEGORIES
                    ];
                  const Icone = ICONE_CATEGORIES[a.category] || Megaphone;
                  return (
                    <article
                      key={a.id}
                      className="bg-white rounded-2xl border border-[#8A8378]/15 p-6 md:p-7"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                          style={{
                            backgroundColor: `${categorieInfo?.couleur ?? "#C9A227"}15`,
                            color: categorieInfo?.couleur ?? "#A3821C",
                            borderColor: `${categorieInfo?.couleur ?? "#C9A227"}30`,
                          }}
                        >
                          <Icone className="w-3 h-3" />
                          {categorieInfo?.libelle ?? a.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#8A8378]">
                          <Clock className="w-3 h-3" />
                          {a.publishedAt
                            ? formaterDate(a.publishedAt)
                            : formaterDate(a.createdAt)}
                        </span>
                      </div>
                      <h2 className="font-serif text-xl font-semibold text-[#1E0F2B] mb-3">
                        {a.title}
                      </h2>
                      <div className="text-sm text-[#1E0F2B]/80 leading-relaxed whitespace-pre-wrap">
                        {a.content}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              {nbPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  {page > 1 ? (
                    <Link
                      href={construireLien(page - 1, categorie)}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#8A8378]/15 text-[#1E0F2B] hover:border-[#C9A227]/40 transition-colors"
                      aria-label="Page précédente"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span className="w-10 h-10" />
                  )}
                  <span className="text-xs font-semibold text-[#1E0F2B]">
                    Page {page} sur {nbPages}
                  </span>
                  {page < nbPages ? (
                    <Link
                      href={construireLien(page + 1, categorie)}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#8A8378]/15 text-[#1E0F2B] hover:border-[#C9A227]/40 transition-colors"
                      aria-label="Page suivante"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span className="w-10 h-10" />
                  )}
                </div>
              )}
            </>
          )}

          {/* Lien vers le secrétariat (demande de rencontre) */}
          <div className="mt-12 text-center">
            <Link
              href="/rendez-vous"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2A0E3D] text-[#DDBE55] text-sm font-bold hover:bg-[#3D1A54] transition-colors"
            >
              <Megaphone className="w-4 h-4" />
              Vous souhaitez rencontrer un serviteur de Dieu ?
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
