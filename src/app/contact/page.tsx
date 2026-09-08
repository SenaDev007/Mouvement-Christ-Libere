import { getHero } from "@/lib/heroes";
import { ContactView } from "@/components/site/contact-view";

/**
 * ⭐ V3.45 — PAGE SERVEUR /contact.
 *
 * Charge la config du hero (back-office /admin/heroes) et la transmet
 * à la vue cliente (formulaire de contact inchangé).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact | Christ Libère",
  description:
    "Laissez-nous vos coordonnées — un membre de l'équipe pastorale revient vers vous sous 24h.",
};

export default async function ContactPage() {
  const hero = await getHero("contact");
  return <ContactView hero={hero} />;
}
