"use client";

/**
 * ⭐ V4.43 — Registre des demandes de RETRAITE SPIRITUELLE (espace
 * Secrétariat, secretariat.mouvementchristlibere.com/secretariat/retraites).
 *
 * Chaque demande déposée depuis le site (/retraite-spirituelle) ou
 * l'application mobile atterrit ici : identité complète, séjour souhaité,
 * pièce d'identité et preuve du paiement des 15 000 FCFA de frais de
 * dossier. La secrétaire examine le dossier puis tranche :
 *   SOUMISE → EN_EXAMEN → ACCEPTEE / REJETEE (rouvrir possible).
 * Les décisions partent par email au demandeur (best-effort) et toute
 * action est journalisée (AuditLog). Export CSV disponible.
 *
 * Gabarit : /secretariat/demandes (onglets statuts, recherche debouncée,
 * cartes-accordéon, badges, Pagination, export CSV).
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  Mountain,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  MapPin,
  Phone,
  CalendarDays,
  BedDouble,
  IdCard,
  Coins,
} from "lucide-react";
import { Pagination } from "@/components/staff-space/pagination";

interface RetraiteDemande {
  id: string;
  trackingCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string | null;
  phone: string;
  country: string;
  city: string;
  address: string | null;
  profession: string | null;
  maritalStatus: string | null;
  emergencyContact: string | null;
  arrivalDate: string | null;
  numberOfDays: number;
  expectations: string | null;
  hasBeenBefore: boolean;
  idDocumentUrl: string;
  paymentProofUrl: string;
  paymentAmount: number;
  paymentMethod: string | null;
  status: string;
  decisionReason: string | null;
  secretaryNote: string | null;
  processedAt: string | null;
  source: string;
  createdAt: string;
}

const PAR_PAGE = 25;

const RETRAITE_STATUTS: Record<string, { libelle: string; couleur: string }> = {
  SOUMISE: {
    libelle: "Soumise",
    couleur: "text-[#a3821c] border-[#c9a227]/60 bg-[#DDBE55]/10",
  },
  EN_EXAMEN: {
    libelle: "En examen",
    couleur: "text-[#2563eb] border-[#7FB5F5]/40 bg-[#7FB5F5]/10",
  },
  ACCEPTEE: {
    libelle: "Acceptée",
    couleur: "text-[#2e7d4f] border-[#6BC28B]/40 bg-[#6BC28B]/10",
  },
  REJETEE: {
    libelle: "Rejetée",
    couleur: "text-[#E5484D] border-[#E5484D]/40 bg-[#E5484D]/10",
  },
};

const ONGLET_STATUTS = [
  { valeur: "", libelle: "Tous" },
  ...Object.entries(RETRAITE_STATUTS).map(([v, s]) => ({
    valeur: v,
    libelle: s.libelle,
  })),
];

export default function SecretariatRetraitesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-[#8a8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <RetraitesContenu />
    </Suspense>
  );
}

function RetraitesContenu() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<RetraiteDemande[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [statut, setStatut] = useState(searchParams.get("statut") || "");
  const [recherche, setRecherche] = useState(searchParams.get("q") || "");
  const [q, setQ] = useState(searchParams.get("q") || "");

  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [actionErreur, setActionErreur] = useState("");

  // Recherche debouncée (300 ms) — même mécanique que /secretariat/demandes
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(recherche);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [recherche]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (statut) params.set("statut", statut);
      if (q) params.set("q", q);
      params.set("limit", String(PAR_PAGE));
      params.set("offset", String((page - 1) * PAR_PAGE));
      const res = await fetch(`/secretariat/api/retraites?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [statut, q, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Action de traitement (examiner / accepter / rejeter / rouvrir). */
  const agir = async (demande: RetraiteDemande, action: string) => {
    setEnCours(`${demande.id}:${action}`);
    setActionErreur("");
    setConfirmation("");
    try {
      const res = await fetch(`/secretariat/api/retraites/${demande.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          decisionReason: note[demande.id] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      const message =
        action === "accepter"
          ? `Séjour de ${demande.firstName} ${demande.lastName} accordé — pensez à le/la contacter pour préparer l'arrivée.`
          : action === "rejeter"
            ? `Demande de ${demande.firstName} ${demande.lastName} rejetée.`
            : action === "examiner"
              ? `Dossier de ${demande.firstName} ${demande.lastName} passé en examen.`
              : `Dossier rouvert — de retour « En examen ».`;
      if (data.courriel && !data.courriel.envoye) {
        setConfirmation(`${message} (Email non envoyé : ${data.courriel.erreur || "erreur"})`);
      } else if (data.courriel?.envoye) {
        setConfirmation(`${message} Email de décision envoyé au demandeur.`);
      } else {
        setConfirmation(message);
      }
      await charger();
    } catch (e) {
      setActionErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setEnCours(null);
    }
  };

  const exporterCsv = () => {
    const params = new URLSearchParams();
    if (statut) params.set("statut", statut);
    if (q) params.set("q", q);
    params.set("format", "csv");
    window.location.href = `/secretariat/api/retraites?${params.toString()}`;
  };

  const exporterLieu = (d: RetraiteDemande) =>
    `${d.country} — ${d.city}${d.address ? ` (${d.address})` : ""}`;
  const nomComplet = (d: RetraiteDemande) => `${d.firstName} ${d.lastName}`;
  const dateFr = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1e0f2b] flex items-center gap-2.5">
            <Mountain className="w-5 h-5 text-[#a3821c]" />
            Retraites spirituelles
          </h1>
          <p className="text-xs text-[#8a8378] mt-1 leading-relaxed max-w-xl">
            Demandes de séjour sur le lieu aménagé du ministère (Côte
            d&apos;Ivoire). Vérifiez l&apos;identité et la preuve des frais de
            dossier (15 000 FCFA) avant d&apos;accorder le séjour — le demandeur
            est ensuite contacté pour préparer son arrivée.
          </p>
        </div>
        <button
          onClick={exporterCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1e0f2b]/15 text-xs font-semibold text-[#1e0f2b]/80 hover:text-[#1e0f2b] hover:border-[#c9a227]/70 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ONGLET_STATUTS.map((o) => (
            <button
              key={o.valeur}
              onClick={() => {
                setStatut(o.valeur);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statut === o.valeur
                  ? "bg-[#DDBE55]/15 text-[#a3821c] border border-[#c9a227]/60"
                  : "text-[#8a8378] border border-[#1e0f2b]/10 hover:text-[#1e0f2b] hover:border-[#1e0f2b]/25"
              }`}
            >
              {o.libelle}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8378]/60" />
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, code de suivi, téléphone, ville…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#2a0e3d]/5 border border-[#1e0f2b]/10 text-sm text-[#1e0f2b] placeholder:text-[#8a8378]/50 focus:outline-none focus:border-[#c9a227]/70"
          />
        </div>
      </div>

      {/* Bandeaux de retour */}
      {confirmation && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#6BC28B]/10 border border-[#6BC28B]/30 text-[#2e7d4f] text-xs leading-relaxed">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {confirmation}
        </div>
      )}
      {actionErreur && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-[#E5484D] text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {actionErreur}
        </div>
      )}
      {erreur && !chargement && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-[#E5484D] text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {erreur}
        </div>
      )}

      {/* Liste */}
      {chargement ? (
        <div className="flex items-center justify-center py-20 text-[#8a8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Mountain className="w-10 h-10 text-[#8a8378]/30 mx-auto mb-3" />
          <p className="text-sm text-[#8a8378]">
            Aucune demande de retraite pour ce filtre.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((d) => {
            const statutInfo = RETRAITE_STATUTS[d.status];
            const ouvert = detailOuvert === d.id;
            const decisionPrise = d.status === "ACCEPTEE" || d.status === "REJETEE";
            return (
              <div
                key={d.id}
                className="rounded-xl border border-[#1e0f2b]/10 bg-[#2a0e3d]/5 overflow-hidden"
              >
                {/* Ligne de tête */}
                <button
                  onClick={() => setDetailOuvert(ouvert ? null : d.id)}
                  className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-[#2a0e3d]/5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#1e0f2b]">
                        {nomComplet(d)}
                      </p>
                      <span className="font-mono text-[10px] text-[#a3821c] tracking-wider">
                        {d.trackingCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-[#8a8378]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {exporterLieu(d)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="w-3 h-3" />
                        {d.numberOfDays} jour{d.numberOfDays > 1 ? "s" : ""}
                        {d.arrivalDate ? ` · arrivée ${dateFr(d.arrivalDate)}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {d.paymentMethod || "moyen non précisé"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {d.source === "MOBILE" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border text-[#8a8378] border-[#1e0f2b]/20">
                        Mobile
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statutInfo?.couleur}`}
                    >
                      {statutInfo?.libelle || d.status}
                    </span>
                    <span className="text-[10px] text-[#8a8378]/60">
                      {dateFr(d.createdAt)}
                    </span>
                  </div>
                </button>

                {/* Détail */}
                {ouvert && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#1e0f2b]/10 space-y-4">
                    {/* Identité */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs">
                      {[
                        { l: "Genre", v: d.gender === "HOMME" ? "Homme" : d.gender === "FEMME" ? "Femme" : "Non précisé" },
                        { l: "Téléphone", v: d.phone, icone: Phone },
                        { l: "Email", v: d.email || "—" },
                        { l: "Adresse", v: d.address || "—" },
                        { l: "Profession", v: d.profession || "—" },
                        { l: "Situation", v: d.maritalStatus || "—" },
                        { l: "Contact d'urgence", v: d.emergencyContact || "—" },
                        { l: "Déjà venu sur le lieu", v: d.hasBeenBefore ? "Oui" : "Non" },
                        { l: "Déposée le", v: dateFr(d.createdAt) },
                      ].map(({ l, v, icone: Icone }) => (
                        <div key={l} className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wide text-[#8a8378]/60">
                            {l}
                          </p>
                          <p className="text-[#1e0f2b] break-words flex items-center gap-1">
                            {Icone && <Icone className="w-3 h-3 text-[#a3821c]/70" />}
                            {v}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Motif / attentes */}
                    {d.expectations && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#8a8378]/60 mb-1">
                          Motif / attentes spirituelles
                        </p>
                        <p className="text-xs text-[#1e0f2b]/85 leading-relaxed whitespace-pre-wrap">
                          {d.expectations}
                        </p>
                      </div>
                    )}

                    {/* Pièces jointes */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        {
                          titre: "Pièce d'identité",
                          url: d.idDocumentUrl,
                          icone: IdCard,
                        },
                        {
                          titre: `Preuve du paiement (${d.paymentAmount.toLocaleString("fr-FR")} FCFA)`,
                          url: d.paymentProofUrl,
                          icone: Coins,
                        },
                      ].map(({ titre, url, icone: Icone }) => (
                        <div key={titre} className="rounded-lg border border-[#1e0f2b]/10 p-3">
                          <p className="text-[10px] uppercase tracking-wide text-[#8a8378]/60 mb-2 flex items-center gap-1.5">
                            <Icone className="w-3 h-3 text-[#a3821c]/70" />
                            {titre}
                          </p>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group relative"
                          >
                            <Image
                              src={url}
                              alt={titre}
                              width={320}
                              height={220}
                              unoptimized
                              className="w-full h-40 object-cover rounded-md border border-[#1e0f2b]/10"
                            />
                            <span className="absolute inset-0 rounded-md bg-[#2a0e3d]/0 group-hover:bg-[#2a0e3d]/40 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e0f2b]">
                                <ExternalLink className="w-3.5 h-3.5" />
                                Ouvrir en grand
                              </span>
                            </span>
                          </a>
                        </div>
                      ))}
                    </div>

                    {/* Décision existante */}
                    {decisionPrise && (
                      <div className="rounded-lg border border-[#1e0f2b]/10 px-3 py-2.5 text-xs text-[#8a8378]">
                        <p className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#1e0f2b]">
                            {d.status === "ACCEPTEE" ? "Acceptée" : "Rejetée"}
                          </span>
                          le {dateFr(d.processedAt)}
                        </p>
                        {d.decisionReason && (
                          <p className="mt-1 leading-relaxed">
                            Précisions communiquées : {d.decisionReason}
                          </p>
                        )}
                        {d.secretaryNote && (
                          <p className="mt-1 leading-relaxed text-[#8a8378]/70">
                            Note interne : {d.secretaryNote}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Note + actions */}
                    {!decisionPrise && (
                      <div className="space-y-3">
                        <textarea
                          rows={2}
                          value={note[d.id] || ""}
                          onChange={(e) =>
                            setNote((n) => ({ ...n, [d.id]: e.target.value }))
                          }
                          placeholder="Précisions envoyées au demandeur lors de la décision (recommandé pour un rejet) — facultatif pour « Examiner »."
                          className="w-full px-3 py-2 rounded-lg bg-[#2a0e3d]/5 border border-[#1e0f2b]/10 text-xs text-[#1e0f2b] placeholder:text-[#8a8378]/50 focus:outline-none focus:border-[#c9a227]/70 resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          {d.status === "SOUMISE" && (
                            <button
                              onClick={() => agir(d, "examiner")}
                              disabled={enCours !== null}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#7FB5F5]/40 bg-[#7FB5F5]/10 text-[#2563eb] text-xs font-semibold hover:bg-[#7FB5F5]/20 transition-colors disabled:opacity-50"
                            >
                              {enCours === `${d.id}:examiner` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              Passer en examen
                            </button>
                          )}
                          <button
                            onClick={() => agir(d, "accepter")}
                            disabled={enCours !== null}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#6BC28B]/40 bg-[#6BC28B]/10 text-[#2e7d4f] text-xs font-semibold hover:bg-[#6BC28B]/20 transition-colors disabled:opacity-50"
                          >
                            {enCours === `${d.id}:accepter` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Accepter le séjour
                          </button>
                          <button
                            onClick={() => agir(d, "rejeter")}
                            disabled={enCours !== null}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5484D]/40 bg-[#E5484D]/10 text-[#E5484D] text-xs font-semibold hover:bg-[#E5484D]/20 transition-colors disabled:opacity-50"
                          >
                            {enCours === `${d.id}:rejeter` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Rejeter
                          </button>
                        </div>
                      </div>
                    )}
                    {decisionPrise && (
                      <div>
                        <button
                          onClick={() => agir(d, "rouvrir")}
                          disabled={enCours !== null}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1e0f2b]/15 text-[#8a8378] text-xs font-semibold hover:text-[#1e0f2b] hover:border-[#1e0f2b]/30 transition-colors disabled:opacity-50"
                        >
                          {enCours === `${d.id}:rouvrir` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Rouvrir le dossier
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        total={total}
        page={page}
        parPage={PAR_PAGE}
        onChange={setPage}
      />
    </div>
  );
}
