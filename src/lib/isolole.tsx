/**
 * ============================================================
 * ⭐ V3.45 — ISOLÉLÉ (ISRAËL) — Transformation d'affichage
 * ============================================================
 *
 * Directive du pasteur : toute référence à « Israël » sur toutes les
 * pages du site doit s'afficher « Isolélé (Israël) », avec
 * « Isolélé » en GRAS partout.
 *
 * STRATÉGIE — transformation au RENDU (jamais dans les données) :
 *   - les textes bruts (code, DB, markdown du back-office)
 *     continuent d'écrire « Israël » ;
 *   - <IsololeText> découpe le texte et affiche
 *     <strong>Isolélé</strong> (Israël) ;
 *   - MarkdownText pré-transforme le markdown source
 *     (« **Isolélé** (Israël) ») ;
 *   - isololePlain() pour les contextes non-HTML (presse-papiers,
 *     attributs alt, noms de pays…).
 *
 * Motif reconnu : le mot isolé « Israël » (et « Israel » sans
 * diacritiques — versions étrangères de la Bible) — PAS les mots
 * dérivés (« Israélite », « Israélien »…).
 *
 * Ce fichier est un composant PARTAGÉ (aucun "use client", aucune API
 * navigateur) : importable depuis les composants serveur ET client.
 */

import React from "react";

const ISRAEL_WORD = /\b(Isra[ëe]l)\b/g;

/** Le mot « Israël » est-il présent (utile pour éviter du travail inutile) ? */
export function contientIsrael(text: string | null | undefined): boolean {
  if (!text) return false;
  ISRAEL_WORD.lastIndex = 0;
  return ISRAEL_WORD.test(text);
}

export interface IsololeSegment {
  text: string;
  /** true = ce segment est le mot « Israël » (→ Isolélé gras + (Israël)). */
  isIsrael: boolean;
}

/** Découpe un texte en segments autour des occurrences d'« Israël ». */
export function splitIsolole(text: string): IsololeSegment[] {
  if (!text) return [];
  const segments: IsololeSegment[] = [];
  ISRAEL_WORD.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ISRAEL_WORD.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isIsrael: false });
    }
    segments.push({ text: match[0], isIsrael: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isIsrael: false });
  }
  return segments;
}

/**
 * Composant de rendu : « …des dispersés d'Israël… » s'affiche
 * « …des dispersés d'<strong>Isolélé</strong> (Israël)… ».
 * Utilisable partout où un texte utilisateur/DB/code est rendu.
 */
export function IsololeText({
  children,
  as: Tag = React.Fragment,
}: {
  children: string | null | undefined;
  /** Optionnel : envelopper chaque segment dans un tag (span, p…). */
  as?: keyof React.JSX.IntrinsicElements;
}) {
  if (!children) return null;
  const segments = splitIsolole(children);
  if (segments.length === 0) return <>{children}</>;
  // Cas rapide : aucune occurrence → texte brut, zéro DOM supplémentaire
  if (!segments.some((s) => s.isIsrael)) return <>{children}</>;

  const content = segments.map((seg, i) =>
    seg.isIsrael ? (
      <strong key={i} className="font-bold">
        Isolélé{" "}
        <span className="font-normal">({seg.text})</span>
      </strong>
    ) : (
      <React.Fragment key={i}>{seg.text}</React.Fragment>
    )
  );
  if (Tag === React.Fragment) return <>{content}</>;
  const T = Tag as React.ElementType;
  return <T>{content}</T>;
}

/**
 * Transformation pour SOURCE MARKDOWN (MarkdownText, biographies,
 * enseignements, témoignages issus de la base) :
 * « Israël » → « **Isolélé** (Israël) ».
 */
export function isololeMarkdown(text: string | null | undefined): string {
  if (!text || !contientIsrael(text)) return text ?? "";
  return text.replace(ISRAEL_WORD, "**Isolélé** ($1)");
}

/**
 * Transformation TEXTE BRUT (presse-papiers, attributs alt/title,
 * libellés non-HTML) : « Israël » → « Isolélé (Israël) ».
 */
export function isololePlain(text: string | null | undefined): string {
  if (!text || !contientIsrael(text)) return text ?? "";
  return text.replace(ISRAEL_WORD, "Isolélé ($1)");
}
