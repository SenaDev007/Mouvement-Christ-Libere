"use client";

/**
 * ⭐ V3.89 — Annonces du ministère (Back-office — super admins).
 *
 * Directive du pasteur : « même depuis le back-office, que les super
 * admins soient aussi capables de créer des annonces exactement comme le
 * secrétaire le fait depuis l'interface secrétariat ».
 *
 * Même composant, même table, même logique — le registre est partagé :
 * chaque annonce apparaît dans le secrétariat, sur la page publique
 * /annonces (si publiée) et peut être relayée à Yeshua Connect.
 *
 * Cette page règle AUSSI le 404 signalé sur le sous-domaine admin :
 * /annonces (ou /admin/annonces) ouvre désormais ce module.
 */

import { AnnoncesView } from "@/components/staff-space/annonces-view";

export default function AdminAnnoncesPage() {
  return (
    <AnnoncesView
      apiBase="/admin/api/annonces"
      sousTitre="Rédigez, programmez et publiez les annonces du ministère — le même registre que le secrétariat, accessible aux super admins."
    />
  );
}
