"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogIn, AlertCircle, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin/dashboard";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Échec de la connexion");
      }

      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-imperial flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-[#C9A227] bg-[#C9A227]/10 mb-4">
            <Lock className="w-7 h-7 text-[#C9A227]" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-[#FAF6EF] mb-2">
            Backoffice
          </h1>
          <p className="text-sm text-[#FAF6EF]/70">
            Christ Libère — Espace réservé
          </p>
        </div>

        {/* Formulaire */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#3D1A54]/50 border border-[#C9A227]/30 rounded-2xl p-6 backdrop-blur-sm"
        >
          <label className="text-xs uppercase tracking-[0.18em] text-[#DDBE55]/80 font-semibold mb-2 block">
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            disabled={loading}
            className="w-full px-4 py-3 rounded border border-[#C9A227]/30 bg-[#1A0826]/60 text-[#FAF6EF] placeholder:text-[#FAF6EF]/40 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors"
            placeholder="••••••••"
          />

          {error && (
            <div className="mt-4 flex items-center gap-2 text-state-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-6 px-4 py-3 rounded bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Se connecter
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#FAF6EF]/50">
          Accès réservé à l&apos;équipe pastorale et technique autorisée.
        </p>
      </div>
    </div>
  );
}
