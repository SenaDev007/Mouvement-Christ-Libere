import { db } from "@/lib/db";
import { HeroSection } from "@/components/premium/hero-section";
import { CalendarView } from "@/components/premium/calendar-view";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";

export const dynamic = "force-dynamic";

export default async function CalendrierPage() {
  const events = await db.liturgicalEvent.findMany({
    orderBy: { startDate: "asc" },
  });

  const serializedEvents = events.map((e) => ({
    id: e.id,
    name: e.name,
    nameFr: e.nameFr,
    nameHe: e.nameHe,
    type: e.type,
    description: e.description,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() || null,
    color: e.color,
    isShabbat: e.isShabbat,
  }));

  return (
    <div>
      <HeroSection
        kicker="Calendrier liturgique"
        title="Les rendez-vous de l'Éternel"
        subtitle="Les fêtes bibliques et les shabbats, avec les enseignements qui s'y rattachent. Le temps n'est pas neutre — Dieu a institué des rendez-vous (les mo'adim) pour son peuple."
        primaryCta={{ label: "Voir les enseignements", href: "/enseignements" }}
      />

      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Vue mensuelle"
            title="Calendrier des fêtes bibliques"
            subtitle="Cliquez sur une fête pour voir sa description, sa référence biblique, et activer des rappels. Les couleurs distinguent les fêtes de printemps (accomplies lors du premier avènement de Yeshoua) des fêtes d'automne (à accomplir lors de son retour)."
          />

          <div className="mt-12">
            <CalendarView events={serializedEvents} />
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Tableau des 7 fêtes */}
      <section className="bg-ivory py-20 md:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <PremiumSectionHeading
            kicker="Les sept fêtes de l'Éternel"
            title="Lévitique 23"
            subtitle="Les sept fêtes instituées par l'Éternel, accomplissement progressif du plan de rédemption. Les quatre fêtes de printemps ont été accomplies lors du premier avènement de Yeshoua ; les trois fêtes d'automne attendent leur accomplissement lors de son retour."
            center
          />

          <div className="mt-12 grid md:grid-cols-2 gap-4">
            <FeastCard name="Pessah" nameFr="Pâque" date="14 Nisan" accomplished="Yeshoua, l'Agneau de Dieu, crucifié à la Pâque" bibleRef="1 Corinthiens 5:7" color="#C9A227" />
            <FeastCard name="Matsot" nameFr="Pain sans levain" date="15-21 Nisan" accomplished="Yeshoua, le pain sans levain, sans péché" bibleRef="1 Corinthiens 5:8" color="#C9A227" />
            <FeastCard name="Reshit" nameFr="Prémices" date="lendemain du shabbat de Pessah" accomplished="Résurrection de Yeshoua, prémices de ceux qui sont morts" bibleRef="1 Corinthiens 15:20" color="#C9A227" />
            <FeastCard name="Shavouot" nameFr="Pentecôte" date="6 Sivan (50 jours après Pâque)" accomplished="Effusion du Saint-Esprit à Jérusalem" bibleRef="Actes 2:1-4" color="#C9A227" />
            <FeastCard name="Yom Terouah" nameFr="Trompettes" date="1 Tishri" accomplished="À venir — Retour du Messie au son du chofar" bibleRef="1 Thessaloniciens 4:16" color="#8C5FA8" pending />
            <FeastCard name="Yom Kippour" nameFr="Expiation" date="10 Tishri" accomplished="À venir — Jugement d'Israël et des nations" bibleRef="Hébreux 9:28" color="#B5502F" pending />
            <FeastCard name="Soukkot" nameFr="Tabernacles" date="15-21 Tishri" accomplished="À venir — Dieu tabernaclera parmi les hommes" bibleRef="Apocalypse 21:3" color="#5B7052" pending />
          </div>
        </div>
      </section>

      {/* Citation */}
      <section className="bg-imperial py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Que personne ne vous juge au sujet du manger ou du boire, ou au sujet d'une fête, d'une nouvelle lune, ou des shabbats : c'était l'ombre des choses à venir, mais le corps est en Christ."
            reference="Colossiens 2:16-17"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}

function FeastCard({
  name,
  nameFr,
  date,
  accomplished,
  bibleRef,
  color,
  pending,
}: {
  name: string;
  nameFr: string;
  date: string;
  accomplished: string;
  bibleRef: string;
  color: string;
  pending?: boolean;
}) {
  return (
    <div className="bg-ivory border border-stone/20 rounded-card p-5 hover:border-gold/40 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink">{nameFr}</h3>
          <p className="text-xs text-stone mt-0.5">{name} · {date}</p>
        </div>
        <div className="w-2 h-12 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <p className="text-sm text-ink/75 leading-relaxed mb-3">{accomplished}</p>
      <div className="flex items-center justify-between pt-3 border-t border-stone/15">
        <span className="text-xs text-stone verse-ref">{bibleRef}</span>
        {pending && (
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-lavender">
            À venir
          </span>
        )}
      </div>
    </div>
  );
}
