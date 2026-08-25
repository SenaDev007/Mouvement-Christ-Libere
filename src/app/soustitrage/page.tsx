"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Languages,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Play,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

const LANGUES = [
  { code: "fr", nom: "Français", drapeau: "🇫🇷" },
  { code: "en", nom: "English", drapeau: "🇬🇧" },
  { code: "es", nom: "Español", drapeau: "🇪🇸" },
  { code: "pt", nom: "Português", drapeau: "🇵🇹" },
  { code: "he", nom: "עברית", drapeau: "🇮🇱" },
  { code: "am", nom: "አማርኛ", drapeau: "🇪🇹" },
  { code: "ln", nom: "Lingála", drapeau: "🇨🇩" },
  { code: "ar", nom: "العربية", drapeau: "🇸🇦" },
];

interface SousTitre {
  debut: number;
  fin: number;
  texte: string;
}

interface ResultatSousTitrage {
  langueSource: string;
  sousTitres: SousTitre[];
  traductions: Record<string, SousTitre[]>;
  dureeTotal: number;
  mode: "demo" | "production";
  srtSource?: string;
  srtTraductions?: Record<string, string>;
}

export default function SousTitragePage() {
  const [fichierUrl, setFichierUrl] = useState("");
  const [langueSource, setLangueSource] = useState("fr");
  const [languesCibles, setLanguesCibles] = useState<string[]>(["en", "es", "pt"]);
  const [submitting, setSubmitting] = useState(false);
  const [resultat, setResultat] = useState<ResultatSousTitrage | null>(null);
  const [error, setError] = useState("");
  const [langueAffichee, setLangueAffichee] = useState("source");
  const [whisperConfigure, setWhisperConfigure] = useState(false);

  useEffect(() => {
    fetch(api.url("/api/soustitres")))
      .then((r) => r.json())
      .then((data) => setWhisperConfigure(data.mode === "production"))
      .catch(() => {});
  }, []);

  const toggleLangueCible = (code: string) => {
    setLanguesCibles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(api.url("/api/soustitres"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fichierUrl: fichierUrl || "demo",
          langueSource,
          languesCibles,
        }),
      });

      if (!res.ok) throw new Error("Échec du sous-titrage");

      const data = await res.json();
      setResultat(data);
      setLangueAffichee("source");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const sousTitresAffiches =
    langueAffichee === "source"
      ? resultat?.sousTitres
      : resultat?.traductions[langueAffichee];

  const srtTelecharger =
    langueAffichee === "source"
      ? resultat?.srtSource
      : resultat?.srtTraductions?.[langueAffichee];

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=1920&auto=format&fit=crop"
        kicker="Sous-titrage IA multilingue"
        title="Sous-titres automatiques"
        subtitle="Génération de sous-titres multilingues via Whisper (OpenAI). Pour que la Parole atteigne les dispersés d'Israël partout où ils se trouvent, dans leur langue."
        primaryCta={{ label: "Générer des sous-titres", href: "#generateur" }}
      />

      <section id="generateur" className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          {/* Bandeau mode */}
          {!whisperConfigure && (
            <div className="mb-6 p-4 rounded-md bg-gold/5 border border-gold/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink mb-1">Mode démonstration</p>
                <p className="text-xs text-stone">
                  Whisper n&apos;est pas configuré (<code className="bg-stone/10 px-1 rounded">OPENAI_API_KEY</code> manquant).
                  Les sous-titres sont simulés. Pour activer le sous-titrage réel, ajoutez la clé API dans Vercel.
                </p>
              </div>
            </div>
          )}

          {!resultat ? (
            <form onSubmit={handleSubmit} className="card-gold-top p-8 space-y-5">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  URL du fichier audio/vidéo
                </label>
                <input
                  type="url"
                  value={fichierUrl}
                  onChange={(e) => setFichierUrl(e.target.value)}
                  placeholder="https://exemple.com/enseignement.mp4"
                  className="w-full px-4 py-3 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                <p className="text-xs text-stone mt-1">
                  Laissez vide pour tester en mode démo (sous-titres simulés).
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Langue source
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLangueSource(l.code)}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm font-semibold transition-all inline-flex items-center gap-2",
                        langueSource === l.code
                          ? "bg-imperial text-ivory"
                          : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                      )}
                    >
                      <span>{l.drapeau}</span>
                      {l.nom}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2 block">
                  Langues cibles (traduction)
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUES.filter((l) => l.code !== langueSource).map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggleLangueCible(l.code)}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm font-semibold transition-all inline-flex items-center gap-2",
                        languesCibles.includes(l.code)
                          ? "bg-gold text-ink"
                          : "border border-stone/30 text-stone hover:border-gold/50"
                      )}
                    >
                      <span>{l.drapeau}</span>
                      {l.nom}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-state-danger text-sm p-3 rounded-md bg-state-danger/5 border border-state-danger/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-4 rounded-md bg-gold text-ink font-semibold text-sm hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4" />
                    Générer les sous-titres
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* En-tête résultat */}
              <div className="card-gold-top p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-state-success/15 border-2 border-state-success/40">
                      <CheckCircle2 className="w-6 h-6 text-state-success" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl font-semibold text-ink">
                        Sous-titres générés
                      </h3>
                      <p className="text-xs text-stone">
                        {resultat.mode === "production" ? "Whisper (production)" : "Mode démo"} ·
                        {" "}{resultat.sousTitres.length} segments · {" "}
                        {Math.floor(resultat.dureeTotal / 60)}:{(resultat.dureeTotal % 60).toString().padStart(2, "0")} de contenu
                      </p>
                    </div>
                  </div>
                  {srtTelecharger && (
                    <button
                      onClick={() => {
                        const blob = new Blob([srtTelecharger], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `soustitres-${langueAffichee}.srt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gold text-ink text-xs font-semibold hover:bg-gold-light transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Télécharger SRT
                    </button>
                  )}
                </div>

                {/* Sélecteur langue affichée */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setLangueAffichee("source")}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                      langueAffichee === "source"
                        ? "bg-imperial text-ivory"
                        : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                    )}
                  >
                    🌐 Source ({LANGUES.find((l) => l.code === resultat.langueSource)?.nom})
                  </button>
                  {Object.keys(resultat.traductions).map((lang) => {
                    const l = LANGUES.find((langue) => langue.code === lang);
                    return (
                      <button
                        key={lang}
                        onClick={() => setLangueAffichee(lang)}
                        className={cn(
                          "px-3 py-1.5 rounded text-xs font-semibold transition-all inline-flex items-center gap-1",
                          langueAffichee === lang
                            ? "bg-imperial text-ivory"
                            : "border border-imperial/30 text-imperial hover:bg-imperial/5"
                        )}
                      >
                        {l?.drapeau} {l?.nom}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Liste des sous-titres */}
              <div className="card-gold-top p-6 max-h-[500px] overflow-y-auto scrollbar-discrete">
                <div className="space-y-3">
                  {sousTitresAffiches?.map((st, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                      className="flex items-start gap-3 p-3 rounded-md hover:bg-gold/5 transition-colors"
                    >
                      <div className="flex items-center gap-1 text-xs text-gold-dark font-mono font-semibold w-20 flex-shrink-0 pt-0.5">
                        <Clock className="w-3 h-3" />
                        {Math.floor(st.debut / 60)}:{(st.debut % 60).toString().padStart(2, "0")}
                      </div>
                      <p className="text-sm text-ink/85 font-serif leading-relaxed flex-1">
                        {st.texte}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Bouton refaire */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setResultat(null);
                    setFichierUrl("");
                  }}
                  className="text-sm font-semibold text-imperial hover:text-gold transition-colors"
                >
                  Générer d&apos;autres sous-titres
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Citation */}
      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Cette bonne nouvelle du royaume sera prêchée dans le monde entier, pour servir de témoignage à toutes les nations."
            reference="Matthieu 24:14"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}
