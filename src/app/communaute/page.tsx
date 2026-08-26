import { redirect } from "next/navigation";

/**
 * ⭐ La page Communauté est maintenant fusionnée dans Yeshua Connect.
 *    Tous les canaux, groupes, annonces, intercession, etc. sont accessibles
 *    directement depuis le chat Yeshua Connect.
 *
 *    Redirection permanente vers /yeshua-connect.
 */
export default function CommunautePage() {
  redirect("/yeshua-connect");
}
