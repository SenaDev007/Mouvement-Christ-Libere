"use client";

/**
 * /admin/stockage — ⭐ V4.46 Stockage GitHub (back-office)
 *
 * Page de contrôle du stockage GitHub du ministère :
 *   ① État de la configuration (GITHUB_STORAGE_TOKEN)
 *   ② Inventaire des médias ENCORE hébergés sur Cloudflare R2
 *      (vidéos, copies mp4 TikTok, notes vocales d'intercession, témoignages
 *      audio, livres PDF, miniatures, enregistrements de lives)
 *   ③ Migration automatique en un clic : boucle serveur R2 → GitHub
 *      (Contents ≤ 75 Mo / Releases > 75 Mo), mise à jour des URLs en base,
 *      suppression R2 après chaque transfert — progression visible.
 *
 * Palette back-office : fond #faf6ef, cartes blanches, or #C9A227, encre #1e0f2b.
 */

import { apiFetch } from "@/lib/api-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Github,
  Cloud,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  HardDriveDownload,
  Info,
} from "lucide-react";

interface MediaR2Item {
  table: string;
  field: string;
  id: string;
  label: string;
  title: string;
  type: string;
  subType: string | null;
}

interface Inventaire {
  total: number;
  categories: { label: string; count: number }[];
  medias: MediaR2Item[];
}

interface ResultatMigration {
  ok: boolean;
  termine?: boolean;
  message?: string;
  error?: string;
  migre?: {
    table: string;
    field: string;
    id: string;
    label: string;
    title: string;
    githubUrl: string;
    storage: string;
    tailleMo: number;
    r2Deleted: boolean;
  };
  echec?: { table: string; field: string; id: string; label: string; title: string };
}

interface LigneJournal {
  type: "ok" | "erreur";
  texte: string;
}

