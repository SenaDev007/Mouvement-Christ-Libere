/**
 * ⭐ V4.16 — MODE MUET GLOBAL DES SONNERIES (demande pasteur).
 * ============================================================================
 *
 * « Je voudrais qu'il y ait quand même un bouton lié pour pouvoir mettre
 * le son, la sonnerie en muet au cas où ça dérangerait l'utilisateur.
 * L'utilisateur peut cliquer et activer le mode muet pour ne pas que ça
 * le dérange. Donc nous allons mettre ça partout où la sonnerie
 * résonne. Pareil côté web aussi. »
 *
 * Une préférence UNIQUE, persistée (localStorage), partagée par toutes
 * les sonneries spontanées du site :
 *   • le shofar de la page de chargement (intro, 30 s) ;
 *   • la sonnerie d'appel sortant (ringback.wav, Yeshua Connect) ;
 *   • le bi-bip d'appel entrant (WebAudio, plein écran) ;
 *   • le shofar automatique du ShofarNotifier (entrées de Shabbat /
 *     solennités — en plus des préférences propres au calendrier).
 *
 * Les lectures EXPLICITES (bouton « Écouter » du calendrier, notes
 * vocales, vidéos…) ne sont PAS concernées : l'utilisateur demande
 * lui-même à entendre.
 *
 * Même mécanique que les préférences du shofar (ShofarNotifier.tsx) :
 * localStorage + événement custom pour réagir en direct dans tous les
 * composants ouverts.
 */

export const CLE_SONNERIE_MUETTE = "mcl-sonnerie-muette";
export const EVENEMENT_SONNERIE_MUETTE = "mcl-sonnerie-muette-change";

/** Lit la préférence (défaut : sonneries actives). Sûr en SSR. */
export function lireSonnerieMuette(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLE_SONNERIE_MUETTE) === "1";
  } catch {
    return false;
  }
}

/** Écrit la préférence + notifie les composants ouverts. */
export function ecrireSonnerieMuette(muet: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_SONNERIE_MUETTE, muet ? "1" : "0");
    window.dispatchEvent(
      new CustomEvent(EVENEMENT_SONNERIE_MUETTE, { detail: { muet } })
    );
  } catch {
    /* stockage indisponible : la session vit sans préférence */
  }
}

/** Bascule la préférence — retourne la nouvelle valeur. */
export function basculerSonnerieMuette(): boolean {
  const nouveau = !lireSonnerieMuette();
  ecrireSonnerieMuette(nouveau);
  return nouveau;
}
