"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Youtube, CheckCircle2, AlertCircle, Copy, Loader2, RefreshCw,
  ExternalLink, Terminal, Settings, Video, ChevronRight,
} from "lucide-react";

interface YoutubeSetupClientProps {
  oauthConfigured: boolean;
  recentLives: {
    id: string;
    title: string;
    status: string;
    youtubeUrl: string | null;
    startedAt: string | null;
    endedAt: string | null;
  }[];
}

export function YoutubeSetupClient({ oauthConfigured, recentLives }: YoutubeSetupClientProps) {
  const [copied, setCopied] = useState("");
  const [testingLiveId, setTestingLiveId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const testFetchReplay = async (liveId: string) => {
    setTestingLiveId(liveId);
    setTestResult({});
    try {
      const res = await apiFetch(`/api/live/${liveId}/youtube-replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setTestResult({
        [liveId]: {
          success: res.ok,
          message: res.ok
            ? `✓ URL trouvée: ${data.youtubeUrl} (source: ${data.source})`
            : `✗ ${data.error || "Échec"}`,
        },
      });
    } catch (err) {
      setTestResult({
        [liveId]: {
          success: false,
          message: err instanceof Error ? err.message : "Erreur",
        },
      });
    } finally {
      setTestingLiveId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#1E0F2B]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-600/10 flex items-center justify-center">
            <Youtube className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Configuration YouTube</h1>
            <p className="text-xs text-[#8A8378]">Auto-récupération des replays (Tier B + C)</p>
          </div>
        </div>

        {/* Statut OAuth */}
        <div className={`rounded-2xl p-5 mb-6 border-2 ${oauthConfigured ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-3">
            {oauthConfigured ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-green-800">OAuth YouTube configuré ✓</p>
                  <p className="text-xs text-green-700">
                    Le Tier B (auto-récupération) et Tier C (broadcast pré-créé) sont actifs.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-800">OAuth YouTube non configuré</p>
                  <p className="text-xs text-amber-700">
                    Seul le Tier A (saisie manuelle) fonctionne actuellement. Suivez les étapes ci-dessous.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Étape 1 : Google Cloud Console */}
        <Section
          number={1}
          title="Créer les credentials OAuth sur Google Cloud"
          icon={Settings}
        >
          <ol className="space-y-2 text-sm text-[#1E0F2B]/80">
            <li>
              Allez sur{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                className="text-[#C9A227] font-bold hover:underline inline-flex items-center gap-0.5">
                Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Sélectionnez votre projet (ou créez-en un nouveau)</li>
            <li>Menu → <strong>APIs &amp; Services</strong> → <strong>Library</strong> → activez <strong>YouTube Data API v3</strong></li>
            <li>Menu → <strong>APIs &amp; Services</strong> → <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>OAuth 2.0 Client ID</strong></li>
            <li>Type : <strong>Web application</strong></li>
            <li>
              Dans <strong>Authorized redirect URIs</strong>, ajoutez :
              <div className="mt-1 flex items-center gap-2">
                <code className="px-2 py-1 bg-[#2A0E3D]/5 rounded text-xs">http://localhost:3001/callback</code>
                <button onClick={() => copyToClipboard("http://localhost:3001/callback", "redirect")}
                  className="p-1 rounded hover:bg-[#2A0E3D]/10 text-[#8A8378]">
                  <Copy className="w-3 h-3" />
                </button>
                {copied === "redirect" && <span className="text-[10px] text-green-600">Copié !</span>}
              </div>
            </li>
            <li>Notez votre <strong>Client ID</strong> et <strong>Client Secret</strong></li>
          </ol>
        </Section>

        {/* Étape 2 : Script OAuth */}
        <Section
          number={2}
          title="Générer le refresh token (script local)"
          icon={Terminal}
        >
          <p className="text-sm text-[#1E0F2B]/80 mb-3">
            Le script ouvre votre navigateur pour le consentement Google, puis affiche le refresh token.
          </p>
          <div className="bg-[#1A0826] rounded-xl p-4 font-mono text-xs text-[#C9A227] overflow-x-auto">
            <div className="text-[#FAF6EF]/40 mb-2"># Dans le terminal, à la racine du projet :</div>
            <div>
              <span className="text-green-400">node</span> scripts/youtube-oauth-setup.js{" "}
              <span className="text-blue-400">"VOTRE_CLIENT_ID"</span>{" "}
              <span className="text-blue-400">"VOTRE_CLIENT_SECRET"</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => copyToClipboard('node scripts/youtube-oauth-setup.js "CLIENT_ID" "CLIENT_SECRET"', "cmd")}
              className="px-3 py-1.5 rounded-lg bg-[#2A0E3D]/5 text-xs font-bold hover:bg-[#2A0E3D]/10 transition-colors flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copier la commande
            </button>
            {copied === "cmd" && <span className="text-[10px] text-green-600">Copié !</span>}
          </div>
          <p className="text-xs text-[#8A8378] mt-3 leading-relaxed">
            Le navigateur s'ouvre → connectez-vous avec le compte YouTube du ministère → autorisez l'accès.
            Le script affiche les 4 variables à copier.
          </p>
        </Section>

        {/* Étape 3 : Vercel env vars */}
        <Section
          number={3}
          title="Ajouter les variables sur Vercel"
          icon={ExternalLink}
        >
          <p className="text-sm text-[#1E0F2B]/80 mb-3">
            Allez sur{" "}
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
              className="text-[#C9A227] font-bold hover:underline inline-flex items-center gap-0.5">
              Vercel Dashboard <ExternalLink className="w-3 h-3" />
            </a>{" "}
            → votre projet → <strong>Settings</strong> → <strong>Environment Variables</strong>.
          </p>
          <div className="space-y-2">
            {[
              { key: "YOUTUBE_CLIENT_ID", desc: "OAuth 2.0 Client ID" },
              { key: "YOUTUBE_CLIENT_SECRET", desc: "OAuth 2.0 Client Secret" },
              { key: "YOUTUBE_REFRESH_TOKEN", desc: "Généré par le script à l'étape 2" },
              { key: "YOUTUBE_CHANNEL_ID", desc: "ID de votre chaîne (UC...)" },
            ].map((v) => (
              <div key={v.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A0E3D]/5">
                <code className="text-xs font-bold text-[#1E0F2B]">{v.key}</code>
                <span className="text-[10px] text-[#8A8378] flex-1">{v.desc}</span>
                <button
                  onClick={() => copyToClipboard(v.key, v.key)}
                  className="p-1 rounded hover:bg-[#2A0E3D]/10 text-[#8A8378]"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {copied === v.key && <span className="text-[10px] text-green-600">✓</span>}
              </div>
            ))}
          </div>
          <div className="mt-3 px-3 py-2 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/15">
            <p className="text-xs text-[#1E0F2B]/70">
              ⚠️ Après avoir ajouté les variables, <strong>redeployez</strong> le projet sur Vercel
              (push un commit ou cliquez "Redeploy" dans Vercel).
            </p>
          </div>
        </Section>

        {/* Étape 4 : Test */}
        <Section
          number={4}
          title="Tester la configuration"
          icon={Video}
        >
          {recentLives.length === 0 ? (
            <p className="text-sm text-[#8A8378]">Aucun live YouTube récent à tester.</p>
          ) : (
            <div className="space-y-2">
              {recentLives.map((live) => (
                <div key={live.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2A0E3D]/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{live.title}</p>
                    <p className="text-[10px] text-[#8A8378]">
                      {live.status === "LIVE" ? "🔴 En cours" : live.status === "ENDED" ? "Terminé" : live.status}
                      {live.youtubeUrl && (
                        <a href={live.youtubeUrl} target="_blank" rel="noopener noreferrer"
                          className="ml-2 text-[#C9A227] hover:underline inline-flex items-center gap-0.5">
                          YouTube <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => testFetchReplay(live.id)}
                    disabled={!oauthConfigured || testingLiveId === live.id}
                    className="px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#1E0F2B] text-xs font-bold hover:bg-[#DDBE55] transition-colors disabled:opacity-30 flex items-center gap-1"
                  >
                    {testingLiveId === live.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Tester
                  </button>
                </div>
              ))}
              {Object.entries(testResult).map(([id, result]) => (
                <div
                  key={id}
                  className={`px-3 py-2 rounded-lg text-xs ${
                    result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {result.message}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Récap des tiers */}
        <div className="mt-8 rounded-2xl bg-[#2A0E3D] text-[#FAF6EF] p-5">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-[#C9A227]" />
            Stratégie de fallback YouTube
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${oauthConfigured ? "bg-green-400" : "bg-amber-400"}`} />
              <span className={oauthConfigured ? "text-green-300" : "text-amber-300"}>
                <strong>Tier C</strong> — Broadcast pré-créé (au démarrage du live) —{" "}
                {oauthConfigured ? "ACTIF" : "en attente OAuth"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${oauthConfigured ? "bg-green-400" : "bg-amber-400"}`} />
              <span className={oauthConfigured ? "text-green-300" : "text-amber-300"}>
                <strong>Tier B</strong> — Auto-récupération post-live (API YouTube) —{" "}
                {oauthConfigured ? "ACTIF" : "en attente OAuth"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-300">
                <strong>Tier A</strong> — Saisie manuelle URL (dans le modal stop) — ACTIF
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  icon: Icon,
  children,
}: {
  number: number;
  title: string;
  icon: typeof Settings;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#8A8378]/15 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#C9A227]/10 flex items-center justify-center text-[#C9A227] font-bold text-sm">
          {number}
        </div>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#8A8378]" />
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
