"use client";

/**
 * Client — /admin/tiktok-accounts
 * Gestion des comptes TikTok multi-serviteurs.
 * Palette : fond crème (#faf6ef), cartes blanches, accents or (#C9A227).
 * Identique aux autres modules admin.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Music2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Power,
  Calendar,
  Pencil,
  ExternalLink,
} from "lucide-react";

interface ServantLite {
  id: string;
  code: string;
  shortName: string;
  fullName: string;
}

interface CompteTiktok {
  id: string;
  servantId: string;
  servantCode: string | null;
  servantShortName: string | null;
  servantFullName: string | null;
  username: string;
  displayName: string | null;
  actif: boolean;
  dernierSyncAt: string | null;
  derniereErreur: string | null;
  createdAt: string;
}

interface Props {
  servants: ServantLite[];
  comptes: CompteTiktok[];
}

export function TiktokAccountsClient({ servants, comptes: comptesInit }: Props) {
  const [comptes, setComptes] = useState<CompteTiktok[]>(comptesInit);
  const [servantSelectionne, setServantSelectionne] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");

  const servantsAvecCompte = new Set(comptes.map((c) => c.servantCode));
  const servantsDisponibles = servants.filter((s) => !servantsAvecCompte.has(s.code));

  const creer = async () => {
    if (!servantSelectionne) {
      setErreur("Sélectionnez un serviteur.");
      return;
    }
    if (!username.trim()) {
      setErreur("Saisissez le username TikTok (sans le @).");
      return;
    }
    setEnCours("create");
    setErreur(null);
    setInfo(null);
    try {
      const res = await fetch("/admin/api/tiktok/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servantCode: servantSelectionne,
          username: username.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Échec (${res.status})`);
      }
      setInfo(`Compte TikTok @${username.trim()} lié au serviteur ${servantSelectionne}.`);
      setServantSelectionne("");
      setUsername("");
      setDisplayName("");
      await recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur création.");
    } finally {
      setEnCours(null);
    }
  };

  const recharger = async () => {
    const res = await fetch("/admin/api/tiktok/accounts");
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { comptes?: CompteTiktok[] } | null;
      if (data?.comptes) setComptes(data.comptes);
    }
  };

  const synchroniser = async (compte: CompteTiktok) => {
    if (!compte.servantCode) return;
    setEnCours(`sync-${compte.id}`);
    setErreur(null);
    setInfo(null);
    try {
      const res = await fetch("/admin/api/videos/sync-tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servantCode: compte.servantCode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ajoutees?: number;
        ignorees?: number;
        sautees?: number;
        filtrees?: number;
        username?: string;
        displayName?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Échec (${res.status})`);
      }
      const a = data.ajoutees || 0;
      const i = data.ignorees || 0;
      const s = data.sautees || 0;
      const f = data.filtrees || 0;
      setInfo(
        a > 0
          ? `@${compte.username} : ${a} nouvelle${a > 1 ? "s" : ""} vidéo${a > 1 ? "s" : ""} importée${a > 1 ? "s" : ""} (${i} déjà en base, non réimportée${i > 1 ? "s" : ""}${f ? `, ${f} filtrée${f > 1 ? "s" : ""} (>10 jours)` : ""}${s ? `, ${s} supprimée${s > 1 ? "s" : ""}` : ""}).`
          : `@${compte.username} à jour — aucune nouvelle vidéo (${i} déjà en base, non réimportée${i > 1 ? "s" : ""}${f ? `, ${f} filtrée${f > 1 ? "s" : ""} (>10 jours)` : ""}).`
      );
      await recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur synchro.");
    } finally {
      setEnCours(null);
    }
  };

  const basculerActif = async (compte: CompteTiktok) => {
    setEnCours(`toggle-${compte.id}`);
    setErreur(null);
    try {
      const res = await fetch(`/admin/api/tiktok/accounts/${compte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !compte.actif }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Échec (${res.status})`);
      }
      setComptes((prev) =>
        prev.map((c) => (c.id === compte.id ? { ...c, actif: !compte.actif } : c))
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur mise à jour.");
    } finally {
      setEnCours(null);
    }
  };

  const supprimer = async (compte: CompteTiktok) => {
    if (!confirm(`Supprimer le lien TikTok pour @${compte.username} ?\n\nLes vidéos déjà importées ne seront PAS supprimées.`)) {
      return;
    }
    setEnCours(`del-${compte.id}`);
    setErreur(null);
    try {
      const res = await fetch(`/admin/api/tiktok/accounts/${compte.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Échec (${res.status})`);
      }
      setComptes((prev) => prev.filter((c) => c.id !== compte.id));
      setInfo(`Lien TikTok @${compte.username} supprimé.`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur suppression.");
    } finally {
      setEnCours(null);
    }
  };

  const demarrerEdition = (compte: CompteTiktok) => {
    setEditionId(compte.id);
    setEditUsername(compte.username);
    setEditDisplayName(compte.displayName || "");
  };

  const sauvegarderEdition = async (compte: CompteTiktok) => {
    setEnCours(`edit-${compte.id}`);
    setErreur(null);
    try {
      const res = await fetch(`/admin/api/tiktok/accounts/${compte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername.trim(),
          displayName: editDisplayName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Échec (${res.status})`);
      }
      setInfo(`Compte @${editUsername.trim()} mis à jour.`);
      setEditionId(null);
      await recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur mise à jour.");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Music2 className="w-7 h-7 text-[#C9A227]" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e0f2b] font-serif">Comptes TikTok liés</h1>
          <p className="text-sm text-[#1e0f2b]/60 mt-1">
            Liez un username TikTok par serviteur. La synchro automatique se fait via ScrapingAnt
            (cron 2×/jour + bouton « Sync maintenant »).
          </p>
        </div>
      </div>

      {/* Erreur / info */}
        {erreur && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-red-700">{erreur}</span>
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-green-700">{info}</span>
          </div>
        )}

      {/* Lier un nouveau compte */}
      <section className="bg-white rounded-xl border border-[#c9a227]/25 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#a3821c]" />
          <h2 className="text-lg font-semibold text-[#1e0f2b]">Lier un nouveau compte TikTok</h2>
        </div>
        {servantsDisponibles.length === 0 ? (
          <p className="text-sm text-[#1e0f2b]/50">
            Tous les serviteurs actifs ont déjà un compte TikTok lié. Créez un nouveau serviteur
            dans <Link href="/admin/servants" className="text-[#a3821c] hover:underline">/admin/servants</Link> pour en ajouter.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-[#1e0f2b]/50">Serviteur</label>
              <select
                value={servantSelectionne}
                onChange={(e) => setServantSelectionne(e.target.value)}
                className="w-full bg-[#faf6ef] border border-[#c9a227]/25 rounded-lg px-3 py-2 text-[#1e0f2b] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30"
              >
                <option value="">— Sélectionnez —</option>
                {servantsDisponibles.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.shortName} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-[#1e0f2b]/50">Username TikTok</label>
              <div className="flex items-center bg-[#faf6ef] border border-[#c9a227]/25 rounded-lg focus-within:border-[#C9A227] focus-within:ring-1 focus-within:ring-[#C9A227]/30">
                <span className="pl-3 text-[#1e0f2b]/30">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nkosi.kongo"
                  className="flex-1 bg-transparent px-2 py-2 text-[#1e0f2b] focus:outline-none placeholder-[#1e0f2b]/25"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-[#1e0f2b]/50">Nom affiché (optionnel)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Pasteur Kongo"
                className="w-full bg-[#faf6ef] border border-[#c9a227]/25 rounded-lg px-3 py-2 text-[#1e0f2b] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/30 placeholder-[#1e0f2b]/25"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                onClick={creer}
                disabled={enCours === "create" || !servantSelectionne || !username.trim()}
                className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#a3821c] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-lg transition-colors shadow-sm"
              >
                {enCours === "create" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Lier ce compte
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Liste des comptes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1e0f2b]">Comptes liés ({comptes.length})</h2>
        {comptes.length === 0 ? (
          <p className="text-sm text-[#1e0f2b]/50 italic">Aucun compte TikTok lié pour l'instant.</p>
        ) : (
          <ul className="space-y-3">
            {comptes.map((c) => {
              const enEdition = editionId === c.id;
              return (
                <li
                  key={c.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    c.actif
                      ? "bg-white border-[#c9a227]/25 shadow-sm"
                      : "bg-[#faf6ef] border-[#c9a227]/10 opacity-60"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Music2 className="w-5 h-5 text-[#a3821c]" />
                        {enEdition ? (
                          <div className="flex items-center bg-[#faf6ef] border border-[#C9A227]/40 rounded px-2">
                            <span className="text-[#1e0f2b]/30">@</span>
                            <input
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="bg-transparent px-1 py-1 text-[#1e0f2b] focus:outline-none w-48"
                            />
                          </div>
                        ) : (
                          <span className="font-semibold text-lg text-[#1e0f2b]">
                            @{c.username}
                          </span>
                        )}
                        {enEdition ? (
                          <input
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            placeholder="Nom affiché"
                            className="bg-[#faf6ef] border border-[#c9a227]/25 rounded px-2 py-1 text-sm text-[#1e0f2b] focus:outline-none focus:border-[#C9A227] w-40"
                          />
                        ) : c.displayName ? (
                          <span className="text-sm text-[#1e0f2b]/50">({c.displayName})</span>
                        ) : null}
                        {c.actif ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            <Power className="w-3 h-3" /> Désactivé
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#1e0f2b]/50">
                        Serviteur : <span className="text-[#1e0f2b]/70">{c.servantFullName} ({c.servantCode})</span>
                      </p>
                      {!enEdition && (
                        <a
                          href={`https://www.tiktok.com/@${c.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#a3821c] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Voir le profil TikTok
                        </a>
                      )}
                      {c.dernierSyncAt && !enEdition && (
                        <p className="text-xs text-[#1e0f2b]/40 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Dernière synchro : {new Date(c.dernierSyncAt).toLocaleString("fr-FR")}
                        </p>
                      )}
                      {c.derniereErreur && !enEdition && (
                        <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{c.derniereErreur}</span>
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {enEdition ? (
                        <>
                          <button
                            onClick={() => sauvegarderEdition(c)}
                            disabled={enCours === `edit-${c.id}`}
                            className="inline-flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#a3821c] disabled:opacity-40 text-white font-semibold text-sm px-3 py-1.5 rounded-md shadow-sm"
                          >
                            {enCours === `edit-${c.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Enregistrer
                          </button>
                          <button
                            onClick={() => setEditionId(null)}
                            className="inline-flex items-center gap-1.5 bg-[#faf6ef] border border-[#c9a227]/25 text-[#1e0f2b]/70 text-sm px-3 py-1.5 rounded-md"
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => synchroniser(c)}
                            disabled={enCours === `sync-${c.id}` || !c.actif}
                            className="inline-flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#a3821c] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-3 py-1.5 rounded-md shadow-sm transition-colors"
                          >
                            {enCours === `sync-${c.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Sync maintenant
                          </button>
                          <button
                            onClick={() => demarrerEdition(c)}
                            className="inline-flex items-center gap-1.5 bg-[#faf6ef] hover:bg-[#f3ecf8] border border-[#c9a227]/25 text-[#1e0f2b]/70 text-sm px-3 py-1.5 rounded-md transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                          <button
                            onClick={() => basculerActif(c)}
                            disabled={enCours === `toggle-${c.id}`}
                            className="inline-flex items-center gap-1.5 bg-[#faf6ef] hover:bg-[#f3ecf8] border border-[#c9a227]/25 text-[#1e0f2b]/70 text-sm px-3 py-1.5 rounded-md transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                            {c.actif ? "Désactiver" : "Activer"}
                          </button>
                          <button
                            onClick={() => supprimer(c)}
                            disabled={enCours === `del-${c.id}`}
                            className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Liens utiles */}
      <div className="text-sm text-[#1e0f2b]/40 flex flex-wrap gap-4 pt-4 border-t border-[#c9a227]/15">
        <Link href="/admin/videos" className="hover:text-[#a3821c] transition-colors">
          ← Module Vidéos
        </Link>
        <Link href="/admin/youtube-accounts" className="hover:text-[#a3821c] transition-colors">
          Comptes YouTube →
        </Link>
      </div>
    </div>
  );
}
