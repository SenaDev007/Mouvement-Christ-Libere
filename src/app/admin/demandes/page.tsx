"use client";

/**
 * ⭐ V3.74 — /admin/demandes — Module de RÉCEPTION des demandes de
 * rencontre, côté serviteurs de Dieu (back-office).
 *
 * Directive : « les serviteurs ont dans leur back-office un module pour
 * réceptionner les demandes envoyées par la secrétaire ; quand ils
 * valident la demande, la secrétaire reçoit une notification ».
 *
 *  · les demandes TRANSMISES par la secrétaire arrivent ici directement,
 *    pré-remplies (toutes les infos du demandeur + note éventuelle) ;
 *  · « Valider » confirme la réception/acceptation → la secrétaire est
 *    notifiée (cloche de l'espace Secrétariat + email) et le demandeur
 *    voit l'étape « Validée » sur /rendez-vous/suivi ;
 *  · « Marquer traitée » clôt après le rendez-vous ;
 *  · le compte connecté voit SES demandes (Pasteur Kongo / Sœur Pam
 *    résolus depuis le nom du compte) — un filtre permet la vue complète.
 *
 * Données : /admin/api/demandes (garde SUPER_ADMIN — 401/403 JSON).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Inbox,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BadgeCheck,
  Phone,
  MapPin,
  ChevronDown,
  Send,
  Clock,
  MessageSquareQuote,
  Mail,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import {
  DEMANDE_URGENCES,
  SERVITEURS_RENDEZ_VOUS,
} from "@/lib/staff-space/constants";

interface DemandeRecue {
  id: string;
  requesterName: string;
  contact: string;
  servantCode: string;
  subject: string;
  message: string;
  urgency: string;
  country: string | null;
  city: string | null;
  status: string;
  source: string;
  transmissionNote: string | null;
  transmittedAt: string | null;
  validatedAt: string | null;
  processedAt: string | null;
  trackingCode?: string | null;
  createdAt: string;
}

interface ReponseApi {
  items: DemandeRecue[];
  monServiteur: "kongo" | "pam" | null;
  compteur: { enAttente: number; validees: number };
}

export default function AdminDemandesPage() {
  const [items, setItems] = useState<DemandeRecue[]>([]);
  const [monServiteur, setMonServiteur] = useState<"kongo" | "pam" | null>(
    null
  );
  const [compteur, setCompteur] = useState({
    enAttente: 0,
    validees: 0,
  });
  const [filtre, setFiltre] = useState<"mien" | "tous">("mien");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [accesRefuse, setAccesRefuse] = useState(false);

  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    type: "succes" | "avertissement" | "erreur";
    texte: string;
  } | null>(null);

  const charger = useCallback(async () => {
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (filtre === "tous") params.set("servant", "tous");
      const res = await fetch(`/admin/api/demandes?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        setAccesRefuse(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setItems(data.items || []);
      setMonServiteur(data.monServiteur ?? null);
      setCompteur(data.compteur || { enAttente: 0, validees: 0 });
      setAccesRefuse(false);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [filtre]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Léger rafraîchissement (de nouvelles demandes transmises arrivent).
  useEffect(() => {
    const t = setInterval(charger, 60_000);
    return () => clearInterval(t);
  }, [charger]);

  const agir = async (
    demande: DemandeRecue,
    action: "valider" | "traiter"
  ) => {
    setActionEnCours(`${action}:${demande.id}`);
    setConfirmation(null);
    try {
      const res = await fetch(`/admin/api/demandes/${demande.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (action === "valider") {
        const courriel = data.courriel as
          | { envoye: boolean; erreur?: string }
          | undefined;
        setConfirmation({
          type: courriel && !courriel.envoye ? "avertissement" : "succes",
          texte:
            courriel && !courriel.envoye
              ? "Demande validée — la secrétaire est notifiée dans son espace (l'email de notification n'a pas pu partir" +
                (courriel.erreur ? ` : ${courriel.erreur}` : "") +
                ")."
              : "Demande validée — la secrétaire vient d'être notifiée (cloche de son espace + email).",
        });
        setTimeout(() => setConfirmation(null), 10_000);
      }
      charger();
    } catch (err) {
      setConfirmation({
        type: "erreur",
        texte: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setActionEnCours(null);
    }
  };

  const enAttente = items.filter((d) => d.status === "TRANSMISE");
  const validees = items.filter((d) => d.status === "VALIDEE");

  if (accesRefuse) {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-white rounded-2xl border border-[#8A857C]/15 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
          <Inbox className="w-6 h-6 text-[#A3821C]" />
        </div>
        <h1 className="text-xl font-bold text-[#000000] mb-2">
          Module réservé aux serviteurs de Dieu
        </h1>
        <p className="text-sm text-[#8A857C] leading-relaxed">
          Les demandes transmises par le secrétariat ne sont consultables que
          par les comptes super administrateurs (Pasteur Kongo et Sœur Pam).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#000000] via-[#161513] to-[#000000] p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2">
            Réception du secrétariat
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold mb-1"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
          >
            Demandes transmises
          </h1>
          <p className="text-sm text-white/70 max-w-2xl">
            {monServiteur
              ? `Les demandes de rencontre que la secrétaire vous transmet, ${
                  SERVITEURS_RENDEZ_VOUS[monServiteur]?.libelle ?? ""
                } — pré-remplies, prêtes à être validées.`
              : "Les demandes de rencontre transmises par le secrétariat aux serviteurs de Dieu."}
          </p>
        </div>
      </div>

      {/* Compteurs + filtre */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#C9A227]/40">
          <Inbox className="w-4 h-4 text-[#A3821C]" />
          <span className="text-sm font-bold text-[#000000]">
            {compteur.enAttente}
          </span>
          <span className="text-xs text-[#8A857C]">
            à réceptionner
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#5B7052]/30">
          <BadgeCheck className="w-4 h-4 text-[#5B7052]" />
          <span className="text-sm font-bold text-[#000000]">
            {compteur.validees}
          </span>
          <span className="text-xs text-[#8A857C]">
            validée{compteur.validees > 1 ? "s" : ""} (à clôturer)
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setFiltre("mien")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtre === "mien"
                ? "bg-[#000000] text-[#F0E9DE]"
                : "bg-white text-[#8A857C] border border-[#8A857C]/25 hover:bg-[#F0E9DE]"
            }`}
          >
            {monServiteur
              ? `Mes demandes (${SERVITEURS_RENDEZ_VOUS[monServiteur]?.libelle ?? ""})`
              : "Demandes (non rattaché)"}
          </button>
          <button
            onClick={() => setFiltre("tous")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtre === "tous"
                ? "bg-[#000000] text-[#F0E9DE]"
                : "bg-white text-[#8A857C] border border-[#8A857C]/25 hover:bg-[#F0E9DE]"
            }`}
          >
            Tous les serviteurs
          </button>
        </div>
      </div>

      {confirmation && (
        <div
          className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${
            confirmation.type === "succes"
              ? "bg-[#5B7052]/10 border-[#5B7052]/30 text-[#3F5039]"
              : confirmation.type === "avertissement"
                ? "bg-[#C9A227]/10 border-[#C9A227]/40 text-[#A3821C]"
                : "bg-[#B3452E]/10 border-[#B3452E]/30 text-[#B3452E]"
          }`}
        >
          {confirmation.type === "succes" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          {confirmation.texte}
        </div>
      )}

      {erreur && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
          <AlertCircle className="w-4 h-4" />
          {erreur}
        </div>
      )}

      {/* Liste */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-[#8A857C]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-[#8A857C]/30 px-6 py-14 text-center">
          <Inbox className="w-8 h-8 text-[#8A857C]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A857C]">
            Aucune demande transmise pour l&apos;instant — la secrétaire vous
            préviendra dès qu&apos;une demande arrive.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* À réceptionner */}
          {enAttente.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#A3821C] font-bold px-1 flex items-center gap-2">
                <Send className="w-3.5 h-3.5" />
                À réceptionner ({enAttente.length})
              </h2>
              {enAttente.map((demande) => (
                <CarteDemande
                  key={demande.id}
                  demande={demande}
                  ouvert={detailOuvert === demande.id}
                  onToggle={() =>
                    setDetailOuvert(
                      detailOuvert === demande.id ? null : demande.id
                    )
                  }
                  actionEnCours={actionEnCours}
                  onValider={() => agir(demande, "valider")}
                  onTraiter={() => agir(demande, "traiter")}
                />
              ))}
            </div>
          )}

          {/* Validées */}
          {validees.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#5B7052] font-bold px-1 flex items-center gap-2">
                <BadgeCheck className="w-3.5 h-3.5" />
                Validées — à clôturer ({validees.length})
              </h2>
              {validees.map((demande) => (
                <CarteDemande
                  key={demande.id}
                  demande={demande}
                  ouvert={detailOuvert === demande.id}
                  onToggle={() =>
                    setDetailOuvert(
                      detailOuvert === demande.id ? null : demande.id
                    )
                  }
                  actionEnCours={actionEnCours}
                  onValider={undefined}
                  onTraiter={() => agir(demande, "traiter")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lien public — expliquer le suivi au demandeur */}
      <div className="bg-white rounded-xl border border-[#8A857C]/15 p-4 flex items-start gap-3">
        <ExternalLink className="w-4 h-4 text-[#A3821C] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#8A857C] leading-relaxed">
          Chaque demandeur reçoit un <strong>code de suivi</strong> (ex.
          MCL-XXXXXX) au dépôt : quand vous validez, il voit l&apos;étape
          « Validée par le serviteur de Dieu » sur la page publique
          /rendez-vous/suivi. La secrétaire, elle, est notifiée
          immédiatement.
        </p>
      </div>
    </div>
  );
}

/* ── Carte d'une demande ───────────────────────────────────────────── */

function CarteDemande({
  demande,
  ouvert,
  onToggle,
  actionEnCours,
  onValider,
  onTraiter,
}: {
  demande: DemandeRecue;
  ouvert: boolean;
  onToggle: () => void;
  actionEnCours: string | null;
  onValider?: () => void;
  onTraiter: () => void;
}) {
  const urgenceInfo =
    DEMANDE_URGENCES[demande.urgency as keyof typeof DEMANDE_URGENCES];
  const serviteur =
    SERVITEURS_RENDEZ_VOUS[
      demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS
    ];
  const isEmail = demande.contact.includes("@");

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden ${
        demande.status === "VALIDEE"
          ? "border-[#5B7052]/40"
          : "border-[#8A857C]/15"
      }`}
    >
      {/* Ligne principale */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 md:px-5 py-4 hover:bg-[#F0E9DE]/60 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-[#000000]">
                {demande.requesterName}
              </span>
              {demande.status === "VALIDEE" ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#5B7052]/15 text-[#3F5039] border-[#5B7052]/30">
                  Validée
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#C9A227]/15 text-[#A3821C] border-[#C9A227]/30">
                  À réceptionner
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  demande.source === "SITE"
                    ? "bg-[#5B7052]/10 text-[#3F5039] border-[#5B7052]/30"
                    : "bg-[#8A857C]/10 text-[#6B675F] border-[#8A857C]/30"
                }`}
              >
                {demande.source === "SITE" ? "Site public" : "Présentiel"}
              </span>
              {demande.urgency === "urgente" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#B3452E]/10 text-[#B3452E]">
                  URGENTE
                </span>
              )}
              {demande.urgency === "elevee" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C9A227]/10 text-[#A3821C]">
                  ÉLEVÉE
                </span>
              )}
            </div>
            <p className="text-sm text-[#000000]/80 font-medium truncate">
              {demande.subject}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-[#8A857C] flex-wrap">
              <span
                className={
                  urgenceInfo?.couleur ?? "text-[#8A857C]"
                }
              >
                Urgence {urgenceInfo?.libelle ?? demande.urgency}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {demande.transmittedAt
                  ? new Date(demande.transmittedAt).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
              {demande.trackingCode && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F0E9DE] text-[#A3821C]">
                  {demande.trackingCode}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#8A857C] flex-shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Détail */}
      {ouvert && (
        <div className="px-4 md:px-5 pb-5 border-t border-[#8A857C]/10 pt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <a
              href={isEmail ? `mailto:${demande.contact}` : `tel:${demande.contact}`}
              className="flex items-center gap-2 text-[#8A857C] hover:text-[#A3821C] hover:underline"
            >
              {isEmail ? (
                <Mail className="w-3.5 h-3.5 text-[#C9A227]" />
              ) : (
                <Phone className="w-3.5 h-3.5 text-[#C9A227]" />
              )}
              {demande.contact}
            </a>
            {(demande.city || demande.country) && (
              <div className="flex items-center gap-2 text-[#8A857C]">
                <MapPin className="w-3.5 h-3.5 text-[#C9A227]" />
                {[demande.city, demande.country].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="flex items-center gap-2 text-[#8A857C]">
              <Send className="w-3.5 h-3.5 text-[#C9A227]" />
              Transmise par le secrétariat{" "}
              {demande.transmittedAt
                ? new Date(demande.transmittedAt).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </div>
            <div className="flex items-center gap-2 text-[#8A857C]">
              <CheckCheck className="w-3.5 h-3.5 text-[#C9A227]" />
              Destinée à {serviteur?.libelle ?? demande.servantCode}
            </div>
          </div>

          <div className="px-4 py-3 rounded-lg bg-[#F0E9DE] border border-[#8A857C]/10">
            <p className="text-[10px] uppercase font-bold text-[#A3821C] mb-1 flex items-center gap-1.5">
              <MessageSquareQuote className="w-3 h-3" />
              Message du demandeur
            </p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed text-[#000000]/90">
              {demande.message}
            </p>
          </div>

          {demande.transmissionNote && (
            <div className="px-4 py-3 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/25">
              <p className="text-[10px] uppercase font-bold text-[#A3821C] mb-1">
                Note de la secrétaire
              </p>
              <p className="text-xs whitespace-pre-wrap text-[#000000]/80">
                {demande.transmissionNote}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {demande.status === "TRANSMISE" && onValider && (
              <button
                onClick={onValider}
                disabled={actionEnCours === `valider:${demande.id}`}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#5B7052] text-white text-xs font-semibold hover:bg-[#3F5039] transition-colors disabled:opacity-50"
              >
                {actionEnCours === `valider:${demande.id}` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BadgeCheck className="w-3.5 h-3.5" />
                )}
                Valider la demande
              </button>
            )}
            <button
              onClick={onTraiter}
              disabled={actionEnCours === `traiter:${demande.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#8A857C]/30 text-[#8A857C] text-xs font-semibold hover:bg-[#F0E9DE] transition-colors disabled:opacity-50"
            >
              {actionEnCours === `traiter:${demande.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Marquer traitée
            </button>
          </div>

          {demande.status === "TRANSMISE" && (
            <p className="text-[10px] text-[#8A857C] flex items-center gap-1.5">
              <BadgeCheck className="w-3 h-3 text-[#A3821C]" />
              En validant, vous confirmez avoir pris connaissance de la
              demande : la secrétaire est immédiatement notifiée, et le
              demandeur voit l&apos;étape « Validée » dans son suivi.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
