"use client";

import { useState } from "react";
import { Link2, Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppIcon, FacebookIcon, XIcon, InstagramIcon } from "@/components/videos/social-icons";

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
    { name: "WhatsApp", Icon: WhatsAppIcon, href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
    { name: "Facebook", Icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "X", Icon: XIcon, href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}` },
    { name: "Instagram", Icon: InstagramIcon, href: `https://www.instagram.com/` },
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
      <div className="flex items-center gap-2">
        <Share2 className={cn("w-4 h-4", isDark ? "text-[#C9A227]" : "text-[#C9A227]")} />
        <span className={cn(
          "text-xs uppercase tracking-[0.18em] font-bold",
          isDark ? "text-[#C9A227]" : "text-[#9C7E1E]"
        )}>
          Partager
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {shareLinks.map((link) => {
          const Icon = link.Icon;
          return (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Partager sur ${link.name}`}
              className="group inline-flex items-center justify-center w-11 h-11 rounded-xl border border-[#8A857C]/15 transition-all duration-300 hover:scale-110 hover:shadow-lg bg-white"
            >
              <Icon size={20} />
              <span className="sr-only">{link.name}</span>
            </a>
          );
        })}

        <button
          onClick={handleCopy}
          title="Copier le lien"
          className={cn(
            "group inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-lg",
            copied
              ? "bg-[#5B7052] border-[#5B7052] text-white"
              : isDark
                ? "bg-[#F0E9DE]/5 border-[#F0E9DE]/15 text-[#F0E9DE]/70 hover:bg-[#FF7A1A] hover:border-[#FF7A1A] hover:text-[#000000]"
                : "bg-[#000000]/5 border-[#000000]/15 text-[#000000] hover:bg-[#FF7A1A] hover:border-[#FF7A1A] hover:text-[#000000]"
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
