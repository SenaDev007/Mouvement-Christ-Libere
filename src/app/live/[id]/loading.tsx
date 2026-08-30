/**
 * loading.tsx pour /live/[id]
 *
 * Pendant que la SSR de /live/[id] s'exécute (Prisma findUnique sur
 * LiveStream + servant), Next.js affiche ce squelette au lieu de laisser
 * l'écran vide. Cela permet à la navigation de "streamer" : l'utilisateur
 * clique sur "Rejoindre", il voit immédiatement le squelette du live
 * s'afficher, puis les données réelles arrivent par-dessus.
 *
 * Sans ce fichier, l'ancien PageLoader (5 s plein écran) + l'absence de
 * streaming = écran figé jusqu'à la fin de la SSR.
 */
export default function LiveLoading() {
  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      <div className="max-w-[1800px] mx-auto px-2 md:px-4 py-4">
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          {/* Colonne gauche : placeholder du player */}
          <div className="space-y-3">
            <div className="relative aspect-video bg-[#1A0826] rounded-xl overflow-hidden shadow-2xl animate-pulse">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-[#C9A227]/30 border-t-[#C9A227] animate-spin" />
              </div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2">
                <div className="h-5 w-24 bg-[#C9A227]/30 rounded-md" />
              </div>
            </div>
            {/* Placeholder du titre */}
            <div className="h-6 w-3/4 bg-[#1A0826]/10 rounded animate-pulse" />
            {/* Placeholder de la barre chaîne + actions */}
            <div className="flex items-center gap-3 pb-3 border-b border-[#8A8378]/15">
              <div className="w-10 h-10 rounded-full bg-[#1A0826]/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-[#1A0826]/10 rounded animate-pulse" />
                <div className="h-3 w-20 bg-[#1A0826]/10 rounded animate-pulse" />
              </div>
            </div>
            {/* Placeholder de la description */}
            <div className="bg-white rounded-xl p-3 border border-[#8A8378]/15 space-y-2">
              <div className="h-3 w-full bg-[#1A0826]/10 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-[#1A0826]/10 rounded animate-pulse" />
            </div>
          </div>

          {/* Colonne droite : placeholder du chat */}
          <div className="h-[calc(100vh-180px)] lg:h-auto lg:max-h-[calc(100vh-140px)]">
            <div className="h-full bg-white rounded-xl border border-[#8A8378]/15 p-4 space-y-3">
              <div className="h-4 w-20 bg-[#1A0826]/10 rounded animate-pulse" />
              <div className="h-3 w-full bg-[#1A0826]/10 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-[#1A0826]/10 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-[#1A0826]/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
