"use client";

/**
 * Client — /admin/tiktok-accounts
 * Gestion des comptes TikTok multi-serviteurs.
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
  Stethoscope,
  Upload,
  Bookmark,
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

  // ⭐ V4.35 — Diagnostic : voir ce que TikTok renvoie réellement
  const [diagUsername, setDiagUsername] = useState("");
  const [diagEnCours, setDiagEnCours] = useState(false);
  const [diagResultat, setDiagResultat] = useState<Record<string, unknown> | null>(null);

  // ⭐ V4.35 — Import batch d'URLs TikTok
  const [importServantCode, setImportServantCode] = useState("");
  const [importUrls, setImportUrls] = useState("");
  const [importEnCours, setImportEnCours] = useState(false);
  const [importResultat, setImportResultat] = useState<{
    traitées?: number;
    ajoutees?: number;
    ignorees?: number;
    sautees?: number;
    filtrees?: number;
    erreurs?: string[];
    titres?: string[];
    error?: string;
  } | null>(null);

  const lancerDiagnostic = async () => {
    if (!diagUsername.trim()) {
      setErreur("Saisissez un username pour le diagnostic.");
      return;
    }
    setDiagEnCours(true);
    setDiagResultat(null);
    setErreur(null);
    try {
      const res = await fetch(
        `/admin/api/tiktok/diagnostic?username=${encodeURIComponent(diagUsername.trim())}`
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      setDiagResultat(data);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur diagnostic.");
    } finally {
      setDiagEnCours(false);
    }
  };

  const importerUrls = async () => {
    if (!importServantCode) {
      setErreur("Sélectionnez un serviteur pour l'import.");
      return;
    }
    if (!importUrls.trim()) {
      setErreur("Collez au moins une URL TikTok.");
      return;
    }
    setImportEnCours(true);
    setImportResultat(null);
    setErreur(null);
    try {
      const urls = importUrls
        .split(/[\n,\s]+/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      const res = await fetch("/admin/api/tiktok/import-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servantCode: importServantCode, urls }),
      });
      const data = (await res.json().catch(() => ({}))) as typeof importResultat;
      setImportResultat(data);
      if (data.ajoutees && data.ajoutees > 0) {
        setInfo(
          `${data.ajoutees} vidéo${data.ajoutees > 1 ? "s" : ""} importée${data.ajoutees > 1 ? "s" : ""} (${data.ignorees || 0} déjà en base, ${data.filtrees || 0} filtrée${(data.filtrees || 0) > 1 ? "s" : ""} >10 jours).`
        );
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur import.");
    } finally {
      setImportEnCours(false);
    }
  };

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
      // Recharger la liste
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
    <div className="min-h-screen bg-gradient-to-b from-[#1A0826] to-[#2A0E3D] text-[#FAF6EF] p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* En-tête */}
        <div className="flex items-center gap-3">
          <Music2 className="w-8 h-8 text-[#C9A227]" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Comptes TikTok liés</h1>
            <p className="text-sm text-[#FAF6EF]/60 mt-1">
              ⭐ V4.26/V4.31 — Multi-comptes : liez un username TikTok par serviteur. Les nouvelles
              publications sont récupérées automatiquement (cron 2×/jour + bouton manuel) par
              scraping direct de la page profil publique TikTok.
            </p>
          </div>
        </div>

        {/* Bandeau : ScrapingAnt pour automatisation */}
        <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#C9A227] flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold text-[#C9A227]">
                ⭐ Automatisation via ScrapingAnt (rendu JavaScript)
              </p>
              <p className="text-[#FAF6EF]/80">
                TikTok sert un <strong>shell HTML vide</strong> (architecture "serverless") — le HTML
                ne contient aucune URL vidéo car tout est rendu par JavaScript. Pour automatiser la
                synchro, on utilise <strong>ScrapingAnt</strong>, un service qui exécute le JavaScript
                côté serveur et retourne le HTML rendu (avec toutes les vidéos chargées).
              </p>
              <p className="text-[#FAF6EF]/80">
                <strong>Configuration (gratuite, 2 minutes) :</strong>
              </p>
              <ol className="text-[#FAF6EF]/70 space-y-1 list-decimal list-inside ml-2">
                <li>
                  Inscrivez-vous sur{" "}
                  <a href="https://scrapingant.com" target="_blank" rel="noopener noreferrer" className="text-[#C9A227] hover:underline">
                    scrapingant.com <ExternalLink className="w-3 h-3 inline" />
                  </a>{" "}
                  (gratuit, 10 000 requêtes/mois)
                </li>
                <li>Copiez votre API key depuis le dashboard</li>
                <li>
                  Ajoutez-la sur Vercel :{" "}
                  <code className="bg-black/30 px-1 rounded">SCRAPINGANT_API_KEY</code>{" "}
                  (Settings → Environment Variables → Production + Preview)
                </li>
                <li>Redéployez — le cron 2×/jour synchronisera automatiquement les vidéos</li>
              </ol>
              <p className="text-[#FAF6EF]/50 text-xs mt-2">
                Consommation estimée : 2 comptes × 2 syncs/jour = ~120 pages/mois (sur les 1 000 incluses
                dans le plan gratuit). Chaque page rendue avec JS coûte 10 crédits.
              </p>
            </div>
          </div>
        </div>

        {/* ⭐ V4.36 — Bookmarklet pour extraire les URLs vidéo depuis le navigateur */}
        <section className="rounded-xl bg-[#C9A227]/5 border border-[#C9A227]/30 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-semibold">Bookmarklet — extraction en 1 clic</h2>
          </div>
          <p className="text-sm text-[#FAF6EF]/70">
            Ce bookmarklet extrait toutes les URLs vidéo d'une page profil TikTok et les copie dans votre
            presse-papier. Plus rapide que de copier les URLs une par une.
          </p>
          <ol className="text-sm text-[#FAF6EF]/60 space-y-1 list-decimal list-inside">
            <li>
              <strong>Glissez ce lien</strong> dans votre barre de favoris :
            </li>
          </ol>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Le bookmarklet : href="javascript:..." — glisser-déposer dans la barre de favoris */}
            <a
              href={`javascript:(function(){var links=document.querySelectorAll('a[href*="/video/"]');var urls=new Set();links.forEach(function(a){var h=a.href;if(h.match(/tiktok\\.com\\/@[^\\/]+\\/video\\/\\d+/)){urls.add(h)}});var t=Array.from(urls).join('\\n');if(t){try{navigator.clipboard.writeText(t).then(function(){alert(urls.size+' URLs TikTok copiees dans le presse-papier !\\n\\nAllez sur /admin/tiktok-accounts et collez-les dans le champ Import manuel.')},function(){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.top='10px';ta.style.left='10px';ta.style.width='90%25';ta.style.height='300px';ta.style.zIndex='999999';ta.style.background='white';ta.style.color='black';document.body.appendChild(ta);ta.select();alert(urls.size+' URLs trouvees. Copiez-les (Ctrl+C) puis collez-les dans /admin/tiktok-accounts.')})}catch(e){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.top='10px';ta.style.left='10px';ta.style.width='90%25';ta.style.height='300px';ta.style.zIndex='999999';ta.style.background='white';ta.style.color='black';document.body.appendChild(ta);ta.select();alert(urls.size+' URLs trouvees. Copiez-les (Ctrl+C) puis collez-les dans /admin/tiktok-accounts.')}}else{alert('Aucune URL video trouvee sur cette page. Faites defiler la page pour charger plus de videos, puis reessayez.')}})();`}
              onClick={(e) => {
                e.preventDefault();
                alert(
                  "Pour installer le bookmarklet :\n\n" +
                  "1. Affichez la barre de favoris de votre navigateur (Ctrl+Shift+B sur Chrome)\n" +
                  "2. Glissez ce lien « 📋 Extraire URLs TikTok » dans la barre de favoris\n" +
                  "3. Ouvrez un profil TikTok dans votre navigateur\n" +
                  "4. Cliquez sur le favori → les URLs sont copiées\n" +
                  "5. Revenez sur /admin/tiktok-accounts et collez-les dans le champ Import manuel"
                );
              }}
              className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-bold px-4 py-2.5 rounded-lg cursor-grab transition-colors select-none"
              title="Glissez-moi dans votre barre de favoris"
            >
              <Bookmark className="w-4 h-4" />
              📋 Extraire URLs TikTok
            </a>
            <span className="text-xs text-[#FAF6EF]/40">
              ← glisser-déposer dans la barre de favoris
            </span>
          </div>
          <div className="text-sm text-[#FAF6EF]/60 space-y-1 pt-2 border-t border-white/10">
            <p className="font-semibold text-[#FAF6EF]/80">Mode d'emploi :</p>
            <ol className="space-y-1 list-decimal list-inside text-[#FAF6EF]/60">
              <li>Affichez la barre de favoris (Ctrl+Shift+B sur Chrome/Firefox)</li>
              <li>Glissez le lien ci-dessus dans la barre → un nouveau favori est créé</li>
              <li>Ouvrez le profil TikTok du serviteur dans votre navigateur</li>
              <li>
                <strong>Faites défiler vers le bas</strong> pour charger les vidéos récentes
                (TikTok utilise le défilement infini)
              </li>
              <li>Cliquez sur le favori « 📋 Extraire URLs TikTok »</li>
              <li>Les URLs sont copiées dans votre presse-papier</li>
              <li>Revenez ici, dans la section « Import manuel » ci-dessous</li>
              <li>Collez les URLs (Ctrl+V), sélectionnez le serviteur, cliquez « Importer »</li>
            </ol>
          </div>
        </section>

        {/* ⭐ V4.35 — Import batch d'URLs TikTok */}
        <section className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-semibold">Import manuel d'URLs TikTok</h2>
          </div>
          <p className="text-sm text-[#FAF6EF]/60">
            Si la synchro automatique échoue (TikTok bloque le scraping), vous pouvez importer
            manuellement les URLs des vidéos TikTok. Allez sur le profil TikTok du serviteur dans
            votre navigateur, copiez les URLs des vidéos récentes (une par ligne), collez-les ci-dessous.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Serviteur</label>
              <select
                value={importServantCode}
                onChange={(e) => setImportServantCode(e.target.value)}
                className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
              >
                <option value="">— Sélectionnez —</option>
                {servants.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.shortName} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">
                URLs TikTok (une par ligne, max 30)
              </label>
              <textarea
                value={importUrls}
                onChange={(e) => setImportUrls(e.target.value)}
                placeholder={"https://www.tiktok.com/@afrika/video/1234567890\nhttps://www.tiktok.com/@afrika/video/9876543210\n..."}
                rows={6}
                className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] font-mono text-sm focus:outline-none focus:border-[#C9A227] resize-y"
              />
            </div>
            <button
              onClick={importerUrls}
              disabled={importEnCours || !importServantCode || !importUrls.trim()}
              className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-50 text-[#1E0F2B] font-bold px-5 py-2 rounded-lg transition-colors"
            >
              {importEnCours ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Import en cours…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importer les URLs
                </>
              )}
            </button>
          </div>
          {importResultat && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm space-y-1">
              <p className="font-semibold text-[#C9A227]">Résultat de l'import</p>
              <p className="text-[#FAF6EF]/80">
                {importResultat.traitées ?? 0} traitées — {importResultat.ajoutees ?? 0} importées,
                {" "}{importResultat.ignorees ?? 0} déjà en base,
                {" "}{importResultat.filtrees ?? 0} filtrées (&gt;10 jours),
                {" "}{importResultat.sautees ?? 0} supprimées.
              </p>
              {importResultat.erreurs && importResultat.erreurs.length > 0 && (
                <p className="text-red-300/80 text-xs">
                  {importResultat.erreurs.length} erreur(s) : {importResultat.erreurs[0]}
                  {importResultat.erreurs.length > 1 ? ` (+${importResultat.erreurs.length - 1} autres)` : ""}
                </p>
              )}
              {importResultat.error && (
                <p className="text-red-300/80 text-xs">{importResultat.error}</p>
              )}
            </div>
          )}
        </section>

        {/* ⭐ V4.35 — Diagnostic : voir ce que TikTok renvoie */}
        <section className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-semibold">Diagnostic TikTok</h2>
          </div>
          <p className="text-sm text-[#FAF6EF]/60">
            Vérifiez ce que TikTok renvoie réellement pour un username donné. Utile pour comprendre
            pourquoi la synchro automatique échoue.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">
                Username TikTok
              </label>
              <div className="flex items-center bg-[#1A0826] border border-white/20 rounded-lg focus-within:border-[#C9A227]">
                <span className="pl-3 text-[#FAF6EF]/40">@</span>
                <input
                  type="text"
                  value={diagUsername}
                  onChange={(e) => setDiagUsername(e.target.value)}
                  placeholder="afrika_christ_libere"
                  className="flex-1 bg-transparent px-2 py-2 text-[#FAF6EF] focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={lancerDiagnostic}
              disabled={diagEnCours || !diagUsername.trim()}
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/20 disabled:opacity-50 text-[#FAF6EF] font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {diagEnCours ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Stethoscope className="w-4 h-4" />
              )}
              Diagnostiquer
            </button>
          </div>
          {diagResultat && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm space-y-2 max-h-96 overflow-y-auto">
              <p className="font-semibold text-[#C9A227]">Résultat du diagnostic</p>
              <pre className="text-xs text-[#FAF6EF]/70 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(diagResultat, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* Créer un nouveau lien */}
        <section className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-semibold">Lier un nouveau compte TikTok</h2>
          </div>
          {servantsDisponibles.length === 0 ? (
            <p className="text-sm text-[#FAF6EF]/60">
              Tous les serviteurs actifs ont déjà un compte TikTok lié. Créez un nouveau serviteur
              dans <Link href="/admin/servants" className="text-[#C9A227] hover:underline">/admin/servants</Link> pour en ajouter.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">Serviteur</label>
                <select
                  value={servantSelectionne}
                  onChange={(e) => setServantSelectionne(e.target.value)}
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
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
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">
                  Username TikTok
                </label>
                <div className="flex items-center bg-[#1A0826] border border-white/20 rounded-lg focus-within:border-[#C9A227]">
                  <span className="pl-3 text-[#FAF6EF]/40">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="afrika_christ_libere"
                    className="flex-1 bg-transparent px-2 py-2 text-[#FAF6EF] focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-[#FAF6EF]/60">
                  Nom affiché (optionnel)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Afrika"
                  className="w-full bg-[#1A0826] border border-white/20 rounded-lg px-3 py-2 text-[#FAF6EF] focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={creer}
                  disabled={enCours === "create" || !servantSelectionne || !username.trim()}
                  className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-50 text-[#1E0F2B] font-bold px-5 py-2 rounded-lg transition-colors"
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
            <p className="text-sm text-[#FAF6EF]/60 italic">Aucun compte TikTok lié pour l'instant.</p>
          ) : (
            <ul className="space-y-3">
              {comptes.map((c) => {
                const enEdition = editionId === c.id;
                return (
                  <li
                    key={c.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      c.actif
                        ? "bg-white/5 border-white/10"
                        : "bg-white/[0.02] border-white/5 opacity-70"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Music2 className="w-5 h-5 text-[#C9A227]" />
                          {enEdition ? (
                            <div className="flex items-center bg-[#1A0826] border border-[#C9A227]/40 rounded px-2">
                              <span className="text-[#FAF6EF]/40">@</span>
                              <input
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                className="bg-transparent px-1 py-1 text-[#FAF6EF] focus:outline-none w-48"
                              />
                            </div>
                          ) : (
                            <span className="font-semibold text-lg">
                              @{c.username}
                            </span>
                          )}
                          {enEdition ? (
                            <input
                              value={editDisplayName}
                              onChange={(e) => setEditDisplayName(e.target.value)}
                              placeholder="Nom affiché"
                              className="bg-[#1A0826] border border-white/20 rounded px-2 py-1 text-sm text-[#FAF6EF] focus:outline-none focus:border-[#C9A227] w-40"
                            />
                          ) : c.displayName ? (
                            <span className="text-sm text-[#FAF6EF]/60">({c.displayName})</span>
                          ) : null}
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
                        {!enEdition && (
                          <a
                            href={`https://www.tiktok.com/@${c.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#C9A227] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Voir le profil TikTok
                          </a>
                        )}
                        {c.dernierSyncAt && !enEdition && (
                          <p className="text-xs text-[#FAF6EF]/50 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Dernière synchro : {new Date(c.dernierSyncAt).toLocaleString("fr-FR")}
                          </p>
                        )}
                        {c.derniereErreur && !enEdition && (
                          <p className="text-xs text-red-300/90 mt-1 flex items-start gap-1">
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
                              className="inline-flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-40 text-[#1E0F2B] font-semibold text-sm px-3 py-1.5 rounded-md"
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
                              className="inline-flex items-center gap-1.5 bg-white/5 border border-white/20 text-[#FAF6EF] text-sm px-3 py-1.5 rounded-md"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => synchroniser(c)}
                              disabled={enCours === `sync-${c.id}` || !c.actif}
                              className="inline-flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#DDBE55] disabled:opacity-40 text-[#1E0F2B] font-semibold text-sm px-3 py-1.5 rounded-md"
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
                              className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/20 text-[#FAF6EF] text-sm px-3 py-1.5 rounded-md"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Modifier
                            </button>
                            <button
                              onClick={() => basculerActif(c)}
                              disabled={enCours === `toggle-${c.id}`}
                              className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/20 text-[#FAF6EF] text-sm px-3 py-1.5 rounded-md"
                            >
                              <Power className="w-3.5 h-3.5" />
                              {c.actif ? "Désactiver" : "Activer"}
                            </button>
                            <button
                              onClick={() => supprimer(c)}
                              disabled={enCours === `del-${c.id}`}
                              className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-sm px-3 py-1.5 rounded-md"
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
        <div className="text-sm text-[#FAF6EF]/50 flex flex-wrap gap-4 pt-4 border-t border-white/10">
          <Link href="/admin/videos" className="hover:text-[#C9A227] transition-colors">
            ← Module Vidéos
          </Link>
          <Link href="/admin/youtube-accounts" className="hover:text-[#C9A227] transition-colors">
            Comptes YouTube →
          </Link>
        </div>
      </div>
    </div>
  );
}
