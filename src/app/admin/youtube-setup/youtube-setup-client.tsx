"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Youtube, CheckCircle2, AlertCircle, Copy, Loader2, RefreshCw,
  ExternalLink, Terminal, Settings, Video, ChevronRight, Globe, KeyRound,
  Eye, EyeOff, ShieldAlert, UserRoundPlus, FileText,
} from "lucide-react";

interface YoutubeSetupClientProps {
  oauthConfigured: boolean;
  /** YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET déjà définis sur Vercel ? */
  credentialsConfigured: boolean;
  recentLives: {
    id: string;
    title: string;
    status: string;
    youtubeUrl: string | null;
    startedAt: string | null;
    endedAt: string | null;
  }[];
}

const OAUTH_ERRORS: Record<string, string> = {
  missing_credentials:
    "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET ne sont pas encore définis sur Vercel — utilisez le formulaire ci-dessous ou ajoutez-les sur Vercel.",
};

export function YoutubeSetupClient({
  oauthConfigured,
  credentialsConfigured,
  recentLives,
}: YoutubeSetupClientProps) {
  const [copied, setCopied] = useState("");
  const [testingLiveId, setTestingLiveId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  // ── État du flux in-app ────────────────────────────────────────────────
  const [origin, setOrigin] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [oauthStarting, setOauthStarting] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const [queryError, setQueryError] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const err = params.get("oauthError");
    if (err) {
      setQueryError(OAUTH_ERRORS[err] || `Le flux OAuth n'a pas pu démarrer (${err}).`);
      // Nettoyer l'URL sans recharger la page
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  // ── Test Tier B (POST /api/live/[id]/youtube-replay) ─────────────────
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

  // ── Lancement du flux OAuth in-app ─────────────────────────────────────
  const startInAppOAuth = async () => {
    setOauthStarting(true);
    setOauthError("");

    // Validation locale des champs (seulement s'ils sont remplis)
    const trimmedId = clientId.trim();
    const trimmedSecret = clientSecret.trim();
    if (trimmedId && !trimmedId.includes("apps.googleusercontent.com")) {
      setOauthError("Client ID invalide — il doit se terminer par .apps.googleusercontent.com.");
      setOauthStarting(false);
      return;
    }
    if (trimmedSecret && trimmedSecret.length < 20) {
      setOauthError("Client Secret invalide (trop court) — vérifiez le copier-coller.");
      setOauthStarting(false);
      return;
    }

    try {
      // POST : les champs vides → le serveur utilise les env vars Vercel
      const res = await apiFetch("/api/youtube/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: trimmedId, clientSecret: trimmedSecret }),
      });
      const data = await res.json();

      if (!res.ok || !data.authUrl) {
        setOauthError(data.error || "Impossible de démarrer le flux OAuth.");
        setOauthStarting(false);
        return;
      }

      // Redirection vers l'écran de consentement Google
      window.location.href = data.authUrl;
    } catch (err) {
      setOauthError(
        err instanceof Error ? err.message : "Erreur réseau — impossible de démarrer le flux OAuth."
      );
      setOauthStarting(false);
    }
  };

  const inAppRedirectUri = `${origin || "https://mouvement-christ-libere.vercel.app"}/api/youtube/oauth/callback`;
  const privacyPolicyUrl = `${origin || "https://mouvement-christ-libere.vercel.app"}/confidentialite`;
  const termsUrl = `${origin || "https://mouvement-christ-libere.vercel.app"}/conditions`;

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
                    {credentialsConfigured
                      ? "Client ID et Secret déjà présents sur Vercel — il ne manque que le refresh token (étape 2)."
                      : "Seul le Tier A (saisie manuelle) fonctionne actuellement. Suivez les étapes ci-dessous."}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ⚠️ Encart : erreur « Accès bloqué » 403 access_denied */}
        <div className="rounded-2xl p-5 mb-6 bg-red-50 border-2 border-red-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-800 mb-1">
                Google affiche « Accès bloqué — Erreur 403 : access_denied » ?
              </p>
              <p className="text-xs text-red-700 leading-relaxed mb-3">
                Message type : <em>« le site n&apos;a pas terminé la procédure de validation de
                Google. L&apos;appli est en cours de test et seuls les testeurs approuvés par le
                développeur y ont accès »</em>. C&apos;est le comportement <strong>normal</strong>{" "}
                d&apos;une application en mode <strong>Testing</strong> : votre compte Google
                n&apos;est pas encore déclaré comme testeur. Ajoutez-le en 30 secondes :
              </p>
              <ol className="space-y-1.5 text-xs text-red-800 mb-3">
                <li>
                  1. Ouvrez{" "}
                  <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer"
                    className="text-red-900 font-bold underline hover:text-red-700 inline-flex items-center gap-0.5">
                    OAuth consent screen <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  (Google Cloud Console → APIs &amp; Services)
                </li>
                <li>2. Section <strong>Test users</strong> → bouton <strong>+ ADD USERS</strong></li>
                <li>
                  3. Ajoutez <strong>le compte Google propriétaire de la chaîne YouTube</strong>
                  (celui avec lequel vous autorisez le flux) puis <strong>Save</strong>
                </li>
                <li>4. Relancez le flux à l&apos;étape 2 — l&apos;écran de consentement s&apos;affiche maintenant</li>
              </ol>
              <p className="text-[11px] text-red-600 bg-red-100/60 rounded-lg px-3 py-2">
                💡 En mode Testing, le refresh token expire après <strong>7 jours</strong>.
                Pour un usage permanent, passez l&apos;app en <strong>In production</strong>
                (bouton « Publish app » sur le même écran) : l&apos;avertissement « app non vérifiée »
                reste contournable via <em>Avancé → Continuer</em>, et le token devient durable.
              </p>
            </div>
          </div>
        </div>

        {/* Encart : écran de consentement Google (politique + conditions) */}
        <div className="rounded-2xl p-5 mb-6 bg-white border-2 border-[#C9A227]/30">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-[#C9A227] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-[#1E0F2B] mb-1">
                Écran de consentement Google — liens légaux à déclarer
              </p>
              <p className="text-xs text-[#1E0F2B]/70 leading-relaxed mb-3">
                Google exige une <strong>politique de confidentialité</strong> (et recommande des
                conditions d&apos;utilisation) pour valider l&apos;écran de consentement. Les deux
                pages sont désormais publiées sur le site — déclarez ces URLs dans{" "}
                <strong>OAuth consent screen → App information</strong> :
              </p>
              <div className="space-y-2">
                {[
                  { label: "Privacy Policy URL", value: privacyPolicyUrl, key: "privacy" },
                  { label: "Terms of Service URL", value: termsUrl, key: "terms" },
                ].map((l) => (
                  <div key={l.key} className="px-3 py-2 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/20">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-bold break-all flex-1">{l.value}</code>
                      <button onClick={() => copyToClipboard(l.value, l.key)}
                        className="p-1 rounded hover:bg-[#2A0E3D]/10 text-[#8A8378] flex-shrink-0">
                        <Copy className="w-3 h-3" />
                      </button>
                      {copied === l.key && <span className="text-[10px] text-green-600">Copié !</span>}
                    </div>
                    <p className="text-[10px] text-[#8A8378] mt-1">→ champ « {l.label} »</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Erreur renvoyée par la route start (GET) */}
        {queryError && (
          <div className="rounded-2xl p-4 mb-6 bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{queryError}</p>
              <button onClick={() => setQueryError("")} className="text-xs text-red-500 hover:underline mt-1">
                Masquer
              </button>
            </div>
          </div>
        )}

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
              Dans <strong>Authorized redirect URIs</strong>, ajoutez <strong>les 2 URIs</strong> :
              <div className="mt-2 space-y-2">
                <div className="px-3 py-2 rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/20">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#C9A227] flex-shrink-0" />
                    <code className="text-xs font-bold break-all">{inAppRedirectUri}</code>
                    <button onClick={() => copyToClipboard(inAppRedirectUri, "redirect-inapp")}
                      className="ml-auto p-1 rounded hover:bg-[#2A0E3D]/10 text-[#8A8378] flex-shrink-0">
                      <Copy className="w-3 h-3" />
                    </button>
                    {copied === "redirect-inapp" && <span className="text-[10px] text-green-600">Copié !</span>}
                  </div>
                  <p className="text-[10px] text-[#8A8378] mt-1">
                    → <strong>requis pour la méthode recommandée (étape 2)</strong> — flux directement depuis le site
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#8A8378] flex-shrink-0" />
                  <code className="px-2 py-1 bg-[#2A0E3D]/5 rounded text-xs">http://localhost:3001/callback</code>
                  <button onClick={() => copyToClipboard("http://localhost:3001/callback", "redirect-local")}
                    className="p-1 rounded hover:bg-[#2A0E3D]/10 text-[#8A8378]">
                    <Copy className="w-3 h-3" />
                  </button>
                  {copied === "redirect-local" && <span className="text-[10px] text-green-600">Copié !</span>}
                </div>
                <p className="text-[10px] text-[#8A8378]">→ uniquement si vous utilisez le script local (étape 3)</p>
              </div>
            </li>
            <li>Notez votre <strong>Client ID</strong> et <strong>Client Secret</strong></li>
          </ol>
        </Section>

        {/* Étape 2 : In-app OAuth (recommandé) */}
        <Section
          number={2}
          title="Générer le refresh token — depuis le site (recommandé)"
          icon={Globe}
        >
          <p className="text-sm text-[#1E0F2B]/80 mb-3">
            Une seule opération, <strong>sans terminal ni Node.js local</strong> : vous cliquez,
            vous autorisez le compte YouTube du ministère sur l'écran Google, et le site affiche
            les variables à copier sur Vercel.
          </p>

          {/* Statut des credentials */}
          <div className={`px-3 py-2 rounded-lg mb-4 flex items-center gap-2 ${credentialsConfigured ? "bg-green-50" : "bg-amber-50"}`}>
            {credentialsConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-800">
                  Credentials détectés sur Vercel (YOUTUBE_CLIENT_ID / SECRET) — prêt à démarrer.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Credentials absents de Vercel — collez-les ci-dessous, le flux fonctionnera quand même.
                </p>
              </>
            )}
          </div>

          {/* Champs credentials (visibles si absents de Vercel, ou toggle) */}
          {(showManual || !credentialsConfigured) && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-bold text-[#1E0F2B]/70 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Client ID (…apps.googleusercontent.com)
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="123456789-abcdef.apps.googleusercontent.com"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-3 py-2 rounded-lg border border-[#8A8378]/25 bg-white text-sm font-mono focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#1E0F2B]/70 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Client Secret (GOCSPX-…)
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-[#8A8378]/25 bg-white text-sm font-mono focus:outline-none focus:border-[#C9A227]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8A8378] hover:text-[#1E0F2B]"
                    aria-label={showSecret ? "Masquer le secret" : "Afficher le secret"}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8A8378] mt-1">
                  🔒 Chiffré côté serveur dans un cookie httpOnly à usage unique (10 min) — jamais affiché ni stocké en clair.
                </p>
              </div>
            </div>
          )}

          {/* Erreur du POST */}
          {oauthError && (
            <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{oauthError}</span>
            </div>
          )}

          {/* Bouton principal */}
          <button
            onClick={startInAppOAuth}
            disabled={oauthStarting}
            className="w-full px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {oauthStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Démarrage du flux…
              </>
            ) : (
              <>
                <Youtube className="w-4 h-4" /> Autoriser YouTube maintenant →
              </>
            )}
          </button>

          {/* Toggle credentials manuels quand env configurée */}
          {credentialsConfigured && (
            <button
              onClick={() => setShowManual(!showManual)}
              className="mt-3 text-xs text-[#8A8378] hover:text-[#1E0F2B] underline"
            >
              {showManual ? "Masquer les champs" : "Utiliser d'autres credentials…"}
            </button>
          )}

          <div className="mt-4 px-3 py-2 rounded-lg bg-[#2A0E3D]/5 text-xs text-[#1E0F2B]/70 leading-relaxed">
            <p className="font-bold text-[#1E0F2B] mb-1">Écrans Google à prévoir :</p>
            <p className="mb-1 text-red-700">
              <strong>0.</strong> « Accès bloqué / 403 access_denied » → votre email n&apos;est pas
              dans <strong>Test users</strong> (voir encart rouge ci-dessus, section{" "}
              <UserRoundPlus className="w-3 h-3 inline" /> <em>Test users</em>).
            </p>
            <p>1. « Google n&apos;a pas validé cette application » → <strong>Avancé</strong> → <strong>Continuer vers Christ Libère (non sécurisé)</strong> — normal en mode Testing.</p>
            <p>2. Cochez les autorisations YouTube → <strong>Continuer</strong>.</p>
            <p>3. Le site affiche les <strong>4 variables</strong> prêtes à copier (retour automatique sur ce domaine).</p>
          </div>
        </Section>

        {/* Étape 3 : Script local (alternative) */}
        <Section
          number={3}
          title="Alternative : script local (terminal)"
          icon={Terminal}
        >
          <p className="text-xs text-[#8A8378] mb-3">
            Si vous préférez générer le token depuis votre ordinateur (Node.js requis) — méthode historique.
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
        </Section>

        {/* Étape 4 : Vercel env vars */}
        <Section
          number={4}
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
              { key: "YOUTUBE_REFRESH_TOKEN", desc: "Généré à l'étape 2 (ou 3)" },
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

        {/* Étape 5 : Test */}
        <Section
          number={5}
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
