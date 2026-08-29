"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, Cloud, TestTube } from "lucide-react";
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
}

interface R2TestResult {
  success: boolean;
  message: string;
  credentialsValid?: boolean;
  bucketsAccessible?: string[];
  bucketExists?: boolean;
  canWrite?: boolean;
  error?: string;
  errorCode?: string;
  details?: string[];
}

export default function R2TestPage() {
  const [status, setStatus] = useState<R2Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<R2TestResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/r2-test?action=status")
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

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await fetch("/api/admin/r2-test?action=test");
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

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#1E0F2B] p-6" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#C9A227]" />
              Test Cloudflare R2
            </h1>
            <p className="text-xs text-[#8A8378] mt-1">
              Vérification du stockage des vidéos replays et miniatures
            </p>
          </div>
          <Link href="/admin" className="text-xs text-[#8A8378] hover:text-[#C9A227]">
            ← Retour admin
          </Link>
        </div>

        {/* Status config */}
        <div className="bg-white rounded-xl p-5 border border-[#8A8378]/15 mb-4">
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
            <p className="text-xs text-[#8A8378]">Vérification...</p>
          ) : status ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">Fournisseur</span>
                <span className="text-xs font-bold text-[#1E0F2B]">{status.provider}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">Statut</span>
                <span className={`text-xs font-bold ${status.configured ? "text-emerald-600" : "text-red-600"}`}>
                  {status.configured ? "✓ Configuré" : "✗ Non configuré"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">Account ID</span>
                <span className="text-xs font-mono text-[#1E0F2B]">{status.accountId}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">Bucket</span>
                <span className="text-xs font-mono text-[#1E0F2B]">{status.bucket}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">URL publique</span>
                <span className="text-xs font-mono text-[#1E0F2B]">{status.publicUrl}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#8A8378]/10">
                <span className="text-xs text-[#8A8378]">Access Key ID</span>
                <span className="text-xs font-mono text-[#1E0F2B]">{status.accessKeyId}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-[#8A8378]">Secret Access Key</span>
                <span className="text-xs font-mono text-[#1E0F2B]">{status.secretAccessKey}</span>
              </div>

              {/* Vérification des variables d'environnement */}
              {status.envCheck && (
                <div className="mt-3 pt-3 border-t border-[#8A8378]/10">
                  <p className="text-[10px] font-bold text-[#8A8378] uppercase tracking-wider mb-2">
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
                        <span className={`font-mono ${present ? "text-[#1E0F2B]" : "text-red-600"}`}>{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Test upload */}
        <div className="bg-white rounded-xl p-5 border border-[#8A8378]/15 mb-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <TestTube className="w-4 h-4 text-[#C9A227]" />
            Test d'upload
          </h2>
          <p className="text-xs text-[#8A8378] mb-3">
            Uploade un petit fichier texte de test vers R2 pour vérifier que l'écriture fonctionne.
          </p>
          <button
            onClick={runTest}
            disabled={!status?.configured || testing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#1E0F2B] font-bold text-sm hover:bg-[#DDBE55] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            {testing ? "Test en cours..." : "Lancer le test"}
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
                    <span className="text-[#8A8378] w-40">Credentials :</span>
                    {testResult.credentialsValid ? (
                      <span className="text-emerald-600 font-bold">✓ Valides</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Invalides</span>
                    )}
                  </div>
                )}
                {testResult.bucketsAccessible && testResult.bucketsAccessible.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#8A8378] w-40">Buckets accessibles :</span>
                    <span className="text-[#1E0F2B] font-mono">{testResult.bucketsAccessible.join(", ")}</span>
                  </div>
                )}
                {testResult.bucketExists !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A8378] w-40">Bucket configuré :</span>
                    {testResult.bucketExists ? (
                      <span className="text-emerald-600 font-bold">✓ Existe</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Introuvable</span>
                    )}
                  </div>
                )}
                {testResult.canWrite !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A8378] w-40">Permission écriture :</span>
                    {testResult.canWrite ? (
                      <span className="text-emerald-600 font-bold">✓ OK</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Refusée</span>
                    )}
                  </div>
                )}
                {testResult.errorCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A8378] w-40">Code d'erreur :</span>
                    <span className="text-red-600 font-mono font-bold">{testResult.errorCode}</span>
                  </div>
                )}
              </div>

              {/* Détails techniques */}
              {testResult.details && testResult.details.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#8A8378]/20">
                  <p className="text-[10px] font-bold text-[#8A8378] uppercase tracking-wider mb-2">Détails du diagnostic</p>
                  <ul className="space-y-1">
                    {testResult.details.map((d, i) => (
                      <li key={i} className={`text-[10px] font-mono ${d.startsWith("✗") ? "text-red-600" : d.startsWith("✓") ? "text-emerald-600" : "text-[#8A8378]"}`}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

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
          <div className="bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-xl p-4">
            <h3 className="text-xs font-bold text-[#1E0F2B] uppercase tracking-wider mb-2">
              Configuration requise
            </h3>
            <p className="text-xs text-[#8A8378] mb-3">
              Ajoutez ces variables d'environnement sur Vercel :
            </p>
            <pre className="text-[10px] bg-[#1E0F2B] text-[#C9A227] p-3 rounded-lg overflow-x-auto">
{`R2_ACCOUNT_ID=votre_account_id
R2_ACCESS_KEY_ID=votre_access_key
R2_SECRET_ACCESS_KEY=votre_secret
R2_BUCKET_NAME=nom-du-bucket
R2_PUBLIC_URL=https://cdn.mouvementchristlibere.org`}
            </pre>
            <p className="text-[10px] text-[#8A8378] mt-3">
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
              <li>Renseignez R2_PUBLIC_URL avec votre domaine custom (optionnel mais recommandé)</li>
            </ol>
            <p className="text-[10px] text-blue-700 mt-2">
              Avantage R2 : zéro frais de transfert sortant (egress gratuit)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
