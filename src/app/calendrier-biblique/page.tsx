import { genererAnnee } from "@/lib/calendrier/generation";
import { calculerFetesPourAnnee } from "@/lib/calendrier/fetes";
import { determinerAnneeBibliqueEnCours } from "@/lib/calendrier/ancrage";
import { libelleAnneeBiblique } from "@/lib/calendrier/conversion";
import { PageHero } from "@/components/site/page-hero";
import { CalendrierBibliqueApp } from "@/components/calendrier-biblique/calendrier-app";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";

export const revalidate = 30; // Cache 30s au lieu de force-dynamic (évite cold start DB)
export const revalidate = 0;

export default async function CalendrierBibliquePage() {
  const now = new Date();
  const anneeBibliqueCourante = determinerAnneeBibliqueEnCours(now);

  // ⭐ Générer 3 années : précédente, courante, suivante — pour permettre
  //    la navigation dynamique entre mois sans être bloqué à une seule année.
  const anneesBibliques = [
    anneeBibliqueCourante - 1,
    anneeBibliqueCourante,
    anneeBibliqueCourante + 1,
  ];

  const serializedAnnees = anneesBibliques.map((ab) => {
    const annee = genererAnnee(ab);
    const fetes = calculerFetesPourAnnee(ab, annee.jours, now);
    return {
      annee: annee.annee,
      libelle: libelleAnneeBiblique(annee.annee),
      debut: annee.debut.toISOString(),
      fin: annee.fin.toISOString(),
      nombreJours: annee.jours.length,
      jours: annee.jours.map((j) => ({
        ...j,
        dateGregorienne: j.dateGregorienne.toISOString(),
      })),
      fetes: fetes.map((f) => ({
        id: f.fete.id,
        nomFr: f.fete.nomFr,
        nomHebrew: f.fete.nomHebrew,
        referenceEcritures: f.fete.referenceEcritures,
        description: f.fete.description,
        categorie: f.fete.categorie,
        couleur: f.fete.couleur,
        travailInterdit: f.fete.travailInterdit,
        dureeJours: f.fete.dureeJours,
        jourDeSemaineFixe: f.fete.jourDeSemaineFixe,
        dateBiblique: `${f.fete.jourDuMois} ${annee.jours.find((j) => j.mois === f.fete.mois)?.nomMois}`,
        dateGregorienne: f.dateGregorienne.toISOString(),
        jourDeSemaine: f.jourDeSemaine,
        joursRestants: f.joursRestants,
      })),
    };
  });

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1519677100203-a9b5e1e1e1e1?q=80&w=1920&auto=format&fit=crop"
        kicker="Calendrier de l'Éternel · 364 jours"
        title="Calendrier Biblique"
        subtitle="Le calendrier solaire de 364 jours attesté dans le Livre d'Hénoch (72-82) et les manuscrits de Qumrân. Chaque fête tombe le même jour de semaine, chaque année, sans exception. L'année commence toujours un mercredi — jour de la création des luminaires."
        primaryCta={{ label: "Aujourd'hui", href: "#aujourdhui" }}
        secondaryCta={{ label: "Télécharger iCal", href: `/api/calendrier-biblique/ical?annee=${anneeBibliqueCourante}` }}
      />

      <CalendrierBibliqueApp
        annees={serializedAnnees}
        anneeCouranteIndex={1}
        maintenant={now.toISOString()}
      />

      <SectionDivider variant="ornament" />

      {/* Documentation théologique */}
      <section className="bg-[#FAF6EF] py-20 md:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A227] font-semibold mb-3">
              Fondements bibliques
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-[#1E0F2B]">
              Pourquoi un calendrier de 364 jours ?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-gold-top p-6">
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-3">
                Structure mathématique
              </h3>
              <p className="text-sm text-[#1E0F2B]/75 leading-relaxed">
                364 jours = 52 semaines × 7 jours, soit 4 trimestres × 91 jours = 13 semaines.
                Parce que 91 = 13 × 7 exactement, chaque trimestre reproduit la même structure
                de semaine. Le 1er mois de chaque trimestre commence toujours un mercredi.
                Ce n'est pas une coïncidence — c&apos;est la propriété mathématique qui rend
                ce calendrier utilisable sans table de correspondance année par année.
              </p>
            </div>

            <div className="card-gold-top p-6">
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-3">
                Sources historiques
              </h3>
              <p className="text-sm text-[#1E0F2B]/75 leading-relaxed">
                Le Livre d&apos;Hénoch (chapitres 72-82) décrit un calendrier solaire de 364 jours.
                Les manuscrits de Qumrân (4Q319, 4Q320, 4Q321) confirment son usage dans le judaïsme
                du Second Temple. Le Livre des Jubilés (6:32-38) condamne ceux qui suivent la lune
                plutôt que le soleil. Ce calendrier était utilisé par la communauté essénienne
                et probablement par les premiers croyants en Yeshoua.
              </p>
            </div>

            <div className="card-gold-top p-6">
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-3">
                Le jour commence au coucher du soleil
              </h3>
              <p className="text-sm text-[#1E0F2B]/75 leading-relaxed">
                Genèse 1:5 : « il y eut un soir et il y eut un matin, un jour. »
                Lévitique 23:32 : « du soir au soir. » Le jour biblique ne commence pas à minuit,
                mais au coucher du soleil. Le moteur calendaire calcule le coucher de soleil à
                Jérusalem (31.7683°N, 35.2137°E) — le lieu où l&apos;Éternel a mis son nom.
              </p>
            </div>

            <div className="card-gold-top p-6">
              <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-3">
                Ancrage sur l&apos;équinoxe
              </h3>
              <p className="text-sm text-[#1E0F2B]/75 leading-relaxed">
                Pour éviter la dérive (364 jours vs 365,2422), l&apos;année est recalculée
                chaque année sur le mercredi le plus proche de l&apos;équinoxe de printemps.
                Cette approche auto-correctrice garantit que le 1 Aviv tombe toujours autour du
                21 mars grégorien, sans nécessiter de jours intercalaires.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Citation */}
      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Que personne ne vous juge au sujet d'une fête, d'une nouvelle lune, ou des shabbats : c'était l'ombre des choses à venir, mais le corps est en Christ."
            reference="Colossiens 2:16-17"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}
