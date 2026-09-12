"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { isololeMarkdown } from "@/lib/isolole";

/**
 * MarkdownText — rendu Markdown propre pour les contenus de Christ Libère.
 *
 * Rend les **gras**, *italiques*, paragraphes, listes, titres numérotés, etc.
 * sans afficher les astérisques bruts.
 *
 * Styles alignés sur le design system (violet impérial + or).
 *
 * ⭐ V3.45 — ISOLÉLÉ : le markdown source est pré-transformé — tout mot
 * « Israël » s'affiche « **Isolélé** (Israël) » (Isolélé en gras).
 * Couvre TOUS les contenus de la base affichés via ce composant :
 * biographies, enseignements, témoignages, pages serviteurs…
 */

interface MarkdownTextProps {
  children: string;
  className?: string;
  variant?: "light" | "dark";
}

export function MarkdownText({ children, className, variant = "light" }: MarkdownTextProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        isDark ? "prose-invert" : "",
        // Paragraphes
        isDark
          ? "[&_p]:text-[#F0E9DE]/80 [&_strong]:text-[#C9A227] [&_em]:text-[#F0E9DE]/90"
          : "[&_p]:text-[#000000]/80 [&_strong]:text-[#000000] [&_strong]:font-semibold [&_em]:text-[#000000]/70",
        // Liens
        "[&_a]:text-[#C9A227] [&_a]:no-underline hover:[&_a]:underline",
        // Listes
        "[&_ul]:list-disc [&_ul]:my-4 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:my-4 [&_ol]:space-y-1.5 [&_li]:ml-5 [&_li]:leading-relaxed",
        // Blockquotes
        "[&_blockquote]:border-l-[3px] [&_blockquote]:border-[#C9A227] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4",
        // === TITRES — espacement généreux avant/après ===
        // h1
        "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:font-serif [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:leading-tight",
        isDark
          ? "[&_h1]:text-[#F0E9DE]"
          : "[&_h1]:text-[#000000]",
        // h2
        "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:font-serif [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:leading-tight [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-[#C9A227]/20",
        isDark
          ? "[&_h2]:text-[#F0E9DE]"
          : "[&_h2]:text-[#000000]",
        // h3 (titres numérotés comme "1. Title", "2. Title")
        "[&_h3]:text-lg [&_h3]:font-bold [&_h3]:font-serif [&_h3]:mt-7 [&_h3]:mb-3 [&_h3]:leading-snug [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2",
        isDark
          ? "[&_h3]:text-[#C9A227]"
          : "[&_h3]:text-[#000000]",
        // h4
        "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:font-serif [&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:leading-snug",
        isDark
          ? "[&_h4]:text-[#F0E9DE]/90"
          : "[&_h4]:text-[#000000]/90",
        // Séparateurs hr
        "[&_hr]:border-[#C9A227]/20 [&_hr]:my-6",
        // Code
        "[&_code]:bg-[#000000]/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[#C9A227] [&_code]:text-xs [&_code]:font-mono",
        // Strong dans h3 (le numéro)
        "[&_h3_strong]:text-[#C9A227] [&_h3_strong]:font-bold",
        className,
      )}
    >
      <ReactMarkdown>{isololeMarkdown(children)}</ReactMarkdown>
    </div>
  );
}
