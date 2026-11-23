"use client";

/**
 * Client — /admin/youtube-accounts
 * Gestion multi-comptes YouTube : liste + liaison OAuth + activation.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Youtube,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  Power,
  Calendar,
} from "lucide-react";

interface ServantLite {
  id: string;
  code: string;
  shortName: string;
  fullName: string;
}

interface CompteYoutube {
  id: string;
  servantId: string;
  servantCode: string | null;
  servantShortName: string | null;
  servantFullName: string | null;
  channelId: string | null;
  channelTitle: string | null;
  clientId: string;
  actif: boolean;
  dernierSyncAt: string | null;
  derniereErreur: string | null;
  createdAt: string;
}

interface Props {
  servants: ServantLite[];
  comptes: CompteYoutube[];
}

export function YoutubeAccountsClient({ servants, comptes: comptesInit }: Props) {
  const [comptes, setComptes] = useState<CompteYoutube[]>(comptesInit);
  const [servantSelectionne, setServantSelectionne] = useState<string>("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const servantsAvecCompte = new Set(comptes.map((c) => c.servantCode));
  const servantsDisponibles = servants.filter((s) => !servantsAvecCompte.has(s.code));

  const lancerOAuth = async () => {
    if (!servantSelectionne) {
      setErreur("Sélectionnez un serviteur.");
      return;
    }
    setEnCours("oauth");
    setErreur(null);
    setInfo(null);
    try {
      const res = await fetch("/admin/api/youtube/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servantCode: servantSelectionne }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        oauthStartUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.oauthStartUrl) {
        throw new Error(data.error || `Échec (${res.status})`);
      }
      // Redirection vers Google — la callback reviendra sur /admin/youtube-accounts
      window.location.href = data.oauthStartUrl;
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur OAuth.");
      setEnCours(null);
    }
  };

  const relancerOAuth = (compte: CompteYoutube) => {
    if (!compte.servantCode) return;
    // Pas besoin d'appeler l'API — on redirige directement vers le start.
    window.location.href = `/api/youtube/oauth/start?servant=${encodeURIComponent(compte.servantCode)}`;
  };

  const basculerActif = async (compte: CompteYoutube) => {
    setEnCours(`toggle-${compte.id}`);
    setErreur(null);
    try {
      const res = await fetch(`/admin/api/youtube/accounts/${compte.id}`, {
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

  const supprimer = async (compte: CompteYoutube) => {
    if (!confirm(`Supprimer le lien YouTube pour ${compte.servantShortName || "?"} ?\n\nLes vidéos déjà importées ne seront PAS supprimées.`)) {
      return;
    }
    setEnCours(`del-${compte.id}`);
    setErreur(null);
    try {
      const res = await fetch(`/admin/api/youtube/accounts/${compte.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Échec (${res.status})`);
      }
      setComptes((prev) => prev.filter((c) => c.id !== compte.id));
      setInfo(`Lien YouTube pour ${compte.servantShortName} supprimé.`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur suppression.");
    } finally {
      setEnCours(null);
    }
  };

  const synchroniserCompte = async (compte: CompteYoutube) => {
    if (!compte.servantCode) return;
    setEnCours(`sync-${compte.id}`);
    setErreur(null);
    setInfo(null);
    try {
      const res = await fetch("/admin/api/videos/sync-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servantCode: compte.servantCode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ajoutees?: number;
        ignorees?: number;
        sautees?: number;
        chaine?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Échec (${res.status})`);
      }
      const a = data.ajoutees || 0;
      const i = data.ignorees || 0;
      const s = data.sautees || 0;
      setInfo(
        a > 0
          ? `${a} nouvelle${a > 1 ? "s" : ""} vidéo${a > 1 ? "s" : ""} importée${a > 1 ? "s" : ""} (${i} déjà présente${i > 1 ? "s" : ""}${s ? `, ${s} supprimée${s > 1 ? "s" : ""}` : ""}).`
          : `Chaîne à jour — aucune nouvelle vidéo (${i} déjà présente${i > 1 ? "s" : ""}).`
      );
      // Recharger les métadonnées (dernierSyncAt, derniereErreur) :
      const res2 = await fetch("/admin/api/youtube/accounts");
      if (res2.ok) {
        const data2 = (await res2.json().catch(() => null)) as { comptes?: CompteYoutube[] } | null;
        if (data2?.comptes) setComptes(data2.comptes);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur synchro.");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A0826] to-[#2A0E3D] text-[#FAF6EF] p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* En-tête */}
        <div className="flex items-center gap-3">
          <Youtube className="w-8 h-8 text-[#C9A227]" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Comptes YouTube liés</h1>
            <p className="text-sm text-[#FAF6EF]/60 mt-1">
              ⭐ V4.26 — Multi-comptes : liez une chaîne YouTube DISTINCTE par serviteur.
              Les publications sont récupérées automatiquement (cron 2×/jour + bouton manuel).
            </p>
          </div>
        </div>

        {/* Bandeau d'information : compat ascendante */}
        {comptes.length === 0 && (
          <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#C9A227]">Aucun compte en base pour l'instant</p>
                <p className="text-[#FAF6EF]/80">
                  Tant que vous n'avez pas lié de compte ici, la synchro utilise le fallback
                  historique (variables d'environnement <code className="bg-black/30 px-1 rounded">YOUTUBE_*</code> sur Vercel).
                  Liez un premier compte ci-dessous pour activer le mode multi-comptes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lier un nouveau compte */}
        <section className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-semibold">Lier une nouvelle chaîne YouTube</h2>
          </div>
          {servantsDisponibles.length === 0 ? (
            <p className="text-sm text-[#FAF6EF]/60">
              Tous les serviteurs actifs ont déjà un compte YouTube lié. Pour en ajouter un nouveau,
              créez d'abord le serviteur dans <Link href="/admin/servants" className="text-[#C9A227] hover:underline">/admin/servants</Link>.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">
                  Serviteur
                </label>
                <select
                  value={servantSelectionne}
                  onChange={(e) => setServantSelectionne(e.target.value)}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                >
                  <option value="">— Sélectionnez —</option>
                  {servantsDisponibles.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.shortName} ({s.code}) — {s.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={lancerOAuth}
                disabled={enCours === "oauth" || !servantSelectionne}
                className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-50 text-[#1E0F2B] font-bold px-5 py-2 rounded-lg transition-colors"
              >
                {enCours === "oauth" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Lier via Google
              </button>
            </div>
          )}
          <p className="text-xs text-[#FAF6EF]/40">
            Vous serez redirigé vers Google pour autoriser l'accès à la chaîne YouTube.
            Le refresh token sera chiffré et stocké en base — aucune variable à copier.
          </p>
        </section>

        {/* Erreur / info */}
        {erreur && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{erreur}</span>
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {/* Liste des comptes */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Comptes liés ({comptes.length})</h2>
          {comptes.length === 0 ? (
            <p className="text-sm text-[#FAF6EF]/60 italic">Aucun compte lié pour l'instant.</p>
          ) : (
            <ul className="space-y-3">
              {comptes.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    c.actif
                      ? "bg-white/5 border-white/10"
                      : "bg-white/[0.02] border-white/5 opacity-70"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Identité */}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Youtube className="w-5 h-5 text-[#C9A227]" />
                        <span className="font-semibold text-lg">
                          {c.channelTitle || c.servantShortName || "Chaîne sans nom"}
                        </span>
                        {c.actif ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-full">
                            <Power className="w-3 h-3" /> Désactivé
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#FAF6EF]/60">
                        Serviteur : <span className="text-[#FAF6EF]/90">{c.servantFullName} ({c.servantCode})</span>
                      </p>
                      {c.channelId && (
                        <p className="text-xs text-[#FAF6EF]/50 font-mono">Channel ID : {c.channelId}</p>
                      )}
                      {c.dernierSyncAt && (
                        <p className="text-xs text-[#FAF6EF]/50 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Dernière synchro : {new Date(c.dernierSyncAt).toLocaleString("fr-FR")}
                        </p>
                      )}
                      {c.derniereErreur && (
                        <p className="text-xs text-red-300/90 mt-1 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{c.derniereErreur}</span>
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => synchroniserCompte(c)}
                        disabled={enCours === `sync-${c.id}` || !c.actif}
                        className="inline-flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-40 text-[#1E0F2B] font-semibold text-sm px-3 py-1.5 rounded-md transition-colors"
                      >
                        {enCours === `sync-${c.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Sync maintenant
                      </button>
                      <button
                        onClick={() => relancerOAuth(c)}
                        className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/20 text-[#FAF6EF] text-sm px-3 py-1.5 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Relancer l'autorisation
                      </button>
                      <button
                        onClick={() => basculerActif(c)}
                        disabled={enCours === `toggle-${c.id}`}
                        className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/20 text-[#FAF6EF] text-sm px-3 py-1.5 rounded-md transition-colors"
                      >
                        <Power className="w-3.5 h-3.5" />
                        {c.actif ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        onClick={() => supprimer(c)}
                        disabled={enCours === `del-${c.id}`}
                        className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-sm px-3 py-1.5 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Liens utiles */}
        <div className="text-sm text-[#FAF6EF]/50 flex flex-wrap gap-4 pt-4 border-t border-white/10">
          <Link href="/admin/videos" className="hover:text-[#C9A227] transition-colors">
            ← Module Vidéos
          </Link>
          <Link href="/admin/youtube-setup" className="hover:text-[#C9A227] transition-colors">
            Configuration mono-compte (legacy) →
          </Link>
          <Link href="/admin/tiktok-accounts" className="hover:text-[#C9A227] transition-colors">
            Comptes TikTok →
          </Link>
        </div>
      </div>
    </div>
  );
}
