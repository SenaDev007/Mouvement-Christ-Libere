/**
 * Loading UI pour l'admin — affiché pendant le chargement des Server Components.
 *
 * ⭐ V3.93 — CORRECTION DU « CERCLE DOUBLÉ ET DÉCALÉ » :
 * l'ancienne version superposait deux cercles frères avec `-mt-12` pour
 * compenser un `mb-3` de 12 px → décalage PERMANENT de 12 px entre la pâte
 * et l'arc rotatif, signalé par le pasteur comme « superposé mais décalé,
 * pas professionnel ». Désormais le composant unifié ChargementInline place
 * l'anneau rotatif en `absolute inset-0` — alignement au pixel près,
 * identique au site public. V3.96 : logo « Z » du gabarit retiré.
 */
import { ChargementInline } from "@/components/site/chargement-inline";

export default function AdminLoading() {
  return <ChargementInline libelle="Chargement…" />;
}
