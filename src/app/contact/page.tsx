import { redirect } from "next/navigation";

/**
 * ⭐ V3.74 — Page /contact RETIRÉE.
 *
 * Le module « Demandes de contact » (back-office) a été supprimé — le
 * Secrétariat couvre entièrement ce besoin via le formulaire public
 * /rendez-vous (demande de rencontre pré-remplie dans le flux de la
 * secrétaire, transmission au serviteur, validation, suivi public par
 * code). Les anciens liens « Contact » (navbar, footer, moteurs) sont
 * redirigés ici vers /rendez-vous — redirection permanente 308 côté
 * navigation client (redirect() utilise 307, suffisant car les liens
 * internes pointent désormais directement vers /rendez-vous).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nous contacter | Christ Libère",
  description:
    "Pour rencontrer un serviteur de Dieu, déposez votre demande de rendez-vous — le secrétariat l'examine et la transmet.",
};

export default function ContactPage() {
  redirect("/rendez-vous");
}
