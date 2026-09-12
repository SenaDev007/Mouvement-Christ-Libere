"use client";

/**
 * ⭐ V3.66 — Registre des demandes de rencontre (Secrétariat).
 *
 * Module central du poste de secrétaire :
 *  · registre filtrable (statut, serviteur, urgence, recherche) ;
 *  · TRANSMISSION d'une demande au serviteur concerné (Pam / Pasteur
 *    Kongo) avec note éventuelle — cœur de la directive : « c'est la
 *    secrétaire qui reçoit ces demandes et pourra les transmettre » ;
 *  · marquage traitée / archivage / réouverture ;
 *  · saisie MANUELLE d'une demande reçue par téléphone ou en personne
 *    (les demandes du formulaire public /rendez-vous arrivent seules).
 *
 * Données : /secretariat/api/demandes (rôles SECRETARY / SUPER_ADMIN).
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Inbox,
  Search,
  Loader2,
  AlertCircle,
  Send,
  CheckCircle2,
  Archive,
  RotateCcw,
  Plus,
  Phone,
  MapPin,
  ChevronDown,
  X,
  Clock,
} from "lucide-react";
import {
  DEMANDE_STATUTS,
  DEMANDE_URGENCES,
  SERVITEURS_RENDEZ_VOUS,
} from "@/lib/staff-space/constants";
import { Pagination } from "@/components/staff-space/pagination";
import { Download } from "lucide-react";

interface Demande {
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
  transmissionNote: string | null;
  transmittedAt: string | null;
  processedAt: string | null;
  trackingCode?: string | null;
  createdAt: string;
}

const PAR_PAGE = 25;

const ONGLET_STATUTS = [
  { valeur: "", libelle: "Tous" },
  ...Object.entries(DEMANDE_STATUTS).map(([v, s]) => ({
    valeur: v,
    libelle: s.libelle,
  })),
];

export default function SecretariatDemandesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <DemandesContenu />
    </Suspense>
  );
}

function DemandesContenu() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Demande[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [statut, setStatut] = useState(searchParams.get("statut") || "");
  const [servant, setServant] = useState(searchParams.get("servant") || "");
  const [urgence, setUrgence] = useState(searchParams.get("urgence") || "");
  const [recherche, setRecherche] = useState(searchParams.get("q") || "");

  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  // Modal transmission.
  const [transmettreId, setTransmettreId] = useState<string | null>(null);
  const [noteTransmission, setNoteTransmission] = useState("");

  // Formulaire de saisie manuelle.
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [form, setForm] = useState({
    requesterName: "",
    contact: "",
    servantCode: "pam",
    subject: "",
    message: "",
    urgency: "normale",
    country: "",
    city: "",
  });
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreurCreation, setErreurCreation] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (statut) params.set("statut", statut);
      if (servant) params.set("servant", servant);
      if (urgence) params.set("urgence", urgence);
      if (recherche.trim()) params.set("q", recherche.trim());
      params.set("limit", String(PAR_PAGE));
      params.set("offset", String((page - 1) * PAR_PAGE));
      const res = await fetch(`/secretariat/api/demandes?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de chargement");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }, [statut, servant, urgence, recherche, page]);

  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  const agir = async (
    demande: Demande,
    action: "transmettre" | "traiter" | "archiver" | "rouvrir",
    note?: string
  ) => {
    setActionEnCours(`${action}:${demande.id}`);
    try {
      const res = await fetch(`/secretariat/api/demandes/${demande.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, transmissionNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (action === "transmettre") {
        setTransmettreId(null);
        setNoteTransmission("");
      }
      charger();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setActionEnCours(null);
    }
  };

  const creerDemande = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationEnCours(true);
    setErreurCreation("");
    try {
      const res = await fetch("/secretariat/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setFormulaireOuvert(false);
      setForm({
        requesterName: "",
        contact: "",
        servantCode: "pam",
        subject: "",
        message: "",
        urgency: "normale",
        country: "",
        city: "",
      });
      charger();
    } catch (err) {
      setErreurCreation(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCreationEnCours(false);
    }
  };

  const exporterCsv = () => {
    const params = new URLSearchParams();
    if (statut) params.set("statut", statut);
    if (servant) params.set("servant", servant);
    if (urgence) params.set("urgence", urgence);
    if (recherche.trim()) params.set("q", recherche.trim());
    params.set("format", "csv");
    window.location.href = `/secretariat/api/demandes?${params}`;
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1E0F2B]">
            Demandes de rencontre
          </h1>
          <p className="text-sm text-[#8A8378] mt-1">
            {total} demande{total > 1 ? "s" : ""} — reçues, transmises aux
            serviteurs de Dieu, traitées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exporterCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#8A8378]/25 text-sm font-medium text-[#1E0F2B] hover:bg-white transition-colors"
            title="Exporter la sélection en CSV (Excel)"
          >
            <Download className="w-4 h-4 text-[#C9A227]" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => setFormulaireOuvert(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Saisir une demande
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-[#8A8378]/15 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {ONGLET_STATUTS.map((o) => (
            <button
              key={o.valeur}
              onClick={() => {
                setPage(1);
                setStatut(o.valeur);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statut === o.valeur
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "bg-[#FAF6EF] text-[#8A8378] hover:bg-[#C9A227]/10 hover:text-[#A3821C]"
              }`}
            >
              {o.libelle}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]/50" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => {
                setPage(1);
                setRecherche(e.target.value);
              }}
              placeholder="Rechercher (nom, objet, contact)…"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
            />
          </div>
          <select
            value={servant}
            onChange={(e) => {
              setPage(1);
              setServant(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
            aria-label="Filtrer par serviteur"
          >
            <option value="">Tous les serviteurs</option>
            <option value="pam">Sœur Pam</option>
            <option value="kongo">Pasteur Kongo</option>
          </select>
          <select
            value={urgence}
            onChange={(e) => {
              setPage(1);
              setUrgence(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227]"
            aria-label="Filtrer par urgence"
          >
            <option value="">Toutes urgences</option>
            {Object.entries(DEMANDE_URGENCES).map(([v, u]) => (
              <option key={v} value={v}>
                {u.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Erreur */}
      {erreur && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#B3452E]/10 text-[#B3452E] text-xs border border-[#B3452E]/30">
          <AlertCircle className="w-4 h-4" />
          {erreur}
        </div>
      )}

      {/* Liste */}
      {chargement ? (
        <div className="flex items-center justify-center py-16 text-[#8A8378]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#8A8378]/15 px-6 py-14 text-center">
          <Inbox className="w-8 h-8 text-[#8A8378]/40 mx-auto mb-3" />
          <p className="text-sm text-[#8A8378]">
            Aucune demande ne correspond aux filtres.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((demande) => {
            const statutInfo =
              DEMANDE_STATUTS[demande.status as keyof typeof DEMANDE_STATUTS];
            const urgenceInfo =
              DEMANDE_URGENCES[demande.urgency as keyof typeof DEMANDE_URGENCES];
            const serviteur =
              SERVITEURS_RENDEZ_VOUS[demande.servantCode as keyof typeof SERVITEURS_RENDEZ_VOUS];
            const ouvert = detailOuvert === demande.id;
            return (
              <div
                key={demande.id}
                className="bg-white rounded-xl border border-[#8A8378]/15 overflow-hidden"
              >
                {/* Ligne principale */}
                <button
                  onClick={() => setDetailOuvert(ouvert ? null : demande.id)}
                  className="w-full text-left px-4 md:px-5 py-4 hover:bg-[#FAF6EF]/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-[#1E0F2B]">
                          {demande.requesterName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statutInfo?.couleur}`}
                        >
                          {statutInfo?.libelle}
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
                      <p className="text-sm text-[#1E0F2B]/80 font-medium truncate">
                        {demande.subject}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-[#8A8378] flex-wrap">
                        <span>→ {serviteur?.libelle ?? demande.servantCode}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(demande.createdAt).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {demande.trackingCode && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FAF6EF] text-[#A3821C]">
                            {demande.trackingCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8A8378] flex-shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {/* Détail */}
                {ouvert && (
                  <div className="px-4 md:px-5 pb-5 border-t border-[#8A8378]/10 pt-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2 text-[#8A8378]">
                        <Phone className="w-3.5 h-3.5 text-[#C9A227]" />
                        {demande.contact}
                      </div>
                      {(demande.city || demande.country) && (
                        <div className="flex items-center gap-2 text-[#8A8378]">
                          <MapPin className="w-3.5 h-3.5 text-[#C9A227]" />
                          {[demande.city, demande.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {demande.trackingCode && (
                        <div className="flex items-center gap-2 text-[#8A8378]">
                          <Clock className="w-3.5 h-3.5 text-[#C9A227]" />
                          Code de suivi public :{" "}
                          <span className="font-mono text-[#A3821C] font-semibold">
                            {demande.trackingCode}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 rounded-lg bg-[#FAF6EF] border border-[#8A8378]/10">
                      <p className="text-xs whitespace-pre-wrap leading-relaxed text-[#1E0F2B]/90">
                        {demande.message}
                      </p>
                    </div>

                    {demande.transmissionNote && (
                      <div className="px-4 py-3 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/25">
                        <p className="text-[10px] uppercase font-bold text-[#A3821C] mb-1">
                          Note de transmission
                        </p>
                        <p className="text-xs whitespace-pre-wrap text-[#1E0F2B]/80">
                          {demande.transmissionNote}
                        </p>
                      </div>
                    )}

                    {/* Dates clés */}
                    {(demande.transmittedAt || demande.processedAt) && (
                      <div className="flex gap-4 text-[11px] text-[#8A8378] flex-wrap">
                        {demande.transmittedAt && (
                          <span>
                            Transmise le{" "}
                            {new Date(demande.transmittedAt).toLocaleString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {demande.processedAt && (
                          <span>
                            Traitée le{" "}
                            {new Date(demande.processedAt).toLocaleString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {demande.status === "RECUE" && (
                        <>
                          <button
                            onClick={() => {
                              setTransmettreId(demande.id);
                              setNoteTransmission("");
                            }}
                            disabled={actionEnCours === `transmettre:${demande.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#5B7052] text-white text-xs font-semibold hover:bg-[#3F5039] transition-colors disabled:opacity-50"
                          >
                            {actionEnCours === `transmettre:${demande.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Transmettre à {serviteur?.libelle}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Archiver cette demande sans la transmettre ?"))
                                agir(demande, "archiver");
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#8A8378]/30 text-[#8A8378] text-xs font-semibold hover:bg-[#FAF6EF] transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Archiver
                          </button>
                        </>
                      )}
                      {demande.status === "TRANSMISE" && (
                        <>
                          <button
                            onClick={() => agir(demande, "traiter")}
                            disabled={actionEnCours === `traiter:${demande.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#8C5FA8] text-white text-xs font-semibold hover:bg-[#6B4480] transition-colors disabled:opacity-50"
                          >
                            {actionEnCours === `traiter:${demande.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Marquer traitée
                          </button>
                          <button
                            onClick={() => agir(demande, "rouvrir")}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#8A8378]/30 text-[#8A8378] text-xs font-semibold hover:bg-[#FAF6EF] transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Rouvrir
                          </button>
                        </>
                      )}
                      {(demande.status === "TRAITEE" || demande.status === "ARCHIVEE") && (
                        <button
                          onClick={() => agir(demande, "rouvrir")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#8A8378]/30 text-[#8A8378] text-xs font-semibold hover:bg-[#FAF6EF] transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Rouvrir
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ⭐ V3.67 — Pagination */}
      {!chargement && total > 0 && (
        <Pagination
          total={total}
          page={page}
          parPage={PAR_PAGE}
          onChange={setPage}
        />
      )}

      {/* ── Modal : transmission avec note ── */}
      {transmettreId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A0826]/60">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1E0F2B]">
                  Transmettre la demande
                </h2>
                <p className="text-xs text-[#8A8378] mt-1">
                  La demande passe au statut « Transmise » — le serviteur de
                  Dieu concerné la verra à sa connexion.
                </p>
              </div>
              <button
                onClick={() => setTransmettreId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:bg-[#FAF6EF]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={noteTransmission}
              onChange={(e) => setNoteTransmission(e.target.value)}
              rows={4}
              placeholder="Note pour le serviteur (contexte, priorité, éléments de langage…) — facultatif"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm text-[#1E0F2B] focus:outline-none focus:border-[#C9A227] resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTransmettreId(null)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A8378] hover:text-[#1E0F2B]"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const demande = items.find((d) => d.id === transmettreId);
                  if (demande) agir(demande, "transmettre", noteTransmission);
                }}
                disabled={actionEnCours?.startsWith("transmettre:")}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#5B7052] text-white text-sm font-semibold hover:bg-[#3F5039] transition-colors disabled:opacity-50"
              >
                {actionEnCours?.startsWith("transmettre:") && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Transmettre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : saisie manuelle ── */}
      {formulaireOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A0826]/60 overflow-y-auto">
          <form
            onSubmit={creerDemande}
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1E0F2B]">
                  Saisir une demande reçue
                </h2>
                <p className="text-xs text-[#8A8378] mt-1">
                  Pour les demandes arrivées par téléphone, WhatsApp ou en
                  personne — les demandes du formulaire public arrivent seules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormulaireOuvert(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A8378] hover:bg-[#FAF6EF]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Nom du demandeur *
                </label>
                <input
                  type="text"
                  required
                  value={form.requesterName}
                  onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Contact (téléphone / WhatsApp / email) *
                </label>
                <input
                  type="text"
                  required
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Serviteur demandé *
                </label>
                <select
                  value={form.servantCode}
                  onChange={(e) => setForm({ ...form, servantCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                >
                  <option value="pam">Sœur Pam</option>
                  <option value="kongo">Pasteur Kongo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Urgence
                </label>
                <select
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                >
                  {Object.entries(DEMANDE_URGENCES).map(([v, u]) => (
                    <option key={v} value={v}>
                      {u.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Pays
                </label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                Objet *
              </label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E0F2B] mb-1">
                Message *
              </label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-[#FAF6EF] text-sm resize-none"
              />
            </div>

            {erreurCreation && (
              <p className="text-xs text-[#B3452E]">{erreurCreation}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormulaireOuvert(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8A8378] hover:text-[#1E0F2B]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creationEnCours}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors disabled:opacity-50"
              >
                {creationEnCours && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
