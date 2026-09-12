"use client";

/**
 * ⭐ V3.66 — Page de connexion partagée des espaces dédiés
 * (secrétariat & trésorerie).
 *
 * Même design que la connexion du back-office (fond violet profond
 * #1A0826, logo, framer-motion) — seule l'identité de l'espace change
 * (titre, sous-titre, point d'accès API, route post-connexion).
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, LogIn, AlertCircle, Loader2, User, ChevronRight } from "lucide-react";
import Image from "next/image";

export interface LoginViewProps {
  /** Titre de l'espace (ex. « Secrétariat »). */
  titreEspace: string;
  /** Sous-titre descriptif affiché sous le titre. */
  soustitre: string;
  /** Route POST d'authentification (ex. /secretariat/api/login). */
  endpointLogin: string;
  /** Préfixe des routes de l'espace (ex. /secretariat). */
  prefixeEspace: string;
  /** Libellé du sous-domaine dédié (ex. « secretariat »). */
  libelleSousDomaine: string;
  /** Nom de domaine complet du sous-domaine (affiché). */
  sousDomaine: string;
  /** Accent de couleur du bandeau-titre (classe Tailwind texte). */
  accentTexte?: string;
}

export function LoginView({
  titreEspace,
  soustitre,
  endpointLogin,
  prefixeEspace,
  libelleSousDomaine,
  sousDomaine,
  accentTexte = "text-[#C9A227]",
}: LoginViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || `${prefixeEspace}/dashboard`;

  // Sur le sous-domaine dédié, « Retour à l'accueil » doit revenir au site
  // PUBLIC et non à la racine de ce même hôte (calcul client uniquement —
  // état initial identique serveur/client, pas de décalage d'hydratation ;
  // même astuce que le back-office V3.44).
  const [accueilPublicUrl, setAccueilPublicUrl] = useState("/");
  useEffect(() => {
    try {
      const hote = window.location.hostname;
      if (hote.startsWith(`${libelleSousDomaine}.`)) {
        const url = new URL(window.location.origin);
        url.hostname = hote.slice(libelleSousDomaine.length + 1);
        setAccueilPublicUrl(url.origin);
      }
    } catch {
      // window indisponible — comportement par défaut "/"
    }
  }, [libelleSousDomaine]);

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
      const res = await fetch(endpointLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Échec de la connexion");
      }

      router.push(from.startsWith(prefixeEspace) ? from : `${prefixeEspace}/dashboard`);
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
        {/* En-tête : logo Christ Libère + nom de l'espace */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo-christ-libere-v2.png"
            alt="Christ Libère"
            width={80}
            height={80}
            className="relative w-16 h-16 md:w-20 md:h-20 object-contain mb-4"
            priority
          />
          <h1 className="text-2xl md:text-3xl font-bold text-[#FAF6EF] text-center">
            <span className={accentTexte}>{titreEspace}</span>
          </h1>
          <p className="text-sm text-[#FAF6EF]/60 text-center mt-1.5 max-w-xs leading-relaxed">
            {soustitre}
          </p>
          <p className="text-[10px] font-mono text-[#DDBE55]/40 mt-2">
            {sousDomaine}
          </p>
        </div>

        {/* Carte de connexion */}
        <div className="relative bg-[#2A0E3D]/60 backdrop-blur-sm rounded-2xl border border-[#C9A227]/15 p-6 md:p-8 shadow-2xl">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#C9A227]/50 to-transparent" />

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#C9A227]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#FAF6EF]">
                Connexion
              </h2>
              <p className="text-xs text-[#FAF6EF]/50">
                Accès réservé aux personnes accréditées
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 mb-4 rounded-lg bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#F3A08E] text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-name"
                className="block text-xs font-semibold text-[#FAF6EF]/70 mb-1.5"
              >
                Nom ou email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FAF6EF]/30" />
                <input
                  id="login-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A0826]/60 border border-[#C9A227]/20 text-sm text-[#FAF6EF] placeholder:text-[#FAF6EF]/25 focus:outline-none focus:border-[#C9A227]/60 focus:ring-1 focus:ring-[#C9A227]/30 transition-colors"
                  placeholder="Votre nom ou email"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#FAF6EF]/70 mb-1.5"
              >
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FAF6EF]/30" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A0826]/60 border border-[#C9A227]/20 text-sm text-[#FAF6EF] placeholder:text-[#FAF6EF]/25 focus:outline-none focus:border-[#C9A227]/60 focus:ring-1 focus:ring-[#C9A227]/30 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C9A227] text-[#1A0826] text-sm font-bold hover:bg-[#DDBE55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>

        {/* Lien retour accueil public */}
        <div className="mt-6 text-center">
          <a
            href={accueilPublicUrl}
            className="inline-flex items-center gap-1.5 text-xs text-[#FAF6EF]/40 hover:text-[#C9A227] transition-colors"
          >
            Retour à l&apos;accueil
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
