"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, BookOpen, ChevronRight, Loader2, ArrowLeft, ArrowRight, Languages, BookMarked } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Verse {
  numero: number;
  texte: string;
}

interface ChapterData {
  version: string;
  livre: string;
  livreId: string;
  chapitre: number;
  nombreVersets: number;
  versets: Verse[];
  fallback?: boolean;
}

interface BibleVersion {
  code: string;
  nom: string;
  langue: string;
}

const LIVRES = [
  // Pentateuque
  { id: "gn", nom: "Genèse", chapitres: 50 },
  { id: "ex", nom: "Exode", chapitres: 40 },
  { id: "lv", nom: "Lévitique", chapitres: 27 },
  { id: "nb", nom: "Nombres", chapitres: 36 },
  { id: "dt", nom: "Deutéronome", chapitres: 34 },
  // Historiques
  { id: "js", nom: "Josué", chapitres: 24 },
  { id: "jg", nom: "Juges", chapitres: 21 },
  { id: "rt", nom: "Ruth", chapitres: 4 },
  { id: "1sm", nom: "1 Samuel", chapitres: 31 },
  { id: "2sm", nom: "2 Samuel", chapitres: 24 },
  { id: "1kg", nom: "1 Rois", chapitres: 22 },
  { id: "2kg", nom: "2 Rois", chapitres: 25 },
  { id: "1ch", nom: "1 Chroniques", chapitres: 29 },
  { id: "2ch", nom: "2 Chroniques", chapitres: 36 },
  { id: "er", nom: "Esdras", chapitres: 10 },
  { id: "ne", nom: "Néhémie", chapitres: 13 },
  { id: "est", nom: "Esther", chapitres: 10 },
  // Sagesse
  { id: "jb", nom: "Job", chapitres: 42 },
  { id: "ps", nom: "Psaumes", chapitres: 150 },
  { id: "pv", nom: "Proverbes", chapitres: 31 },
  { id: "ec", nom: "Ecclésiaste", chapitres: 12 },
  { id: "ct", nom: "Cantique", chapitres: 8 },
  // Prophètes
  { id: "es", nom: "Ésaïe", chapitres: 66 },
  { id: "je", nom: "Jérémie", chapitres: 52 },
  { id: "lm", nom: "Lamentations", chapitres: 5 },
  { id: "ez", nom: "Ézéchiel", chapitres: 48 },
  { id: "dn", nom: "Daniel", chapitres: 12 },
  { id: "os", nom: "Osée", chapitres: 14 },
  { id: "jl", nom: "Joël", chapitres: 3 },
  { id: "am", nom: "Amos", chapitres: 9 },
  { id: "ob", nom: "Abdias", chapitres: 1 },
  { id: "jn", nom: "Jonas", chapitres: 4 },
  { id: "mi", nom: "Michée", chapitres: 7 },
  { id: "na", nom: "Nahum", chapitres: 3 },
  { id: "hb", nom: "Habacuc", chapitres: 3 },
  { id: "so", nom: "Sophonie", chapitres: 3 },
  { id: "ag", nom: "Aggée", chapitres: 2 },
  { id: "za", nom: "Zacharie", chapitres: 14 },
  { id: "ml", nom: "Malachie", chapitres: 4 },
];

