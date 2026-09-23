/**
 * Loading UI — affiché pendant le streaming server components.
 *
 * ⭐ V3.93 — Utilise ChargementInline (composant unifié V3.93) :
 * un seul anneau parfaitement centré, plus aucun risque de cercle
 * « doublé et décalé » (l'ancien admin/loading.tsx empilait deux cercles
 * décalés de 12 px — retour pasteur). V3.96 : logo « Z » du gabarit
 * retiré (retour pasteur — il s'affichait sur les 4 points d'entrée).
 * Copywriting conservé : « Un instant... »
 */
import { ChargementInline } from "@/components/site/chargement-inline";

export default function Loading() {
  return <ChargementInline libelle="Un instant…" />;
}
