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
 *  2. ZÉRO JavaScript (aucun « use client ») : rendu serveur pur,
 *     animation 100 % CSS (animate-spin) — s'affiche instantanément
 *     pendant le streaming des Server Components.
 *  3. Variantes : `page` (transitions complètes, 60 vh) et `compact`
 *     (à l'intérieur d'un bloc, ex. lecteur vidéo du live).
 *
 * ⭐ V3.96 — RETRAIT DU LOGO (retour pasteur) : le composant affichait
 * `/logo.svg` au cœur de l'anneau — or ce fichier est le logo « Z » du
 * gabarit de développement, PAS le logo du Mouvement Christ Libère.
 * Le pasteur l'a vu sur le site public, l'admin, le secrétariat et la
 * trésorerie : logo retiré PARTOUT. L'indicateur reste sobre et
 * professionnel : un seul anneau doré + libellé en italique.
 */

type Variante = "page" | "compact";

const DIMENSIONS: Record<Variante, { boite: string; bordure: string }> = {
  page: { boite: "w-14 h-14", bordure: "border-2" },
  compact: { boite: "w-10 h-10", bordure: "border-2" },
};

export function ChargementInline({
  libelle = "Un instant…",
  variante = "page",
  remplir = true,
  className = "",
}: {
  libelle?: string;
  variante?: Variante;
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
        {/* Anneau rotatif — UN SEUL élément, superposition parfaite :
            piste or pâle + arc or plein (même mécanique que le squelette
            du live, prouvée en production). V3.96 : plus de logo au
            centre — l'ancien /logo.svg était le logo « Z » du gabarit. */}
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
