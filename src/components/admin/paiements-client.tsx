"use client";

import { useState } from "react";
import {
  Smartphone,
  Globe,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Webhook,
  Lock,
  Save,
  PlugZap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EtatPasserelle } from "@/lib/payments/gateway-config";

/**
 * ⭐ V3.83 — Interface de configuration des passerelles de paiement
 * (FedaPay + Paystack) — réservée aux super admins.
 *
 * Principes :
 *   · les clés saisies ne sont JAMAIS réaffichées (champs mot de passe,
 *     vidés après enregistrement — seuls •••• 1234 restent visibles) ;
 *   · « Tester la connexion » interroge le fournisseur en LECTURE SEULE
 *     (aucune écriture, aucun paiement) avec la clé du champ si remplie,
 *     sinon la clé effective ;
 *   · chaque enregistrement est chiffré (AES-256-GCM), tracé dans le
 *     journal d'audit et pris en compte immédiatement (cache invalidé).
 */

interface Props {
  etats: EtatPasserelle[];
  webhooks: { fedapay: string; paystack: string };
}

type ProviderId = "fedapay" | "paystack";

interface MessageCarte {
  type: "ok" | "erreur";
  texte: string;
}

const META_PASSERELLES: Record<
  ProviderId,
  {
    titre: string;
    zone: string;
    detail: string;
    placeholderCle: string;
    aideWebhook: string;
    icon: typeof Smartphone;
  }
> = {
  fedapay: {
    titre: "FedaPay",
    zone: "Côte d'Ivoire · Afrique de l'Ouest",
    detail:
      "Mobile Money (MTN, Orange, Moov, Wave) et cartes bancaires régionales — règlement en FCFA. Avec une clé publique, le paiement s'ouvre directement sur la page Contribuer.",
    placeholderCle: "sk_live_… ou sk_sandbox_…",
    aideWebhook:
      "Secret défini dans le dashboard FedaPay (Paramètres → Webhooks → Secret key). Sans lui, les webhooks sont rejetés.",
    icon: Smartphone,
  },
  paystack: {
    titre: "Paystack",
    zone: "International",
    detail:
      "Cartes Visa / Mastercard émises n'importe où dans le monde — règlement en FCFA.",
    placeholderCle: "sk_live_… ou sk_test_…",
    aideWebhook:
      "Par convention, Paystack signe ses webhooks avec la clé secrète du compte — laissez vide pour l'utiliser.",
    icon: Globe,
  },
};

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaiementsClient({ etats, webhooks }: Props) {
  const [etatsActuels, setEtatsActuels] = useState<EtatPasserelle[]>(etats);

  // ⭐ V3.84 — mx-auto : le module est CENTRÉ dans la zone de contenu du
  // back-office (comme /admin/staff) — avant, la colonne restait collée à
  // gauche avec un grand vide à droite sur les écrans larges.
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8A8378] font-bold mb-1">
          Contributions financières
        </p>
        <h1
          className="text-2xl md:text-3xl font-bold text-[#1E0F2B]"
          style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
        >
          Passerelles de paiement
        </h1>
        <p className="text-sm text-[#8A8378] mt-1 leading-relaxed">
          Configuration des moyens de paiement de la page « Contribuer » —
          FedaPay (Afrique de l&apos;Ouest) et Paystack (international) :
          clés API, secrets de webhook, activation et test de connexion.
        </p>
      </div>

      {/* Note sécurité */}
      <div className="bg-white rounded-xl border border-[#C9A227]/30 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#C9A227]/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#C9A227]" />
        </div>
        <div className="text-sm leading-relaxed">
          <p className="font-semibold text-[#1E0F2B] mb-0.5">
            Clés chiffrées, accès restreint, actions tracées
          </p>
          <p className="text-[#8A8378]">
            Les clés secrètes sont chiffrées (AES-256-GCM) avant stockage et
            ne sont jamais réaffichées — seuls leurs 4 derniers caractères
            servent de rappel. Chaque modification est consignée dans le
            journal d&apos;audit. Réservé aux comptes super administrateurs.
          </p>
        </div>
      </div>

      {/* Cartes des deux passerelles */}
      {(["fedapay", "paystack"] as ProviderId[]).map((provider) => (
        <CartePasserelle
          key={provider}
          provider={provider}
          etat={etatsActuels.find((e) => e.provider === provider)}
          webhookUrl={webhooks[provider]}
          onEtatMisAJour={(nouveau) =>
            setEtatsActuels((precedents) =>
              precedents.map((e) => (e.provider === provider ? nouveau : e))
            )
          }
        />
      ))}

      {/* Note de déploiement */}
      <div className="bg-[#2A0E3D]/5 border border-[#2A0E3D]/10 rounded-xl p-4 text-xs text-[#8A8378] leading-relaxed">
        <p className="flex items-center gap-1.5 font-semibold text-[#1E0F2B] mb-1">
          <Lock className="w-3.5 h-3.5 text-[#A3821C]" />
          Bon à savoir
        </p>
        Les variables d&apos;environnement (Vercel) restent valables en
        repli : tant qu&apos;une passerelle n&apos;est pas activée ici, la
        clé du serveur est utilisée. Désactiver une passerelle ici
        n&apos;efface pas sa clé enregistrée — elle peut être réactivée à
        tout moment.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

