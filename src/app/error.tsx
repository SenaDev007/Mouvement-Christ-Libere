"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#2A0E3D]">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-danger/20 border-2 border-state-danger/40 mb-6">
          <AlertTriangle className="w-8 h-8 text-state-danger" />
        </div>

        <h2 className="font-serif text-2xl font-semibold text-[#FAF6EF] mb-3">
          Une erreur est survenue
        </h2>

        <p className="text-sm text-[#FAF6EF]/70 leading-relaxed mb-6">
          Le site rencontre un problème technique. Vous pouvez réessayer
          ou retourner à l&apos;accueil. Si le problème persiste,
          le contenu reste accessible via les différentes sections du menu.
        </p>

        {error.digest && (
          <p className="text-xs text-[#FAF6EF]/40 mb-6 font-mono">
            Référence : {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-[#C9A227]/40 text-[#C9A227] font-semibold text-sm hover:bg-[#C9A227]/10 transition-colors"
          >
            <Home className="w-4 h-4" />
            Accueil
          </Link>
        </div>

        <p className="mt-8 text-xs text-[#FAF6EF]/40 italic font-serif">
          « Soyez forts, ne perdez pas courage, car votre œuvre aura sa récompense. »
          <br />
          2 Chroniques 15:7
        </p>
      </div>
    </div>
  );
}
