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
 *  · le compte connecté voit SES demandes (Pasteur Kongo / Sœur Afrika
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
  monServiteur: "kongo" | "afrika" | null;
  compteur: { enAttente: number; validees: number };
}

export default function AdminDemandesPage() {
  const [items, setItems] = useState<DemandeRecue[]>([]);
  const [monServiteur, setMonServiteur] = useState<"kongo" | "afrika" | null>(
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
      <div className="max-w-xl mx-auto mt-8 bg-[#1A0826]/70 rounded-2xl shadow-xl border border-[#C9A227]/15 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
          <Inbox className="w-6 h-6 text-[#DDBE55]" />
        </div>
        <h1 className="text-xl font-bold font-serif text-[#FAF6EF] mb-2">
          Module réservé aux serviteurs de Dieu
        </h1>
        <p className="text-sm text-[#BDB4C9] leading-relaxed">
          Les demandes transmises par le secrétariat ne sont consultables que
          par les comptes super administrateurs (Pasteur Kongo et Sœur Afrika).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2A0E3D] via-[#3D1A54] to-[#2A0E3D] p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#DDBE55]/80 font-semibold mb-2">
            Réception du secrétariat
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold mb-1"
           
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
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A0826]/70 border border-[#C9A227]/40">
          <Inbox className="w-4 h-4 text-[#DDBE55]" />
          <span className="text-sm font-bold font-serif text-[#FAF6EF]">
            {compteur.enAttente}
          </span>
          <span className="text-xs text-[#BDB4C9]">
            à réceptionner
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A0826]/70 border border-[#5B7052]/30">
          <BadgeCheck className="w-4 h-4 text-[#A3C9B0]" />
          <span className="text-sm font-bold font-serif text-[#FAF6EF]">
            {compteur.validees}
          </span>
          <span className="text-xs text-[#BDB4C9]">
            validée{compteur.validees > 1 ? "s" : ""} (à clôturer)
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setFiltre("mien")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtre === "mien"
                ? "bg-[#3D1A54] text-[#FAF6EF]"
                : "bg-[#1A0826]/70 text-[#BDB4C9] border border-[#C9A227]/25 hover:bg-[#C9A227]/10"
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
                ? "bg-[#3D1A54] text-[#FAF6EF]"
                : "bg-[#1A0826]/70 text-[#BDB4C9] border border-[#C9A227]/25 hover:bg-[#C9A227]/10"
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
              ? "bg-[#5B7052]/10 border-[#5B7052]/30 text-[#A3C9B0]"
              : confirmation.type === "avertissement"
                ? "bg-[#C9A227]/10 border-[#C9A227]/40 text-[#DDBE55]"
                : "bg-[#B3452E]/10 border-[#B3452E]/30 text-[#E08B6D]"
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
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#E08B6D] text-xs border border-[#B3452E]/30">
          <AlertCircle className="w-4 h-4" />
          {erreur}
        </div>
      )}

      {/* Liste */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-[#BDB4C9]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-dashed border-[#C9A227]/30 px-6 py-14 text-center">
          <Inbox className="w-8 h-8 text-[#FAF6EF]/25 mx-auto mb-3" />
          <p className="text-sm text-[#BDB4C9]">
            Aucune demande transmise pour l&apos;instant — la secrétaire vous
            préviendra dès qu&apos;une demande arrive.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* À réceptionner */}
          {enAttente.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#DDBE55] font-bold px-1 flex items-center gap-2">
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
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#A3C9B0] font-bold px-1 flex items-center gap-2">
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
      <div className="bg-[#1A0826]/70 rounded-2xl shadow-lg border border-[#C9A227]/15 p-4 flex items-start gap-3">
        <ExternalLink className="w-4 h-4 text-[#DDBE55] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#BDB4C9] leading-relaxed">
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
      className={`bg-[#1A0826]/70 rounded-2xl shadow-lg border overflow-hidden ${
        demande.status === "VALIDEE"
          ? "border-[#5B7052]/40"
          : "border-[#C9A227]/15"
      }`}
    >
      {/* Ligne principale */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 md:px-5 py-4 hover:bg-[#C9A227]/15 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-[#FAF6EF]">
                {demande.requesterName}
              </span>
              {demande.status === "VALIDEE" ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#5B7052]/15 text-[#A3C9B0] border-[#5B7052]/30">
                  Validée
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#C9A227]/15 text-[#DDBE55] border-[#C9A227]/30">
                  À réceptionner
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  demande.source === "SITE"
                    ? "bg-[#5B7052]/10 text-[#A3C9B0] border-[#5B7052]/30"
                    : "bg-[#FAF6EF]/10 text-[#6B6459] border-[#C9A227]/30"
                }`}
              >
                {demande.source === "SITE" ? "Site public" : "Présentiel"}
              </span>
              {demande.urgency === "urgente" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#B3452E]/10 text-[#E08B6D]">
                  URGENTE
                </span>
              )}
              {demande.urgency === "elevee" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C9A227]/10 text-[#DDBE55]">
                  ÉLEVÉE
                </span>
              )}
            </div>
            <p className="text-sm text-[#FAF6EF]/80 font-medium truncate">
              {demande.subject}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-[#BDB4C9] flex-wrap">
              <span
                className={
                  urgenceInfo?.couleur ?? "text-[#BDB4C9]"
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
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#C9A227]/10 text-[#DDBE55]">
                  {demande.trackingCode}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#BDB4C9] flex-shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Détail */}
      {ouvert && (
        <div className="px-4 md:px-5 pb-5 border-t border-[#C9A227]/10 pt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <a
              href={isEmail ? `mailto:${demande.contact}` : `tel:${demande.contact}`}
              className="flex items-center gap-2 text-[#BDB4C9] hover:text-[#DDBE55] hover:underline"
            >
              {isEmail ? (
                <Mail className="w-3.5 h-3.5 text-[#C9A227]" />
              ) : (
                <Phone className="w-3.5 h-3.5 text-[#C9A227]" />
              )}
              {demande.contact}
            </a>
            {(demande.city || demande.country) && (
              <div className="flex items-center gap-2 text-[#BDB4C9]">
                <MapPin className="w-3.5 h-3.5 text-[#C9A227]" />
                {[demande.city, demande.country].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="flex items-center gap-2 text-[#BDB4C9]">
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
            <div className="flex items-center gap-2 text-[#BDB4C9]">
              <CheckCheck className="w-3.5 h-3.5 text-[#C9A227]" />
              Destinée à {serviteur?.libelle ?? demande.servantCode}
            </div>
          </div>

          <div className="px-4 py-3 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/10">
            <p className="text-[10px] uppercase font-bold text-[#DDBE55] mb-1 flex items-center gap-1.5">
              <MessageSquareQuote className="w-3 h-3" />
              Message du demandeur
            </p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed text-[#FAF6EF]/90">
              {demande.message}
            </p>
          </div>

          {demande.transmissionNote && (
            <div className="px-4 py-3 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/25">
              <p className="text-[10px] uppercase font-bold text-[#DDBE55] mb-1">
                Note de la secrétaire
              </p>
              <p className="text-xs whitespace-pre-wrap text-[#FAF6EF]/80">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#C9A227]/30 text-[#BDB4C9] text-xs font-semibold hover:bg-[#C9A227]/10 transition-colors disabled:opacity-50"
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
            <p className="text-[10px] text-[#BDB4C9] flex items-center gap-1.5">
              <BadgeCheck className="w-3 h-3 text-[#DDBE55]" />
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
