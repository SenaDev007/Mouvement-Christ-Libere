"use client";

import { useState, useEffect } from "react";

/**
 * LinkEmbed — affiche un aperçu automatique des URLs dans les messages.
 * Extrait og:title, og:description, og:image depuis l'URL.
 *
 * Style Discord/Slack: carte avec image + titre + description.
 */

interface EmbedData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export function LinkEmbed({ url }: { url: string }) {
  const [embed, setEmbed] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch og metadata from our API
    fetch(api_url(`/api/og?url=${encodeURIComponent(url)}`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setEmbed(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-[#1E0F2B]/5 border border-[#8A8378]/10 animate-pulse">
        <div className="h-4 bg-[#8A8378]/20 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-[#8A8378]/10 rounded w-full"></div>
      </div>
    );
  }

  if (!embed?.title) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block max-w-md rounded-xl overflow-hidden border border-[#8A8378]/20 hover:border-[#C9A227]/40 transition-colors group"
    >
      {embed.image && (
        <div className="w-full h-32 overflow-hidden bg-[#FAF6EF]">
          <img src={embed.image} alt={embed.title} className="w-full h-full object-cover" />
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

/** Extract URLs from a text message */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

/** Helper to build API URL */
function api_url(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "";
  return `${base}${path}`;
}
