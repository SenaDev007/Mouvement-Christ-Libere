"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * MarkdownText — rendu Markdown propre pour les contenus de Pam.
 *
 * Rend les **gras**, *italiques*, paragraphes, listes, etc.
 * sans afficher les astérisques bruts.
 *
 * Styles alignés sur le design system (violet impérial + or).
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
        // Override prose colors to match design system
        isDark
          ? "[&_p]:text-[#FAF6EF]/80 [&_strong]:text-[#C9A227] [&_em]:text-[#FAF6EF]/90"
          : "[&_p]:text-[#1E0F2B]/80 [&_strong]:text-[#1E0F2B] [&_strong]:font-semibold [&_em]:text-[#1E0F2B]/70",
        "[&_a]:text-[#C9A227] [&_a]:no-underline hover:[&_a]:underline",
        "[&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4",
        "[&_blockquote]:border-l-[3px] [&_blockquote]:border-[#C9A227] [&_blockquote]:pl-4 [&_blockquote]:italic",
        className,
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
