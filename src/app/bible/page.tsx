"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Languages,
  Hash,
  Scroll,
  Shield,
  Columns,
  Menu,
  X,
  Bookmark,
  Share2,
  Copy,
  Printer,
  Settings,
  List,
  Type,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// CONSTANTES — Couleurs du royaume
// ============================================================
const IMPERIAL = "#2A0E3D";
const GOLD = "#C9A227";
const GOLD_DARK = "#9C7E1E";
const IVORY = "#FAF6EF";
const INK = "#1E0F2B";
const STONE = "#8A8378";
const LAVENDER = "#7C5CB8";

// ============================================================
// TYPES
// ============================================================
type Onglet = "lecture" | "recherche" | "strong" | "hebreu" | "peshitta" | "concordance" | "comparatif";

interface Version { code: string; label: string; shortLabel: string; lang: string; }
interface LivreOption { id: string; nom: string; categorie: "AT" | "NT"; chapitres: number; }
interface VersetData { numero: number; texte: string; }
interface ChapitreData {
  version: string;
  livre: string;
  livreId: string;
  chapitre: number;
  nombreVersets: number;
  versets: VersetData[];
  fallback?: boolean;
}

// ============================================================
// DONNÉES
// ============================================================
const VERSIONS: Version[] = [
  { code: "fr-apee", label: "Bible de l'Épée (Français)", shortLabel: "FR · ÉPÉE", lang: "Français" },
  { code: "en-kjv",  label: "King James Version (English)", shortLabel: "EN · KJV", lang: "English" },
  { code: "en-bbe",  label: "Bible in Basic English",       shortLabel: "EN · BBE", lang: "English" },
  { code: "es-rvr",  label: "Reina Valera (Español)",        shortLabel: "ES · RVR", lang: "Español" },
  { code: "pt-acf",  label: "Almeida Corrigida Fiel",        shortLabel: "PT · ACF", lang: "Português" },
  { code: "ar-svd",  label: "Arabic Bible (العربية)",        shortLabel: "AR · SVD", lang: "العربية" },
];

const LIVRES_OPTIONS: LivreOption[] = [
  { id: "gn", nom: "Genèse", categorie: "AT", chapitres: 50 }, { id: "ex", nom: "Exode", categorie: "AT", chapitres: 40 },
  { id: "lv", nom: "Lévitique", categorie: "AT", chapitres: 27 }, { id: "nb", nom: "Nombres", categorie: "AT", chapitres: 36 },
  { id: "dt", nom: "Deutéronome", categorie: "AT", chapitres: 34 }, { id: "js", nom: "Josué", categorie: "AT", chapitres: 24 },
  { id: "jg", nom: "Juges", categorie: "AT", chapitres: 21 }, { id: "rt", nom: "Ruth", categorie: "AT", chapitres: 4 },
  { id: "1sm", nom: "1 Samuel", categorie: "AT", chapitres: 31 }, { id: "2sm", nom: "2 Samuel", categorie: "AT", chapitres: 24 },
  { id: "1kg", nom: "1 Rois", categorie: "AT", chapitres: 22 }, { id: "2kg", nom: "2 Rois", categorie: "AT", chapitres: 25 },
  { id: "1ch", nom: "1 Chroniques", categorie: "AT", chapitres: 29 }, { id: "2ch", nom: "2 Chroniques", categorie: "AT", chapitres: 36 },
  { id: "er", nom: "Esdras", categorie: "AT", chapitres: 10 }, { id: "ne", nom: "Néhémie", categorie: "AT", chapitres: 13 },
  { id: "est", nom: "Esther", categorie: "AT", chapitres: 10 }, { id: "jb", nom: "Job", categorie: "AT", chapitres: 42 },
  { id: "ps", nom: "Psaumes", categorie: "AT", chapitres: 150 }, { id: "pv", nom: "Proverbes", categorie: "AT", chapitres: 31 },
  { id: "ec", nom: "Ecclésiaste", categorie: "AT", chapitres: 12 }, { id: "ct", nom: "Cantique", categorie: "AT", chapitres: 8 },
  { id: "es", nom: "Ésaïe", categorie: "AT", chapitres: 66 }, { id: "je", nom: "Jérémie", categorie: "AT", chapitres: 52 },
  { id: "lm", nom: "Lamentations", categorie: "AT", chapitres: 5 }, { id: "ez", nom: "Ézéchiel", categorie: "AT", chapitres: 48 },
  { id: "dn", nom: "Daniel", categorie: "AT", chapitres: 12 }, { id: "os", nom: "Osée", categorie: "AT", chapitres: 14 },
  { id: "jl", nom: "Joël", categorie: "AT", chapitres: 3 }, { id: "am", nom: "Amos", categorie: "AT", chapitres: 9 },
  { id: "ob", nom: "Abdias", categorie: "AT", chapitres: 1 }, { id: "jn", nom: "Jonas", categorie: "AT", chapitres: 4 },
  { id: "mi", nom: "Michée", categorie: "AT", chapitres: 7 }, { id: "na", nom: "Nahum", categorie: "AT", chapitres: 3 },
  { id: "hb", nom: "Habacuc", categorie: "AT", chapitres: 3 }, { id: "so", nom: "Sophonie", categorie: "AT", chapitres: 3 },
  { id: "ag", nom: "Aggée", categorie: "AT", chapitres: 2 }, { id: "za", nom: "Zacharie", categorie: "AT", chapitres: 14 },
  { id: "ml", nom: "Malachie", categorie: "AT", chapitres: 4 },
  { id: "mt", nom: "Matthieu", categorie: "NT", chapitres: 28 }, { id: "mc", nom: "Marc", categorie: "NT", chapitres: 16 },
  { id: "lc", nom: "Luc", categorie: "NT", chapitres: 24 }, { id: "jo", nom: "Jean", categorie: "NT", chapitres: 21 },
  { id: "ac", nom: "Actes", categorie: "NT", chapitres: 28 }, { id: "rm", nom: "Romains", categorie: "NT", chapitres: 16 },
  { id: "1co", nom: "1 Corinthiens", categorie: "NT", chapitres: 16 }, { id: "2co", nom: "2 Corinthiens", categorie: "NT", chapitres: 13 },
  { id: "ga", nom: "Galates", categorie: "NT", chapitres: 6 }, { id: "ep", nom: "Éphésiens", categorie: "NT", chapitres: 6 },
  { id: "ph", nom: "Philippiens", categorie: "NT", chapitres: 4 }, { id: "cl", nom: "Colossiens", categorie: "NT", chapitres: 4 },
  { id: "1th", nom: "1 Thessaloniciens", categorie: "NT", chapitres: 5 }, { id: "2th", nom: "2 Thessaloniciens", categorie: "NT", chapitres: 3 },
  { id: "1tm", nom: "1 Timothée", categorie: "NT", chapitres: 6 }, { id: "2tm", nom: "2 Timothée", categorie: "NT", chapitres: 4 },
  { id: "tt", nom: "Tite", categorie: "NT", chapitres: 3 }, { id: "pm", nom: "Philémon", categorie: "NT", chapitres: 1 },
  { id: "he", nom: "Hébreux", categorie: "NT", chapitres: 13 }, { id: "jq", nom: "Jacques", categorie: "NT", chapitres: 5 },
  { id: "1pe", nom: "1 Pierre", categorie: "NT", chapitres: 5 }, { id: "2pe", nom: "2 Pierre", categorie: "NT", chapitres: 3 },
  { id: "1jo", nom: "1 Jean", categorie: "NT", chapitres: 5 }, { id: "2jo", nom: "2 Jean", categorie: "NT", chapitres: 1 },
  { id: "3jo", nom: "3 Jean", categorie: "NT", chapitres: 1 }, { id: "jd", nom: "Jude", categorie: "NT", chapitres: 1 },
  { id: "ap", nom: "Apocalypse", categorie: "NT", chapitres: 22 },
];

