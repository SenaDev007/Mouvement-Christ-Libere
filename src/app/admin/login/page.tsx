"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Lock, LogIn, AlertCircle, Loader2, User, ChevronRight } from "lucide-react";
import { MotDePasseOublie } from "@/components/auth/mot-de-passe-oublie";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin/dashboard";

  // ⭐ V3.44 — Sur le sous-domaine admin, « Retour à l'accueil » doit revenir
  // au site PUBLIC (mouvementchristlibere.com) et non au back-office réécrit
  // à la racine de ce même hôte. Calcul côté client uniquement (état initial
  // "/" identique serveur/client → pas de décalage d'hydratation).
  const [accueilPublicUrl, setAccueilPublicUrl] = useState("/");
  useEffect(() => {
    try {
      if (/^admin\./i.test(window.location.hostname)) {
        const url = new URL(window.location.origin);
        url.hostname = window.location.hostname.replace(/^admin\./i, "");
        setAccueilPublicUrl(url.origin);
      }
    } catch {
      // window indisponible ou origin invalide — comportement par défaut ("/")
    }
  }, []);

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
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-[#000000]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* En-tête : logo Christ Libère + nom */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo-christ-libere-v2.png"
            alt="Christ Libère"
            width={80}
            height={80}
            className="relative w-16 h-16 md:w-20 md:h-20 object-contain mb-4"
            priority
          />
          {/* Nom "Christ Libère" — Christ en or, Libère en ivoire */}
          <h1
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
          >
            <span style={{ color: "#C9A227" }}>Christ</span>
            <span style={{ color: "#F0E9DE" }}>&nbsp;&nbsp;Libère</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
            Back Office
          </p>
        </div>

        {/* Carte formulaire */}
        <div className="bg-white rounded-lg border border-stone-200 border-t-[3px] border-t-[#C9A227] p-8 space-y-5">
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Champ pseudonyme / email */}
          <div>
            <label className="block text-xs font-semibold text-[#000000] uppercase tracking-wider mb-2">
              Pseudonyme ou email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A857C]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                disabled={loading}
                placeholder="Votre pseudonyme ou email"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 bg-[#F0E9DE] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
              />
            </div>
          </div>

          {/* Champ mot de passe */}
          <div>
            <label className="block text-xs font-semibold text-[#000000] uppercase tracking-wider mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A857C]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-3 bg-[#F0E9DE] border border-stone-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
              />
            </div>
          </div>

          {/* Bouton connexion */}
          <button
            type="submit"
            disabled={loading || !name || !password}
            className="w-full py-3 bg-[#C9A227] text-[#000000] font-semibold text-sm rounded-md hover:bg-[#FF7A1A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

          {/* ⭐ V3.69 — Mot de passe oublié (OTP par email) */}
          <div className="text-center">
            <MotDePasseOublie variante="claire" />
          </div>
        </div>

        {/* Note de bas */}
        <p className="text-center text-xs text-[#F0E9DE]/60 mt-6 leading-relaxed">
          Accès réservé aux super administrateurs et administrateurs autorisés.
        </p>

        {/* Retour à l'accueil */}
        <p className="text-center text-xs text-[#F0E9DE]/60 mt-4">
          <Link href={accueilPublicUrl} className="hover:text-[#FF7A1A] transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
