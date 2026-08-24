"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { PageHero } from "@/components/magic/page-hero";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { ParticleField } from "@/components/magic/particle-field";
import { QuoteBlock, SectionDivider } from "@/components/premium/section-divider";
import { LIVRES_BIBLIQUES, type LivreBiblique } from "@/lib/bible/references";
import { tousLesVersets, type VersetBiblique } from "@/lib/bible/versets";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

export default function BiblePage() {
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref");

  const [recherche, setRecherche] = useState("");
  const [livreSelectionne, setLivreSelectionne] = useState<LivreBiblique | null>(null);
  const [versetSelectionne, setVersetSelectionne] = useState<VersetBiblique | null>(null);

  const tousVersets = useMemo(() => tousLesVersets(), []);

  // Si un ?ref= est passé dans l'URL, charger ce verset
  useEffect(() => {
    if (!refParam) return;
    const verset = tousVersets.find(
      (v) => v.reference.toLowerCase() === refParam.toLowerCase()
    );
    if (verset) {
      const livre = LIVRES_BIBLIQUES.find((l) => l.id === verset.livreId);
      // Utiliser un micro-delay pour éviter le setState synchrone dans l'effet
      Promise.resolve().then(() => {
        setVersetSelectionne(verset);
        if (livre) setLivreSelectionne(livre);
      });
    }
  }, [refParam, tousVersets]);

  // Filtrer les versets
  const versetsFiltres = useMemo(() => {
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      return tousVersets.filter(
        (v) =>
          v.texte.toLowerCase().includes(q) ||
          v.contexte?.toLowerCase().includes(q) ||
          v.reference.toLowerCase().includes(q)
      );
    }
    if (livreSelectionne) {
      return tousVersets.filter((v) => v.livreId === livreSelectionne.id);
    }
    return tousVersets;
  }, [recherche, livreSelectionne, tousVersets]);

  const livresAT = LIVRES_BIBLIQUES.filter((l) => l.testament === "AT");
  const livresNT = LIVRES_BIBLIQUES.filter((l) => l.testament === "NT");

  return (
    <div>
      <PageHero
        kicker="La Parole de Dieu"
        title="Bible interconnectée"
        subtitle="Les versets cités dans les enseignements, témoignages et biographies deviennent cliquables. Survolez une référence pour voir le texte, cliquez pour le contexte complet."
        primaryCta={{ label: "Rechercher un verset", href: "#recherche" }}
      />

      <section id="recherche" className="bg-ivory py-16 md:py-20">
        <div className="container mx-auto max-w-7xl px-4">
          {/* Barre de recherche */}
          <div className="relative mb-8 max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un mot, une phrase, une référence (ex: Genèse 5:24, paix, Hénoch)..."
              className="w-full pl-12 pr-4 py-4 rounded-md border border-stone/30 bg-ivory text-ink placeholder:text-stone/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>

          {/* Sélection par livre */}
          {!recherche && (
            <div className="mb-8">
              <h3 className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-4 text-center">
                Ou sélectionnez un livre
              </h3>
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div>
                  <p className="text-xs font-semibold text-imperial mb-2 uppercase tracking-wider">
                    Ancien Testament
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {livresAT.map((livre) => (
                      <button
                        key={livre.id}
                        onClick={() => {
                          setLivreSelectionne(livre);
                          setVersetSelectionne(null);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                          livreSelectionne?.id === livre.id
                            ? "bg-imperial text-ivory"
                            : "bg-imperial/5 text-imperial hover:bg-imperial/10"
                        )}
                      >
                        {livre.nomFrCourt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-imperial mb-2 uppercase tracking-wider">
                    Nouveau Testament
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {livresNT.map((livre) => (
                      <button
                        key={livre.id}
                        onClick={() => {
                          setLivreSelectionne(livre);
                          setVersetSelectionne(null);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                          livreSelectionne?.id === livre.id
                            ? "bg-imperial text-ivory"
                            : "bg-imperial/5 text-imperial hover:bg-imperial/10"
                        )}
                      >
                        {livre.nomFrCourt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statistiques */}
          <div className="text-center mb-6">
            <p className="text-xs text-stone">
              {versetsFiltres.length} verset{versetsFiltres.length > 1 ? "s" : ""} trouvé{versetsFiltres.length > 1 ? "s" : ""}
              {livreSelectionne && !recherche && ` dans ${livreSelectionne.nomFr}`}
              {recherche && ` pour « ${recherche} »`}
            </p>
          </div>

          {/* Liste des versets */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {versetsFiltres.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-stone italic">
                  Aucun verset trouvé. Essayez une autre recherche.
                </p>
              </div>
            ) : (
              versetsFiltres.map((verset, i) => {
                const livre = LIVRES_BIBLIQUES.find((l) => l.id === verset.livreId);
                return (
                  <motion.button
                    key={`${verset.reference}-${i}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.03 }}
                    onClick={() => {
                      setVersetSelectionne(verset);
                      if (livre) setLivreSelectionne(livre);
                    }}
                    className="text-left card-gold-top p-5 hover:border-gold/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-serif text-sm font-semibold text-gold-dark">
                        {verset.reference}
                      </span>
                      {livre?.testament === "AT" ? (
                        <span className="text-[9px] uppercase tracking-wider text-stone">AT</span>
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider text-stone">NT</span>
                      )}
                    </div>
                    <p className="font-serif italic text-sm text-ink/80 leading-relaxed line-clamp-3">
                      « {verset.texte} »
                    </p>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>
      </section>

      <SectionDivider variant="ornament" />

      {/* Modal détail verset */}
      <AnimatePresence>
        {versetSelectionne && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-imperial-dark/60 backdrop-blur-sm"
            onClick={() => setVersetSelectionne(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-ivory rounded-card max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête */}
              <div className="bg-imperial text-ivory p-6 relative">
                <button
                  onClick={() => setVersetSelectionne(null)}
                  className="absolute top-4 right-4 p-1.5 rounded hover:bg-ivory/20"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-gold" />
                  <span className="text-xs uppercase tracking-[0.18em] text-gold-light/80 font-semibold">
                    {livreSelectionne?.testament === "AT" ? "Ancien Testament" : "Nouveau Testament"}
                  </span>
                </div>
                <h2 className="font-serif text-3xl font-semibold">
                  {versetSelectionne.reference}
                </h2>
                {livreSelectionne?.nomHe && (
                  <p className="text-sm text-gold-light/70 font-serif mt-1" dir="rtl">
                    {livreSelectionne.nomHe}
                  </p>
                )}
              </div>

              {/* Texte */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <p className="font-serif text-lg text-ink leading-relaxed italic mb-4">
                  « {versetSelectionne.texte} »
                </p>

                {versetSelectionne.contexte && (
                  <div className="mt-6 p-4 bg-imperial/5 rounded-md border border-gold/20">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2">
                      Contexte
                    </p>
                    <p className="text-sm text-ink/70 leading-relaxed">
                      {versetSelectionne.contexte}
                    </p>
                  </div>
                )}

                {/* Traduction */}
                <div className="mt-6 pt-6 border-t border-stone/15">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone font-semibold mb-2">
                    Traduction
                  </p>
                  <p className="text-xs text-stone">
                    Louis Segond 1910 (domaine public)
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Citation */}
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
