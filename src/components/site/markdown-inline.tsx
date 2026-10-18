"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { normaliserMarkdown } from "@/lib/markdown-normal";
import { isololeMarkdown } from "@/lib/isolole";

/**
 * ⭐ V4.13 — MARKDOWN INLINE pour les EXTRAITS et RÉSUMÉS.
 *
 * Problème : les extraits (hero des pages détail, citation
 * d'ouverture, cartes de liste) étaient rendus en TEXTE BRUT —
 * si la rédaction écrit « **Israël** » ou « * Watchman * »,
 * les astérisques s'affichaient tels quels.
 *
 * Ce composant rend les emphases EN GRAS / ITALIQUE inline —
 * sans créer de paragraphes ni de listes (contexte : résumé
 * monligne dans une carte ou un hero). Comportement :
 *   · `**gras**`, `__gras__`        → <strong>
 *   · `*italique*`, `_italique_`    → <em>
 *   · `***gras italique***`         → <strong><em>
 *   · titres `#`, `>` et puces `-`  → supprimés (extraits)
 *   · « Israël »                    → « Isolélé (Israël) » (gras)
 *   · retours à la ligne            → espaces (résumé compact)
 *
 * Le gras hérite la couleur du parent (texte courant) — seul
 * le poids change : sobre et professionnel partout.
 */

interface MarkdownInlineProps {
  children: string | null | undefined;
  className?: string;
}

/** Motif d'emphalyse inline : ***…***, **…**, *…* (non-gourmand, pas de * interne). */
const MOTIF_EMPHASE = /(\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g;

function renduInline(texte: string): React.ReactNode[] {
  const parties = texte.split(MOTIF_EMPHASE).filter((p) => p !== "");
  return parties.map((partie, i) => {
    if (partie.startsWith("***") && partie.endsWith("***") && partie.length > 6) {
      return (
        <strong key={i} className="font-semibold">
          <em>{partie.slice(3, -3)}</em>
        </strong>
      );
    }
    if (partie.startsWith("**") && partie.endsWith("**") && partie.length > 4) {
      return <strong key={i} className="font-semibold">{partie.slice(2, -2)}</strong>;
    }
    if (partie.startsWith("*") && partie.endsWith("*") && partie.length > 2) {
      return <em key={i}>{partie.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{partie}</React.Fragment>;
  });
}

export function MarkdownInline({ children, className }: MarkdownInlineProps) {
  if (!children) return null;

  // 1. Réparer les emphases mal formées (« ** ainsi ** ») ;
  // 2. Isolélé : « Israël » → « **Isolélé** (Israël) » ;
  // 3. Extraits : titres « # », citations « > » et puces « - » supprimés,
  //    retours à la ligne compactés (contexte = résumé, pas article).
  let source = normaliserMarkdown(children);
  source = source
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*&gt;\s?/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  source = isololeMarkdown(source);

  return <span className={cn(className)}>{renduInline(source)}</span>;
}
