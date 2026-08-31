import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SectionDivider, QuoteBlock } from "@/components/premium/section-divider";
import {
  FileSignature, Globe, Users, UserCheck, MessageSquareHeart, ShieldAlert,
  Copyright, Ban, HeartHandshake, Youtube, Scale, PenLine, Mail,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Mouvement Christ Libère",
  description:
    "Conditions générales d'utilisation du site Mouvement Christ Libère : accès aux services, comptes, contenus des membres, modération, propriété intellectuelle et responsabilités.",
};

// ─── Composants ─────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ id, icon, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 mb-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="font-serif text-xl md:text-2xl font-bold text-[#1E0F2B]">{title}</h2>
      </div>
      <div className="md:pl-13 space-y-3 text-sm md:text-[15px] leading-relaxed text-[#1E0F2B]/80">
        {children}
      </div>
    </section>
  );
}

const LAST_UPDATED = "31 août 2026";

export default function ConditionsPage() {
  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1519494026892-50bb91962141?q=80&w=1920&auto=format&fit=crop"
        kicker="Informations légales"
        title="Conditions d'utilisation"
        subtitle="Les règles qui encadrent l'utilisation du site du Mouvement Christ Libère : espaces communautaires, publication de contenus, retransmissions et responsabilités de chacun."
        primaryCta={{ label: "Lire la politique de confidentialité", href: "/confidentialite" }}
      />

      {/* Sommaire + contenu */}
      <section className="bg-[#FAF6EF] py-16 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Date + sommaire */}
          <div className="mb-10 p-5 rounded-2xl bg-white border border-[#8A8378]/15">
            <p className="text-xs text-[#8A8378] mb-4">Dernière mise à jour : {LAST_UPDATED}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-[#C9A227] font-semibold mb-2">
              Sommaire
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["#objet", "1. Objet et acceptation"],
                ["#services", "2. Description des services"],
                ["#compte", "3. Compte utilisateur"],
                ["#contenus", "4. Contenus des membres"],
                ["#moderation", "5. Modération"],
                ["#propriete", "6. Propriété intellectuelle"],
                ["#interdits", "7. Usages interdits"],
                ["#dons", "8. Contributions et dons"],
                ["#youtube", "9. Retransmissions YouTube"],
                ["#responsabilite", "10. Responsabilités et garanties"],
                ["#modifications-cgu", "11. Modification des conditions"],
                ["#contact-cgu", "12. Contact et droit applicable"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="text-[#1E0F2B]/75 hover:text-[#C9A227] transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Section id="objet" icon={<FileSignature className="w-5 h-5 text-[#C9A227]" />} title="1. Objet et acceptation">
            <p>
              Les présentes conditions générales d&apos;utilisation (ci-après « CGU ») régissent
              l&apos;accès et l&apos;utilisation du site{" "}
              <strong>mouvement-christ-libere.vercel.app</strong> édité par le Mouvement Christ
              Libère. En naviguant sur le Site, en créant un compte ou en utilisant l&apos;un de ses
              services, vous acceptez sans réserve les présentes CGU.
            </p>
            <p>
              Si vous n&apos;acceptez pas tout ou partie de ces conditions, merci de ne pas utiliser
              le Site. L&apos;utilisation du Site est réservée aux personnes majeures ; les mineurs
              ne peuvent y accéder qu&apos;avec l&apos;accord et sous la supervision de leurs
              parents ou tuteurs légaux.
            </p>
          </Section>

          <Section id="services" icon={<Globe className="w-5 h-5 text-[#C9A227]" />} title="2. Description des services">
            <p>Le Site met gratuitement à disposition les services suivants :</p>
            <ul className="space-y-1.5 pl-5 list-disc">
              <li>Consultation des <strong>témoignages, enseignements et vidéos</strong> du ministère ;</li>
              <li><strong>Retransmission en direct</strong> des cultes et rencontres (YouTube Live) ;</li>
              <li>Espaces communautaires : <strong>canaux, chaîne d&apos;intercession, appels audio/vidéo</strong>, carte des dispersés ;</li>
              <li><strong>Calendrier biblique</strong>, Bible interconnectée et outils d&apos;édification ;</li>
              <li>Formulaire de <strong>contact</strong> et de demande d&apos;intercession.</li>
            </ul>
            <p>
              L&apos;équipe pastorale s&apos;efforce d&apos;assurer la disponibilité continue du
              Site, mais ne peut garantir une absence totale d&apos;interruptions (maintenance,
              pannes techniques, prestataires tiers).
            </p>
          </Section>

          <Section id="compte" icon={<UserCheck className="w-5 h-5 text-[#C9A227]" />} title="3. Compte utilisateur">
            <p>
              Certains espaces nécessitent un compte membre. Vous vous engagez à fournir des
              informations exactes, à garder votre mot de passe confidentiel et à avertir
              rapidement l&apos;équipe en cas d&apos;utilisation frauduleuse de votre compte. Vous
              restez responsable de l&apos;activité menée sous votre identifiant.
            </p>
            <p>
              L&apos;équipe se réserve le droit de suspendre ou supprimer un compte en cas de
              manquement aux présentes CGU, de comportement contraire à l&apos;esprit de la
              communauté, ou de tentative de compromission du Site.
            </p>
          </Section>

          <Section id="contenus" icon={<MessageSquareHeart className="w-5 h-5 text-[#C9A227]" />} title="4. Contenus des membres">
            <p>
              Lorsque vous publiez un témoignage, un message dans un canal ou une réaction, vous
              restez <strong>l&apos;auteur et propriétaire</strong> de votre contribution, et vous
              accordez au Mouvement Christ Libère une licence non exclusive, gratuite et
              révocable d&apos;affichage sur le Site, strictement limitée à la diffusion du contenu
              dans l&apos;espace concerné.
            </p>
            <p>
              Vous garantissez disposer des droits sur les contenus publiés (textes, images,
              enregistrements) et vous vous engagez à ne publier que des contenus conformes à la
              doctrine de respect et de bienveillance de la communauté. Vous pouvez demander à tout
              moment le retrait d&apos;un contenu que vous avez publié.
            </p>
          </Section>

          <Section id="moderation" icon={<ShieldAlert className="w-5 h-5 text-[#C9A227]" />} title="5. Modération">
            <p>
              Les contenus publiés par les membres peuvent être relus a posteriori par
              l&apos;équipe de modération. Tout contenu contraire aux CGU, à l&apos;ordre public ou
              aux valeurs de la communauté (insultes, hérésies provocatrices, prosélytisme
              agressif, spam, contenus diffamatoires ou illicites) peut être retiré sans préavis,
              avec information de son auteur lorsque cela est possible.
            </p>
          </Section>

          <Section id="propriete" icon={<Copyright className="w-5 h-5 text-[#C9A227]" />} title="6. Propriété intellectuelle">
            <p>
              L&apos;ensemble des éléments du Site (structure, textes, visuels, logo, charte
              graphique, enseignements, vidéos) est protégé par le droit d&apos;auteur. Sauf
              mention contraire, les droits appartiennent au Mouvement Christ Libère ou à leurs
              auteurs respectifs, comme rappelé en pied de page : « Tous les contenus appartiennent
              à leurs auteurs. Usage personnel et non commercial. »
            </p>
            <p>
              Toute reproduction, adaptation ou diffusion des contenus du Site à des fins
              commerciales est interdite sans autorisation écrite préalable. Le partage spontané
              des enseignements et témoignages est en revanche encouragé, dans le respect de
              l&apos;intégrité des messages et de la mention de leur source.
            </p>
          </Section>

          <Section id="interdits" icon={<Ban className="w-5 h-5 text-[#C9A227]" />} title="7. Usages interdits">
            <p>Il vous est notamment interdit de :</p>
            <ul className="space-y-1.5 pl-5 list-disc">
              <li>porter atteinte à l&apos;intégrité ou au bon fonctionnement technique du Site (intrusions, robots massifs, exactions automatisées) ;</li>
              <li>collecter les données personnelles d&apos;autres membres sans leur accord ;</li>
              <li>usurper l&apos;identité d&apos;un tiers, en particulier d&apos;un serviteur du ministère ;</li>
              <li>publier des contenus illicites, haineux, discriminatoires ou contraires à la dignité humaine ;</li>
              <li>utiliser le Site à des fins commerciales, publicitaires ou de sollicitation non sollicitée.</li>
            </ul>
          </Section>

          <Section id="dons" icon={<HeartHandshake className="w-5 h-5 text-[#C9A227]" />} title="8. Contributions et dons">
            <p>
              Les éventuelles contributions financières au ministère sont libres, volontaires et
              sans contrepartie. Elles sont affectées à la mission du Mouvement Christ Libère
              (retransmissions, outils communautaires, aide aux dispersés). Aucune contribution
              n&apos;est requise pour accéder aux services du Site.
            </p>
          </Section>

          <Section id="youtube" icon={<Youtube className="w-5 h-5 text-red-600" />} title="9. Retransmissions YouTube">
            <p>
              Les cultes et enseignements sont retransmis en direct puis conservés sous forme de
              replays sur la chaîne YouTube publique du ministère, et intégrés au Site via le
              lecteur officiel YouTube. En participant au chat d&apos;un live, vos messages sont
              publics et soumis aux{" "}
              <a
                href="https://www.youtube.com/t/terms?hl=fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9A227] font-semibold hover:underline"
              >
                conditions d&apos;utilisation de YouTube
              </a>{" "}
              ainsi qu&apos;à leur politique de confidentialité.
            </p>
            <p>
              Le Site ne saurait être tenu responsable des interruptions de diffusion imputables à
              la plateforme YouTube (coupures, modération automatique, indisponibilité du service).
            </p>
          </Section>

          <Section id="responsabilite" icon={<Scale className="w-5 h-5 text-[#C9A227]" />} title="10. Responsabilités et garanties">
            <p>
              Le Site est fourni « en l&apos;état ». Le Mouvement Christ Libère ne garantit pas que
              le Site soit exempt d&apos;erreurs ou d&apos;interruptions. Sa responsabilité ne
              saurait être engagée pour tout dommage indirect résultant de l&apos;utilisation du
              Site (perte de données, perte d&apos;opportunité, impossibilité momentanée
              d&apos;accéder à un service).
            </p>
            <p>
              Les liens externes proposés renvoient vers des sites tiers dont le contenu
              n&apos;engage pas la responsabilité du Mouvement Christ Libère.
            </p>
          </Section>

          <Section id="modifications-cgu" icon={<PenLine className="w-5 h-5 text-[#C9A227]" />} title="11. Modification des conditions">
            <p>
              Les présentes CGU peuvent être modifiées à tout moment afin de refléter l&apos;évolution
              des services. La version applicable est celle publiée en ligne au moment de votre
              utilisation ; la date de dernière mise à jour figure en tête de page. L&apos;utilisation
              continue du Site après publication vaut acceptation de la nouvelle version.
            </p>
          </Section>

          <Section id="contact-cgu" icon={<Mail className="w-5 h-5 text-[#C9A227]" />} title="12. Contact et droit applicable">
            <p>
              Toute question relative aux présentes CGU peut être adressée via la{" "}
              <Link href="/contact" className="text-[#C9A227] font-semibold hover:underline">page contact</Link>.
              Les présentes conditions sont soumises au droit applicable dans le pays de siège du
              ministère ; en cas de litige, les parties s&apos;engagent à rechercher d&apos;abord une
              solution amiable, dans un esprit de réconciliation évangélique.
            </p>
          </Section>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation finale */}
      <section className="bg-[#2A0E3D] py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A227]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative">
          <QuoteBlock
            text="Que toutes choses se fassent avec convenance et avec ordre."
            reference="1 Corinthiens 14:40"
            variant="dark"
          />
        </div>
      </section>
    </div>
  );
}
