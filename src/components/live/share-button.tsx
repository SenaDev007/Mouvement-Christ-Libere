"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, X, Check, Link2 } from "lucide-react";
import { WhatsAppIcon, FacebookIcon, XIcon, InstagramIcon } from "@/components/videos/social-icons";

interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const shareUrl = encodeURIComponent(url);
  const shareTitle = encodeURIComponent(title);

  const platforms = [
    {
      name: "WhatsApp",
      icon: WhatsAppIcon,
      color: "#25D366",
      href: `https://wa.me/?text=${shareTitle}%20${shareUrl}`,
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
    },
    {
      name: "X",
      icon: XIcon,
      color: "#000000",
      href: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`,
    },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#2A0E3D]/5 rounded-full hover:bg-[#2A0E3D]/10 transition-colors"
      >
        <Share2 className="w-4 h-4 text-[#1E0F2B]" />
        <span className="text-xs font-medium text-[#1E0F2B] hidden sm:inline">Partager</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-2xl border border-[#8A8378]/15 p-3 min-w-[200px]">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider">Partager</span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[#8A8378]/10 text-[#8A8378]">
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Plateformes */}
          <div className="space-y-1">
            {platforms.map((p) => {
              const Icon = p.icon;
              return (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A0E3D]/5 transition-colors"
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium text-[#1E0F2B]">{p.name}</span>
                </a>
              );
            })}

            {/* Copier le lien */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A0E3D]/5 transition-colors"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <Link2 className="w-5 h-5 text-[#1E0F2B]" />
              )}
              <span className="text-sm font-medium text-[#1E0F2B]">
                {copied ? "Lien copié !" : "Copier le lien"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
