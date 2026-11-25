"use client";

/**
 * Client — /bibliotheque
 * ⭐ V4.41 — Refonte complète : design premium + animations framer-motion.
 * En-tête animé (orbes ambiants, compteurs), grille avec entrées en cascade,
 * cartes 3D (survol, reflet, overlay « Lire »), pastilles de filtre animées
 * (layoutId) et lecteur PDF en modale avec ressort d'entrée.
 * ⭐ V4.42 — Scission stricte en espaces distincts : sélecteur « Pasteur
 * Kongo / Afrika » (+ Collectif si des ouvrages sans serviteur existent),
 * filtrage par servantCode, identité visuelle propre à chaque espace
 * (or pour Kongo, violet pour Afrika), statistiques calculées par espace.
 * Bibliothèque documentaire publique avec filtres + lecteur PDF intégré.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useInView,
  animate,
  type Variants,
} from "framer-motion";
import {
  BookOpen,
  Download,
  Search,
  X,
  Filter,
  User,
  Eye,
  Layers,
  FileText,
  Calendar,
  Languages,
  Building2,
  Hash,
  type LucideIcon,
} from "lucide-react";

interface BookLite {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  coverUrl: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  pageCount: number | null;
  language: string;
  publishedYear: number | null;
  isbn: string | null;
  editeur: string | null;
  tags: string | null;
  isDownloadable: boolean;
  downloadCount: number;
  servantCode: string | null;
  servantShortName: string | null;
}

interface Props {
  books: BookLite[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Enseignements: "from-blue-600 to-indigo-800",
  Prières: "from-amber-600 to-orange-800",
  Révélations: "from-purple-600 to-violet-800",
  Délivrance: "from-red-600 to-rose-800",
  "Vie Chrétienne": "from-green-600 to-emerald-800",
  Prophéties: "from-cyan-600 to-blue-800",
  Jeunesse: "from-pink-600 to-fuchsia-800",
  Autres: "from-gray-600 to-slate-800",
};

/** ⭐ V4.40 — Taille lisible en français (ex. « 2,4 Mo »). */
function formatTaille(octets: number | null | undefined): string {
  if (octets == null || octets <= 0) return "";
  if (octets < 1024) return `${octets} o`;
  const ko = octets / 1024;
  if (ko < 1024) return `${ko.toFixed(ko < 10 ? 1 : 0).replace(".", ",")} Ko`;
  const mo = ko / 1024;
  return `${mo.toFixed(mo < 10 ? 1 : 0).replace(".", ",")} Mo`;
}

/* ── ⭐ V4.42 — Espaces distincts (scission stricte par serviteur) ──── */

type EspaceCode = "kongo" | "afrika" | "collectif";

interface EspaceDef {
  code: EspaceCode;
  nom: string;
  sousTitre: string;
  initiales: string;
  accent: string;
  accentClair: string;
}

/**
 * Chaque espace a sa propre identité visuelle. « Collectif » n'est affiché
 * que si des ouvrages sans serviteur existent : un livre appartient à UN
 * seul espace, jamais plusieurs.
 */
const ESPACES: EspaceDef[] = [
  {
    code: "kongo",
    nom: "Pasteur Kongo",
    sousTitre: "Époux, ministre pastoral",
    initiales: "PK",
    accent: "#C9A227",
    accentClair: "#E8D48B",
  },
  {
    code: "afrika",
    nom: "Afrika Pamela DALI",
    sousTitre: "Servante de l'Éternel",
    initiales: "AP",
    accent: "#B87AEB",
    accentClair: "#D9B8FA",
  },
  {
    code: "collectif",
    nom: "Collectif",
    sousTitre: "Ouvrages du ministère",
    initiales: "MC",
    accent: "#8FA3C8",
    accentClair: "#B8C8E0",
  },
];

