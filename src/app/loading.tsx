/**
 * Loading UI — page de chargement du SITE PUBLIC.
 *
 * ⭐ V3.99 — Design Win Agro (palette Christ Libère conservée) :
 * fond ivoire, halos flottants animés, texture grain, wordmark serif
 * « Christ Libère » et soulignement doré animé. Retour pasteur : la
 * page de chargement n'avait pas reçu le design Win Agro.
 *
 * Principes conservés de V3.93/V3.96 :
 *  - ZÉRO JavaScript (Server Component pur, animations 100 % CSS) :
 *    s'affiche instantanément pendant le streaming des Server
 *    Components, sans flash ni hydration.
 *  - UN SEUL anneau rotatif doré (`absolute inset-0`) : superposition
 *    mathématiquement parfaite, aucun cercle « doublé et décalé ».
 *  - Aucun logo « Z » (retour pasteur V3.96) : le wordmark réel du
 *    Mouvement remplace avantageusement une image lourde à charger.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Chargement en cours"
      className="relative min-h-[60vh] flex flex-col items-center justify-center overflow-hidden bg-cream px-4"
    >
      {/* Halos flottants façon Win Agro (or + violet, décalés dans le temps) */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary-pale/60 blur-3xl animate-float pointer-events-none" />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-accent-pale/50 blur-3xl animate-float pointer-events-none [animation-delay:1.6s]" />

      {/* Texture grain Win Agro */}
      <div className="absolute inset-0 bg-grain opacity-[0.05] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6">
        {/* Anneau unique doré — piste or pâle + arc or plein (V3.93) */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-solid border-accent-yellow/25 border-t-accent-yellow animate-spin" />
        </div>

        {/* Wordmark serif + soulignement doré pulsant */}
        <div className="text-center">
          <p className="font-serif text-2xl font-extrabold tracking-wide select-none">
            <span className="text-accent-dark">Christ</span>{" "}
            <span className="text-primary-deep">Libère</span>
          </p>
          <div className="h-[3px] w-24 mx-auto mt-3 rounded-full bg-gradient-to-r from-transparent via-accent-yellow to-transparent animate-pulse" />
        </div>

        {/* Libellé — copwriting V3.93 conservé */}
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.3em] text-gray-text select-none">
          Un instant…
        </p>
      </div>
    </div>
  );
}
