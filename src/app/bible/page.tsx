"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Languages,
  Hash,
  Scroll,
  Shield,
  ExternalLink,
  Columns,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

type Onglet = "lecture" | "recherche" | "strong" | "hebreu" | "peshitta" | "concordance" | "comparatif";

const ONGLETS: Array<{ id: Onglet; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "lecture", label: "Lecture", icon: BookOpen },
  { id: "recherche", label: "Recherche", icon: Search },
  { id: "strong", label: "Lexique Strong", icon: Hash },
  { id: "hebreu", label: "Texte hébraïque", icon: Scroll },
  { id: "peshitta", label: "Peshitta araméenne", icon: Languages },
  { id: "concordance", label: "Concordance", icon: Shield },
  { id: "comparatif", label: "Comparatif", icon: Columns },
];

const VERSIONS = [
  { code: "fr-apee", label: "Français (Bible de l'Épée)" },
  { code: "en-kjv", label: "English (KJV)" },
  { code: "en-bbe", label: "English (Basic English)" },
  { code: "es-rvr", label: "Español (Reina Valera)" },
  { code: "pt-acf", label: "Português (ACF)" },
  { code: "ar-svd", label: "العربية (Arabic Bible)" },
];

export default function BiblePage() {
  const [onglet, setOnglet] = useState<Onglet>("lecture");

  return (
    <div>
      <PageHero
        imageSrc="https://images.unsplash.com/photo-1581275288578-bb9308d4e1e1?q=80&w=1920&auto=format&fit=crop"
        kicker="La Parole de Dieu — Bible interconnectée"
        title="Bible complète"
        subtitle="Bible complète en 6 langues, lexique Strong (hébreu + grec), texte hébraïque morphologique, Peshitta araméenne, et concordance. Toutes les données sont intégrées localement — aucune dépendance externe."
        primaryCta={{ label: "Commencer la lecture", href: "#bible-app" }}
      />

      <section id="bible-app" className="bg-[#FAF6EF] py-20 md:py-24 md:py-20 md:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Onglets */}
          <div className="flex items-center gap-1 mb-8 bg-[#2A0E3D]/5 p-1 rounded-lg overflow-x-auto">
            {ONGLETS.map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.id}
                  onClick={() => setOnglet(o.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap",
                    onglet === o.id
                      ? "bg-[#2A0E3D] text-[#FAF6EF] shadow-sm"
                      : "text-[#1E0F2B]/60 hover:text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {o.label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={onglet}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {onglet === "lecture" && <OngletLecture />}
              {onglet === "recherche" && <OngletRecherche />}
              {onglet === "strong" && <OngletStrong />}
              {onglet === "hebreu" && <OngletHebreu />}
              {onglet === "peshitta" && <OngletPeshitta />}
              {onglet === "concordance" && <OngletConcordance />}
              {onglet === "comparatif" && <OngletComparatif />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      <AuroraBackground variant="imperial" intensity="strong" className="py-24 md:py-32">
        <ParticleField count={40} color="#C9A227" size={1.5} speed="slow" />
        <div className="relative">
          <QuoteBlock
            text="Ta parole est une lampe à mes pieds, et une lumière sur mon sentier."
            reference="Psaume 119:105"
            variant="dark"
          />
        </div>
      </AuroraBackground>
    </div>
  );
}

// ============================================================
// LECTURE
// ============================================================

function OngletLecture() {
  const [version, setVersion] = useState("fr-apee");
  const [livre, setLivre] = useState("gn");
  const [chapitre, setChapitre] = useState(1);
  const [data, setData] = useState<{ versets: Array<{ numero: number; texte: string }>; livre: string; nombreVersets: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchChapitre = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/${version}/${livre}/${chapitre}`));
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [version, livre, chapitre]);

  useEffect(() => {
    fetchChapitre();
  }, [fetchChapitre]);

  return (
    <div className="space-y-4">
      {/* Sélecteurs */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
        >
          {VERSIONS.map((v) => (
            <option key={v.code} value={v.code}>{v.label}</option>
          ))}
        </select>

        <select
          value={livre}
          onChange={(e) => { setLivre(e.target.value); setChapitre(1); }}
          className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
        >
          {LIVRES_OPTIONS.map((l) => (
            <option key={l.id} value={l.id}>{l.nom}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChapitre(Math.max(1, chapitre - 1))}
            className="p-2 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D]"
            disabled={chapitre <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-[#1E0F2B] min-w-[80px] text-center">
            Chapitre {chapitre}
          </span>
          <button
            onClick={() => setChapitre(chapitre + 1)}
            className="p-2 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="card-gold-top p-6 md:p-8">
          <h3 className="font-serif text-xl font-semibold text-[#1E0F2B] mb-4">
            {data.livre} {chapitre}
          </h3>
          <div className="space-y-3">
            {data.versets.map((v) => (
              <div key={v.numero} className="flex gap-3 group">
                <span className="text-xs text-[#A3821C] font-semibold w-8 text-right pt-0.5 flex-shrink-0">
                  {v.numero}
                </span>
                <p className="text-sm md:text-base text-[#1E0F2B]/85 leading-relaxed font-serif">
                  {v.texte}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[#8A8378] italic text-center py-20 md:py-24">Chargement...</p>
      )}
    </div>
  );
}

// ============================================================
// RECHERCHE
// ============================================================

function OngletRecherche() {
  const [version, setVersion] = useState("fr-apee");
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<Array<{ livre: string; livreId: string; chapitre: number; verset: number; texte: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [aRecherche, setARecherche] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setARecherche(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/search?version=${version}&q=${encodeURIComponent(query)}`));
      if (res.ok) {
        const data = await res.json();
        setResultats(data.resultats || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
        >
          {VERSIONS.map((v) => (
            <option key={v.code} value={v.code}>{v.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Rechercher un mot ou une phrase..."
          className="flex-1 px-4 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
        />
        <button
          onClick={handleSearch}
          className="px-5 py-2 rounded-md bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55]"
        >
          Rechercher
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 md:py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      )}

      {aRecherche && !loading && (
        <div>
          <p className="text-xs text-[#8A8378] mb-4">
            {resultats.length} résultat{resultats.length > 1 ? "s" : ""} pour « {query} »
          </p>
          <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-discrete">
            {resultats.map((r, i) => (
              <div key={i} className="card-gold-top p-4">
                <p className="text-xs font-semibold text-[#A3821C] mb-1">
                  {r.livre} {r.chapitre}:{r.verset}
                </p>
                <p className="text-sm text-[#1E0F2B]/85 font-serif leading-relaxed">
                  {r.texte}
                </p>
              </div>
            ))}
            {resultats.length === 0 && (
              <p className="text-[#8A8378] italic text-center py-8">Aucun résultat.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STRONG
// ============================================================

function OngletStrong() {
  const [numero, setNumero] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!numero.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/strong/${encodeURIComponent(numero)}`));
      if (res.ok) {
        setResult(await res.json());
      } else {
        setResult(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Numéro Strong (ex: H1, H1961, G2424, G3056)"
          className="flex-1 px-4 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
        />
        <button
          onClick={handleSearch}
          className="px-5 py-2 rounded-md bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55]"
        >
          Chercher
        </button>
      </div>

      <div className="p-4 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-md">
        <p className="text-xs text-[#8A8378] leading-relaxed">
          <strong className="text-[#1E0F2B]">Dictionnaire Strong</strong> — 8 674 entrées hébraïques (H1-H8674) et 5 523 entrées grecques (G1-G5523).
          Tapez un numéro avec préfixe H (hébreu) ou G (grec).
          Exemples : H1 (père), H1961 (marcher), G2424 (Jésus), G3056 (parole).
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 md:py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      )}

      {result && !loading && (
        <div className="card-gold-top p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={cn(
              "inline-flex items-center px-3 py-1 rounded text-sm font-bold",
              (result.langue as string) === "hebrew" ? "bg-[#C9A227]/15 text-[#A3821C]" : "bg-[#8C5FA8]/15 text-[#8C5FA8]"
            )}>
              {result.numero as string}
            </span>
            <span className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold">
              {(result.langue as string) === "hebrew" ? "Hébreu" : "Grec"}
            </span>
          </div>

          {Boolean(result.lemma) && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold mb-1">Lemme</p>
              <p className="font-serif text-2xl text-[#1E0F2B]" dir="rtl">{result.lemma as string}</p>
            </div>
          )}

          {Boolean(result.pron) && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold mb-1">Prononciation</p>
              <p className="text-sm text-[#1E0F2B]">{result.pron as string}</p>
            </div>
          )}

          {Boolean(result.translit) && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold mb-1">Translittération</p>
              <p className="text-sm text-[#1E0F2B] italic">{result.translit as string}</p>
            </div>
          )}

          {Boolean(result.derivation) && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold mb-1">Étymologie</p>
              <p className="text-sm text-[#1E0F2B]/80">{result.derivation as string}</p>
            </div>
          )}

          {Boolean(result.strongs_def) && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold mb-1">Définition Strong</p>
              <p className="text-sm text-[#1E0F2B]/80 leading-relaxed">{result.strongs_def as string}</p>
            </div>
          )}

          {Boolean(result.kjv_def) && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-[#8A8378] font-semibold mb-1">Traductions KJV</p>
              <p className="text-sm text-[#1E0F2B]/70 italic">{result.kjv_def as string}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// HÉBREU
// ============================================================

function OngletHebreu() {
  const [livre, setLivre] = useState("Gen");
  const [chapitre, setChapitre] = useState(1);
  const [verset, setVerset] = useState(1);
  const [data, setData] = useState<{ mots: Array<{ mot: string; lemme: string; morphologie: string }> } | null>(null);
  const [loading, setLoading] = useState(false);

  const LIVRES_OSHB = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal"];

  const fetchVerset = async () => {
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/hebrew/${livre}/${chapitre}/${verset}`));
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerset();
  }, [livre, chapitre, verset]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={livre} onChange={(e) => setLivre(e.target.value)} className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]">
          {LIVRES_OSHB.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="number" min={1} value={chapitre} onChange={(e) => setChapitre(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]" />
        <input type="number" min={1} value={verset} onChange={(e) => setVerset(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]" />
      </div>

      <div className="p-4 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-md">
        <p className="text-xs text-[#8A8378] leading-relaxed">
          <strong className="text-[#1E0F2B]">Open Scriptures Hebrew Bible</strong> — Texte massorétique (Westminster Leningrad Codex)
          avec analyse morphologique complète. Chaque mot affiche son lemme (numéro Strong) et sa forme grammaticale.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 md:py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="card-gold-top p-6">
          <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-4">
            {livre} {chapitre}:{verset}
          </h3>
          <div className="space-y-2" dir="rtl">
            {data.mots.map((mot, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-[#C9A227]/5 transition-colors group">
                <span className="font-serif text-lg text-[#1E0F2B]">{mot.mot}</span>
                <div className="flex-1 text-left" dir="ltr">
                  <span className="text-xs font-mono text-[#A3821C]">{mot.lemme}</span>
                  <span className="text-xs text-[#8A8378] ml-2">{mot.morphologie}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[#8A8378] italic text-center py-8">Verset non trouvé.</p>
      )}
    </div>
  );
}

// ============================================================
// PESHITTA
// ============================================================

function OngletPeshitta() {
  const [livre, setLivre] = useState("Genesis");
  const [chapitre, setChapitre] = useState(1);
  const [data, setData] = useState<{ versets: Array<{ numero: number; texte: string }> } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchChapitre = async () => {
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/peshitta/${livre}/${chapitre}`));
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChapitre();
  }, [livre, chapitre]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" value={livre} onChange={(e) => setLivre(e.target.value)} className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]" placeholder="Nom du livre (ex: Genesis)" />
        <input type="number" min={1} value={chapitre} onChange={(e) => setChapitre(parseInt(e.target.value) || 1)} className="w-24 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]" />
      </div>

      <div className="p-4 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-md">
        <p className="text-xs text-[#8A8378] leading-relaxed">
          <strong className="text-[#1E0F2B]">Peshitta</strong> — Bible araméenne (syriaque). Langue parlée par Yeshoua et ses disciples.
          Texte de la Peshitta avec lexique SEDRA. La Peshitta est la Bible des églises de tradition syriaque
          depuis le Ve siècle.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 md:py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="card-gold-top p-6">
          <h3 className="font-serif text-lg font-semibold text-[#1E0F2B] mb-4">
            {livre} — Chapter {chapitre}
          </h3>
          <div className="space-y-2">
            {data.versets.map((v) => (
              <div key={v.numero} className="flex gap-3">
                <span className="text-xs text-[#A3821C] font-semibold w-8 text-right pt-0.5">{v.numero}</span>
                <p className="text-sm text-[#1E0F2B]/85 font-serif leading-relaxed" dir="rtl">{v.texte}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[#8A8378] italic text-center py-8">Chapitre non trouvé.</p>
      )}
    </div>
  );
}

// ============================================================
// CONCORDANCE
// ============================================================

function OngletConcordance() {
  const [numero, setNumero] = useState("");
  const [data, setData] = useState<{ strong: Record<string, unknown> | null; versets: Array<{ livre: string; livreId: string; chapitre: number; verset: number; mots: Array<{ mot: string; lemme: string; morphologie: string }> }> } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!numero.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/concordance/${encodeURIComponent(numero)}?limite=30`));
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Numéro Strong (ex: H1961, H7225, H3068)"
          className="flex-1 px-4 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
        />
        <button onClick={handleSearch} className="px-5 py-2 rounded-md bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55]">
          Chercher
        </button>
      </div>

      <div className="p-4 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-md">
        <p className="text-xs text-[#8A8378] leading-relaxed">
          <strong className="text-[#1E0F2B]">Concordance Strong</strong> — Trouve tous les versets de la Bible hébraïque
          où apparaît un mot identifié par son numéro Strong. Outil d'étude biblique approfondi.
          Exemples : H1961 (marcher), H7225 (commencement), H3068 (YHWH).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 md:py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="space-y-3">
          {data.strong && (
            <div className="card-gold-top p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#C9A227]/15 text-[#A3821C]">{data.strong.numero as string}</span>
                {Boolean(data.strong.lemma) && <span className="font-serif text-lg text-[#1E0F2B]" dir="rtl">{data.strong.lemma as string}</span>}
              </div>
              {Boolean(data.strong.strongs_def) && <p className="text-sm text-[#1E0F2B]/70">{data.strong.strongs_def as string}</p>}
            </div>
          )}

          <p className="text-xs text-[#8A8378]">{data.versets.length} verset(s) trouvé(s)</p>

          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-discrete">
            {data.versets.map((v, i) => (
              <div key={i} className="card-gold-top p-3">
                <p className="text-xs font-semibold text-[#A3821C] mb-1">
                  {v.livre} {v.chapitre}:{v.verset}
                </p>
                <div className="flex flex-wrap gap-1" dir="rtl">
                  {v.mots.map((m, j) => (
                    <span
                      key={j}
                      className={cn(
                        "font-serif text-sm",
                        m.lemme.includes(numero.replace("H", "")) ? "text-[#A3821C] font-bold" : "text-[#1E0F2B]/60"
                      )}
                    >
                      {m.mot}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// COMPARATIF MULTILINGUE
// ============================================================

function OngletComparatif() {
  const [livre, setLivre] = useState("gn");
  const [chapitre, setChapitre] = useState(1);
  const [verset, setVerset] = useState(1);
  const [versionsSelectionnees, setVersionsSelectionnees] = useState<string[]>(["fr-apee", "en-kjv", "es-rvr"]);
  const [traductions, setTraductions] = useState<Record<string, { texte: string; livre: string } | null>>({});
  const [loading, setLoading] = useState(false);

  const fetchComparatif = useCallback(async () => {
    setLoading(true);
    const resultats: Record<string, { texte: string; livre: string } | null> = {};
    await Promise.all(
      versionsSelectionnees.map(async (version) => {
        try {
          const res = await fetch(api.url(`/api/bible-v2/${version}/${livre}/${chapitre}`));
          if (res.ok) {
            const data = await res.json();
            const versetData = data.versets[verset - 1];
            resultats[version] = versetData
              ? { texte: versetData.texte, livre: data.livre }
              : null;
          } else {
            resultats[version] = null;
          }
        } catch {
          resultats[version] = null;
        }
      })
    );
    setTraductions(resultats);
    setLoading(false);
  }, [versionsSelectionnees, livre, chapitre, verset]);

  useEffect(() => {
    Promise.resolve().then(() => fetchComparatif());
  }, [fetchComparatif]);

  const toggleVersion = (code: string) => {
    setVersionsSelectionnees((prev) =>
      prev.includes(code) ? prev.filter((v) => v !== code) : [...prev, code]
    );
  };

  return (
    <div className="space-y-4">
      {/* Sélecteurs */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={livre} onChange={(e) => setLivre(e.target.value)} className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]">
          {LIVRES_OPTIONS.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
        <input type="number" min={1} value={chapitre} onChange={(e) => setChapitre(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]" />
        <span className="text-[#8A8378] text-sm">:</span>
        <input type="number" min={1} value={verset} onChange={(e) => setVerset(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-[#FAF6EF] text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]" />
      </div>

      {/* Sélecteur de versions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold mr-2">Versions :</span>
        {VERSIONS.map((v) => (
          <button
            key={v.code}
            onClick={() => toggleVersion(v.code)}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-semibold transition-all",
              versionsSelectionnees.includes(v.code)
                ? "bg-[#2A0E3D] text-[#FAF6EF]"
                : "border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 md:py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(versionsSelectionnees.length, 3)}, minmax(0, 1fr))` }}>
          {versionsSelectionnees.map((version) => {
            const v = VERSIONS.find((ver) => ver.code === version);
            const data = traductions[version];
            return (
              <div key={version} className="card-gold-top p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-[#A3821C] font-semibold">
                    {v?.label.split(" ")[0]}
                  </span>
                </div>
                {data ? (
                  <>
                    <p className="text-xs text-[#8A8378] mb-2">{data.livre} {chapitre}:{verset}</p>
                    <p className="text-sm text-[#1E0F2B]/85 font-serif leading-relaxed italic">
                      « {data.texte} »
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[#8A8378] italic">Verset non disponible</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 bg-[#2A0E3D]/5 border border-[#C9A227]/20 rounded-md">
        <p className="text-xs text-[#8A8378] leading-relaxed">
          <strong className="text-[#1E0F2B]">Étude comparative</strong> — Lisez le même verset dans plusieurs langues côte à côte.
          Sélectionnez jusqu&apos;à 6 versions. Idéal pour les dispersés d&apos;Israël qui parlent différentes langues
          et pour l&apos;étude comparative des traductions.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// CONSTANTES
// ============================================================

const LIVRES_OPTIONS = [
  { id: "gn", nom: "Genèse" }, { id: "ex", nom: "Exode" }, { id: "lv", nom: "Lévitique" },
  { id: "nb", nom: "Nombres" }, { id: "dt", nom: "Deutéronome" }, { id: "js", nom: "Josué" },
  { id: "jg", nom: "Juges" }, { id: "rt", nom: "Ruth" }, { id: "1sm", nom: "1 Samuel" },
  { id: "2sm", nom: "2 Samuel" }, { id: "1kg", nom: "1 Rois" }, { id: "2kg", nom: "2 Rois" },
  { id: "1ch", nom: "1 Chroniques" }, { id: "2ch", nom: "2 Chroniques" }, { id: "er", nom: "Esdras" },
  { id: "ne", nom: "Néhémie" }, { id: "est", nom: "Esther" }, { id: "jb", nom: "Job" },
  { id: "ps", nom: "Psaumes" }, { id: "pv", nom: "Proverbes" }, { id: "ec", nom: "Ecclésiaste" },
  { id: "ct", nom: "Cantique" }, { id: "es", nom: "Ésaïe" }, { id: "je", nom: "Jérémie" },
  { id: "lm", nom: "Lamentations" }, { id: "ez", nom: "Ézéchiel" }, { id: "dn", nom: "Daniel" },
  { id: "os", nom: "Osée" }, { id: "jl", nom: "Joël" }, { id: "am", nom: "Amos" },
  { id: "ob", nom: "Abdias" }, { id: "jn", nom: "Jonas" }, { id: "mi", nom: "Michée" },
  { id: "na", nom: "Nahum" }, { id: "hb", nom: "Habacuc" }, { id: "so", nom: "Sophonie" },
  { id: "ag", nom: "Aggée" }, { id: "za", nom: "Zacharie" }, { id: "ml", nom: "Malachie" },
  { id: "mt", nom: "Matthieu" }, { id: "mc", nom: "Marc" }, { id: "lc", nom: "Luc" },
  { id: "jo", nom: "Jean" }, { id: "ac", nom: "Actes" }, { id: "rm", nom: "Romains" },
  { id: "1co", nom: "1 Corinthiens" }, { id: "2co", nom: "2 Corinthiens" }, { id: "ga", nom: "Galates" },
  { id: "ep", nom: "Éphésiens" }, { id: "ph", nom: "Philippiens" }, { id: "cl", nom: "Colossiens" },
  { id: "1th", nom: "1 Thessaloniciens" }, { id: "2th", nom: "2 Thessaloniciens" },
  { id: "1tm", nom: "1 Timothée" }, { id: "2tm", nom: "2 Timothée" }, { id: "tt", nom: "Tite" },
  { id: "pm", nom: "Philémon" }, { id: "he", nom: "Hébreux" }, { id: "jq", nom: "Jacques" },
  { id: "1pe", nom: "1 Pierre" }, { id: "2pe", nom: "2 Pierre" }, { id: "1jo", nom: "1 Jean" },
  { id: "2jo", nom: "2 Jean" }, { id: "3jo", nom: "3 Jean" }, { id: "jd", nom: "Jude" },
  { id: "ap", nom: "Apocalypse" },
];