/** ⭐ V4.42 — Rattachement strict d'un livre à un espace (servantCode). */
function appartientAEspace(livre: BookLite, code: EspaceCode): boolean {
  const codeLivre = (livre.servantCode || "").toLowerCase();
  if (code === "collectif") return !codeLivre;
  return codeLivre === code;
}

/** Carte d'espace : état actif partagé via layoutId (glissement du halo). */
function CarteEspace({
  espace,
  actif,
  nbOuvrages,
  onChoisir,
}: {
  espace: EspaceDef;
  actif: boolean;
  nbOuvrages: number;
  onChoisir: () => void;
}) {
  return (
    <motion.button
      onClick={onChoisir}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`relative text-left rounded-2xl p-5 border transition-colors duration-300 ${
        actif
          ? "bg-white/[0.08]"
          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
      }`}
      style={
        actif
          ? {
              borderColor: `${espace.accent}99`,
              boxShadow: `0 12px 40px -12px ${espace.accent}55`,
            }
          : undefined
      }
      aria-pressed={actif}
    >
      {actif && (
        <motion.span
          layoutId="espace-active"
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${espace.accent}1F, transparent 65%)`,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-4 min-w-0">
        <span
          className="w-12 h-12 rounded-full flex items-center justify-center font-serif font-bold text-sm flex-shrink-0"
          style={{
            background: `${espace.accent}1A`,
            border: `1.5px solid ${espace.accent}66`,
            color: espace.accentClair,
          }}
        >
          {espace.initiales}
        </span>
        <div className="min-w-0">
          <p
            className="font-serif font-bold text-base md:text-lg leading-tight truncate"
            style={{ color: actif ? espace.accentClair : "#FAF6EF" }}
          >
            {espace.nom}
          </p>
          <p className="text-xs text-[#FAF6EF]/50 mt-0.5 truncate">
            {espace.sousTitre}
          </p>
          <p
            className="text-[11px] uppercase tracking-wider mt-1"
            style={{ color: `${espace.accent}CC` }}
          >
            {nbOuvrages} ouvrage{nbOuvrages > 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

/* ── Variantes d'animation ─────────────────────────────────────────── */

const vHero: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const vHeroItem: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const vGrille: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const vCarte: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

const vFiltres: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const vFiltre: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

/* ── Compteur animé (statistiques d'en-tête) ───────────────────────── */

function Compteur({ valeur, suffixe = "" }: { valeur: number; suffixe?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVue = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!enVue || !ref.current) return;
    const controles = animate(0, valeur, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = `${Math.round(v)}${suffixe}`;
      },
    });
    return () => controles.stop();
  }, [enVue, valeur, suffixe]);

  return <span ref={ref}>0{suffixe}</span>;
}

/* ── Orbes ambiants animés derrière l'en-tête ──────────────────────── */

function OrbesAmbiants() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Halo doré au-dessus du titre */}
      <div
        className="absolute inset-x-0 top-0 h-[440px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% -10%, rgba(201,162,39,0.16), transparent 70%)",
        }}
      />
      <motion.div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#6D28D9]/25 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-44 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#C9A227]/10 blur-3xl"
        animate={{ y: [0, -24, 0], x: [0, -16, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-44 left-1/4 w-72 h-72 rounded-full bg-[#7C3AED]/20 blur-3xl"
        animate={{ y: [0, 18, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}

/* ── Composant principal ───────────────────────────────────────────── */

export function BibliotequeClient({ books }: Props) {
  // ⭐ V4.42 — espace actif : un seul espace visible à la fois, jamais un mélange.
  const [espaceActif, setEspaceActif] = useState<EspaceCode>("kongo");
  const [categorieSelectionnee, setCategorieSelectionnee] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [livreOuvert, setLivreOuvert] = useState<BookLite | null>(null);
  const [lecteurCharge, setLecteurCharge] = useState(false);

  // Ouvrages de l'espace actif uniquement (rattachement par servantCode)
  const livresEspace = useMemo(
    () => books.filter((b) => appartientAEspace(b, espaceActif)),
    [books, espaceActif]
  );

  // Répartition des ouvrages par espace (pour les compteurs des cartes)
  const nbParEspace = useMemo(() => {
    const compte: Record<EspaceCode, number> = { kongo: 0, afrika: 0, collectif: 0 };
    for (const b of books) {
      const code = (b.servantCode || "").toLowerCase();
      if (code === "kongo") compte.kongo += 1;
      else if (code === "afrika") compte.afrika += 1;
      else compte.collectif += 1;
    }
    return compte;
  }, [books]);

  // ⭐ V4.42 — l'espace « Collectif » n'apparaît que s'il contient des ouvrages.
  const espacesVisibles = ESPACES.filter(
    (e) => e.code !== "collectif" || nbParEspace.collectif > 0
  );
  const espaceCourant =
    ESPACES.find((e) => e.code === espaceActif) ?? ESPACES[0];

  // Catégories présentes dans l'espace actif uniquement
  const categoriesEspace = useMemo(() => {
    const ensemble = new Set<string>();
    livresEspace.forEach((b) => b.category && ensemble.add(b.category));
    return Array.from(ensemble);
  }, [livresEspace]);

  const livresFiltres = useMemo(() => {
    return livresEspace.filter((b) => {
      if (categorieSelectionnee && b.category !== categorieSelectionnee) return false;
      if (recherche) {
        const q = recherche.toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          // ⭐ V4.40 — les mots-clés entrent aussi dans la recherche.
          (b.tags || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [livresEspace, categorieSelectionnee, recherche]);

  // Statistiques animées de l'en-tête — calculées sur l'espace actif
  const nbTelechargements = useMemo(
    () => livresEspace.reduce((total, b) => total + (b.downloadCount || 0), 0),
    [livresEspace]
  );

  const choisirEspace = (code: EspaceCode) => {
    if (code === espaceActif) return;
    setEspaceActif(code);
    // Les catégories d'un espace n'ont pas de sens dans l'autre
    setCategorieSelectionnee(null);
  };

  // Modale : fermeture avec Échap + verrouillage du défilement du corps
  useEffect(() => {
    if (!livreOuvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLivreOuvert(null);
    };
    window.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
  }, [livreOuvert]);

  // Réinitialise l'état de chargement du lecteur à chaque ouverture
  useEffect(() => {
    if (livreOuvert) setLecteurCharge(false);
  }, [livreOuvert]);

  const filtreActif = Boolean(categorieSelectionnee || recherche);
  const reinitialiser = () => {
    setCategorieSelectionnee(null);
    setRecherche("");
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-gradient-to-b from-[#1A0826] via-[#2A0E3D] to-[#1A0826] text-[#FAF6EF]">
        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-20">
          <OrbesAmbiants />

          {/* ── En-tête animé ── */}
          <motion.header
            variants={vHero}
            initial="hidden"
            animate="visible"
            className="relative text-center mb-12 md:mb-16"
          >
            <motion.div variants={vHeroItem} className="mb-5 inline-block">
              <motion.div
                className="relative w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-[#C9A227]/10 border border-[#C9A227]/30"
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 16 }}
              >
                {/* Anneaux pulsants autour de l'icône */}
                <motion.span
                  className="absolute inset-0 rounded-full border border-[#C9A227]/40"
                  animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.span
                  className="absolute inset-0 rounded-full border border-[#C9A227]/30"
                  animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 1.2 }}
                />
                <BookOpen className="w-9 h-9 text-[#C9A227]" />
              </motion.div>
            </motion.div>

            <motion.h1
              variants={vHeroItem}
              className="font-serif text-4xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-[#C9A227] via-[#E8D48B] to-[#C9A227] bg-clip-text text-transparent"
            >
              Bibliothèque
            </motion.h1>

            {/* Trait doré qui se dessine sous le titre */}
            <motion.div variants={vHeroItem}>
              <motion.div
                className="w-40 h-0.5 mx-auto mb-5 rounded-full bg-gradient-to-r from-transparent via-[#C9A227] to-transparent origin-center"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
              />
            </motion.div>

            <motion.p
              variants={vHeroItem}
              className="text-[#FAF6EF]/60 max-w-2xl mx-auto text-base md:text-lg"
            >
              Deux espaces bien distincts : les ouvrages du pasteur Kongo et
              ceux d'Afrika Pamela DALI.
            </motion.p>

            {/* Statistiques avec compteurs — calculées sur l'espace actif */}
            <motion.div
              variants={vHeroItem}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
            >
              {[
                { valeur: livresEspace.length, label: "ouvrages", icone: BookOpen },
                { valeur: categoriesEspace.length, label: "catégories", icone: Layers },
                { valeur: nbTelechargements, label: "téléchargements", icone: Download },
              ].map(({ valeur, label, icone: Icone }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icone className="w-4 h-4 text-[#C9A227]/70" />
                  <span className="font-serif text-2xl md:text-3xl font-bold text-[#C9A227]">
                    <Compteur valeur={valeur} />
                  </span>
                  <span className="text-xs uppercase tracking-wider text-[#FAF6EF]/40">
                    {label}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.header>

          {/* ── ⭐ V4.42 Sélecteur d'espace : scission stricte par serviteur ── */}
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.45, ease: "easeOut" }}
            className="relative mb-8"
            aria-label="Choisir un espace"
          >
            <div
              className={`grid gap-4 ${
                espacesVisibles.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"
              }`}
            >
              {espacesVisibles.map((espace) => (
                <CarteEspace
                  key={espace.code}
                  espace={espace}
                  actif={espaceActif === espace.code}
                  nbOuvrages={nbParEspace[espace.code]}
                  onChoisir={() => choisirEspace(espace.code)}
                />
              ))}
            </div>
          </motion.section>

          {/* ── Recherche ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.55, ease: "easeOut" }}
            className="relative mb-6"
          >
            <div className="group relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FAF6EF]/40 transition-colors group-focus-within:text-[#C9A227]" />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un livre, un auteur, un mot-clé..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-[#FAF6EF] placeholder-[#FAF6EF]/30 focus:outline-none focus:border-[#C9A227]/70 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(201,162,39,0.12)] transition-all duration-300"
              />
              {recherche && (
                <button
                  onClick={() => setRecherche("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 text-[#FAF6EF]/50 hover:text-[#FAF6EF] transition-colors"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>

          {/* ── Filtres par catégorie (pastilles animées) ── */}
          <motion.div
            variants={vFiltres}
            initial="hidden"
            animate="visible"
            className="flex flex-wrap gap-2.5 mb-6"
          >
            {categoriesEspace.map((cat) => {
              const actif = categorieSelectionnee === cat;
              return (
                <motion.button
                  key={cat}
                  variants={vFiltre}
                  onClick={() =>
                    setCategorieSelectionnee(actif ? null : cat)
                  }
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    actif
                      ? "text-[#1E0F2B]"
                      : "bg-white/5 text-[#FAF6EF]/70 border border-white/10 hover:text-[#FAF6EF] hover:bg-white/10"
                  }`}
                >
                  {actif && (
                    <motion.span
                      layoutId="pastille-active"
                      className="absolute inset-0 rounded-full shadow-lg"
                      style={{
                        background: `linear-gradient(90deg, ${espaceCourant.accent}, ${espaceCourant.accentClair})`,
                        boxShadow: `0 8px 24px -6px ${espaceCourant.accent}66`,
                      }}
                      transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Compteur de résultats */}
          <AnimatePresence>
            {filtreActif && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <button
                  onClick={reinitialiser}
                  className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm text-[#FAF6EF]/70 hover:text-[#FAF6EF] transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  {livresFiltres.length} ouvrage
                  {livresFiltres.length > 1 ? "s" : ""} — réinitialiser les filtres
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Grille de livres ── */}
          {livresFiltres.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center py-24"
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block mb-5"
              >
                <BookOpen className="w-16 h-16 text-[#C9A227]/30 mx-auto" />
              </motion.div>
              <p className="text-[#FAF6EF]/50 text-lg">
                {livresEspace.length === 0
                  ? `Aucun livre publié dans l'espace « ${espaceCourant.nom} » pour l'instant.`
                  : "Aucun livre ne correspond à votre recherche."}
              </p>
              {filtreActif && (
                <motion.button
                  onClick={reinitialiser}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-6 inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                  Réinitialiser les filtres
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={espaceActif}
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {livresFiltres.map((book) => (
                  <motion.article
                    key={book.id}
                    layout
                    variants={vCarte}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileHover={{ y: -8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className={`group relative ${book.fileUrl ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() => book.fileUrl && setLivreOuvert(book)}
                  >
                    {/* Couverture */}
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 group-hover:ring-[#C9A227]/60 group-hover:shadow-[0_20px_60px_-15px_rgba(201,162,39,0.35)] transition-all duration-300 mb-3">
                      {book.coverUrl ? (
                        <Image
                          src={book.coverUrl}
                          alt={book.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width: 640px) 50vw, 20vw"
                        />
                      ) : (
                        <div
                          className={`w-full h-full bg-gradient-to-br ${
                            CATEGORY_COLORS[book.category] || CATEGORY_COLORS.Autres
                          } flex flex-col items-center justify-center p-4 transition-transform duration-500 group-hover:scale-110`}
                        >
                          <BookOpen className="w-9 h-9 text-white/80 mb-3" />
                          <p className="text-white text-xs font-bold text-center line-clamp-3">
                            {book.title}
                          </p>
                        </div>
                      )}

                      {/* Reflet balayant au survol */}
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 -translate-x-[130%] group-hover:translate-x-[130%] transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                      </div>

                      {/* Overlay « Lire » au survol */}
                      {book.fileUrl && (
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0826]/90 via-[#1A0826]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-5">
                          <span className="inline-flex items-center gap-2 bg-[#C9A227] text-[#1E0F2B] text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-[#C9A227]/40">
                            <Eye className="w-3.5 h-3.5" />
                            Lire
                          </span>
                        </div>
                      )}

                      {/* Badge catégorie */}
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-black/60 text-white px-2 py-1 rounded backdrop-blur-sm">
                          {book.category}
                        </span>
                      </div>

                      {/* Badge lecture seule / bientôt */}
                      {(!book.fileUrl || book.isDownloadable === false) && (
                        <div className="absolute top-2 right-2">
                          <span className="text-[10px] font-semibold bg-[#1E0F2B]/80 text-[#FAF6EF]/80 px-2 py-1 rounded backdrop-blur-sm">
                            {!book.fileUrl ? "Bientôt" : "En ligne"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <p className="font-semibold text-sm line-clamp-2 mb-1 transition-colors group-hover:text-[#E8D48B]">
                      {book.title}
                    </p>
                    <p className="text-xs text-[#FAF6EF]/50 flex items-center gap-1.5">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{book.author}</span>
                    </p>
                    <p className="text-[11px] text-[#FAF6EF]/30 mt-1.5 flex items-center gap-3">
                      {book.pageCount && <span>{book.pageCount} pages</span>}
                      {book.downloadCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Download className="w-3 h-3" />
                          {book.downloadCount}
                        </span>
                      )}
                    </p>
                  </motion.article>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* ── Modale lecteur PDF (ressort d'entrée) ── */}
        <AnimatePresence>
          {livreOuvert && (
            <motion.div
              key="modale-fond"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setLivreOuvert(null)}
            >
              <motion.div
                key="modale-panneau"
                initial={{ opacity: 0, y: 48, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="bg-[#1A0826] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-[#C9A227]/20 shadow-2xl shadow-[#C9A227]/10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* En-tête */}
                <div className="flex items-start justify-between gap-3 p-4 md:p-5 border-b border-white/10">
                  <div className="min-w-0">
                    <h2 className="font-serif font-bold text-lg md:text-xl line-clamp-2">
                      {livreOuvert.title}
                    </h2>
                    <p className="text-sm text-[#FAF6EF]/60 mt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {livreOuvert.author}
                        {livreOuvert.servantShortName ? ` · ${livreOuvert.servantShortName}` : ""}
                      </span>
                    </p>
                    {/* ⭐ V4.40 — fiche professionnelle : éditeur, ISBN, pages,
                        taille, langue, année — tout ce que le back-office sait. */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {(
                        [
                          livreOuvert.editeur && { icone: Building2, texte: livreOuvert.editeur },
                          livreOuvert.isbn && { icone: Hash, texte: `ISBN ${livreOuvert.isbn}` },
                          livreOuvert.pageCount && {
                            icone: FileText,
                            texte: `${livreOuvert.pageCount} pages`,
                          },
                          livreOuvert.fileSize && {
                            icone: Download,
                            texte: formatTaille(livreOuvert.fileSize),
                          },
                          livreOuvert.language && { icone: Languages, texte: livreOuvert.language },
                          livreOuvert.publishedYear && {
                            icone: Calendar,
                            texte: String(livreOuvert.publishedYear),
                          },
                        ].filter(Boolean) as Array<{ icone: LucideIcon; texte: string }>
                      ).map(({ icone: Icone, texte }) => (
                        <span
                          key={texte}
                          className="inline-flex items-center gap-1 text-[11px] bg-white/5 border border-white/10 text-[#FAF6EF]/60 px-2 py-1 rounded-md"
                        >
                          <Icone className="w-3 h-3 text-[#C9A227]/70" />
                          {texte}
                        </span>
                      ))}
                    </div>
                    {(livreOuvert.tags || "").trim() && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {livreOuvert
                          .tags!.split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .map((t) => (
                            <span
                              key={t}
                              className="text-[10px] uppercase tracking-wide bg-[#C9A227]/10 border border-[#C9A227]/25 text-[#E8D48B] px-2 py-0.5 rounded-full"
                            >
                              {t}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {livreOuvert.fileUrl && livreOuvert.isDownloadable !== false && (
                      <motion.a
                        href={livreOuvert.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#C9A227] to-[#DDBE55] hover:from-[#DDBE55] hover:to-[#E8D48B] text-[#1E0F2B] font-bold text-sm px-4 py-2 rounded-lg shadow-lg shadow-[#C9A227]/25 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </motion.a>
                    )}
                    {livreOuvert.fileUrl && livreOuvert.isDownloadable === false && (
                      <span className="text-xs text-[#FAF6EF]/50 px-3 py-2">
                        Lecture en ligne seulement
                      </span>
                    )}
                    <motion.button
                      onClick={() => setLivreOuvert(null)}
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      aria-label="Fermer"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>

                {/* Lecteur PDF avec état de chargement */}
                <div className="relative flex-1 overflow-hidden bg-gray-900" style={{ minHeight: "60vh" }}>
                  {livreOuvert.fileUrl ? (
                    <>
                      <iframe
                        src={`${livreOuvert.fileUrl}#toolbar=1&navpanes=0&view=FitH`}
                        className="w-full h-full"
                        style={{ minHeight: "60vh" }}
                        title={livreOuvert.title}
                        onLoad={() => setLecteurCharge(true)}
                      />
                      {!lecteurCharge && (
                        <motion.div
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                            className="w-10 h-10 rounded-full border-2 border-[#C9A227]/30 border-t-[#C9A227]"
                          />
                          <p className="text-sm text-[#FAF6EF]/40">
                            Chargement du lecteur…
                          </p>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[#FAF6EF]/40">
                      Aucun fichier PDF disponible
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
