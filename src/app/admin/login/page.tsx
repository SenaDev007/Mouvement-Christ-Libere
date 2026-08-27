"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
        {/* En-tête : logo Christ Libère + nom */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            {/* Halo lumineux doré */}
            <div className="absolute inset-0 rounded-full pointer-events-none logo-halo" />
            <Image
              src="/logo-christ-libere.png"
              alt="Christ Libère"
              width={80}
              height={80}
              className="relative w-16 h-16 md:w-20 md:h-20 object-contain"
              priority
            />
          </div>
          {/* Nom "Christ Libère" — Christ en or, Libère en ivoire */}
          <h1
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
          >
            <span style={{ color: "#C9A227" }}>Christ</span>
            <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
            Back Office
          </p>
        </div>

        {/* Carte formulaire */}
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
                placeholder="Votre pseudonyme ou email"
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
        <p className="text-center text-xs text-[#FAF6EF]/60 mt-6 leading-relaxed">
          Accès réservé aux super administrateurs et administrateurs autorisés.
        </p>

        {/* Retour à l'accueil */}
        <p className="text-center text-xs text-[#FAF6EF]/60 mt-4">
          <Link href="/" className="hover:text-[#C9A227] transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
