"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Cloud,
  TestTube,
  Globe,
  KeyRound,
  ShieldAlert,
  Copy,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface R2Status {
  configured: boolean;
  provider: string;
  accountId: string;
  bucket: string;
  publicUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  envCheck?: Record<string, boolean>;
  /** ⭐ V3.55 — origine (virtual-hosted) du bucket pour la sonde CORS navigateur. */
  r2EndpointOrigin?: string;
}

interface R2TestResult {
  success: boolean;
  message: string;
  credentialsValid?: boolean;
  bucketsAccessible?: string[];
  bucketExists?: boolean;
  /** ⭐ V3.52 — le token peut-il lire le bucket ? */
  canRead?: boolean;
  /** ⭐ V3.52 — code d'erreur de la sonde de lecture (si refusée). */
  readErrorCode?: string;
  canWrite?: boolean;
  /** ⭐ V3.52 — CreateMultipartUpload (upload vidéo V3.51) OK ? */
  canMultipart?: boolean;
  error?: string;
  errorCode?: string;
  details?: string[];
}

/** ⭐ V3.35 — Résultat du test PUT depuis LE NAVIGATEUR (vrai chemin du replay). */
interface BrowserTestResult {
  ok: boolean;
  status?: number;
  xmlCode?: string;
  message: string;
  durationMs?: number;
  urlClean?: boolean;
  checksumParams?: string[];
}

/** ⭐ V3.55 — État CORS du bucket lu côté serveur (GetBucketCors best-effort). */
interface CorsServeurEtat {
  etat: "ok" | "absent" | "inverifiable";
  regles: { origins: string[]; methods: string[] }[];
  detail: string;
  /** ⭐ V3.57 — verdict du preflight testé PAR LE SERVEUR avec l'origine de
   * cette page : "ok" (règle présente et couvrante), "absent", "inconnu". */
  preflight?: "ok" | "absent" | "inconnu";
}

/** ⭐ V3.55 — Résultat de l'application de la règle CORS (token temporaire). */
interface AppliCorsResultat {
  success: boolean;
  message: string;
  origins?: string[];
  error?: string;
}

/**
 * ⭐ V3.56 — Règle CORS du bucket, au FORMAT JSON (Dashboard Cloudflare →
 * R2 → bucket → Settings → CORS Policy → onglet JSON). ⚠️ CONSTAT 2026-09-09
 * (retour pasteur) : l'éditeur « CORS Policy » du Dashboard N'ACCEPTE PLUS
 * LE XML S3 — coller du XML répond « This policy is not valid » ; la doc
 * officielle (developers.cloudflare.com/r2/buckets/cors) ne documente plus
 * QUE du JSON (onglet JSON, tableau de règles). ATTENTION : à maintenir en
 * cohérence avec reglesCorsR2() / reglesCorsR2Json() de src/lib/r2.ts (le
 * serveur applique la même règle via l'option B — token temporaire).
 */
const REGLE_CORS_JSON = `[
  {
    "AllowedOrigins": [
      "https://www.mouvementchristlibere.com",
      "https://mouvementchristlibere.com",
      "https://admin.mouvementchristlibere.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  }
]`;

