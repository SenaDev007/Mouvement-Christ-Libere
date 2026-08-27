"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, LogIn, AlertCircle, Loader2, ShieldCheck, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin/dashboard";

  const [email, setEmail] = useState("");
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
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#1A0826]">
      {/* Décor de fond */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A227]/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#7C5CB8]/8 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#C9A227]/3 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Carte principale */}
        <div className="bg-[#FAF6EF] rounded-3xl shadow-2xl overflow-hidden border border-[#C9A227]/20">
          {/* En-tête avec logo */}
          <div className="bg-[#2A0E3D] px-8 py-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A227]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              {/* Logo avec halo */}
              <div className="relative mb-4 group/logo">
                <div className="absolute inset-0 rounded-full pointer-events-none logo-halo" />
                <Image
                  src="/logo-christ-libere.png"
                  alt="Christ Libère"
                  width={72}
                  height={72}
                  className="relative w-16 h-16 md:w-20 md:h-20 object-contain"
                  priority
                />
              </div>
              {/* Nom Christ Libère (même style que navbar) */}
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                <span style={{ color: "#C9A227" }}>Christ</span>
                <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
              </h1>
              <p className="text-xs uppercase tracking-[0.25em] font-bold text-[#C9A227]">
                Espace membre
              </p>
            </div>
          </div>

          {/* Corps du formulaire */}
          <div className="p-8 md:p-10">
            {/* Badge sécurisé */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <ShieldCheck className="w-4 h-4 text-[#5B7052]" />
              <span className="text-xs font-semibold text-[#8A8378]">
                Connexion sécurisée — Accès réservé
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Champ mot de passe */}
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-2 block">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-[#8A8378]/20 bg-[#FAF6EF] text-[#1E0F2B] placeholder:text-[#8A8378]/50 focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15 transition-all text-sm"
                    placeholder="Entrez votre mot de passe"
                  />
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bouton connexion */}
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3.5 rounded-2xl bg-[#2A0E3D] text-[#FAF6EF] font-bold text-sm hover:bg-[#3D1A54] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-[#C9A227]" />
                    Se connecter
                  </>
                )}
              </button>
            </form>

            {/* Note de bas */}
            <div className="mt-6 pt-6 border-t border-[#8A8378]/10 text-center">
              <p className="text-xs text-[#8A8378] leading-relaxed">
                Accès réservé à l&apos;équipe pastorale et technique autorisée.
                <br />
                Vos modifications sont synchronisées en temps réel avec le site public.
              </p>
            </div>
          </div>
        </div>

        {/* Liens */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <a
            href="/register"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FAF6EF]/60 hover:text-[#C9A227] transition-colors"
          >
            Créer un compte
          </a>
          <span className="text-[#FAF6EF]/20">|</span>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FAF6EF]/60 hover:text-[#C9A227] transition-colors"
          >
            ← Retour au site
          </a>
        </div>
      </div>
    </div>
  );
}
