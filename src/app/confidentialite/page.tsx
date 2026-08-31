import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { ShieldCheck, Database, Eye, Clock, Server, Cookie, Lock, Mail, Users, FileText, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Mouvement Christ Libère",
  description:
    "Politique de confidentialité du site Mouvement Christ Libère : données collectées, finalités, durée de conservation, hébergement, cookies et vos droits.",
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

export default function ConfidentialitePage() {
  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1504082431402-cb5e50681959?q=80&w=1920&auto=format&fit=crop"
        kicker="Informations légales"
        title="Politique de confidentialité"
        subtitle="Comment le Mouvement Christ Libère collecte, utilise et protège vos données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD)."
        primaryCta={{ label: "Nous contacter", href: "/contact" }}
      />

      {/* Sommaire + contenu */}
      <section className="bg-[#FAF6EF] py-16 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Date + sommaire */}
          <div className="mb-10 p-5 rounded-2xl bg-white border border-[#8A8378]/15">
            <p className="text-xs text-[#8A8378] mb-4 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Dernière mise à jour : {LAST_UPDATED}
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-[#C9A227] font-semibold mb-2">
              Sommaire
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["#editeur", "1. Éditeur du site"],
                ["#donnees", "2. Données collectées"],
                ["#finalites", "3. Finalités et bases légales"],
                ["#conservation", "4. Durée de conservation"],
                ["#hebergement", "5. Hébergement et services tiers"],
                ["#cookies", "6. Cookies"],
                ["#securite", "7. Sécurité"],
                ["#droits", "8. Vos droits"],
                ["#modifications", "9. Modifications de la politique"],
                ["#contact", "10. Nous contacter"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="text-[#1E0F2B]/75 hover:text-[#C9A227] transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Section id="editeur" icon={<FileText className="w-5 h-5 text-[#C9A227]" />} title="1. Éditeur du site">
            <p>
              Le site <strong>mouvement-christ-libere.vercel.app</strong> (ci-après « le Site ») est
              édité par le <strong>Mouvement Christ Libère</strong>, une communauté chrétienne à but
              non lucratif dont la mission est le partage de témoignages, d&apos;enseignements
              bibliques et la vie de communauté au service du rassemblement.
            </p>
            <p>
              <strong>Responsable de la publication :</strong> l&apos;équipe pastorale du Mouvement
              Christ Libère. Pour toute question relative à la présente politique ou à vos données,
              vous pouvez nous écrire via la{" "}
              <Link href="/contact" className="text-[#C9A227] font-semibold hover:underline">page contact</Link>.
            </p>
          </Section>

          <Section id="donnees" icon={<Database className="w-5 h-5 text-[#C9A227]" />} title="2. Données collectées">
            <p>
              Le Site est un site vitrine et communautaire : il fonctionne{" "}
              <strong>sans publicité et sans revente de données</strong>. Selon votre utilisation,
              les catégories de données suivantes peuvent être collectées :
            </p>
            <ul className="space-y-2 list-none">
              {[
                ["Formulaires de contact", "nom, coordonnée (email ou téléphone) et message — uniquement si vous nous écrivez volontairement."],
                ["Témoignages", "prénom/pseudonyme et contenu du témoignage, si vous choisissez d'en publier un."],
                ["Comptes utilisateurs", "nom, email et mot de passe chiffré, pour les membres inscrits (accès aux canaux, intercession, appels…)."],
                ["Vidéos et lives", "interactions publiques (chat, réactions) liées aux retransmissions YouTube."],
                ["Données techniques", "journaux de connexion (adresse IP anonymisée, navigateur) conservés à des fins de sécurité."],
              ].map(([title, desc]) => (
                <li key={title} className="p-3 rounded-xl bg-white border border-[#8A8378]/10">
                  <strong className="text-[#1E0F2B]">{title} :</strong> {desc}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="finalites" icon={<Users className="w-5 h-5 text-[#C9A227]" />} title="3. Finalités et bases légales">
            <p>Vos données ne sont utilisées que pour les finalités suivantes :</p>
            <ul className="space-y-1.5 pl-5 list-disc">
              <li><strong>Répondre à vos demandes</strong> de contact ou d&apos;intercession (base légale : votre consentement) ;</li>
              <li><strong>Gérer votre compte membre</strong> et l&apos;accès aux espaces communautaires (exécution du service demandé) ;</li>
              <li><strong>Publier vos témoignages et enseignements</strong> avec votre accord explicite ;</li>
              <li><strong>Assurer la sécurité du Site</strong> et prévenir les abus (intérêt légitime).</li>
            </ul>
            <p>
              Aucune décision automatisée ni profilage publicitaire n&apos;est réalisé à partir de
              vos données.
            </p>
          </Section>

          <Section id="conservation" icon={<Clock className="w-5 h-5 text-[#C9A227]" />} title="4. Durée de conservation">
            <ul className="space-y-1.5 pl-5 list-disc">
              <li><strong>Demandes de contact :</strong> 24 mois après le dernier échange, puis suppression ;</li>
              <li><strong>Comptes membres :</strong> pendant la durée de l&apos;inscription, puis 12 mois avant anonymisation ;</li>
              <li><strong>Témoignages publiés :</strong> jusqu&apos;à votre demande de retrait ;</li>
              <li><strong>Journaux techniques :</strong> 12 mois maximum.</li>
            </ul>
          </Section>

          <Section id="hebergement" icon={<Server className="w-5 h-5 text-[#C9A227]" />} title="5. Hébergement et services tiers">
            <p>
              Le Site est hébergé par <strong>Vercel Inc.</strong> (410 Terry Ave North, Seattle, WA
              98109, États-Unis), qui applique les clauses contractuelles types de la Commission
              européenne pour le transfert des données hors Union européenne.
            </p>
            <p>Des services tiers strictement nécessaires au fonctionnement sont utilisés :</p>
            <ul className="space-y-1.5 pl-5 list-disc">
              <li>
                <strong>YouTube (Google LLC)</strong> — retransmission des cultes et enseignements en
                direct, hébergement public des replays. Les vidéos intégrées au Site peuvent déposer
                des cookies propres à Google lorsque vous les regardez ;
              </li>
              <li><strong>Cloudflare (R2)</strong> — stockage des fichiers multimédias (miniatures, archives) ;</li>
              <li><strong>Services de visioconférence</strong> — appels audio/vidéo et salons communautaires.</li>
            </ul>
            <p>
              Ces prestataires agissent en qualité de sous-traitants et sont liés par leurs propres
              engagements de confidentialité.
            </p>
          </Section>

          <Section id="cookies" icon={<Cookie className="w-5 h-5 text-[#C9A227]" />} title="6. Cookies">
            <p>
              Le Site n&apos;utilise <strong>aucun cookie publicitaire ni traceur analytique tiers</strong>.
              Seuls des cookies techniques indispensables sont déposés : maintien de votre session
              administrateur ou membre et sécurisation des formulaires. Ils ne nécessitent pas de
              consentement au sens de la réglementation, car le Site ne fonctionnerait pas sans eux.
            </p>
            <p>
              Les lecteurs YouTube intégrés dans les pages « Lives » et « Vidéos » peuvent, eux,
              déposer des cookies de mesure d&apos;audience propres à Google. Vous pouvez les
              refuser à tout moment via les{" "}
              <a
                href="https://policies.google.com/technologies/cookies?hl=fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9A227] font-semibold hover:underline inline-flex items-center gap-1"
              >
                paramètres de confidentialité de Google <Globe className="w-3 h-3" />
              </a>.
            </p>
          </Section>

          <Section id="securite" icon={<Lock className="w-5 h-5 text-[#C9A227]" />} title="7. Sécurité">
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
              protéger vos données : chiffrement HTTPS sur l&apos;ensemble du Site, mots de passe
              jamais stockés en clair (hachage), accès administrateur protégé par session signée,
              principe du moindre privilège pour l&apos;équipe technique, et sauvegardes régulières
              des contenus.
            </p>
            <p>
              En cas de violation de données susceptible d&apos;engendrer un risque élevé pour vos
              droits, vous seriez informé sans délai injustifié, conformément à l&apos;article 34 du RGPD.
            </p>
          </Section>

          <Section id="droits" icon={<Eye className="w-5 h-5 text-[#C9A227]" />} title="8. Vos droits">
            <p>
              Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits
              suivants sur vos données personnelles :
            </p>
            <div className="flex flex-wrap gap-2 my-2">
              {["Accès", "Rectification", "Effacement", "Limitation", "Opposition", "Portabilité", "Retrait du consentement"].map((d) => (
                <span
                  key={d}
                  className="px-3 py-1.5 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/25 text-xs font-semibold text-[#1E0F2B]"
                >
                  {d}
                </span>
              ))}
            </div>
            <p>
              Pour exercer ces droits, écrivez-nous via la{" "}
              <Link href="/contact" className="text-[#C9A227] font-semibold hover:underline">page contact</Link>{" "}
              en précisant votre demande. Nous répondons sous 30 jours maximum. Vous pouvez également
              introduire une réclamation auprès de votre autorité de protection des données (en
              France : la CNIL, www.cnil.fr).
            </p>
          </Section>

          <Section id="modifications" icon={<FileText className="w-5 h-5 text-[#C9A227]" />} title="9. Modifications de la politique">
            <p>
              La présente politique peut être mise à jour pour refléter l&apos;évolution du Site ou de
              la réglementation. La date de dernière modification figure en tête de page ; en cas de
              changement substantiel, un bandeau d&apos;information serait affiché sur le Site.
            </p>
          </Section>

          <Section id="contact" icon={<Mail className="w-5 h-5 text-[#C9A227]" />} title="10. Nous contacter">
            <p>
              Pour toute question relative à la protection des données, l&apos;exercice de vos droits
              ou le contenu de cette politique, la voie la plus rapide est notre{" "}
              <Link href="/contact" className="text-[#C9A227] font-semibold hover:underline">formulaire de contact</Link>.
              L&apos;équipe pastorale s&apos;engage à répondre sous 24 à 48 heures.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-[#2A0E3D]/5 border border-[#C9A227]/20 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                <strong>En résumé :</strong> nous ne collectons que le strict nécessaire, nous ne
                vendons rien, nous ne pistons personne — votre vie privée est respectée comme une
                confiance qui nous est confiée.
              </p>
            </div>
          </Section>
        </div>
      </section>
    </div>
  );
}
