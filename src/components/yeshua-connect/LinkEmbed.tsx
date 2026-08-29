"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";

/**
 * LinkEmbed — affiche un aperçu automatique des URLs dans les messages.
 * Extrait og:title, og:description, og:image depuis l'URL via l'API /api/og.
 *
 * Style Discord/Slack: carte avec image + titre + description.
 *
 * ⭐ V2.1 — utilise `api.url()` de `@/lib/api-client` (compatible Railway +
 *    API Next.js locale). L'API `/api/og` renvoie { url, title, description,
 *    image } (null-safe côté serveur).
 *
 * Implémentation : LinkEmbed est un wrapper qui remonte LinkEmbedInner avec
 * un `key={url}` pour forcer le remontage à chaque URL différente. Cela
 * permet à l'Inner d'initialiser son état paresseusement (loading=true au
 * premier render) sans devoir reset state dans un effect (interdit par
 * react-hooks/set-state-in-effect).
 */

interface EmbedData {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  url: string;
}

export function LinkEmbed({ url }: { url: string }) {
  return <LinkEmbedInner key={url} url={url} />;
}

function LinkEmbedInner({ url }: { url: string }) {
  // État initial paresseux — loading=true dès le premier render, sans
  // nécessiter de setState synchrone dans un effect.
  const [embed, setEmbed] = useState<EmbedData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(api.url(`/api/og?url=${encodeURIComponent(url)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EmbedData | null) => {
        if (cancelled) return;
        if (data) {
          setEmbed(data);
          setStatus("ok");
        } else {
          setStatus("failed");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (status === "loading") {
    return (
      <div className="mt-2 p-3 rounded-xl bg-[#1E0F2B]/5 border border-[#8A8378]/10 animate-pulse">
        <div className="h-4 bg-[#8A8378]/20 rounded w-3/4 mb-2" />
        <div className="h-3 bg-[#8A8378]/10 rounded w-full" />
      </div>
    );
  }

  // Si l'API n'a rien retourné ou pas de titre, on affiche un fallback
  // minimal (juste le domaine cliquable) plutôt que rien du tout.
  if (status === "failed" || !embed?.title) {
    let domain = url;
    try {
      domain = new URL(url).hostname;
    } catch {
      // garde l'URL brute
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF6EF] border border-[#8A8378]/20 hover:border-[#C9A227]/40 transition-colors group"
      >
        <LinkIcon />
        <span className="text-xs text-[#1E0F2B] group-hover:text-[#C9A227] truncate max-w-[240px]">
          {status === "failed" ? "Lien (aperçu indisponible)" : domain}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block max-w-md rounded-xl overflow-hidden border border-[#8A8378]/20 hover:border-[#C9A227]/40 transition-colors group"
    >
      {embed.image && (
        <div className="w-full h-32 overflow-hidden bg-[#FAF6EF]">
          <img
            src={embed.image}
            alt={embed.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Masquer l'image si elle ne charge pas (CORS / 404)
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="p-3 bg-[#FAF6EF]">
        <p className="text-sm font-semibold text-[#1E0F2B] group-hover:text-[#C9A227] transition-colors truncate">
          {embed.title}
        </p>
        {embed.description && (
          <p className="text-xs text-[#8A8378] mt-1 line-clamp-2">{embed.description}</p>
        )}
        <p className="text-[10px] text-[#8A8378]/60 mt-1 truncate">{url}</p>
      </div>
    </a>
  );
}

/** Extract URLs from a text message (https?://…) */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
  return text.match(urlRegex) || [];
}

/** Petite icône "lien" inline (pas besoin de dépendance lucide ici) */
function LinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#8A8378] flex-shrink-0"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