function CartePasserelle({
  provider,
  etat,
  webhookUrl,
  onEtatMisAJour,
}: {
  provider: ProviderId;
  etat: EtatPasserelle | undefined;
  webhookUrl: string;
  onEtatMisAJour: (etat: EtatPasserelle) => void;
}) {
  const meta = META_PASSERELLES[provider];
  const Icon = meta.icon;

  const [environment, setEnvironment] = useState<"sandbox" | "live">(
    etat?.backOffice?.environment === "live" ? "live" : "sandbox"
  );
  const [cle, setCle] = useState("");
  // ⭐ V3.85 — clé PUBLIQUE FedaPay (widget checkout.js sur /contribuer).
  const [clePublique, setClePublique] = useState("");
  const [clePubliqueTouche, setClePubliqueTouche] = useState(false);
  const [afficherClePublique, setAfficherClePublique] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  // « Touché » = l'utilisateur a réellement modifié le champ : seule
  // condition pour transmettre la valeur (chaîne vide = suppression
  // explicite du secret enregistré ; jamais touché = conservation).
  const [webhookTouche, setWebhookTouche] = useState(false);
  const [activee, setActivee] = useState(etat?.backOffice?.activee ?? false);
  const [afficherCle, setAfficherCle] = useState(false);
  const [afficherWebhook, setAfficherWebhook] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [test, setTest] = useState(false);
  const [message, setMessage] = useState<MessageCarte | null>(null);
  const [copie, setCopie] = useState(false);

  if (!etat) return null;

  // ── Badge d'état effectif ──
  const badge = !etat.effective.prete
    ? {
        libelle: "Non configurée",
        classe: "bg-[#B3452E]/10 text-[#B3452E] border-[#B3452E]/30",
      }
    : etat.effective.source === "back-office"
      ? {
          libelle: "Active — configurée ici",
          classe:
            "bg-state-success/15 text-state-success border-state-success/40",
        }
      : {
          libelle: "Active — variable serveur",
          classe: "bg-amber-100 text-amber-800 border-amber-300",
        };

  const copierWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // presse-papiers indisponible (contexte non sécurisé…)
      setMessage({
        type: "erreur",
        texte: `Copie impossible — copiez manuellement : ${webhookUrl}`,
      });
    }
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    setMessage(null);
    try {
      const reponse = await fetch("/admin/api/paiements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          activee,
          environment,
          // Champs vides et jamais touchés = conservation des valeurs
          // enregistrées ; le secret webhook vidé exprès = suppression.
          secretKey: cle.trim() || undefined,
          // ⭐ V3.85 — clé publique : touchée = envoyée (vide = retrait
          // explicite) ; jamais touchée = conservation de l'enregistrée.
          publicKey: clePubliqueTouche ? clePublique : undefined,
          webhookSecret: webhookTouche ? webhookSecret : undefined,
        }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as {
        ok?: boolean;
        masque?: string | null;
        etats?: EtatPasserelle[];
        error?: string;
      };
      if (!reponse.ok || !corps.ok) {
        setMessage({
          type: "erreur",
          texte:
            corps.error || "Enregistrement impossible — réessayez dans un instant.",
        });
        return;
      }
      // Succès : champs vidés (jamais de secret qui traîne), état rafraîchi.
      setCle("");
      setClePublique("");
      setClePubliqueTouche(false);
      setAfficherClePublique(false);
      setWebhookSecret("");
      setWebhookTouche(false);
      setAfficherCle(false);
      setAfficherWebhook(false);
      const nouveau = corps.etats?.find((e) => e.provider === provider);
      if (nouveau) {
        onEtatMisAJour(nouveau);
        setActivee(nouveau.backOffice?.activee ?? false);
        setEnvironment(
          nouveau.backOffice?.environment === "live" ? "live" : "sandbox"
        );
      }
      setMessage({
        type: "ok",
        texte: `Configuration enregistrée${corps.masque ? ` — clé ${corps.masque}` : ""}. ${
          activee
            ? "La passerelle est active : la page Contribuer l'utilise immédiatement."
            : "La passerelle est désactivée (la clé reste enregistrée)."
        }`,
      });
    } catch {
      setMessage({
        type: "erreur",
        texte:
          "Connexion impossible au serveur — vérifiez votre réseau puis réessayez.",
      });
    } finally {
      setEnregistrement(false);
    }
  };

  const tester = async () => {
    setTest(true);
    setMessage(null);
    try {
      const reponse = await fetch("/admin/api/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          secretKey: cle.trim() || undefined,
          environment,
        }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      setMessage({
        type: corps.ok ? "ok" : "erreur",
        texte:
          corps.message ||
          (corps.ok ? "Test réussi." : "Test impossible — réessayez."),
      });
    } catch {
      setMessage({
        type: "erreur",
        texte:
          "Connexion impossible au serveur — vérifiez votre réseau puis réessayez.",
      });
    } finally {
      setTest(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#8A8378]/15 overflow-hidden">
      {/* Bandeau d'en-tête */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] p-5 md:p-6 text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-[#C9A227]" />
            </div>
            <div>
              <h2
                className="text-lg md:text-xl font-bold"
                style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
              >
                {meta.titre}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#DDBE55]/80 mt-0.5">
                {meta.zone}
              </p>
              <p className="text-xs text-white/60 mt-1.5 max-w-md leading-relaxed">
                {meta.detail}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border flex-shrink-0",
              badge.classe
            )}
          >
            {badge.libelle}
          </span>
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-5">
        {/* État enregistré */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8A8378]">
          {etat.backOffice?.cleMasquee ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#A3821C]" />
                Clé enregistrée :
                <span className="font-mono text-[#1E0F2B]">
                  {etat.backOffice.cleMasquee}
                </span>
                {/* ⭐ V3.84 — preuve visible du chiffrement au repos : la
                    matière stockée en base est le texte chiffré AES-256-GCM
                    « v1:<sel>:<iv>:<tag>:<données> », jamais la clé brute. */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#A3821C] font-bold">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  chiffrée AES-256
                </span>
              </span>
              {etat.backOffice.majLe && (
                <span>
                  modifiée le {formaterDate(etat.backOffice.majLe)}
                  {etat.backOffice.majPar ? ` par ${etat.backOffice.majPar}` : ""}
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 italic">
              <KeyRound className="w-3.5 h-3.5 text-[#8A8378]/60" />
              Aucune clé enregistrée depuis le back-office
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#A3821C] font-bold not-italic">
                <Lock className="w-3 h-3" aria-hidden="true" />
                stockage chiffré AES-256-GCM
              </span>
            </span>
          )}
        </div>
        {etat.environnement.clePresente && !etat.effective.prete && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
            La variable serveur {etat.environnement.nomVariableCle} est
            détectée mais la passerelle doit d&apos;abord être{" "}
            <strong>activée ici</strong> avec une clé enregistrée pour que
            la configuration back-office prime. En attendant, collez votre
            clé ci-dessous puis activez.
          </p>
        )}
        {etat.environnement.clePresente && etat.effective.source === "environnement" && (
          <p className="text-[11px] text-[#8A8378] bg-[#FAF6EF] border border-[#8A8378]/15 rounded-lg px-3 py-2 leading-relaxed">
            La variable serveur {etat.environnement.nomVariableCle} est
            détectée — elle est utilisée tant qu&apos;aucune configuration
            n&apos;est activée ici.
          </p>
        )}

        {/* URL de webhook */}
        <div className="rounded-xl border border-[#8A8378]/20 bg-[#FAF6EF] p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#8A8378] mb-2 flex items-center gap-1.5">
            <Webhook className="w-3.5 h-3.5 text-[#A3821C]" />
            URL de webhook à déclarer chez {meta.titre}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs text-[#1E0F2B] bg-white border border-[#8A8378]/15 rounded-lg px-3 py-2.5 font-mono truncate">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={copierWebhook}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-xs font-semibold hover:bg-[#3D1A54] transition-colors"
            >
              {copie ? (
                <Check className="w-3.5 h-3.5 text-[#C9A227]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copie ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="text-[11px] text-[#8A8378] mt-2 leading-relaxed">
            {meta.aideWebhook}
          </p>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          {/* Environnement (FedaPay) */}
          {provider === "fedapay" && (
            <div>
              <p className="text-xs font-semibold text-[#2A0E3D] mb-1.5">
                Environnement
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {(
                  [
                    {
                      valeur: "sandbox" as const,
                      libelle: "Sandbox (test)",
                      aide: "sk_sandbox_…",
                    },
                    {
                      valeur: "live" as const,
                      libelle: "Production",
                      aide: "sk_live_…",
                    },
                  ]
                ).map((env) => (
                  <button
                    key={env.valeur}
                    type="button"
                    onClick={() => setEnvironment(env.valeur)}
                    aria-pressed={environment === env.valeur}
                    className={cn(
                      "px-3 py-2.5 rounded-xl border text-left transition-all",
                      environment === env.valeur
                        ? "border-[#C9A227] bg-[#C9A227]/10 shadow-[0_0_15px_rgba(201,162,39,0.15)]"
                        : "border-[#8A8378]/25 hover:border-[#C9A227]/50"
                    )}
                  >
                    <span className="block text-xs font-bold text-[#1E0F2B]">
                      {env.libelle}
                    </span>
                    <span className="block text-[10px] text-[#8A8378] font-mono mt-0.5">
                      {env.aide}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#8A8378] mt-1.5 leading-relaxed">
                Testez d&apos;abord en sandbox, puis basculez en production
                avec votre clé sk_live_ — la cohérence clé/environnement est
                vérifiée à l&apos;enregistrement.
              </p>
            </div>
          )}

          {/* Clé secrète API */}
          <div>
            <label
              htmlFor={`cle-${provider}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#2A0E3D] mb-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#C9A227]" />
              Clé secrète API{" "}
              <span className="text-[#8A8378] font-normal">
                (laisser vide pour conserver
                {etat.backOffice?.cleMasquee
                  ? ` ${etat.backOffice.cleMasquee}`
                  : " l'actuelle"}
                )
              </span>
            </label>
            <div className="relative">
              <input
                id={`cle-${provider}`}
                type={afficherCle ? "text" : "password"}
                value={cle}
                onChange={(e) => setCle(e.target.value)}
                placeholder={meta.placeholderCle}
                autoComplete="off"
                spellCheck={false}
                className="w-full px-4 py-3 rounded-xl border border-[#8A8378]/30 bg-white text-[#1E0F2B] font-mono text-sm placeholder:text-[#8A8378]/50 placeholder:font-sans focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all pr-11"
              />
              <button
                type="button"
                onClick={() => setAfficherCle(!afficherCle)}
                aria-label={
                  afficherCle ? "Masquer la clé" : "Afficher la clé"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#1E0F2B] hover:bg-[#8A8378]/10 transition-colors"
              >
                {afficherCle ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* ⭐ V3.85 — Clé PUBLIQUE (FedaPay uniquement) : widget checkout.js */}
          {provider === "fedapay" && (
            <div>
              <label
                htmlFor={`cle-publique-${provider}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#2A0E3D] mb-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-[#C9A227]" />
                Clé publique (paiement sur la page)
                <span className="text-[#8A8378] font-normal">(recommandée)</span>
              </label>
              <div className="relative">
                <input
                  id={`cle-publique-${provider}`}
                  type={afficherClePublique ? "text" : "password"}
                  value={clePublique}
                  onChange={(e) => {
                    setClePublique(e.target.value);
                    setClePubliqueTouche(true);
                  }}
                  placeholder="pk_live_… ou pk_sandbox_…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-xl border border-[#8A8378]/30 bg-white text-[#1E0F2B] font-mono text-sm placeholder:text-[#8A8378]/50 placeholder:font-sans focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setAfficherClePublique(!afficherClePublique)}
                  aria-label={
                    afficherClePublique
                      ? "Masquer la clé publique"
                      : "Afficher la clé publique"
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#1E0F2B] hover:bg-[#8A8378]/10 transition-colors"
                >
                  {afficherClePublique ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {etat.backOffice?.clePubliqueMasquee ? (
                <p className="text-[11px] text-[#8A8378] mt-1.5">
                  Clé publique enregistrée :{" "}
                  <span className="font-mono text-[#1E0F2B]">
                    {etat.backOffice.clePubliqueMasquee}
                  </span>{" "}
                  — le paiement s'ouvre directement sur la page Contribuer.
                  Vider le champ puis enregistrer pour revenir à la redirection
                  vers FedaPay.
                </p>
              ) : (
                <p className="text-[11px] text-[#8A8378] mt-1.5 leading-relaxed">
                  Avec cette clé (dashboard FedaPay → Paramètres → API → clé
                  publique), le paiement s'ouvre dans une fenêtre directement
                  sur la page Contribuer — sans quitter le site. Sans elle, le
                  donateur est redirigé vers la plateforme FedaPay (l'ancien
                  mode reste valable).
                </p>
              )}
            </div>
          )}

          {/* Secret webhook */}
          <div>
            <label
              htmlFor={`webhook-${provider}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#2A0E3D] mb-1.5"
            >
              <Webhook className="w-3.5 h-3.5 text-[#C9A227]" />
              Secret de webhook{" "}
              <span className="text-[#8A8378] font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                id={`webhook-${provider}`}
                type={afficherWebhook ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => {
                  setWebhookSecret(e.target.value);
                  setWebhookTouche(true);
                }}
                placeholder={
                  provider === "paystack"
                    ? "Vide = clé secrète du compte (convention Paystack)"
                    : "Secret du dashboard FedaPay"
                }
                autoComplete="off"
                spellCheck={false}
                className="w-full px-4 py-3 rounded-xl border border-[#8A8378]/30 bg-white text-[#1E0F2B] font-mono text-sm placeholder:text-[#8A8378]/50 placeholder:font-sans focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all pr-11"
              />
              <button
                type="button"
                onClick={() => setAfficherWebhook(!afficherWebhook)}
                aria-label={
                  afficherWebhook
                    ? "Masquer le secret"
                    : "Afficher le secret"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:text-[#1E0F2B] hover:bg-[#8A8378]/10 transition-colors"
              >
                {afficherWebhook ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {etat.backOffice?.webhookMasque && (
              <p className="text-[11px] text-[#8A8378] mt-1.5">
                Secret enregistré :{" "}
                <span className="font-mono text-[#1E0F2B]">
                  {etat.backOffice.webhookMasque}
                </span>{" "}
                — laisser vide pour le conserver.
              </p>
            )}
          </div>

          {/* Activation */}
          <button
            type="button"
            onClick={() => setActivee(!activee)}
            aria-pressed={activee}
            className={cn(
              "w-full flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border-2 transition-all text-left",
              activee
                ? "border-state-success/60 bg-state-success/5"
                : "border-[#8A8378]/25 hover:border-[#C9A227]/50"
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#1E0F2B]">
                Activer cette passerelle
              </span>
              <span className="block text-[11px] text-[#8A8378] mt-0.5 leading-relaxed">
                Une fois activée, la clé enregistrée ici est utilisée par la
                page « Contribuer » (elle prime sur la variable serveur).
              </span>
            </span>
            {/* Interrupteur */}
            <span
              className={cn(
                "relative flex-shrink-0 w-12 h-7 rounded-full transition-colors",
                activee ? "bg-state-success" : "bg-[#8A8378]/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform",
                  activee && "translate-x-5"
                )}
              />
            </span>
          </button>

          {/* Message (succès / erreur) */}
          {message && (
            <div
              role="status"
              className={cn(
                "flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm leading-relaxed",
                message.type === "ok"
                  ? "bg-state-success/10 border-state-success/40 text-[#3F5039]"
                  : "bg-red-50 border-red-300 text-red-800"
              )}
            >
              {message.type === "ok" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-state-success" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
              )}
              {message.texte}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={enregistrer}
              disabled={enregistrement || test}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enregistrement ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
              ) : (
                <Save className="w-4 h-4 text-[#C9A227]" />
              )}
              {enregistrement ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={tester}
              disabled={enregistrement || test}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#C9A227] text-[#A3821C] text-sm font-semibold hover:bg-[#C9A227]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {test ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlugZap className="w-4 h-4" />
              )}
              {test ? "Test en cours…" : "Tester la connexion"}
            </button>
            <p className="text-[11px] text-[#8A8378] italic">
              Le test interroge le fournisseur en lecture seule — aucun
              paiement n&apos;est créé.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