export default function R2TestPage() {
  const [status, setStatus] = useState<R2Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<R2TestResult | null>(null);
  const [browserTesting, setBrowserTesting] = useState(false);
  const [browserResult, setBrowserResult] = useState<BrowserTestResult | null>(null);
  const [error, setError] = useState("");

  // ⭐ V3.55 — Section CORS du bucket
  const [corsProbing, setCorsProbing] = useState(false);
  const [corsVerdict, setCorsVerdict] = useState<"ok" | "bloque" | null>(null);
  const [corsServeur, setCorsServeur] = useState<CorsServeurEtat | null>(null);
  const [copieJson, setCopieJson] = useState(false);
  const [tempKeyId, setTempKeyId] = useState("");
  const [tempSecret, setTempSecret] = useState("");
  const [appliquant, setAppliquant] = useState(false);
  const [appliResultat, setAppliResultat] = useState<AppliCorsResultat | null>(null);

  useEffect(() => {
    // ⭐ V3.35 — RÉPARATION : la page appelait /api/live/r2-test qui
    // N'EXISTE PAS (404 au chargement → page inutilisable, impossible de
    // diagnostiquer quoi que ce soit). La bonne route est /api/admin/r2-test.
    apiFetch("/api/admin/r2-test?action=status")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setStatus(data);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ⭐ V3.57 — Sonde CORS du bucket DEPUIS CE NAVIGATEUR : envoi RÉEL d'un
  // micro-fichier vers R2 via une URL pré-signée — le chemin EXACT des
  // morceaux d'upload (mêmes en-têtes, même signature). C'est le seul test
  // navigateur VALIDE : l'ancienne sonde (PUT NON SIGNÉ vers l'origine du
  // bucket, V3.55) échouait TOUJOURS — R2 rejette les requêtes non signées
  // par un 400 SANS en-têtes CORS (rejet pré-CORS) → le navigateur bloque
  // la réponse → verdict « REFUSÉ » perpétuel, même règle correctement
  // appliquée (constaté en production 2026-09-09).
  const sonderCors = async () => {
    setCorsProbing(true);
    try {
      const res = await apiFetch("/api/admin/r2-test?action=presign");
      const data = await res.json().catch(() => ({} as { uploadUrl?: string }));
      if (!data.uploadUrl) {
        setCorsVerdict("bloque");
        return;
      }
      // PUT signé d'un micro-corps — si la règle CORS du bucket est absente
      // ou ne couvre pas ce site, le navigateur bloque et on passe au catch.
      await fetch(data.uploadUrl, {
        method: "PUT",
        body: new Blob(["sonde-cors"], { type: "video/webm" }),
      });
      setCorsVerdict("ok"); // requête signée acceptée (statut final lu par fetch)
    } catch {
      setCorsVerdict("bloque"); // bloqué par le navigateur (CORS) ou réseau coupé
    } finally {
      setCorsProbing(false);
    }
  };

  // ⭐ V3.55 — Sonde automatique dès que la configuration est chargée :
  // verdict navigateur (envoi réel signé) + preflight testé côté serveur.
  useEffect(() => {
    if (!status?.configured) return;
    apiFetch("/api/admin/r2-test?action=cors-status")
      .then((r) => r.json())
      .then((d) => setCorsServeur(d))
      .catch(() => undefined);
    sonderCors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.configured]);

  // ⭐ V3.56 — Copie de la règle JSON (option A : onglet JSON du Dashboard).
  const copierRegle = async () => {
    try {
      await navigator.clipboard.writeText(REGLE_CORS_JSON);
      setCopieJson(true);
      setTimeout(() => setCopieJson(false), 2000);
    } catch {
      // presse-papiers indisponible → l'utilisateur sélectionne/copie à la main
    }
  };

  // ⭐ V3.55 — Option B : applique la règle avec un token TEMPORAIRE
  // « Admin Read & Write » (les identifiants ne sont jamais stockés — effacés
  // du formulaire dès la réussite, le token est à supprimer dans Cloudflare).
  const appliquerCors = async () => {
    if (!tempKeyId.trim() || !tempSecret.trim()) {
      setAppliResultat({
        success: false,
        message: "Renseignez l'Access Key ID et le Secret Access Key du token temporaire.",
      });
      return;
    }
    setAppliquant(true);
    setAppliResultat(null);
    try {
      const res = await apiFetch("/api/admin/r2-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKeyId: tempKeyId.trim(),
          secretAccessKey: tempSecret.trim(),
        }),
        timeoutMs: 30000,
      });
      const data = await res.json();
      setAppliResultat(data);
      if (data.success) {
        setTempKeyId("");
        setTempSecret("");
        await sonderCors(); // re-sonde immédiatement : doit passer au vert
      }
    } catch (err) {
      setAppliResultat({ success: false, message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setAppliquant(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await apiFetch("/api/admin/r2-test?action=test");
      const data = await res.json();
      // La réponse peut être 200 (success) ou 500/503 (erreur) avec details
      setTestResult(data);
      if (!res.ok && data.error && !data.details) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setTesting(false);
    }
  };

  // ⭐ V3.35 — Test PUT depuis LE NAVIGATEUR, exactement le chemin du replay
  // de live (> 4 Mo) : 1) demande une URL pré-signée au serveur, 2) PUT le
  // petit blob DIRECTEMENT vers R2 (preflight CORS inclus — video/webm),
  // 3) affiche le statut et le code XML exact en cas de refus.
  // Un PUT serveur réussit toujours, même quand le PUT navigateur échoue :
  // seul ce test détecte le vrai problème (ex. le 403 « AccessDenied » du
  // checksum SDK qui bloquait TOUS les replays).
  const runBrowserTest = async () => {
    setBrowserTesting(true);
    setBrowserResult(null);
    setError("");
    try {
      const presignRes = await apiFetch("/api/admin/r2-test?action=presign");
      const presign = await presignRes.json();
      if (!presignRes.ok || !presign.uploadUrl) {
        setBrowserResult({
          ok: false,
          message: presign.error || "Impossible de générer l'URL pré-signée",
        });
        return;
      }
      if (!presign.urlClean) {
        setBrowserResult({
          ok: false,
          urlClean: false,
          checksumParams: presign.checksumParams || [],
          message:
            "L'URL pré-signée contient des paramètres checksum (" +
            (presign.checksumParams || []).join(", ") +
            ") — le PUT navigateur sera refusé (403). Signalez cette erreur.",
        });
        return;
      }
      const debut = Date.now();
      try {
        const blob = new Blob(
          ["Test presign navigateur V3.35 — upload direct navigateur vers R2, même chemin que le replay du live."],
          { type: "video/webm" }
        );
        const putRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "video/webm" },
        });
        const dureeMs = Date.now() - debut;
        if (putRes.ok) {
          setBrowserResult({
            ok: true,
            status: putRes.status,
            urlClean: true,
            durationMs: dureeMs,
            message: "PUT navigateur accepté par R2 (HTTP " + putRes.status + ") — le chemin d'upload du replay fonctionne depuis ce navigateur.",
          });
        } else {
          const errBody = await putRes.text().catch(() => "");
          const xmlCode = errBody.match(/<Code>([^<]{1,60})<\/Code>/)?.[1];
          setBrowserResult({
            ok: false,
            status: putRes.status,
            xmlCode,
            urlClean: true,
            durationMs: dureeMs,
            message:
              "PUT navigateur refusé : " +
              (xmlCode || "HTTP " + putRes.status) +
              (putRes.status === 403
                ? " — refus R2 : vérifiez le token (règles IP ?) et envoyez ce code à l'équipe technique."
                : ""),
          });
        }
      } catch (err) {
        setBrowserResult({
          ok: false,
          urlClean: true,
          message:
            "Échec réseau (" +
            (err instanceof TypeError ? "Failed to fetch" : err instanceof Error ? err.message : "erreur") +
            ") — le préflight OPTIONS vers R2 est bloqué : voir la section « CORS du bucket » ci-dessus.",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBrowserTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0E9DE] text-[#000000] p-6" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#C9A227]" />
              Test Cloudflare R2
            </h1>
            <p className="text-xs text-[#8A857C] mt-1">
              Vérification du stockage des vidéos replays et miniatures
            </p>
          </div>
          <Link href="/admin" className="text-xs text-[#8A857C] hover:text-[#FF7A1A]">
            ← Retour admin
          </Link>
        </div>

        {/* Status config */}
        <div className="bg-white rounded-xl p-5 border border-[#8A857C]/15 mb-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
            ) : status?.configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            Configuration
          </h2>

          {loading ? (
            <p className="text-xs text-[#8A857C]">Vérification...</p>
          ) : status ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A857C]/10">
                <span className="text-xs text-[#8A857C]">Fournisseur</span>
                <span className="text-xs font-bold text-[#000000]">{status.provider}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A857C]/10">
                <span className="text-xs text-[#8A857C]">Statut</span>
                <span className={`text-xs font-bold ${status.configured ? "text-emerald-600" : "text-red-600"}`}>
                  {status.configured ? "✓ Configuré" : "✗ Non configuré"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A857C]/10">
                <span className="text-xs text-[#8A857C]">Account ID</span>
                <span className="text-xs font-mono text-[#000000]">{status.accountId}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A857C]/10">
                <span className="text-xs text-[#8A857C]">Bucket</span>
                <span className="text-xs font-mono text-[#000000]">{status.bucket}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A857C]/10">
                <span className="text-xs text-[#8A857C]">URL publique</span>
                <span className="text-xs font-mono text-[#000000]">{status.publicUrl}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A857C]/10">
                <span className="text-xs text-[#8A857C]">Access Key ID</span>
                <span className="text-xs font-mono text-[#000000]">{status.accessKeyId}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-[#8A857C]">Secret Access Key</span>
                <span className="text-xs font-mono text-[#000000]">{status.secretAccessKey}</span>
              </div>

              {/* Vérification des variables d'environnement */}
              {status.envCheck && (
                <div className="mt-3 pt-3 border-t border-[#8A857C]/10">
                  <p className="text-[10px] font-bold text-[#8A857C] uppercase tracking-wider mb-2">
                    Variables d'environnement Vercel
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(status.envCheck).map(([key, present]) => (
                      <div key={key} className="flex items-center gap-1.5 text-[10px]">
                        {present ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        )}
                        <span className={`font-mono ${present ? "text-[#000000]" : "text-red-600"}`}>{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Test upload */}
        <div className="bg-white rounded-xl p-5 border border-[#8A857C]/15 mb-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <TestTube className="w-4 h-4 text-[#C9A227]" />
            Test d'upload serveur
          </h2>
          <p className="text-xs text-[#8A857C] mb-3">
            Diagnostic complet côté serveur (⭐ V3.52) : sonde de <b>lecture</b> (le token
            peut-il lire le bucket ?), test d&apos;<b>écriture</b> (même mécanisme que les notes
            vocales d&apos;intercession) et sonde <b>multipart</b> (exactement l&apos;opération
            de l&apos;upload des vidéos par morceaux). Ce test peut réussir alors que
            l&apos;upload navigateur échoue — lancez les deux.
          </p>
          <button
            onClick={runTest}
            disabled={!status?.configured || testing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#000000] font-bold text-sm hover:bg-[#FF7A1A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            {testing ? "Test en cours..." : "Lancer le test serveur"}
          </button>

          {testResult && (
            <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <p className={`text-sm font-bold mb-3 flex items-center gap-2 ${testResult.success ? "text-emerald-700" : "text-red-700"}`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testResult.message}
              </p>

              {/* Diagnostic détaillé */}
              <div className="space-y-1.5 text-xs">
                {testResult.credentialsValid !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Credentials :</span>
                    {testResult.credentialsValid ? (
                      <span className="text-emerald-600 font-bold">✓ Valides</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Invalides</span>
                    )}
                  </div>
                )}
                {testResult.bucketsAccessible && testResult.bucketsAccessible.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#8A857C] w-40">Buckets accessibles :</span>
                    <span className="text-[#000000] font-mono">{testResult.bucketsAccessible.join(", ")}</span>
                  </div>
                )}
                {testResult.bucketExists !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Bucket configuré :</span>
                    {testResult.bucketExists ? (
                      <span className="text-emerald-600 font-bold">✓ Existe</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Introuvable</span>
                    )}
                  </div>
                )}
                {testResult.canRead !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Permission lecture :</span>
                    {testResult.canRead ? (
                      <span className="text-emerald-600 font-bold">✓ OK</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Refusée{testResult.readErrorCode ? ` (${testResult.readErrorCode})` : ""}</span>
                    )}
                  </div>
                )}
                {testResult.canWrite !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Permission écriture :</span>
                    {testResult.canWrite ? (
                      <span className="text-emerald-600 font-bold">✓ OK</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Refusée</span>
                    )}
                  </div>
                )}
                {testResult.canMultipart !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Upload vidéo (multipart) :</span>
                    {testResult.canMultipart ? (
                      <span className="text-emerald-600 font-bold">✓ OK</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Refusé</span>
                    )}
                  </div>
                )}
                {testResult.errorCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Code d'erreur :</span>
                    <span className="text-red-600 font-mono font-bold">{testResult.errorCode}</span>
                  </div>
                )}
              </div>

              {/* Détails techniques */}
              {testResult.details && testResult.details.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#8A857C]/20">
                  <p className="text-[10px] font-bold text-[#8A857C] uppercase tracking-wider mb-2">Détails du diagnostic</p>
                  <ul className="space-y-1">
                    {testResult.details.map((d, i) => (
                      <li key={i} className={`text-[10px] font-mono ${d.startsWith("✗") ? "text-red-600" : d.startsWith("✓") ? "text-emerald-600" : "text-[#8A857C]"}`}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ⭐ V3.52 — PANNEAU DE RÉPARATION GUIDÉE : écriture refusée */}
              {testResult.canWrite === false && testResult.errorCode === "AccessDenied" && (
                <div className="mt-4 pt-3 border-t border-[#8A857C]/20">
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      Réparation requise dans le Cloudflare Dashboard (2 min)
                    </h3>
                    <p className="text-xs text-red-700 mb-3">
                      Le token R2 de ce site n&apos;a pas (ou plus) la permission d&apos;écrire dans le bucket
                      « {status?.bucket} ». La signature est valide (les clés sont correctes) — c&apos;est
                      uniquement la <b>permission du token</b> qui manque. Tant que ce n&apos;est pas réparé,
                      l&apos;upload des vidéos, des replays de live et des notes d&apos;intercession échouera.
                    </p>
                    {testResult.canRead === false ? (
                      <p className="text-xs text-red-800 bg-red-100/60 rounded p-2 mb-3">
                        <b>Votre cas :</b> le token ne peut même pas <b>lire</b> le bucket → il est
                        probablement <b>expiré, révoqué ou scoped à un autre bucket</b> → suivez la
                        <b> procédure A (recréer le token)</b> ci-dessous, puis mettez à jour les
                        variables sur Vercel.
                      </p>
                    ) : (
                      <p className="text-xs text-red-800 bg-red-100/60 rounded p-2 mb-3">
                        <b>Votre cas :</b> le token peut <b>lire</b> mais pas <b>écrire</b> → sa
                        permission est probablement <b>« Object Read only »</b> → suivez la
                        <b> procédure B (changer la permission)</b> ci-dessous — aucune mise à jour
                        de variables Vercel nécessaire.
                      </p>
                    )}
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-red-900 uppercase tracking-wider mb-1">
                          Procédure A — Recréer le token (si expiré/scoped à un autre bucket)
                        </p>
                        <ol className="text-[11px] text-red-800 list-decimal list-inside space-y-1">
                          <li>Dashboard Cloudflare → <b>R2</b> → <b>Manage R2 API Tokens</b> (bouton en haut à droite de la page R2)</li>
                          <li><b>Créez un nouveau token</b> : nom « christ-libere-site », <b>Object Read &amp; Write</b>, appliqué <b>uniquement au bucket « {status?.bucket} »</b></li>
                          <li>Copiez l&apos;<b>Access Key ID</b> et le <b>Secret Access Key</b> affichés (une seule fois !)</li>
                          <li>Vercel → votre projet → <b>Settings → Environment Variables</b> → remplacer <b>R2_ACCESS_KEY_ID</b> et <b>R2_SECRET_ACCESS_KEY</b> par les nouvelles valeurs</li>
                          <li>Vercel → <b>Deployments</b> → menu du dernier déploiement → <b>Redeploy</b></li>
                          <li>Revenez sur cette page et relancez le test — tout doit passer au ✓ vert</li>
                        </ol>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-red-900 uppercase tracking-wider mb-1">
                          Procédure B — Changer la permission (si « Object Read only »)
                        </p>
                        <ol className="text-[11px] text-red-800 list-decimal list-inside space-y-1">
                          <li>Dashboard Cloudflare → <b>R2</b> → <b>Manage R2 API Tokens</b></li>
                          <li>Éditez le token correspondant à l&apos;Access Key ID <b>{status?.accessKeyId}</b></li>
                          <li>Permission : <b>Object Read &amp; Write</b> — appliqué au bucket <b>« {status?.bucket} »</b> (vérifiez aussi qu&apos;il n&apos;est pas expiré)</li>
                          <li>Enregistrez, puis revenez ici et relancez le test — « Permission écriture » doit passer au ✓ vert</li>
                        </ol>
                      </div>
                      <p className="text-[10px] text-red-700 bg-red-100/40 rounded p-2">
                        Si la permission semble déjà correcte mais que l&apos;accès reste refusé : vérifiez
                        dans le Dashboard Cloudflare → <b>Billing</b> qu&apos;aucune alerte de paiement ne
                        bloque le compte (le palier gratuit de R2 est de 10 Go de stockage — au-delà
                        sans moyen de paiement, les écritures sont bloquées).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ⭐ V3.35 — Test d'upload NAVIGATEUR (le vrai chemin du replay de live) */}
        <div className="bg-white rounded-xl p-5 border border-[#C9A227]/40 mb-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#C9A227]" />
            Test d&apos;upload navigateur — le chemin exact du replay
          </h2>
          <p className="text-xs text-[#8A857C] mb-3">
            C&apos;est LE test décisif pour les replays de live : votre navigateur uploade un petit
            fichier DIRECTEMENT vers R2 via une URL pré-signée, exactement comme le replay après un
            direct (preflight CORS inclus). Le test serveur peut réussir alors que celui-ci échoue —
            c&apos;est ce qui expliquait le « access denied » des replays.
          </p>
          <button
            onClick={runBrowserTest}
            disabled={!status?.configured || browserTesting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#000000] text-[#C9A227] font-bold text-sm hover:bg-[#161513] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {browserTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            {browserTesting ? "Test navigateur en cours..." : "Lancer le test navigateur"}
          </button>

          {browserResult && (
            <div className={`mt-4 p-4 rounded-lg border ${browserResult.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <p className={`text-sm font-bold mb-2 flex items-start gap-2 ${browserResult.ok ? "text-emerald-700" : "text-red-700"}`}>
                {browserResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                {browserResult.message}
              </p>
              <div className="space-y-1.5 text-xs">
                {browserResult.status !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Statut HTTP :</span>
                    <span className={`font-mono font-bold ${browserResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                      {browserResult.status} {browserResult.ok ? "(accepté)" : "(refusé)"}
                    </span>
                  </div>
                )}
                {browserResult.xmlCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Code d&apos;erreur R2 :</span>
                    <span className="text-red-600 font-mono font-bold">{browserResult.xmlCode}</span>
                  </div>
                )}
                {browserResult.durationMs !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">Durée :</span>
                    <span className="text-[#000000] font-mono">{browserResult.durationMs} ms</span>
                  </div>
                )}
                {browserResult.urlClean !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A857C] w-40">URL pré-signée :</span>
                    {browserResult.urlClean ? (
                      <span className="text-emerald-600 font-bold">✓ sans paramètres checksum</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ polluée par checksum : {(browserResult.checksumParams || []).join(", ")}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ⭐ V3.55 — CORS du bucket : verdict automatique + réparation guidée */}
        {status?.configured && (
          <div className="bg-white rounded-xl p-5 border border-[#C9A227]/40 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#C9A227]" />
                CORS du bucket — envoi du navigateur vers R2
              </h2>
              <button
                onClick={() => sonderCors()}
                disabled={corsProbing}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8A857C] hover:text-[#FF7A1A] disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${corsProbing ? "animate-spin" : ""}`} />
                Re-tester
              </button>
            </div>
            <p className="text-xs text-[#8A857C] mb-3">
              Test automatique à l&apos;ouverture de la page : votre navigateur envoie RÉELLEMENT un
              micro-fichier vers R2 par une URL pré-signée — le chemin EXACT des uploads de vidéos
              par morceaux. Sans règle CORS, Cloudflare R2 refuse TOUT envoi direct du navigateur
              — c&apos;était la cause exacte des « Le morceau 1/4 n&apos;a pas pu être envoyé » : le bucket
              répondait « CORS not configured for this bucket ». La réparation est unique et
              définitive (une règle à appliquer une seule fois sur le bucket).
            </p>

            {/* Verdict navigateur (l'autorité) + état serveur (best-effort) */}
            <div
              className={`p-4 rounded-lg border ${
                corsProbing
                  ? "bg-[#000000]/5 border-[#8A857C]/20"
                  : corsVerdict === "ok"
                    ? "bg-emerald-50 border-emerald-200"
                    : corsVerdict === "bloque"
                      ? "bg-red-50 border-red-200"
                      : "bg-[#000000]/5 border-[#8A857C]/20"
              }`}
            >
              <p
                className={`text-sm font-bold mb-2 flex items-start gap-2 ${
                  corsVerdict === "ok" ? "text-emerald-700" : corsVerdict === "bloque" ? "text-red-700" : "text-[#000000]"
                }`}
              >
                {corsProbing ? (
                  <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin text-[#C9A227]" />
                ) : corsVerdict === "ok" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                {corsProbing
                  ? "Envoi du micro-fichier de test vers le stockage..."
                  : corsVerdict === "ok"
                    ? "ACCEPTÉ — le stockage autorise les envois de ce navigateur (envoi réel vérifié : les uploads de vidéos/replays fonctionnent)."
                    : corsVerdict === "bloque"
                      ? corsServeur?.preflight === "ok"
                        ? "BLOQUÉ — la règle du bucket est correcte (vérifiée côté serveur) mais CE navigateur n'arrive pas à joindre le stockage : extension de navigateur, antivirus ou filtre réseau. Essayez un autre navigateur ou une autre connexion."
                        : "REFUSÉ — la politique CORS du bucket n'est pas configurée (ou n'inclut pas ce site). Les uploads de vidéos/replays ne peuvent pas fonctionner tant que la règle ci-dessous n'est pas appliquée."
                      : "En attente du test..."}
              </p>
              {corsServeur && (
                <p
                  className={`text-[11px] rounded p-2 ${
                    corsServeur.preflight === "ok"
                      ? "text-emerald-700 bg-emerald-100/60"
                      : corsServeur.preflight === "absent"
                        ? "text-red-600 bg-red-100/60"
                        : "text-[#8A857C] bg-[#000000]/5"
                  }`}
                >
                  {corsServeur.preflight === "ok"
                    ? "Règle du bucket vérifiée PAR LE SERVEUR (pré-vol vers l'origine du bucket) : présente et couvrante pour ce site."
                    : corsServeur.preflight === "absent"
                      ? "Confirmé aussi côté serveur : pas de règle CORS (ou origine non couverte) sur le bucket."
                      : corsServeur.etat === "ok"
                        ? "Règle lue côté serveur : " +
                          corsServeur.regles.flatMap((r) => r.origins).join(", ")
                        : "Test serveur impossible (le token de l'application ne peut pas lire la configuration du bucket) — l'envoi réel ci-dessus fait foi."}
                </p>
              )}
            </div>

            {/* ⭐ V3.57 — Panneau RÉSEAU (règle correcte MAIS navigateur bloqué) */}
            {corsVerdict === "bloque" && corsServeur?.preflight === "ok" && (
              <div className="mt-4 bg-amber-50 border border-amber-300 rounded-lg p-4">
                <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  La règle du bucket est CORRECTE — le blocage vient de ce navigateur ou de ce réseau
                </h3>
                <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-1">
                  <li>Essayez un <b>autre navigateur</b> (Chrome, Edge, Firefox) — une extension peut bloquer le domaine du stockage.</li>
                  <li>Désactivez temporairement l&apos;<b>antivirus</b> ou son filtrage HTTPS, et tout filtre DNS/réseau.</li>
                  <li>Essayez le <b>partage de connexion mobile</b> — si l&apos;envoi passe, le filtre est sur le réseau actuel.</li>
                  <li>Une fois l&apos;envoi réussi sur un autre chemin, prévenez l&apos;administrateur avec ce constat.</li>
                </ul>
              </div>
            )}

            {/* Panneau de réparation (si refusé pour cause de règle) */}
            {corsVerdict === "bloque" && corsServeur?.preflight !== "ok" && (
              <div className="mt-4 space-y-4">
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Réparation (2 minutes, UNE SEULE FOIS) — au choix
                  </h3>
                  <p className="text-xs text-red-700 mb-4">
                    Le bucket « {status.bucket} » doit porter une règle CORS qui autorise ce site à
                    lui envoyer des fichiers directement. Le token actuel du site (Object Read &amp;
                    Write) n&apos;a pas le droit de modifier cette règle — d&apos;où les deux options
                    ci-dessous, qui utilisent VOS droits de propriétaire du compte Cloudflare.
                  </p>

                  {/* Option A — coller dans le Dashboard */}
                  <div className="bg-white/70 border border-red-200 rounded-lg p-3 mb-3">
                    <p className="text-[10px] font-bold text-red-900 uppercase tracking-wider mb-2">
                      Option A — Coller la règle dans le Dashboard Cloudflare (recommandée)
                    </p>
                    <ol className="text-[11px] text-red-800 list-decimal list-inside space-y-1 mb-3">
                      <li>Ouvrez le <b>Dashboard Cloudflare</b> → <b>R2</b> → bucket « {status.bucket} » → <b>Settings</b></li>
                      <li>Section <b>CORS Policy</b> → <b>Add CORS policy</b> (ou <b>Edit</b>) → onglet <b>JSON</b></li>
                      <li>Sélectionnez TOUT le contenu de la zone, collez la règle ci-dessous (bouton Copier — du <b>JSON</b>, le Dashboard refuse le XML), puis <b>Enregistrer</b></li>
                      <li>Revenez ici → le verdict doit passer au ✓ vert (bouton « Re-tester »)</li>
                    </ol>
                    <div className="relative">
                      <pre className="text-[10px] bg-[#000000] text-[#C9A227] p-3 pr-24 rounded-lg overflow-x-auto whitespace-pre">
{REGLE_CORS_JSON}
                      </pre>
                      <button
                        onClick={copierRegle}
                        className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#C9A227] text-[#000000] text-[10px] font-bold hover:bg-[#FF7A1A] transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        {copieJson ? "Copié !" : "Copier"}
                      </button>
                    </div>
                    <p className="text-[10px] text-red-700 mt-2">
                      Astuce : si le Dashboard refuse encore l&apos;enregistrement, utilisez l&apos;option B ci-dessous — elle applique exactement la même règle.
                    </p>
                  </div>

                  {/* Option B — token temporaire */}
                  <div className="bg-white/70 border border-red-200 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-red-900 uppercase tracking-wider mb-2">
                      Option B — Laisser le site appliquer la règle (token temporaire)
                    </p>
                    <ol className="text-[11px] text-red-800 list-decimal list-inside space-y-1 mb-3">
                      <li>Dashboard Cloudflare → <b>R2</b> → <b>Manage R2 API Tokens</b> → <b>Créer un token</b></li>
                      <li>Nom : <b>temp-cors-repair</b> — permission : <b>Admin Read &amp; Write</b> (compte, ou scoped au bucket « {status.bucket} »)</li>
                      <li>Copiez l&apos;<b>Access Key ID</b> et le <b>Secret Access Key</b> affichés, collez-les ci-dessous</li>
                      <li>Après le ✓ vert : <b>SUPPRIMEZ ce token</b> dans Cloudflare (il n&apos;a plus d&apos;utilité)</li>
                    </ol>
                    <div className="grid grid-cols-1 gap-2 mb-3">
                      <input
                        type="text"
                        value={tempKeyId}
                        onChange={(e) => setTempKeyId(e.target.value)}
                        placeholder="Access Key ID du token temporaire"
                        autoComplete="off"
                        spellCheck={false}
                        className="px-3 py-2 rounded-lg border border-[#8A857C]/30 text-xs font-mono text-[#000000] bg-white focus:outline-none focus:border-[#C9A227]"
                      />
                      <input
                        type="password"
                        value={tempSecret}
                        onChange={(e) => setTempSecret(e.target.value)}
                        placeholder="Secret Access Key du token temporaire"
                        autoComplete="off"
                        className="px-3 py-2 rounded-lg border border-[#8A857C]/30 text-xs font-mono text-[#000000] bg-white focus:outline-none focus:border-[#C9A227]"
                      />
                    </div>
                    <button
                      onClick={appliquerCors}
                      disabled={appliquant}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#000000] font-bold text-sm hover:bg-[#FF7A1A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {appliquant ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                      {appliquant ? "Application en cours..." : "Appliquer la règle et vérifier"}
                    </button>
                    <p className="text-[10px] text-red-700 mt-2">
                      Sécurité : ces identifiants servent UNE fois, en mémoire, uniquement pour
                      écrire la règle — ils ne sont jamais enregistrés ni journalisés, et le
                      formulaire les efface dès la réussite. Le token temporaire est ensuite à
                      supprimer (étape 4).
                    </p>

                    {appliResultat && (
                      <div
                        className={`mt-3 p-3 rounded-lg border text-xs ${
                          appliResultat.success
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-red-100 border-red-300 text-red-800"
                        }`}
                      >
                        <p className="font-bold mb-1 flex items-center gap-2">
                          {appliResultat.success ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {appliResultat.success ? "Règle appliquée" : "Échec"}
                        </p>
                        <p>{appliResultat.message}</p>
                        {appliResultat.origins && appliResultat.origins.length > 0 && (
                          <p className="text-[10px] mt-1 font-mono">
                            Origines autorisées : {appliResultat.origins.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-[#8A857C] bg-[#000000]/5 rounded-lg p-3">
                  Après réparation : revenez au module Vidéos → « Nouvelle vidéo » → l&apos;envoi
                  reprendra et fonctionnera. La progression affiche « Envoi du fichier… X% ·
                  partie N/M » morceau par morceau, chaque morceau étant réessayé individuellement
                  en cas de véritable hoquet réseau (ce qui devient alors rare et réparable par
                  un simple « Réessayer l&apos;envoi »).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {error}
            </p>
          </div>
        )}

        {/* Instructions */}
        {!status?.configured && !loading && (
          <div className="bg-[#000000]/5 border border-[#C9A227]/20 rounded-xl p-4">
            <h3 className="text-xs font-bold text-[#000000] uppercase tracking-wider mb-2">
              Configuration requise
            </h3>
            <p className="text-xs text-[#8A857C] mb-3">
              Ajoutez ces variables d'environnement sur Vercel :
            </p>
            <pre className="text-[10px] bg-[#000000] text-[#C9A227] p-3 rounded-lg overflow-x-auto">
{`R2_ACCOUNT_ID=votre_account_id
R2_ACCESS_KEY_ID=votre_access_key
R2_SECRET_ACCESS_KEY=votre_secret
R2_BUCKET_NAME=nom-du-bucket
# Accès public (AU MOINS UN des deux) :
R2_PUBLIC_URL=https://cdn.mouvementchristlibere.org
# ou (bucket → Settings → Public Development URL) :
R2_PUBLIC_DEV_URL=https://pub-<hash-du-bucket>.r2.dev`}
            </pre>
            <p className="text-[10px] text-[#8A857C] mt-3">
              Docs : <a href="https://developers.cloudflare.com/r2/api/s3/api/" target="_blank" rel="noopener noreferrer" className="text-[#C9A227] hover:underline">R2 S3 API</a>
            </p>
          </div>
        )}

        {/* Setup instructions */}
        {status?.configured && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
              ℹ️ Configuration R2 (déjà faite)
            </h3>
            <p className="text-xs text-blue-800 mb-2">
              R2 est configuré. Pour activer l'accès public aux fichiers :
            </p>
            <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1">
              <li>Dashboard Cloudflare → R2 → votre bucket → Settings</li>
              <li>Activez "Public access" via un domaine custom (recommandé) ou r2.dev</li>
              <li>Renseignez R2_PUBLIC_URL avec votre domaine custom, OU R2_PUBLIC_DEV_URL avec la « Public Development URL » du bucket (format https://pub-&lt;hash&gt;.r2.dev — ATTENTION : ce hash est propre au bucket, ce n'est PAS l'ID de compte)</li>
            </ol>
            <p className="text-[10px] text-blue-700 mt-2">
              Sans URL publique valide, les uploads réussissent mais les replays/miniatures/vidéos ne chargeront jamais. Le test ci-dessus vérifie désormais aussi l'accessibilité de l'URL publique.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
