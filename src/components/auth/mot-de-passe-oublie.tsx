"use client";

/**
 * ⭐ V3.69 — Bloc « Mot de passe oublié » (OTP par email).
 *
 * Parcours en deux temps, branché sur les routes publiques :
 *   ① /api/auth/forgot-password  — envoi d'un code à 6 chiffres par email ;
 *   ② /api/auth/reset-password   — code + nouveau mot de passe.
 *
 * Un seul composant, deux habillages :
 *   - variante « claire »  : cartes blanches (login membre / back-office) ;
 *   - variante « sombre »  : cartes noires translucides (LoginView des
 *                            espaces secrétariat & trésorerie).
 *
 * Intégré sur les QUATRE pages de connexion — le même compte (table User)
 * servant aux espaces membre, back-office, secrétariat et trésorerie.
 */

import { useState } from "react";
import {
  KeyRound,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

type Etape = "email" | "code" | "succes";

interface Props {
  variante?: "claire" | "sombre";
}

export function MotDePasseOublie({ variante = "claire" }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  const sombre = variante === "sombre";

  // Classes conditionnelles selon l'habillage de la page hôte.
  const classes = {
    lien: sombre
      ? "text-xs text-[#C9A227] hover:text-[#FF7A1A] transition-colors"
      : "text-xs text-[#8A857C] hover:text-[#FF7A1A] transition-colors",
    bloc:
      "mt-4 pt-4 border-t space-y-3 " +
      (sombre ? "border-[#C9A227]/15" : "border-stone-200"),
    titre: sombre ? "text-sm font-semibold text-[#F0E9DE]" : "text-sm font-semibold text-[#000000]",
    sousTitre: sombre ? "text-xs text-[#F0E9DE]/50" : "text-xs text-[#8A857C]",
    champ:
      "w-full px-3.5 py-2.5 text-sm outline-none transition-colors " +
      (sombre
        ? "rounded-xl bg-[#000000]/60 border border-[#C9A227]/20 text-[#F0E9DE] placeholder:text-[#F0E9DE]/25 focus:border-[#C9A227]/60 focus:ring-1 focus:ring-[#C9A227]/30"
        : "rounded-md bg-[#F0E9DE] border border-stone-200 text-[#000000] focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"),
    bouton:
      "w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
      (sombre
        ? "bg-[#C9A227] text-[#000000] hover:bg-[#FF7A1A]"
        : "bg-[#C9A227] text-[#000000] rounded-md font-semibold hover:bg-[#FF7A1A]"),
    erreur: sombre
      ? "flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-[#B3452E]/10 border border-[#B3452E]/30 text-[#F3A08E] text-xs leading-relaxed"
      : "flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm",
    info: sombre
      ? "flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-[#5B7052]/10 border border-[#5B7052]/30 text-[#A8C39A] text-xs leading-relaxed"
      : "flex items-start gap-2 p-3 rounded-lg bg-[#5B7052]/10 border border-[#5B7052]/30 text-[#3F5039] text-sm",
    label: sombre ? "block text-xs font-semibold text-[#F0E9DE]/70 mb-1.5" : "block text-xs font-semibold text-[#000000] mb-1.5",
    retour:
      "inline-flex items-center gap-1.5 text-xs " +
      (sombre ? "text-[#F0E9DE]/40 hover:text-[#FF7A1A]" : "text-[#8A857C] hover:text-[#FF7A1A]") +
      " transition-colors",
  };

  const demanderCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || chargement) return;
    setChargement(true);
    setErreur("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi du code");
      setInfo(data.message || "Code envoyé — consultez votre boîte mail.");
      setEtape("code");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  };

  const reinitialiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chargement) return;
    if (nouveauMdp !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setChargement(true);
    setErreur("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword: nouveauMdp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la réinitialisation");
      setInfo(
        data.message ||
          "Mot de passe mis à jour — vous pouvez vous connecter."
      );
      setEtape("succes");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  };

  const fermer = () => {
    setOuvert(false);
    setEtape("email");
    setCode("");
    setNouveauMdp("");
    setConfirmation("");
    setErreur("");
    setInfo("");
  };

  // ── Lien d'ouverture ──────────────────────────────────────────────
  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={classes.lien}
      >
        Mot de passe oublié&nbsp;?
      </button>
    );
  }

  // ── Bloc ouvert ───────────────────────────────────────────────────
  return (
    <div className={classes.bloc}>
      <div className="flex items-center gap-2">
        <KeyRound className={sombre ? "w-4 h-4 text-[#C9A227]" : "w-4 h-4 text-[#A3821C]"} />
        <span className={classes.titre}>
          {etape === "email" && "Réinitialiser le mot de passe"}
          {etape === "code" && "Code reçu par email"}
          {etape === "succes" && "Mot de passe mis à jour"}
        </span>
      </div>
      <p className={classes.sousTitre}>
        {etape === "email" &&
          "Indiquez l'email de votre compte : nous vous enverrons un code de vérification valable 10 minutes."}
        {etape === "code" &&
          `Saisissez le code à 6 chiffres envoyé à ${email} puis choisissez votre nouveau mot de passe.`}
        {etape === "succes" &&
          "Connectez-vous avec votre nouveau mot de passe — il vaut pour tous les espaces (membre, secrétariat, trésorerie, back-office)."}
      </p>

      {erreur && (
        <div className={classes.erreur}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {erreur}
        </div>
      )}
      {info && etape !== "succes" && (
        <div className={classes.info}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {info}
        </div>
      )}

      {etape === "email" && (
        <form onSubmit={demanderCode} className="space-y-3">
          <div>
            <label className={classes.label}>Email du compte</label>
            <div className="relative">
              <Mail
                className={
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 " +
                  (sombre ? "text-[#F0E9DE]/30" : "text-[#8A857C]")
                }
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                required
                autoFocus
                disabled={chargement}
                className={classes.champ + " pl-10"}
              />
            </div>
          </div>
          <button type="submit" disabled={chargement || !email.trim()} className={classes.bouton}>
            {chargement ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {chargement ? "Envoi du code…" : "Envoyer le code"}
          </button>
        </form>
      )}

      {etape === "code" && (
        <form onSubmit={reinitialiser} className="space-y-3">
          <div>
            <label className={classes.label}>Code de vérification (6 chiffres)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              autoComplete="one-time-code"
              required
              autoFocus
              disabled={chargement}
              className={classes.champ + " text-center tracking-[0.5em] font-mono"}
            />
          </div>
          <div>
            <label className={classes.label}>Nouveau mot de passe</label>
            <input
              type="password"
              value={nouveauMdp}
              onChange={(e) => setNouveauMdp(e.target.value)}
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={chargement}
              className={classes.champ}
            />
          </div>
          <div>
            <label className={classes.label}>Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={chargement}
              className={classes.champ}
            />
          </div>
          <button type="submit" disabled={chargement} className={classes.bouton}>
            {chargement ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {chargement ? "Réinitialisation…" : "Réinitialiser mon mot de passe"}
          </button>
        </form>
      )}

      {etape === "succes" && (
        <div className={classes.info}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {info}
        </div>
      )}

      <button type="button" onClick={fermer} className={classes.retour}>
        <ArrowLeft className="w-3.5 h-3.5" />
        {etape === "succes" ? "Retour à la connexion" : "Annuler et revenir à la connexion"}
      </button>
    </div>
  );
}
