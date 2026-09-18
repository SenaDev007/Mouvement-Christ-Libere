/**
 * ⭐ V3.93 — ChargementInline : indicateur de chargement UNIFIÉ et
 * professionnel pour toutes les transitions entre pages (loading.tsx).
 *
 * CONTEXTE (retour pasteur) : l'ancien admin/loading.tsx superposait DEUX
 * cercles avec une marge négative approximative (`-mt-12` alors que `mb-3`
 * ajoutait 12 px) → les anneaux étaient décalés de 12 px, effet « cercle
 * doublé et décalé » peu professionnel. L'ancien loading racine utilisait
 * un positionnement absolu correct mais un style différent → incohérence
 * visuelle entre le site public et les back-offices.
 *
 * PRINCIPES DE CE COMPOSANT :
 *  1. UN SEUL anneau rotatif (`absolute inset-0`) — superposition
 *     mathématiquement parfaite, aucun décalage possible.
 *  2. Logo officiel au centre (respiration douce) — signature de marque
 *     sobre, identique sur le site public et les back-offices.
 *  3. ZÉRO JavaScript (aucun « use client ») : rendu serveur pur,
 *     animation 100 % CSS (animate-spin / animate-pulse) — s'affiche
 *     instantanément pendant le streaming des Server Components.
 *  4. Variantes : `page` (transitions complètes, 60 vh) et `compact`
 *     (à l'intérieur d'un bloc, ex. lecteur vidéo du live).
 */

type Variante = "page" | "compact";

const DIMENSIONS: Record<Variante, { boite: string; bordure: string; logo: number }> = {
  page: { boite: "w-14 h-14", bordure: "border-2", logo: 24 },
  compact: { boite: "w-10 h-10", bordure: "border-2", logo: 18 },
};

export function ChargementInline({
  libelle = "Un instant…",
  variante = "page",
  avecLogo = true,
  remplir = true,
  className = "",
}: {
  libelle?: string;
  variante?: Variante;
  /** Affiche le logo officiel au cœur de l'anneau (désactivable sur fond sombre). */
  avecLogo?: boolean;
  /** Centre verticalement sur 60 vh (transition de page complète). */
  remplir?: boolean;
  className?: string;
}) {
  const d = DIMENSIONS[variante];
  return (
    <div
      className={[
        "flex flex-col items-center justify-center px-4",
        remplir ? "min-h-[60vh]" : "",
        variante === "page" ? "gap-5" : "gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label={libelle}
    >
      <div className={`relative ${d.boite}`}>
        {/* Logo officiel — respiration douce au cœur de l'anneau */}
        {avecLogo && (
          <img
            src="/logo.svg"
            alt=""
            width={d.logo}
            height={d.logo}
            className="absolute inset-0 m-auto animate-pulse"
          />
        )}
        {/* Anneau rotatif — UN SEUL élément, superposition parfaite :
            piste or pâle + arc or plein (même mécanique que le squelette
            du live, prouvée en production). */}
        <div
          className={`absolute inset-0 rounded-full border-solid ${d.bordure} border-[#C9A227]/25 border-t-[#C9A227] animate-spin`}
        />
      </div>
      {libelle && (
        <p className="text-sm text-[#8A8378] italic font-serif tracking-wide select-none">
          {libelle}
        </p>
      )}
    </div>
  );
}