const ONGLETS: Array<{ id: Onglet; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "lecture",     label: "Lecture",           icon: BookOpen },
  { id: "recherche",   label: "Recherche",         icon: Search },
  { id: "strong",      label: "Lexique Strong",    icon: Hash },
  { id: "hebreu",      label: "Texte hébraïque",   icon: Scroll },
  { id: "peshitta",    label: "Peshitta araméenne", icon: Languages },
  { id: "concordance", label: "Concordance",       icon: Shield },
  { id: "comparatif",  label: "Comparatif",        icon: Columns },
];

// ============================================================
// COMPOSANT RACINE
// ============================================================
export default function BiblePage() {
  const [onglet, setOnglet] = useState<Onglet>("lecture");

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* En-tête BibleHub-style */}
      <BibleHeader onglet={onglet} setOnglet={setOnglet} />

      {/* Contenu principal */}
      <main className="mx-auto max-w-[1600px] px-3 md:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={onglet}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {onglet === "lecture"     && <OngletLecture />}
            {onglet === "recherche"   && <OngletRecherche />}
            {onglet === "strong"      && <OngletStrong />}
            {onglet === "hebreu"      && <OngletHebreu />}
            {onglet === "peshitta"    && <OngletPeshitta />}
            {onglet === "concordance" && <OngletConcordance />}
            {onglet === "comparatif"  && <OngletComparatif />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ============================================================
// EN-TÊTE BIBLEHUB-STYLE
// ============================================================
interface BibleHeaderProps {
  onglet: Onglet;
  setOnglet: (o: Onglet) => void;
}

function BibleHeader({ onglet, setOnglet }: BibleHeaderProps) {
  const [quickSearch, setQuickSearch] = useState("");

  return (
    <header className="sticky top-0 z-40 bg-[#2A0E3D] text-[#FAF6EF] shadow-lg shadow-[#2A0E3D]/20">
      {/* Bande supérieure : logo + recherche */}
      <div className="border-b border-[#C9A227]/20">
        <div className="mx-auto max-w-[1600px] px-3 md:px-6 py-3 flex items-center gap-3 md:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 rounded-md bg-[#C9A227] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#2A0E3D]" />
            </div>
            <div className="hidden md:block">
              <p className="font-serif text-base font-bold leading-none">Bible du Royaume</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#C9A227]/80 font-semibold mt-0.5">
                6 versions · Strong · Hébreu · Peshitta
              </p>
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FAF6EF]/40" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickSearch.trim()) {
                    setOnglet("recherche");
                  }
                }}
                placeholder="Rechercher un verset, un mot, une référence (ex: Jean 3:16)..."
                className="w-full pl-10 pr-4 py-2 rounded-md bg-[#FAF6EF]/8 border border-[#C9A227]/30 text-[#FAF6EF] placeholder:text-[#FAF6EF]/40 text-sm focus:outline-none focus:border-[#C9A227] focus:bg-[#FAF6EF]/12 transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button className="p-2 rounded hover:bg-[#FAF6EF]/10 transition-colors" title="Marque-pages">
              <Bookmark className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-[#FAF6EF]/10 transition-colors" title="Paramètres">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bande inférieure : onglets */}
      <div className="mx-auto max-w-[1600px] px-3 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-1">
          {ONGLETS.map((o) => {
            const Icon = o.icon;
            const isActive = onglet === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setOnglet(o.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2",
                  isActive
                    ? "border-[#C9A227] text-[#FAF6EF]"
                    : "border-transparent text-[#FAF6EF]/60 hover:text-[#FAF6EF] hover:border-[#C9A227]/40"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// ============================================================
// LECTURE — Layout BibleHub 3 colonnes
// ============================================================
function OngletLecture() {
  const [version, setVersion] = useState("fr-apee");
  const [livre, setLivre] = useState("gn");
  const [chapitre, setChapitre] = useState(1);
  const [data, setData] = useState<ChapitreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [versetSelectionne, setVersetSelectionne] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [parallelVersion, setParallelVersion] = useState<string | null>(null);
  const [parallelData, setParallelData] = useState<ChapitreData | null>(null);
  const [fontSize, setFontSize] = useState(16);

  const livreOption = useMemo(() => LIVRES_OPTIONS.find((l) => l.id === livre)!, [livre]);

  const fetchChapitre = useCallback(async () => {
    setLoading(true);
    setData(null);
    setVersetSelectionne(null);
    try {
      const res = await fetch(`/api/bible-v2/${version}/${livre}/${chapitre}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [version, livre, chapitre]);

  useEffect(() => { fetchChapitre(); }, [fetchChapitre]);

  // Fetch version parallèle si activée
  useEffect(() => {
    if (!parallelVersion || parallelVersion === version) {
      setParallelData(null);
      return;
    }
    fetch(`/api/bible-v2/${parallelVersion}/${livre}/${chapitre}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setParallelData)
      .catch(() => setParallelData(null));
  }, [parallelVersion, version, livre, chapitre]);

  const changeLivre = (newLivre: string) => {
    setLivre(newLivre);
    setChapitre(1);
    setSidebarOpen(false);
  };

  const changeChapitre = (newChap: number) => {
    setChapitre(newChap);
    setSidebarOpen(false);
  };

  const livrePrecedent = () => {
    const idx = LIVRES_OPTIONS.findIndex((l) => l.id === livre);
    if (idx > 0) {
      changeLivre(LIVRES_OPTIONS[idx - 1].id);
    }
  };

  const livreSuivant = () => {
    const idx = LIVRES_OPTIONS.findIndex((l) => l.id === livre);
    if (idx < LIVRES_OPTIONS.length - 1) {
      changeLivre(LIVRES_OPTIONS[idx + 1].id);
    }
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr_300px] gap-4">
      {/* SIDEBARE GAUCHE — Livres & chapitres */}
      <aside className={cn(
        "lg:block",
        sidebarOpen ? "block fixed inset-0 z-50 bg-black/50 lg:bg-transparent lg:static" : "hidden"
      )}>
        <div className={cn(
          "bg-white rounded-lg shadow-md border border-[#8A8378]/15 overflow-hidden",
          sidebarOpen && "lg:rounded-lg fixed lg:static top-0 left-0 bottom-0 w-80 lg:w-auto max-w-full"
        )}>
          <div className="flex items-center justify-between px-4 py-3 bg-[#2A0E3D]/5 border-b border-[#8A8378]/15">
            <h3 className="font-serif text-sm font-bold text-[#1E0F2B] flex items-center gap-2">
              <List className="w-4 h-4 text-[#C9A227]" />
              Livres
            </h3>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-[#2A0E3D]/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
            <ListeLivres
              livreActuel={livre}
              chapitreActuel={chapitre}
              onSelectLivre={changeLivre}
              onSelectChapitre={changeChapitre}
            />
          </div>
        </div>
      </aside>

      {/* COLONNE CENTRALE — Versets */}
      <div className="min-w-0">
        {/* Barre du haut : sélecteurs + nav */}
        <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-3 mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded hover:bg-[#2A0E3D]/5"
            title="Afficher les livres"
          >
            <Menu className="w-4 h-4 text-[#2A0E3D]" />
          </button>

          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm font-semibold focus:outline-none focus:border-[#C9A227]"
          >
            {VERSIONS.map((v) => (
              <option key={v.code} value={v.code}>{v.label}</option>
            ))}
          </select>

          <div className="h-5 w-px bg-[#8A8378]/20" />

          <span className="font-serif text-sm font-bold text-[#1E0F2B]">
            {livreOption.nom} {chapitre}
          </span>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => chapitre > 1 ? changeChapitre(chapitre - 1) : livrePrecedent()}
              className="p-1.5 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D] disabled:opacity-30"
              disabled={chapitre <= 1 && LIVRES_OPTIONS.findIndex((l) => l.id === livre) === 0}
              title="Chapitre précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={chapitre}
              onChange={(e) => changeChapitre(parseInt(e.target.value))}
              className="px-2 py-1 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm font-semibold focus:outline-none focus:border-[#C9A227]"
            >
              {Array.from({ length: livreOption.chapitres }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => chapitre < livreOption.chapitres ? changeChapitre(chapitre + 1) : livreSuivant()}
              className="p-1.5 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D] disabled:opacity-30"
              disabled={chapitre >= livreOption.chapitres && LIVRES_OPTIONS.findIndex((l) => l.id === livre) === LIVRES_OPTIONS.length - 1}
              title="Chapitre suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-[#8A8378]/20" />

          {/* Taille du texte */}
          <div className="flex items-center gap-1">
            <Type className="w-3.5 h-3.5 text-[#8A8378]" />
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              className="px-1.5 py-0.5 text-xs rounded hover:bg-[#2A0E3D]/5 font-bold"
              title="Réduire"
            >A-</button>
            <button
              onClick={() => setFontSize((s) => Math.min(22, s + 1))}
              className="px-1.5 py-0.5 text-sm rounded hover:bg-[#2A0E3D]/5 font-bold"
              title="Agrandir"
            >A+</button>
          </div>

          {/* Version parallèle */}
          <select
            value={parallelVersion || ""}
            onChange={(e) => setParallelVersion(e.target.value || null)}
            className="px-2 py-1.5 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-xs font-semibold focus:outline-none focus:border-[#C9A227]"
            title="Afficher une version parallèle"
          >
            <option value="">Parallèle : —</option>
            {VERSIONS.filter((v) => v.code !== version).map((v) => (
              <option key={v.code} value={v.code}>{v.shortLabel}</option>
            ))}
          </select>
        </div>

        {/* Contenu du chapitre */}
        {loading ? (
          <div className="flex items-center justify-center py-32 bg-white rounded-lg border border-[#8A8378]/15">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
          </div>
        ) : data ? (
          <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 overflow-hidden">
            {/* Titre du chapitre */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#2A0E3D]/5 to-transparent border-b border-[#8A8378]/15">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="font-serif text-2xl font-bold text-[#1E0F2B]">
                  {data.livre} {data.chapitre}
                </h2>
                <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-semibold">
                  {data.version} · {data.nombreVersets} versets
                </span>
              </div>
            </div>

            {/* Versets */}
            <div className="px-6 py-5">
              {data.versets.length === 0 ? (
                <p className="text-[#8A8378] italic text-center py-12">
                  Chapitre non disponible dans les versets de secours.
                </p>
              ) : (
                <div className="space-y-2" style={{ fontSize: `${fontSize}px` }}>
                  {data.versets.map((v) => {
                    const isSelected = versetSelectionne === v.numero;
                    const parallelVerset = parallelData?.versets.find((pv) => pv.numero === v.numero);
                    return (
                      <div
                        key={v.numero}
                        className={cn(
                          "group relative rounded-md transition-all px-3 py-1.5 -mx-3",
                          isSelected
                            ? "bg-[#C9A227]/10 ring-1 ring-[#C9A227]/30"
                            : "hover:bg-[#2A0E3D]/3"
                        )}
                      >
                        {/* Numéro de verset — cliquable */}
                        <button
                          onClick={() => setVersetSelectionne(isSelected ? null : v.numero)}
                          className="inline-flex items-center justify-center w-6 h-6 mr-1.5 align-top mt-1 rounded text-[10px] font-bold transition-colors flex-shrink-0"
                          style={{
                            backgroundColor: isSelected ? GOLD : "transparent",
                            color: isSelected ? IVORY : STONE,
                            border: `1px solid ${isSelected ? GOLD : `${STONE}30`}`,
                          }}
                          title={`Verset ${v.numero} — cliquer pour les références croisées`}
                        >
                          {v.numero}
                        </button>

                        {/* Texte du verset */}
                        <span className="font-serif leading-relaxed text-[#1E0F2B]" style={{ fontSize: `${fontSize}px` }}>
                          {v.texte}
                        </span>

                        {/* Actions au survol */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/90 backdrop-blur-sm rounded px-1 py-0.5 shadow-sm">
                          <button
                            onClick={() => navigator.clipboard?.writeText(`${data.livre} ${data.chapitre}:${v.numero} — ${v.texte}`)}
                            className="p-1 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#2A0E3D]"
                            title="Copier"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#2A0E3D]"
                            title="Partager"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-[#C9A227]/10 text-[#8A8378] hover:text-[#2A0E3D]"
                            title="Imprimer"
                          >
                            <Printer className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Verset parallèle (si activé) */}
                        {parallelVerset && (
                          <div className="mt-1.5 ml-7 pl-3 border-l-2 border-[#C9A227]/40 text-[#1E0F2B]/70 italic" style={{ fontSize: `${fontSize - 2}px` }}>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#C9A227] mr-2">
                              {VERSIONS.find((v) => v.code === parallelVersion)?.shortLabel}
                            </span>
                            {parallelVerset.texte}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation bas de page */}
            <div className="px-6 py-4 border-t border-[#8A8378]/15 flex items-center justify-between bg-[#FAF6EF]/50">
              <button
                onClick={() => chapitre > 1 ? changeChapitre(chapitre - 1) : livrePrecedent()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-[#2A0E3D] hover:bg-[#2A0E3D]/5 disabled:opacity-30"
                disabled={chapitre <= 1 && LIVRES_OPTIONS.findIndex((l) => l.id === livre) === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
              <span className="text-xs text-[#8A8378] font-semibold">
                {data.livre} {data.chapitre} · {data.nombreVersets} versets
              </span>
              <button
                onClick={() => chapitre < livreOption.chapitres ? changeChapitre(chapitre + 1) : livreSuivant()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-[#2A0E3D] hover:bg-[#2A0E3D]/5 disabled:opacity-30"
                disabled={chapitre >= livreOption.chapitres && LIVRES_OPTIONS.findIndex((l) => l.id === livre) === LIVRES_OPTIONS.length - 1}
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#8A8378]/15 py-32 text-center">
            <p className="text-[#8A8378] italic">Chargement...</p>
          </div>
        )}
      </div>

      {/* SIDEBAR DROITE — Références croisées */}
      <aside className="hidden lg:block">
        <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 overflow-hidden sticky top-32">
          <div className="px-4 py-3 bg-[#2A0E3D]/5 border-b border-[#8A8378]/15">
            <h3 className="font-serif text-sm font-bold text-[#1E0F2B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9A227]" />
              Étude du verset
            </h3>
          </div>
          <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
            {versetSelectionne ? (
              <VersetEtude
                livre={data?.livre || ""}
                livreId={livre}
                chapitre={chapitre}
                verset={versetSelectionne}
                texte={data?.versets.find((v) => v.numero === versetSelectionne)?.texte || ""}
                version={version}
              />
            ) : (
              <div className="text-center py-8">
                <Hash className="w-8 h-8 text-[#8A8378]/30 mx-auto mb-3" />
                <p className="text-sm text-[#8A8378]">
                  Cliquez sur un numéro de verset pour afficher les références croisées, les mots Strong, et les versions parallèles.
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ============================================================
// LISTE DES LIVRES (sidebar gauche)
// ============================================================
interface ListeLivresProps {
  livreActuel: string;
  chapitreActuel: number;
  onSelectLivre: (id: string) => void;
  onSelectChapitre: (c: number) => void;
}

function ListeLivres({ livreActuel, chapitreActuel, onSelectLivre, onSelectChapitre }: ListeLivresProps) {
  const [sectionOuverte, setSectionOuverte] = useState<"AT" | "NT" | null>(
    LIVRES_OPTIONS.find((l) => l.id === livreActuel)?.categorie || "AT"
  );

  return (
    <div className="py-1">
      {/* AT */}
      <button
        onClick={() => setSectionOuverte(sectionOuverte === "AT" ? null : "AT")}
        className="w-full flex items-center justify-between px-4 py-2 text-xs uppercase tracking-[0.18em] font-bold text-[#8A8378] hover:bg-[#2A0E3D]/3"
      >
        <span>Ancien Testament</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOuverte === "AT" && "rotate-180")} />
      </button>
      {sectionOuverte === "AT" && (
        <div className="pb-2">
          {LIVRES_OPTIONS.filter((l) => l.categorie === "AT").map((l) => (
            <LivreItem
              key={l.id}
              livre={l}
              estActif={l.id === livreActuel}
              chapitreActuel={l.id === livreActuel ? chapitreActuel : null}
              onSelectLivre={() => onSelectLivre(l.id)}
              onSelectChapitre={onSelectChapitre}
            />
          ))}
        </div>
      )}

      {/* NT */}
      <button
        onClick={() => setSectionOuverte(sectionOuverte === "NT" ? null : "NT")}
        className="w-full flex items-center justify-between px-4 py-2 text-xs uppercase tracking-[0.18em] font-bold text-[#8A8378] hover:bg-[#2A0E3D]/3"
      >
        <span>Nouveau Testament</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOuverte === "NT" && "rotate-180")} />
      </button>
      {sectionOuverte === "NT" && (
        <div className="pb-2">
          {LIVRES_OPTIONS.filter((l) => l.categorie === "NT").map((l) => (
            <LivreItem
              key={l.id}
              livre={l}
              estActif={l.id === livreActuel}
              chapitreActuel={l.id === livreActuel ? chapitreActuel : null}
              onSelectLivre={() => onSelectLivre(l.id)}
              onSelectChapitre={onSelectChapitre}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LivreItemProps {
  livre: LivreOption;
  estActif: boolean;
  chapitreActuel: number | null;
  onSelectLivre: () => void;
  onSelectChapitre: (c: number) => void;
}

function LivreItem({ livre, estActif, chapitreActuel, onSelectLivre, onSelectChapitre }: LivreItemProps) {
  const [expanded, setExpanded] = useState(estActif);

  useEffect(() => {
    if (estActif) setExpanded(true);
  }, [estActif]);

  return (
    <div>
      <button
        onClick={() => {
          if (estActif) {
            setExpanded(!expanded);
          } else {
            onSelectLivre();
            setExpanded(true);
          }
        }}
        className={cn(
          "w-full flex items-center justify-between px-4 py-1.5 text-sm transition-colors",
          estActif
            ? "bg-[#C9A227]/10 text-[#2A0E3D] font-bold border-l-2 border-[#C9A227]"
            : "text-[#1E0F2B] hover:bg-[#2A0E3D]/3 border-l-2 border-transparent"
        )}
      >
        <span>{livre.nom}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#8A8378] font-normal">{livre.chapitres}</span>
          <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
        </div>
      </button>
      {expanded && (
        <div className="grid grid-cols-10 gap-0.5 px-3 py-2 bg-[#FAF6EF]/50">
          {Array.from({ length: livre.chapitres }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={() => onSelectChapitre(c)}
              className={cn(
                "aspect-square text-[10px] font-semibold rounded transition-colors",
                c === chapitreActuel
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "text-[#1E0F2B] hover:bg-[#C9A227]/15"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ÉTUDE D'UN VERSET (sidebar droite)
// ============================================================
interface VersetEtudeProps {
  livre: string;
  livreId: string;
  chapitre: number;
  verset: number;
  texte: string;
  version: string;
}

function VersetEtude({ livre, livreId, chapitre, verset, texte, version }: VersetEtudeProps) {
  const [paralleles, setParalleles] = useState<Array<{ code: string; label: string; texte: string | null; loading: boolean }>>([]);

  useEffect(() => {
    const autres = VERSIONS.filter((v) => v.code !== version);
    setParalleles(autres.map((v) => ({ code: v.code, label: v.shortLabel, texte: null, loading: true })));

    Promise.all(
      autres.map(async (v) => {
        try {
          const res = await fetch(`/api/bible-v2/${v.code}/${livreId}/${chapitre}`);
          if (res.ok) {
            const data = await res.json();
            const versetData = data.versets?.find((vv: VersetData) => vv.numero === verset);
            return { code: v.code, label: v.shortLabel, texte: versetData?.texte || null, loading: false };
          }
        } catch {}
        return { code: v.code, label: v.shortLabel, texte: null, loading: false };
      })
    ).then(setParalleles);
  }, [version, livreId, chapitre, verset]);

  return (
    <div className="space-y-4">
      {/* Verset sélectionné */}
      <div className="p-3 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A227] mb-1.5">
          {livre} {chapitre}:{verset}
        </p>
        <p className="font-serif text-sm text-[#1E0F2B] leading-relaxed italic">
          « {texte} »
        </p>
      </div>

      {/* Versions parallèles */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#8A8378] mb-2 flex items-center gap-1.5">
          <Columns className="w-3 h-3" />
          Versions parallèles
        </p>
        <div className="space-y-2">
          {paralleles.map((p) => (
            <div key={p.code} className="p-2 rounded border border-[#8A8378]/15 text-xs">
              <p className="text-[10px] font-bold text-[#C9A227] mb-1">{p.label}</p>
              {p.loading ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#8A8378]" />
              ) : p.texte ? (
                <p className="text-[#1E0F2B] font-serif italic">{p.texte}</p>
              ) : (
                <p className="text-[#8A8378] italic">Non disponible</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Références croisées (statiques pour démonstration) */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#8A8378] mb-2 flex items-center gap-1.5">
          <Share2 className="w-3 h-3" />
          Références croisées
        </p>
        <div className="space-y-1.5 text-xs">
          <a href="#" className="block px-2 py-1 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D] font-serif">
            → Voir les passages parallèles
          </a>
          <a href="#" className="block px-2 py-1 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D] font-serif">
            → Treasury of Scripture Knowledge
          </a>
          <a href="#" className="block px-2 py-1 rounded hover:bg-[#C9A227]/10 text-[#2A0E3D] font-serif">
            → Commentaires bibliques
          </a>
        </div>
      </div>
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
      const res = await fetch(`/api/bible-v2/search?version=${version}&q=${encodeURIComponent(query)}`);
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-[#C9A227]" />
          Recherche dans la Bible
        </h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm font-semibold focus:outline-none focus:border-[#C9A227]"
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
            className="flex-1 min-w-[200px] px-4 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2 rounded-md bg-[#C9A227] text-[#2A0E3D] text-sm font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] transition-colors"
          >
            Rechercher
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-[#8A8378]/15">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      )}

      {aRecherche && !loading && (
        <div>
          <p className="text-xs text-[#8A8378] mb-3 px-1">
            <span className="font-bold text-[#1E0F2B]">{resultats.length}</span> résultat{resultats.length > 1 ? "s" : ""} pour « <span className="font-serif italic text-[#2A0E3D]">{query}</span> » dans {VERSIONS.find((v) => v.code === version)?.label}
          </p>
          <div className="space-y-2">
            {resultats.map((r, i) => (
              <div key={i} className="bg-white rounded-md border border-[#8A8378]/15 p-4 hover:border-[#C9A227]/40 transition-colors">
                <p className="text-xs font-bold text-[#C9A227] mb-1.5 font-mono">
                  {r.livre} {r.chapitre}:{r.verset}
                </p>
                <p className="text-sm text-[#1E0F2B] font-serif leading-relaxed">
                  {r.texte}
                </p>
              </div>
            ))}
            {resultats.length === 0 && (
              <div className="bg-white rounded-md border border-[#8A8378]/15 p-12 text-center">
                <p className="text-[#8A8378] italic">Aucun résultat.</p>
              </div>
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
      const res = await fetch(`/api/bible-v2/strong/${encodeURIComponent(numero)}`);
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Hash className="w-5 h-5 text-[#C9A227]" />
          Lexique Strong
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Numéro Strong (ex: H1, H1961, G2424, G3056)"
            className="flex-1 px-4 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2 rounded-md bg-[#C9A227] text-[#2A0E3D] text-sm font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] transition-colors"
          >
            Chercher
          </button>
        </div>
        <div className="mt-4 p-3 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
          <p className="text-xs text-[#8A8378] leading-relaxed">
            <strong className="text-[#1E0F2B]">Dictionnaire Strong</strong> — 8 674 entrées hébraïques (H1-H8674) et 5 523 entrées grecques (G1-G5523).
            Tapez un numéro avec préfixe H (hébreu) ou G (grec).
            Exemples : <span className="font-mono text-[#C9A227]">H1</span> (père), <span className="font-mono text-[#C9A227]">H1961</span> (marcher), <span className="font-mono text-[#C9A227]">G2424</span> (Jésus), <span className="font-mono text-[#C9A227]">G3056</span> (parole).
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-[#8A8378]/15">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      )}

      {result && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className={cn(
              "inline-flex items-center px-3 py-1 rounded text-sm font-bold",
              (result.langue as string) === "hebrew" ? "bg-[#C9A227]/15 text-[#9C7E1E]" : "bg-[#7C5CB8]/15 text-[#7C5CB8]"
            )}>
              {result.numero as string}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-[#8A8378] font-bold">
              {(result.langue as string) === "hebrew" ? "Hébreu" : "Grec"}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              {Boolean(result.lemma) && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-1">Lemme</p>
                  <p className="font-serif text-3xl text-[#1E0F2B]" dir="rtl">{result.lemma as string}</p>
                </div>
              )}
              {Boolean(result.pron) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-1">Prononciation</p>
                  <p className="text-sm text-[#1E0F2B]">{result.pron as string}</p>
                </div>
              )}
              {Boolean(result.translit) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-1">Translittération</p>
                  <p className="text-sm text-[#1E0F2B] italic">{result.translit as string}</p>
                </div>
              )}
            </div>
            <div>
              {Boolean(result.derivation) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-1">Étymologie</p>
                  <p className="text-sm text-[#1E0F2B]/80">{result.derivation as string}</p>
                </div>
              )}
              {Boolean(result.strongs_def) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-1">Définition Strong</p>
                  <p className="text-sm text-[#1E0F2B]/80 leading-relaxed">{result.strongs_def as string}</p>
                </div>
              )}
              {Boolean(result.kjv_def) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mb-1">Traductions KJV</p>
                  <p className="text-sm text-[#1E0F2B]/70 italic">{result.kjv_def as string}</p>
                </div>
              )}
            </div>
          </div>
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
      const res = await fetch(`/api/bible-v2/hebrew/${livre}/${chapitre}/${verset}`);
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Scroll className="w-5 h-5 text-[#C9A227]" />
          Texte hébraïque morphologique
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={livre}
            onChange={(e) => setLivre(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm font-semibold focus:outline-none focus:border-[#C9A227]"
          >
            {LIVRES_OSHB.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input
            type="number"
            min={1}
            value={chapitre}
            onChange={(e) => setChapitre(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
          />
          <span className="text-[#8A8378]">:</span>
          <input
            type="number"
            min={1}
            value={verset}
            onChange={(e) => setVerset(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
          />
        </div>
        <div className="mt-4 p-3 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
          <p className="text-xs text-[#8A8378] leading-relaxed">
            <strong className="text-[#1E0F2B]">Open Scriptures Hebrew Bible</strong> — Texte massorétique (Westminster Leningrad Codex)
            avec analyse morphologique complète. Chaque mot affiche son lemme (numéro Strong) et sa forme grammaticale.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-[#8A8378]/15">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6">
          <h3 className="font-serif text-lg font-bold text-[#1E0F2B] mb-4">
            {livre} {chapitre}:{verset}
          </h3>
          <div className="space-y-1" dir="rtl">
            {data.mots.map((mot, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-[#C9A227]/5 transition-colors">
                <span className="font-serif text-xl text-[#1E0F2B]">{mot.mot}</span>
                <div className="flex-1 text-left" dir="ltr">
                  <span className="text-xs font-mono text-[#9C7E1E] font-bold">{mot.lemme}</span>
                  <span className="text-xs text-[#8A8378] ml-2">{mot.morphologie}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#8A8378]/15 py-12 text-center">
          <p className="text-[#8A8378] italic">Verset non trouvé.</p>
        </div>
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
      const res = await fetch(`/api/bible-v2/peshitta/${livre}/${chapitre}`);
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Languages className="w-5 h-5 text-[#C9A227]" />
          Peshitta araméenne
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={livre}
            onChange={(e) => setLivre(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
            placeholder="Nom du livre (ex: Genesis)"
          />
          <input
            type="number"
            min={1}
            value={chapitre}
            onChange={(e) => setChapitre(parseInt(e.target.value) || 1)}
            className="w-24 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
          />
        </div>
        <div className="mt-4 p-3 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
          <p className="text-xs text-[#8A8378] leading-relaxed">
            <strong className="text-[#1E0F2B]">Peshitta</strong> — Bible araméenne (syriaque). Langue parlée par Yeshoua et ses disciples.
            Texte de la Peshitta avec lexique SEDRA. La Peshitta est la Bible des églises de tradition syriaque depuis le Ve siècle.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-[#8A8378]/15">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6">
          <h3 className="font-serif text-lg font-bold text-[#1E0F2B] mb-4">
            {livre} — Chapter {chapitre}
          </h3>
          <div className="space-y-2">
            {data.versets.map((v) => (
              <div key={v.numero} className="flex gap-3">
                <span className="text-xs text-[#9C7E1E] font-bold w-8 text-right pt-0.5 flex-shrink-0">{v.numero}</span>
                <p className="text-sm text-[#1E0F2B] font-serif leading-relaxed" dir="rtl">{v.texte}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#8A8378]/15 py-12 text-center">
          <p className="text-[#8A8378] italic">Chapitre non trouvé.</p>
        </div>
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
      const res = await fetch(`/api/bible-v2/concordance/${encodeURIComponent(numero)}?limite=30`);
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#C9A227]" />
          Concordance Strong
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Numéro Strong (ex: H1961, H7225, H3068)"
            className="flex-1 px-4 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2 rounded-md bg-[#C9A227] text-[#2A0E3D] text-sm font-bold hover:bg-[#9C7E1E] hover:text-[#FAF6EF] transition-colors"
          >
            Chercher
          </button>
        </div>
        <div className="mt-4 p-3 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
          <p className="text-xs text-[#8A8378] leading-relaxed">
            <strong className="text-[#1E0F2B]">Concordance Strong</strong> — Trouve tous les versets de la Bible hébraïque
            où apparaît un mot identifié par son numéro Strong. Outil d'étude biblique approfondi.
            Exemples : <span className="font-mono text-[#C9A227]">H1961</span> (marcher), <span className="font-mono text-[#C9A227]">H7225</span> (commencement), <span className="font-mono text-[#C9A227]">H3068</span> (YHWH).
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-[#8A8378]/15">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          {data.strong && (
            <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#C9A227]/15 text-[#9C7E1E]">{data.strong.numero as string}</span>
                {Boolean(data.strong.lemma) && <span className="font-serif text-lg text-[#1E0F2B]" dir="rtl">{data.strong.lemma as string}</span>}
              </div>
              {Boolean(data.strong.strongs_def) && <p className="text-sm text-[#1E0F2B]/70">{data.strong.strongs_def as string}</p>}
            </div>
          )}

          <p className="text-xs text-[#8A8378] px-1">
            <span className="font-bold text-[#1E0F2B]">{data.versets.length}</span> verset(s) trouvé(s)
          </p>

          <div className="space-y-2">
            {data.versets.map((v, i) => (
              <div key={i} className="bg-white rounded-md border border-[#8A8378]/15 p-3">
                <p className="text-xs font-bold text-[#9C7E1E] mb-1 font-mono">
                  {v.livre} {v.chapitre}:{v.verset}
                </p>
                <div className="flex flex-wrap gap-1" dir="rtl">
                  {v.mots.map((m, j) => (
                    <span
                      key={j}
                      className={cn(
                        "font-serif text-sm",
                        m.lemme.includes(numero.replace("H", "")) ? "text-[#9C7E1E] font-bold" : "text-[#1E0F2B]/60"
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
          const res = await fetch(`/api/bible-v2/${version}/${livre}/${chapitre}`);
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

  const livreOption = LIVRES_OPTIONS.find((l) => l.id === livre)!;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-6 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#1E0F2B] mb-4 flex items-center gap-2">
          <Columns className="w-5 h-5 text-[#C9A227]" />
          Étude comparative multilingue
        </h2>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={livre}
            onChange={(e) => setLivre(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm font-semibold focus:outline-none focus:border-[#C9A227]"
          >
            {LIVRES_OPTIONS.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
          </select>
          <input
            type="number"
            min={1}
            value={chapitre}
            onChange={(e) => setChapitre(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
          />
          <span className="text-[#8A8378]">:</span>
          <input
            type="number"
            min={1}
            value={verset}
            onChange={(e) => setVerset(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 rounded-md border border-[#8A8378]/30 bg-white text-[#1E0F2B] text-sm focus:outline-none focus:border-[#C9A227]"
          />
          <span className="ml-auto text-xs text-[#8A8378]">
            {livreOption.nom} {chapitre}:{verset}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8A8378] font-bold mr-2">Versions :</span>
          {VERSIONS.map((v) => (
            <button
              key={v.code}
              onClick={() => toggleVersion(v.code)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-bold transition-all",
                versionsSelectionnees.includes(v.code)
                  ? "bg-[#2A0E3D] text-[#FAF6EF]"
                  : "border border-[#2A0E3D]/30 text-[#2A0E3D] hover:bg-[#2A0E3D]/5"
              )}
            >
              {v.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border border-[#8A8378]/15">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" />
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(versionsSelectionnees.length, 3)}, minmax(0, 1fr))` }}>
          {versionsSelectionnees.map((version) => {
            const v = VERSIONS.find((ver) => ver.code === version);
            const data = traductions[version];
            return (
              <div key={version} className="bg-white rounded-lg shadow-sm border border-[#8A8378]/15 p-5">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#8A8378]/15">
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-[#C9A227]/15 text-[#9C7E1E]">
                    {v?.shortLabel}
                  </span>
                  <span className="text-xs text-[#8A8378]">{v?.lang}</span>
                </div>
                {data ? (
                  <>
                    <p className="text-[10px] text-[#8A8378] mb-2 font-mono">{data.livre} {chapitre}:{verset}</p>
                    <p className="text-sm text-[#1E0F2B] font-serif leading-relaxed italic">
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

      <div className="mt-6 p-4 rounded-md bg-[#2A0E3D]/5 border border-[#C9A227]/20">
        <p className="text-xs text-[#8A8378] leading-relaxed">
          <strong className="text-[#1E0F2B]">Étude comparative</strong> — Lisez le même verset dans plusieurs langues côte à côte.
          Sélectionnez jusqu&apos;à 6 versions. Idéal pour les dispersés d&apos;Israël qui parlent différentes langues
          et pour l&apos;étude comparative des traductions.
        </p>
      </div>
    </div>
  );
}
