import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { PageHero } from "@/components/site/page-hero";
import { AutoRefresh } from "@/components/site/auto-refresh";
import { SoumissionTemoignage } from "@/components/site/soumission-temoignage";
import { ensureCroyantTestimoniesTable } from "@/lib/ensure-schema";
import { Heart, MapPin, Sparkles, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic"; // pas de DB au build

/**
 * ⭐ V3.100 — PAGE « VIES TRANSFORMÉES » : témoignages des CROYANTS.
 *
 * Distinction demandée par le pasteur :
 *   · /temoignages       → témoignages des SERVITEURS (Afrika & Pasteur
 *                          Kongo — récits du Mouvement) ;
 *   · /vie-transformee   → témoignages des CROYANTS dont la vie a été
 *                          transformée (cette page).
 *
 * Parcours : soumission publique (2 modales : personnel → professionnel)
 * → statut en_attente → validation par un super admin
 * (/admin/vie-transformee) → publication ici + section de la landing.
 *
 * ⚠️ Aucune donnée privée n'est affichée : email et téléphone restent
 * confidentiels (relecture pastorale uniquement).
 */

export const metadata = {
  title: "Vies transformées — Témoignages des croyants | Christ Libère",
  description:
    "Des croyants racontent ce que Yeshoua a fait dans leur vie : guérisons, délivrances, foyers restaurés, providence. Chaque témoignage est validé par l'équipe pastorale.",
  alternates: { canonical: "/vie-transformee" },
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
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function VieTransformeePage() {
  // Auto-réparation de la table au premier passage (lambda froide,
  // premier déploiement — même garde que l'API).
  await ensureCroyantTestimoniesTable().catch(() => {});

  const [hero, temoignages] = await Promise.all([
    getHero("vie-transformee"),
    db.croyantTestimony.findMany({
      where: { statut: "publie" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        nom: true,
        pays: true,
        ville: true,
        profession: true,
        eglise: true,
        categorie: true,
        titre: true,
        contenu: true,
        publishedAt: true,
      },
    }),
  ]);

  return (
    <div>
      <AutoRefresh intervalMs={60000} />
      <PageHero
        imageSrc={hero.backgroundImage}
        kicker={hero.kicker}
        title={hero.title}
        titleAccent={hero.titleAccent}
        subtitle={hero.subtitle}
      />

      {/* Bandeau de garantie : relecture pastorale + bouton de soumission */}
      <section className="bg-cream border-b border-primary-pale/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-sm text-gray-text font-sans">
            <ShieldCheck className="w-5 h-5 text-accent-dark shrink-0" />
            Chaque témoignage est relu et validé par l&apos;équipe pastorale
            avant publication.
          </p>
          <SoumissionTemoignage variante="or" libelle="Partager votre témoignage" />
        </div>
      </section>

      {/* Liste des témoignages publiés */}
      <section className="bg-[#FAF6EF] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          {temoignages.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary-pale flex items-center justify-center mb-6">
                <Heart className="w-9 h-9 text-accent-dark" fill="currentColor" />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-extrabold text-primary-deep mb-4">
                Soyez le premier à témoigner.
              </h2>
              <p className="text-gray-text leading-relaxed max-w-xl mx-auto mb-8">
                Aucun témoignage n&apos;a encore été publié — mais le Seigneur
                agit déjà dans les cœurs. Si Yeshoua a transformé votre vie,
                votre récit peut relever la foi de milliers de personnes.
                Soumettez-le : il sera relu avec attention par l&apos;équipe
                pastorale.
              </p>
              <SoumissionTemoignage variante="or" libelle="Partager votre témoignage" />
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-pale text-primary-deep text-xs font-sans font-bold uppercase tracking-wider mb-3">
                    <Sparkles className="w-3 h-3" /> {temoignages.length}{" "}
                    {temoignages.length === 1 ? "témoignage publié" : "témoignages publiés"}
                  </p>
                  <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-primary-deep leading-tight">
                    Ce que Dieu a fait, ils le racontent.
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {temoignages.map((t) => {
                  const localisation = [t.ville, t.pays].filter(Boolean).join(", ");
                  const soustitre = [t.profession, t.eglise].filter(Boolean).join(" · ");
                  return (
                    <article
                      key={t.id}
                      className="group relative bg-white rounded-2xl shadow-md hover:shadow-xl border border-primary-pale border-t-4 border-t-accent-yellow p-7 flex flex-col transition-all duration-300 card-shimmer"
                    >
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-pale text-primary-deep text-[10px] font-bold uppercase tracking-wider">
                          <Heart className="w-2.5 h-2.5" />
                          {LABEL_CATEGORIE[t.categorie] || "Vie transformée"}
                        </span>
                        {localisation && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-text uppercase tracking-wider">
                            <MapPin className="w-2.5 h-2.5" /> {localisation}
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif text-xl font-extrabold text-primary-deep leading-snug mb-3">
                        {t.titre}
                      </h3>

                      <p className="text-sm text-gray-text leading-relaxed whitespace-pre-line flex-1 mb-5">
                        {t.contenu.length > 420
                          ? t.contenu.slice(0, 420).trimEnd() + "…"
                          : t.contenu}
                      </p>

                      <div className="flex items-center gap-3 pt-4 border-t border-primary-pale/60">
                        <div className="h-11 w-11 rounded-full bg-primary-deep flex items-center justify-center text-accent-yellow font-serif font-black text-sm select-none shrink-0">
                          {t.nom.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-serif font-bold text-primary-deep text-sm leading-tight truncate">
                            {t.nom}
                          </span>
                          <span className="text-primary-green/80 font-sans font-semibold text-xs mt-0.5 truncate">
                            {soustitre || "Membre de la communauté"}
                          </span>
                          {t.publishedAt && (
                            <span className="text-gray-text/70 font-sans text-[10px] mt-0.5">
                              Publié le {dateFr(t.publishedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Rappel de soumission en fin de liste */}
              <div className="mt-14 text-center">
                <p className="font-serif text-xl font-extrabold text-primary-deep mb-2">
                  Yeshoua a-t-il transformé votre vie ?
                </p>
                <p className="text-sm text-gray-text mb-6 max-w-lg mx-auto">
                  Votre témoignage peut fortifier la foi d&apos;un frère ou
                  d&apos;une sœur. Soumettez-le : il sera relu par l&apos;équipe
                  pastorale avant publication.
                </p>
                <SoumissionTemoignage variante="contour" libelle="Partager votre témoignage" />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