export default function BiblePage() {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("fr-apee");
  const [selectedLivre, setSelectedLivre] = useState("gn");
  const [selectedChapitre, setSelectedChapitre] = useState(1);
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [showBookList, setShowBookList] = useState(false);

  // Load versions
  useEffect(() => {
    fetch(api.url("/api/bible-v2/versions"))
      .then(r => r.json())
      .then(data => setVersions(data.versions || []))
      .catch(() => {});
  }, []);

  // Load chapter
  const loadChapter = useCallback(async (version: string, livre: string, chapitre: number) => {
    setLoading(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/${version}/${livre}/${chapitre}`));
      if (res.ok) {
        const data = await res.json();
        setChapterData(data);
      }
    } catch (e) {
      console.error("loadChapter:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChapter(selectedVersion, selectedLivre, selectedChapitre);
  }, [selectedVersion, selectedLivre, selectedChapitre, loadChapter]);

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(api.url(`/api/bible-v2/search?q=${encodeURIComponent(searchQuery)}`));
      if (res.ok) setSearchResults(await res.json());
    } catch (e) {
      console.error("search:", e);
    } finally {
      setSearching(false);
    }
  };

  const livreActuel = LIVRES.find(l => l.id === selectedLivre);
  const prevChapter = () => {
    if (selectedChapitre > 1) setSelectedChapitre(selectedChapitre - 1);
    else {
      const idx = LIVRES.findIndex(l => l.id === selectedLivre);
      if (idx > 0) {
        setSelectedLivre(LIVRES[idx - 1].id);
        setSelectedChapitre(LIVRES[idx - 1].chapitres);
      }
    }
  };
  const nextChapter = () => {
    if (livreActuel && selectedChapitre < livreActuel.chapitres) setSelectedChapitre(selectedChapitre + 1);
    else {
      const idx = LIVRES.findIndex(l => l.id === selectedLivre);
      if (idx < LIVRES.length - 1) {
        setSelectedLivre(LIVRES[idx + 1].id);
        setSelectedChapitre(1);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* ═══ HEADER ═══ */}
      <section className="bg-[#2A0E3D] pt-20 pb-6 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          {/* Title + search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-[#C9A227]" />
              <h1 className="font-serif font-extrabold text-2xl md:text-3xl text-[#FAF6EF]">Bible en ligne</h1>
            </div>
            {/* Search bar */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8378]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  placeholder="Rechercher un verset..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FAF6EF]/10 border border-[#C9A227]/20 text-sm text-[#FAF6EF] placeholder:text-[#FAF6EF]/40 outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] font-semibold text-sm hover:bg-[#DDBE55] transition-colors"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Chercher"}
              </button>
            </div>
          </div>

          {/* Navigation: book selector + version + chapter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Book selector */}
            <button
              onClick={() => setShowBookList(!showBookList)}
              className="px-4 py-2 rounded-full bg-[#FAF6EF]/10 border border-[#C9A227]/20 text-sm font-semibold text-[#FAF6EF] hover:bg-[#C9A227]/10 transition-colors flex items-center gap-2"
            >
              <BookMarked className="w-4 h-4 text-[#C9A227]" />
              {livreActuel?.nom || "Choisir un livre"}
            </button>

            {/* Chapter selector */}
            {livreActuel && (
              <select
                value={selectedChapitre}
                onChange={(e) => setSelectedChapitre(parseInt(e.target.value))}
                className="px-4 py-2 rounded-full bg-[#FAF6EF]/10 border border-[#C9A227]/20 text-sm font-semibold text-[#FAF6EF] outline-none cursor-pointer"
              >
                {Array.from({ length: livreActuel.chapitres }, (_, i) => (
                  <option key={i + 1} value={i + 1} className="text-[#1E0F2B]">Chapitre {i + 1}</option>
                ))}
              </select>
            )}

            {/* Version selector */}
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="px-4 py-2 rounded-full bg-[#FAF6EF]/10 border border-[#C9A227]/20 text-sm font-semibold text-[#FAF6EF] outline-none cursor-pointer ml-auto"
            >
              {versions.map((v) => (
                <option key={v.code} value={v.code} className="text-[#1E0F2B]">{v.nom}</option>
              ))}
              <option value="fr-apee" className="text-[#1E0F2B]">Français (APEE)</option>
            </select>
          </div>

          {/* Book list dropdown */}
          {showBookList && (
            <div className="mt-4 p-4 bg-[#1A0826] rounded-2xl border border-[#C9A227]/20 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {LIVRES.map((livre) => (
                  <button
                    key={livre.id}
                    onClick={() => { setSelectedLivre(livre.id); setSelectedChapitre(1); setShowBookList(false); }}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                      selectedLivre === livre.id
                        ? "bg-[#C9A227] text-[#1E0F2B]"
                        : "text-[#FAF6EF]/70 hover:bg-[#C9A227]/10 hover:text-[#C9A227]"
                    )}
                  >
                    {livre.nom}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ SEARCH RESULTS ═══ */}
      {searchResults && (
        <section className="py-8 bg-[#FAF6EF] border-b border-[#8A8378]/10">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-bold text-[#1E0F2B]">Résultats de recherche</h2>
              <button onClick={() => setSearchResults(null)} className="text-sm text-[#8A8378] hover:text-[#1E0F2B]">Fermer ✕</button>
            </div>
            <div className="space-y-3">
              {searchResults.resultats?.map((r: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 p-5">
                  <p className="text-xs font-semibold text-[#C9A227] mb-1">{r.reference}</p>
                  <p className="text-sm text-[#1E0F2B] leading-relaxed">{r.texte}</p>
                </div>
              )) || <p className="text-sm text-[#8A8378]">Aucun résultat trouvé.</p>}
            </div>
          </div>
        </section>
      )}

      {/* ═══ CHAPTER CONTENT ═══ */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Chapter header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={prevChapter}
              className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-[#2A0E3D] hover:bg-[#2A0E3D]/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Précédent
            </button>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-[#C9A227] font-semibold">{chapterData?.version || ""}</p>
              <h2 className="font-serif text-xl md:text-2xl font-bold text-[#1E0F2B]">
                {chapterData?.livre || livreActuel?.nom} {selectedChapitre}
              </h2>
            </div>
            <button
              onClick={nextChapter}
              className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-[#2A0E3D] hover:bg-[#2A0E3D]/5 transition-colors"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Verses */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
            </div>
          ) : chapterData ? (
            <motion.div
              key={`${selectedLivre}-${selectedChapitre}-${selectedVersion}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-sm border border-[#8A8378]/10 border-t-[3px] border-t-[#C9A227] p-6 md:p-10"
            >
              <div className="space-y-3">
                {chapterData.versets.map((verse) => (
                  <div key={verse.numero} className="flex gap-3 group hover:bg-[#FAF6EF] rounded-lg p-2 -mx-2 transition-colors">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#C9A227]/10 flex items-center justify-center text-xs font-bold text-[#C9A227] mt-0.5">
                      {verse.numero}
                    </span>
                    <p className="text-sm md:text-base text-[#1E0F2B] leading-relaxed flex-1">
                      {verse.texte}
                    </p>
                  </div>
                ))}
              </div>

              {chapterData.fallback && (
                <p className="mt-6 text-xs text-[#8A8378] italic text-center">
                  ⚠ Version de secours — versets clés uniquement. Les données complètes seront chargées depuis l'API.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-[#8A8378]/30 mx-auto mb-4" />
              <p className="text-[#8A8378]">Sélectionnez un livre et un chapitre</p>
            </div>
          )}

          {/* Bottom navigation */}
          {chapterData && (
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={prevChapter}
                className="flex items-center gap-1 px-5 py-2.5 rounded-full bg-[#2A0E3D] text-[#FAF6EF] text-sm font-semibold hover:bg-[#3D1A54] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Précédent
              </button>
              <button
                onClick={nextChapter}
                className="flex items-center gap-1 px-5 py-2.5 rounded-full bg-[#C9A227] text-[#1E0F2B] text-sm font-semibold hover:bg-[#DDBE55] transition-colors"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
