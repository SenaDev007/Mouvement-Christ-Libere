"use client";

/**
 * Client — /bibliotheque
 * Bibliothèque documentaire publique avec filtres + lecteur PDF intégré.
 */

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  BookOpen,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
} from "lucide-react";

interface BookLite {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  coverUrl: string | null;
  fileUrl: string | null;
  pageCount: number | null;
  language: string;
  publishedYear: number | null;
  downloadCount: number;
  servantCode: string | null;
  servantShortName: string | null;
}

interface Props {
  books: BookLite[];
  categories: string[];
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

export function BibliotequeClient({ books, categories }: Props) {
  const [categorieSelectionnee, setCategorieSelectionnee] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [livreOuvert, setLivreOuvert] = useState<BookLite | null>(null);

  const livresFiltres = useMemo(() => {
    return books.filter((b) => {
      if (categorieSelectionnee && b.category !== categorieSelectionnee) return false;
      if (recherche) {
        const q = recherche.toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [books, categorieSelectionnee, recherche]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A0826] via-[#2A0E3D] to-[#1A0826] text-[#FAF6EF]">
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
        {/* En-tête */}
        <div className="text-center mb-12">
          <BookOpen className="w-12 h-12 text-[#C9A227] mx-auto mb-4" />
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Bibliothèque</h1>
          <p className="text-[#FAF6EF]/60 max-w-2xl mx-auto">
            Livres et enseignements gratuits du Pasteur Kongo et d'Afrika Pamela.
            Feuilletez en ligne ou téléchargez librement.
          </p>
        </div>

        {/* Barre de recherche + filtres */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FAF6EF]/40" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un livre, un auteur..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-[#FAF6EF] placeholder-[#FAF6EF]/30 focus:outline-none focus:border-[#C9A227]"
            />
          </div>
          {categorieSelectionnee && (
            <button
              onClick={() => setCategorieSelectionnee(null)}
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm transition-colors"
            >
              <Filter className="w-4 h-4" />
              {categorieSelectionnee}
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Catégories */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategorieSelectionnee(categorieSelectionnee === cat ? null : cat)
              }
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                categorieSelectionnee === cat
                  ? "bg-[#C9A227] text-[#1E0F2B]"
                  : "bg-white/5 text-[#FAF6EF]/70 hover:bg-white/10 border border-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grille de livres */}
        {livresFiltres.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-[#FAF6EF]/20 mx-auto mb-4" />
            <p className="text-[#FAF6EF]/50">
              {books.length === 0
                ? "Aucun livre publié pour l'instant. Revenez bientôt !"
                : "Aucun livre ne correspond à votre recherche."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {livresFiltres.map((book) => (
              <div
                key={book.id}
                className="group cursor-pointer"
                onClick={() => book.fileUrl && setLivreOuvert(book)}
              >
                {/* Couverture */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-lg mb-3 transition-transform group-hover:scale-105">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={book.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 20vw"
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${
                        CATEGORY_COLORS[book.category] || CATEGORY_COLORS.Autres
                      } flex items-center justify-center p-3`}
                    >
                      <BookOpen className="w-8 h-8 text-white/80 mb-2" />
                      <p className="text-white text-xs font-bold text-center line-clamp-3">
                        {book.title}
                      </p>
                    </div>
                  )}
                  {/* Badge catégorie */}
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-black/60 text-white px-2 py-1 rounded backdrop-blur-sm">
                      {book.category}
                    </span>
                  </div>
                </div>
                {/* Infos */}
                <p className="font-semibold text-sm line-clamp-2 mb-1">{book.title}</p>
                <p className="text-xs text-[#FAF6EF]/50 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {book.author}
                </p>
                {book.pageCount && (
                  <p className="text-xs text-[#FAF6EF]/30 mt-1">{book.pageCount} pages</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal lecteur PDF */}
      {livreOuvert && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLivreOuvert(null)}
        >
          <div
            className="bg-[#1A0826] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h2 className="font-bold text-lg">{livreOuvert.title}</h2>
                <p className="text-sm text-[#FAF6EF]/60">
                  {livreOuvert.author}
                  {livreOuvert.servantShortName ? ` · ${livreOuvert.servantShortName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {livreOuvert.fileUrl && (
                  <a
                    href={livreOuvert.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#DDBE55] text-[#1E0F2B] font-bold text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger
                  </a>
                )}
                <button
                  onClick={() => setLivreOuvert(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Lecteur PDF */}
            <div className="flex-1 overflow-hidden bg-gray-900">
              {livreOuvert.fileUrl ? (
                <iframe
                  src={`${livreOuvert.fileUrl}#toolbar=1&navpanes=0&view=FitH`}
                  className="w-full h-full"
                  style={{ minHeight: "60vh" }}
                  title={livreOuvert.title}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[#FAF6EF]/40">
                  Aucun fichier PDF disponible
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