export default function StockagePage() {
  const [inventaire, setInventaire] = useState<Inventaire | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurConfig, setErreurConfig] = useState<string | null>(null);
  const [migrationEnCours, setMigrationEnCours] = useState(false);
  const [progres, setProgres] = useState({ fait: 0, echecs: 0 });
  const [journal, setJournal] = useState<LigneJournal[]>([]);
  const [termineMessage, setTermineMessage] = useState<string | null>(null);
  const annuleRef = useRef(false);

  const chargerInventaire = useCallback(async () => {
    setChargement(true);
    setErreurConfig(null);
    try {
      const res = await apiFetch("/admin/api/storage/migrate-r2", { timeoutMs: 30000 });
      const data = await res.json();
      if (!res.ok) {
        setErreurConfig(data.error || "Erreur d'inventaire");
        setInventaire(null);
      } else {
        setInventaire(data as Inventaire);
      }
    } catch (e) {
      setErreurConfig(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerInventaire();
  }, [chargerInventaire]);

  /** Migration automatique : boucle POST jusqu'à épuisement du stock R2. */
  const lancerMigration = useCallback(async () => {
    if (!inventaire || inventaire.total === 0) return;
    setMigrationEnCours(true);
    setTermineMessage(null);
    annuleRef.current = false;
    setProgres({ fait: 0, echecs: 0 });
    setJournal([]);

    const total = inventaire.total;
    const echoues: MediaR2Item[] = [];
    let fait = 0;
    let echecs = 0;

    // Boucle : au maximum total + échoués (un média en échec peut être
    // redemandé — on limite à total + 3 tours pour éviter tout cycle infini).
    const maxTours = total + 3;
    for (let tour = 0; tour < maxTours; tour++) {
      if (annuleRef.current) break;
      let data: ResultatMigration | null = null;
      try {
        const res = await apiFetch("/admin/api/storage/migrate-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          timeoutMs: 90000, // vidéos lourdes → GitHub Releases peuvent prendre ~60 s
        });
        data = (await res.json()) as ResultatMigration;
      } catch (e) {
        // Timeout réseau / serveless : on continue — le média non traité
        // sera repris au prochain tour (il est toujours en R2).
        setJournal((j) => [
          ...j,
          { type: "erreur", texte: `Appel interrompu : ${e instanceof Error ? e.message : "réseau"} — reprise…` },
        ]);
        continue;
      }

      if (!data) continue;

      if (data.termine) {
        break; // plus rien sur R2
      }

      if (data.ok && data.migre) {
        fait++;
        setProgres({ fait, echecs });
        setJournal((j) => [
          ...j,
          {
            type: "ok",
            texte: `${data.migre!.label} — ${data.migre!.title || data.migre!.id} → GitHub ${data.migre!.storage} (${data.migre!.tailleMo} Mo${data.migre!.r2Deleted ? ", R2 supprimé" : ""})`,
          },
        ]);
      } else if (!data.ok && data.echec) {
        echecs++;
        setProgres({ fait, echecs });
        echoues.push({
          table: data.echec.table,
          field: data.echec.field,
          id: data.echec.id,
          label: data.echec.label,
          title: data.echec.title,
          type: "",
          subType: null,
        });
        setJournal((j) => [
          ...j,
          { type: "erreur", texte: `ÉCHEC ${data.echec!.label} — ${data.echec!.title || data.echec!.id} : ${data.error?.slice(0, 140)}` },
        ]);
        // Si le même média échoue plusieurs fois il finira au-delà de
        // maxTours tours → la boucle s'arrête d'elle-même.
      }

      // Rafraîchir périodiquement le compteur restant (l'inventaire côté
      // serveur retire chaque média migré de la base).
      if (fait + echecs >= total) break;
    }

    setMigrationEnCours(false);
    setTermineMessage(`Migration terminée : ${fait} média(s) transféré(s)${echecs ? `, ${echecs} échec(s)` : ""}.`);
    await chargerInventaire();
  }, [inventaire, chargerInventaire]);

  const totalRestant = inventaire?.total ?? 0;
  const pourcentage = migrationEnCours && inventaire
    ? Math.min(100, Math.round((progres.fait / Math.max(totalRestant + progres.fait, 1)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#faf6ef] text-[#1e0f2b] p-6">
      {/* ─── En-tête ─── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Github className="w-6 h-6 text-[#C9A227]" />
          Stockage GitHub
        </h1>
        <button
          onClick={chargerInventaire}
          disabled={chargement || migrationEnCours}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#c9a227]/50 bg-white text-[#1e0f2b] font-bold text-sm hover:bg-[#C9A227]/10 transition-colors disabled:opacity-40"
        >
          {chargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Actualiser
        </button>
      </div>

      {/* ─── Explication de l'architecture ─── */}
      <div className="bg-white rounded-2xl shadow-lg p-5 border border-[#c9a227]/35 mb-4">
        <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#C9A227]" />
          Architecture du stockage
        </h2>
        <p className="text-sm leading-relaxed text-[#1e0f2b]/80">
          Depuis V4.43, tous les médias du ministère sont stockés de façon permanente dans le dépôt
          GitHub (<span className="font-mono text-xs">storage/…</span> — Contents API ≤ 75 Mo, Releases jusqu&apos;à
          2 Go). Cloudflare R2 ne sert plus que de tampon d&apos;upload : chaque nouveau fichier (vidéos,
          témoignages audio, notes vocales d&apos;intercession — web <em>et</em> mobile, livres PDF) est
          transféré automatiquement vers GitHub puis supprimé de R2. Cette page rapatrie les médias
          plus anciens encore présents sur R2.
        </p>
      </div>

      {/* ─── Erreur de configuration ─── */}
      {erreurConfig && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-bold mb-1">Stockage GitHub indisponible</p>
            <p>{erreurConfig}</p>
            <p className="mt-1 text-xs text-red-700">
              Vérifiez la variable d&apos;environnement GITHUB_STORAGE_TOKEN sur Vercel.
            </p>
          </div>
        </div>
      )}

      {/* ─── Inventaire R2 ─── */}
      <div className="bg-white rounded-2xl shadow-lg p-5 border border-[#c9a227]/35 mb-4">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[#C9A227]" />
          Médias encore sur Cloudflare R2
        </h2>

        {chargement ? (
          <div className="flex items-center gap-2 text-sm text-[#1e0f2b]/60 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Inventaire en cours…
          </div>
        ) : inventaire && totalRestant > 0 ? (
          <>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-black text-[#C9A227]">{totalRestant}</span>
              <span className="text-sm text-[#1e0f2b]/70">fichier(s) à rapatrier vers GitHub</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {inventaire.categories.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#faf6ef] border border-[#c9a227]/40 text-xs font-bold"
                >
                  {c.label}
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#C9A227] text-white text-[10px]">
                    {c.count}
                  </span>
                </span>
              ))}
            </div>

            {!migrationEnCours ? (
              <button
                onClick={lancerMigration}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2A0E3D] text-[#DDBE55] font-bold text-sm hover:bg-[#3D1A54] transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Tout migrer automatiquement vers GitHub
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
                    Migration en cours… ({progres.fait} transféré(s), {progres.echecs} échec(s))
                  </span>
                  <button
                    onClick={() => {
                      annuleRef.current = true;
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Arrêter après le fichier en cours
                  </button>
                </div>
                <div className="h-3 rounded-full bg-[#faf6ef] border border-[#c9a227]/30 overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-[#C9A227] to-[#2A0E3D] transition-all duration-500"
                    style={{ width: `${pourcentage}%` }}
                  />
                </div>
              </div>
            )}

            {journal.length > 0 && (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-[#c9a227]/25 bg-[#faf6ef] p-3 space-y-1.5">
                {journal.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {l.type === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <span className={l.type === "ok" ? "text-[#1e0f2b]/80" : "text-red-700"}>{l.texte}</span>
                  </div>
                ))}
              </div>
            )}

            {!migrationEnCours && journal.length > 0 && termineMessage && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-400/10 border border-emerald-400/25 text-sm text-emerald-800 font-bold">
                {termineMessage}
              </div>
            )}

            {/* Liste détaillée des médias restants */}
            <details className="mt-4">
              <summary className="text-xs font-bold cursor-pointer text-[#1e0f2b]/70 hover:text-[#C9A227]">
                Voir le détail ({inventaire.medias.length})
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#c9a227]/25 divide-y divide-[#c9a227]/15">
                {inventaire.medias.map((m) => (
                  <div key={`${m.table}-${m.field}-${m.id}`} className="flex items-center gap-2 px-3 py-2 text-xs bg-white">
                    <span className="px-2 py-0.5 rounded-full bg-[#C9A227]/15 text-[#8a6d1c] font-bold shrink-0">{m.label}</span>
                    <span className="truncate flex-1 text-[#1e0f2b]/80">{m.title || m.id}</span>
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div className="flex items-start gap-3 py-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">R2 est vidé — tout est sur GitHub</p>
              <p className="text-[#1e0f2b]/70">
                Aucun média hébergé sur Cloudflare R2 n&apos;est restant. Les prochains uploads
                continueront d&apos;être transférés automatiquement.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Carte info : notes vocales d'intercession ─── */}
      <div className="bg-white rounded-2xl shadow-lg p-5 border border-[#c9a227]/35">
        <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
          <HardDriveDownload className="w-4 h-4 text-[#C9A227]" />
          Notes vocales d&apos;intercession — GitHub direct (web &amp; mobile)
        </h2>
        <p className="text-sm leading-relaxed text-[#1e0f2b]/80">
          Les notes vocales envoyées depuis la page Intercession (formulaire web et application
          mobile — même route <span className="font-mono text-xs">/api/intercession</span>) sont
          désormais uploadées directement vers GitHub dans{" "}
          <span className="font-mono text-xs">storage/audio/intercession/&lt;année-mois&gt;/&lt;jour&gt;/</span>.
          R2 ne sert plus que de repli si GitHub est momentanément indisponible, et les notes
          vocales plus anciennes encore sur R2 sont rapatriées par la migration ci-dessus.
        </p>
      </div>
    </div>
  );
}
