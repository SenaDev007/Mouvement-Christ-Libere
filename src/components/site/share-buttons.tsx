"use client";

import { useState } from "react";
import { MessageCircle, Facebook, Twitter, Instagram, Link2, Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  url: string;
  title: string;
  className?: string;
  variant?: "light" | "dark";
}

export function ShareButtons({ url, title, className, variant = "light" }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const isDark = variant === "dark";

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: "hover:bg-[#25D366] hover:border-[#25D366] hover:text-white",
      bgColor: isDark ? "bg-[#FAF6EF]/5" : "bg-[#25D366]/8",
      borderColor: isDark ? "border-[#FAF6EF]/15" : "border-[#25D366]/20",
      textColor: isDark ? "text-[#FAF6EF]/70" : "text-[#25D366]",
    },
    {
      name: "Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "hover:bg-[#1877F2] hover:border-[#1877F2] hover:text-white",
      bgColor: isDark ? "bg-[#FAF6EF]/5" : "bg-[#1877F2]/8",
      borderColor: isDark ? "border-[#FAF6EF]/15" : "border-[#1877F2]/20",
      textColor: isDark ? "text-[#FAF6EF]/70" : "text-[#1877F2]",
    },
    {
      name: "Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: "hover:bg-[#000000] hover:border-[#000000] hover:text-white",
      bgColor: isDark ? "bg-[#FAF6EF]/5" : "bg-[#1E0F2B]/5",
      borderColor: isDark ? "border-[#FAF6EF]/15" : "border-[#1E0F2B]/15",
      textColor: isDark ? "text-[#FAF6EF]/70" : "text-[#1E0F2B]",
    },
    {
      name: "Instagram",
      icon: Instagram,
      href: `https://www.instagram.com/`,
      color: "hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCB045] hover:border-transparent hover:text-white",
      bgColor: isDark ? "bg-[#FAF6EF]/5" : "bg-gradient-to-br from-[#833AB4]/8 to-[#FCB045]/8",
      borderColor: isDark ? "border-[#FAF6EF]/15" : "border-[#833AB4]/20",
      textColor: isDark ? "text-[#FAF6EF]/70" : "text-[#833AB4]",
    },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <Share2 className={cn("w-4 h-4", isDark ? "text-[#C9A227]" : "text-[#C9A227]")} />
        <span className={cn(
          "text-xs uppercase tracking-[0.18em] font-bold",
          isDark ? "text-[#C9A227]" : "text-[#9C7E1E]"
        )}>
          Partager ce témoignage
        </span>
      </div>

      {/* Boutons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {shareLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Partager sur ${link.name}`}
              className={cn(
                "group inline-flex items-center justify-center w-11 h-11 rounded-xl border transition-all duration-300 hover:scale-110 hover:shadow-lg",
                link.bgColor,
                link.borderColor,
                link.textColor,
                link.color
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="sr-only">{link.name}</span>
            </a>
          );
        })}

        {/* Bouton copier le lien */}
        <button
          onClick={handleCopy}
          title="Copier le lien"
          className={cn(
            "group inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-lg",
            copied
              ? "bg-[#5B7052] border-[#5B7052] text-white"
              : isDark
                ? "bg-[#FAF6EF]/5 border-[#FAF6EF]/15 text-[#FAF6EF]/70 hover:bg-[#C9A227] hover:border-[#C9A227] hover:text-[#1E0F2B]"
                : "bg-[#2A0E3D]/5 border-[#2A0E3D]/15 text-[#2A0E3D] hover:bg-[#C9A227] hover:border-[#C9A227] hover:text-[#1E0F2B]"
          )}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span className="text-xs font-bold">Copié !</span>
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              <span className="text-xs font-bold">Copier le lien</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
