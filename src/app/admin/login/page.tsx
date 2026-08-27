"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, LogIn, AlertCircle, Loader2, User, ChevronRight } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin/dashboard";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
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
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-[#1A0826]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* En-tête logo + titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2A0E3D] border border-[#C9A227]/30 mb-4">
            <Lock className="w-7 h-7 text-[#C9A227]" />
          </div>
          <h1 className="font-serif text-3xl font-semibold text-[#1E0F2B] mb-1">
            Back Office
          </h1>
          <p className="text-sm text-[#8A8378]">
            Mouvement Christ Libère — Espace réservé
          </p>
        </div>

        {/* Carte formulaire (même style que /login) */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 space-y-5"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Champ pseudonyme / email */}
          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">
              Pseudonyme ou email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                disabled={loading}
                placeholder="Ex : Pam, Pasteur Kongo, ou email"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
              />
            </div>
          </div>

          {/* Champ mot de passe */}
          <div>
            <label className="block text-xs font-semibold text-[#1E0F2B] uppercase tracking-wider mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-3 bg-[#FAF6EF] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
              />
            </div>
          </div>

          {/* Bouton connexion */}
          <button
            type="submit"
            disabled={loading || !name || !password}
            className="w-full py-3 bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm rounded-md hover:bg-[#DDBE55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Se connecter
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Note de bas */}
        <p className="text-center text-xs text-[#8A8378] mt-6 leading-relaxed">
          Accès réservé aux super administrateurs (Pam, Pasteur Kongo)
          <br />
          et aux administrateurs délégués autorisés.
        </p>

        {/* Retour à l'accueil */}
        <p className="text-center text-xs text-[#8A8378] mt-4">
          <Link href="/" className="hover:text-[#1E0F2B] transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
