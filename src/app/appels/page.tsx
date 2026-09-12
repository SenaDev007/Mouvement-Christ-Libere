import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";
import { PageHero } from "@/components/site/page-hero";
import { PremiumSectionHeading } from "@/components/premium/section-heading";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import { CallScreen } from "@/components/premium/call-screen";
import { PhoneCall, PhoneMissed, Video, Phone, Clock, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic"; // Force dynamic — évite le pré-render au build (pas de DB au build)

export default async function AppelsPage() {
  // ⭐ V3.45 — Section hero paramétrable (back-office /admin/heroes)
  const hero = await getHero("appels");

  // Pour la démo, on simule un historique d'appels
  // En production, ces données viendraient de la table Call
  const mockHistory = [
    { id: "1", type: "AUDIO", direction: "outgoing", contact: "Pam", duration: 1245, status: "ANSWERED", date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: "2", type: "VIDEO", direction: "incoming", contact: "Pasteur Kongo", duration: 0, status: "MISSED", date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { id: "3", type: "AUDIO", direction: "incoming", contact: "Équipe pastorale", duration: 678, status: "ANSWERED", date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { id: "4", type: "VIDEO", direction: "outgoing", contact: "Pam", duration: 2134, status: "ANSWERED", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
  };

  return (
    <div>
      <PageHero
        imageSrc={hero.backgroundImage}
        kicker={hero.kicker}
        title={hero.title}
        subtitle={hero.subtitle}
        primaryCta={hero.ctaLabel ? { label: hero.ctaLabel, href: hero.ctaHref } : undefined}
        secondaryCta={hero.cta2Label ? { label: hero.cta2Label, href: hero.cta2Href } : undefined}
      />

      {/* Interface d'appel */}
      <section id="start" className="bg-[#F0E9DE] py-20 md:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <PremiumSectionHeading
            kicker="Nouvel appel"
            title="Démarrer un appel"
            subtitle="Choisissez un contact et le type d'appel. Les appels nécessitent l'accès à votre microphone et, pour les appels vidéo, à votre caméra."
            center
          />

          <div className="mt-12 max-w-2xl mx-auto">
            <CallScreen />
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Historique */}
      <section className="bg-[#F0E9DE] py-20 md:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          <PremiumSectionHeading
            kicker="Historique"
            title="Appels récents"
            subtitle="Retrouvez ici l'historique de vos appels — entrants, sortants, manqués. En cas d'appel manqué, vous pouvez rappeler en un clic."
          />

          <div className="mt-12 space-y-3">
            {mockHistory.map((call) => (
              <div
                key={call.id}
                className={cn(
                  "card-gold-top p-4 flex items-center justify-between",
                  call.status === "MISSED" && "border-state-danger/30"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Icône direction */}
                  <div
                    className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-full",
                      call.status === "MISSED"
                        ? "bg-state-danger/10 text-state-danger"
                        : call.direction === "outgoing"
                          ? "bg-state-success/10 text-state-success"
                          : "bg-[#000000]/10 text-[#000000]"
                    )}
                  >
                    {call.status === "MISSED" ? (
                      <PhoneMissed className="w-4 h-4" />
                    ) : call.direction === "outgoing" ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>

                  {/* Infos */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#000000]">{call.contact}</p>
                      {call.type === "VIDEO" ? (
                        <Video className="w-3.5 h-3.5 text-[#8A857C]" />
                      ) : (
                        <Phone className="w-3.5 h-3.5 text-[#8A857C]" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#8A857C] mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(call.date).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {call.status === "ANSWERED" && (
                        <span>· {formatDuration(call.duration)}</span>
                      )}
                      {call.status === "MISSED" && (
                        <span className="text-state-danger font-semibold">· Manqué</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bouton rappeler */}
                <button
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    call.type === "VIDEO"
                      ? "bg-[#000000]/10 text-[#000000] hover:bg-[#000000] hover:text-[#F0E9DE]"
                      : "bg-state-success/10 text-state-success hover:bg-state-success hover:text-[#F0E9DE]"
                  )}
                  aria-label="Rappeler"
                >
                  {call.type === "VIDEO" ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <PhoneCall className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Bandeau d'info */}
          <div className="mt-8 p-4 bg-[#000000]/5 border border-[#C9A227]/20 rounded-2xl">
            <p className="text-xs text-[#8A857C] leading-relaxed">
              <PhoneCall className="w-3.5 h-3.5 inline mr-1.5 text-[#C9A227]" />
              Les appels d'urgence (marqués comme urgents) peuvent contourner le mode
              « ne pas déranger » de Pam ou du Pasteur Kongo, à condition d'être validés
              par un modérateur de confiance. Cette fonctionnalité sert l'équivalent
              numérique du devoir pastoral de veille.
            </p>
          </div>
        </div>
      </section>

      {/* Citation */}
      <section className="bg-[#000000] py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ."
            reference="Galates 6:2"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
