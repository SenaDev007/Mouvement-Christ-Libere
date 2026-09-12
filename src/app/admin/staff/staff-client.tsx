"use client";

/**
 * ⭐ V3.66 — Interface d'accréditation Secrétariat & Trésorerie.
 *
 * Réservée aux super admins (Pam, Pasteur Kongo) :
 *  · créer le compte de la secrétaire / du trésorier (rôle dédié) ;
 *  · réinitialiser un mot de passe ;
 *  · révoquer l'accès (retour au rôle membre) / le réactiver.
 *
 * Design : même langage que le back-office (violet #000000, or #C9A227,
 * crème #F0E9DE, cartes blanches, lucide-react).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCog,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Save,
  KeyRound,
  Ban,
  RotateCcw,
  Mail,
  Clock,
  Briefcase,
  Building2,
  Landmark,
  ArrowLeft,
} from "lucide-react";

interface CompteStaff {
  id: string;
  name: string;
  email: string;
  role: string;
  bio: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

const CARTES_ROLES = [
  {
    value: "SECRETARY",
    label: "Secrétaire du ministère",
    desc: "Reçoit les demandes de rencontre des serviteurs de Dieu, les transmet, gère les annonces du ministère.",
    icon: Briefcase,
    espace: "secretariat.mouvementchristlibere.com",
  },
  {
    value: "TREASURER",
    label: "Trésorier / Comptable",
    desc: "Tient le journal des recettes et dépenses (dons, offrandes, dîmes), la situation de caisse et les rapports.",
    icon: Landmark,
    espace: "tresorerie.mouvementchristlibere.com",
  },
];

export function StaffClient() {
  const [comptes, setComptes] = useState<CompteStaff[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurListe, setErreurListe] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SECRETARY",
    bio: "",
  });
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [messageCreation, setMessageCreation] = useState<{
    type: "succes" | "erreur";
    texte: string;
  } | null>(null);

  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [reninitId, setReninitId] = useState<string | null>(null);
  const [nouveauMdp, setNouveauMdp] = useState("");

  const chargerComptes = useCallback(async () => {
    setChargement(true);
    setErreurListe("");
    try {
      const res = await fetch("/admin/api/staff", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setComptes(data.items || []);
    } catch (err) {
      setErreurListe(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerComptes();
  }, [chargerComptes]);

  const creerCompte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;

    setCreationEnCours(true);
    setMessageCreation(null);
    try {
      const res = await fetch("/admin/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création");
      setMessageCreation({
        type: "succes",
        texte: data.accredite
          ? `Compte membre existant (${data.email}) accrédité ${
              data.role === "SECRETARY" ? "secrétaire" : "trésorier"
            } — la personne conserve son email et son compte, avec le nouveau mot de passe que vous venez de définir. Communiquez-le de façon sécurisée.`
          : `Compte ${data.name} créé avec le rôle ${data.role}. Communiquez le mot de passe de façon sécurisée.`,
      });
      setForm({ name: "", email: "", password: "", role: form.role, bio: "" });
      chargerComptes();
    } catch (err) {
      setMessageCreation({
        type: "erreur",
        texte: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setCreationEnCours(false);
    }
  };

  const actionCompte = async (
    userId: string,
    action: "reset-password" | "revoke" | "reactivate",
    extras?: Record<string, unknown>
  ) => {
    setActionEnCours(`${action}:${userId}`);
    try {
      const res = await fetch("/admin/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...extras }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (action === "reset-password") {
        setReninitId(null);
        setNouveauMdp("");
      }
      chargerComptes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setActionEnCours(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* En-tête */}
      <div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[#8A857C] hover:text-[#FF7A1A] mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour au tableau de bord
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-[#000000] mb-1 flex items-center gap-3">
          <UserCog className="w-7 h-7 text-[#C9A227]" />
          Secrétariat &amp; Trésorerie
        </h1>
        <p className="text-sm text-[#8A857C]">
          Accréditation des espaces dédiés du ministère — réservé aux super
          administrateurs (Pam, Pasteur Kongo).
        </p>
      </div>

      {/* Avertissement */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/30">
        <ShieldCheck className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#000000] leading-relaxed">
          Chaque compte créé donne accès à <strong>son espace uniquement</strong>{" "}
          (le secrétaire n&apos;entre pas dans la trésorerie et réciproquement).
          Vous gardez le contrôle total : réinitialisation du mot de passe et
          révocation de l&apos;accès à tout moment depuis cette page.
        </p>
      </div>

      {/* Formulaire de création */}
      <form
        onSubmit={creerCompte}
        className="bg-white rounded-2xl border border-[#8A857C]/15 p-6 space-y-6"
      >
        <div>
          <h2 className="font-semibold text-[#000000] mb-1">
            Créer un compte / accréditer un membre
          </h2>
          <p className="text-xs text-[#8A857C] mb-4">
            Le compte sera immédiatement actif — communiquez le mot de passe de
            façon sécurisée à son destinataire. <strong>Si l&apos;email correspond
            déjà à un compte membre</strong>, celui-ci est simplement accrédité
            (même email, nouveau rôle) — être membre n&apos;empêche pas d&apos;être
            secrétaire ou trésorier.
          </p>
        </div>

        {/* Choix du rôle */}
        <div className="grid md:grid-cols-2 gap-3">
          {CARTES_ROLES.map((r) => {
            const Icone = r.icon;
            const actif = form.role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm({ ...form, role: r.value })}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  actif
                    ? "border-[#C9A227] bg-[#C9A227]/5"
                    : "border-[#8A857C]/15 hover:border-[#FF7A1A]/40 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      actif ? "bg-[#C9A227]/15" : "bg-[#F0E9DE]"
                    }`}
                  >
                    <Icone className="w-4 h-4 text-[#A3821C]" />
                  </div>
                  <span className="text-sm font-semibold text-[#000000]">
                    {r.label}
                  </span>
                </div>
                <p className="text-xs text-[#8A857C] leading-relaxed mb-2">
                  {r.desc}
                </p>
                <p className="text-[10px] font-mono text-[#8A857C] break-all">
                  {r.espace}
                </p>
              </button>
            );
          })}
        </div>

        {/* Champs */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1.5">
              Nom complet <span className="text-[#B3452E]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex. Grâce Adjoua"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1.5">
              Email <span className="text-[#B3452E]">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="secretaire@christ-libere.org"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1.5">
              Mot de passe <span className="text-[#B3452E]">*</span>
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="8 caractères minimum"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#000000] mb-1.5">
              Fonction / biographie (facultatif)
            </label>
            <input
              type="text"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Ex. Secrétaire du Mouvement Christ Libère"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-sm text-[#000000] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
            />
          </div>
        </div>

        {messageCreation && (
          <div
            className={`flex items-start gap-2 px-4 py-3 rounded-lg text-xs leading-relaxed ${
              messageCreation.type === "succes"
                ? "bg-[#5B7052]/10 text-[#3F5039] border border-[#5B7052]/30"
                : "bg-[#B3452E]/10 text-[#B3452E] border border-[#B3452E]/30"
            }`}
          >
            {messageCreation.type === "succes" ? (
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            {messageCreation.texte}
          </div>
        )}

        <button
          type="submit"
          disabled={creationEnCours}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#000000] text-[#F0E9DE] text-sm font-semibold hover:bg-[#161513] transition-colors disabled:opacity-50"
        >
          {creationEnCours ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {creationEnCours ? "Création…" : "Créer le compte"}
        </button>
      </form>

      {/* Liste des comptes accrédités */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-[#000000] mb-1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#C9A227]" />
            Comptes accrédités
          </h2>
          <p className="text-xs text-[#8A857C]">
            {comptes.length === 0
              ? "Aucun compte secrétaire ou trésorier pour l'instant."
              : `${comptes.length} compte${comptes.length > 1 ? "s" : ""} actif${comptes.length > 1 ? "s" : ""} sur les espaces dédiés.`}
          </p>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-10 text-[#8A857C]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : erreurListe ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
            <AlertCircle className="w-4 h-4" />
            {erreurListe}
          </div>
        ) : (
          <div className="space-y-3">
            {comptes.map((compte) => {
              const estSecretaire = compte.role === "SECRETARY";
              const carteRole = CARTES_ROLES.find((r) => r.value === compte.role);
              return (
                <div
                  key={compte.id}
                  className="bg-white rounded-xl border border-[#8A857C]/15 p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#000000] text-sm">
                          {compte.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            estSecretaire
                              ? "bg-[#C9A227]/10 text-[#A3821C] border-[#C9A227]/30"
                              : "bg-[#5B7052]/10 text-[#3F5039] border-[#5B7052]/30"
                          }`}
                        >
                          {estSecretaire ? "Secrétaire" : "Trésorier"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-[#8A857C]">
                        <Mail className="w-3 h-3" />
                        {compte.email}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#8A857C]/70">
                        <Clock className="w-3 h-3" />
                        {compte.lastSeenAt
                          ? `Vu le ${new Date(compte.lastSeenAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "Jamais connecté"}
                      </div>
                      {compte.bio && (
                        <p className="text-[11px] text-[#8A857C] mt-1 italic">
                          {compte.bio}
                        </p>
                      )}
                      {carteRole && (
                        <p className="text-[10px] font-mono text-[#8A857C]/70 mt-1.5">
                          {carteRole.espace}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {reninitId === compte.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={nouveauMdp}
                            onChange={(e) => setNouveauMdp(e.target.value)}
                            placeholder="Nouveau mot de passe"
                            className="px-3 py-1.5 rounded-lg border border-[#8A857C]/25 bg-[#F0E9DE] text-xs w-44"
                            minLength={8}
                          />
                          <button
                            onClick={() =>
                              actionCompte(compte.id, "reset-password", {
                                password: nouveauMdp,
                              })
                            }
                            disabled={
                              !nouveauMdp || nouveauMdp.length < 8 ||
                              actionEnCours === `reset-password:${compte.id}`
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5B7052] text-white text-xs font-semibold hover:bg-[#3F5039] transition-colors disabled:opacity-50"
                          >
                            {actionEnCours ===
                            `reset-password:${compte.id}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <KeyRound className="w-3 h-3" />
                            )}
                            Confirmer
                          </button>
                          <button
                            onClick={() => {
                              setReninitId(null);
                              setNouveauMdp("");
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs text-[#8A857C] hover:text-[#000000]"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReninitId(compte.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A227]/40 text-[#A3821C] text-xs font-semibold hover:bg-[#FF7A1A]/10 transition-colors"
                        >
                          <KeyRound className="w-3 h-3" />
                          Mot de passe
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Révoquer l'accès de ${compte.name} ? Le compte sera ramené au rôle membre simple.`
                            )
                          ) {
                            actionCompte(compte.id, "revoke");
                          }
                        }}
                        disabled={actionEnCours === `revoke:${compte.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#B3452E]/30 text-[#B3452E] text-xs font-semibold hover:bg-[#B3452E]/10 transition-colors disabled:opacity-50"
                      >
                        {actionEnCours === `revoke:${compte.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        Révoquer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comptes révoqués : rappel */}
      <div className="px-4 py-3 rounded-xl bg-[#F0E9DE] border border-[#8A857C]/15 text-[11px] text-[#8A857C] leading-relaxed">
        <p className="flex items-center gap-1.5 mb-1 font-semibold text-[#000000]">
          <RotateCcw className="w-3.5 h-3.5 text-[#C9A227]" />
          Réactiver un accès révoqué
        </p>
        Un compte révoqué est ramené au rôle « membre » : il apparaît dans{" "}
        <Link
          href="/admin/users"
          className="text-[#C9A227] underline underline-offset-2 hover:text-[#A3821C]"
        >
          Utilisateurs
        </Link>
        . Pour lui redonner l&apos;accès à un espace, recréez simplement un
        compte avec le même email — ou utilisez l&apos;action de réactivation
        avec son identifiant.
      </div>
    </div>
  );
}
