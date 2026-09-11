/**
 * ⭐ V3.64 — Icône « croche TikTok » partagée (site public + back-office).
 *
 * Glyphe du logo TikTok (note de musique) avec le double décalage de
 * marque cyan #25F4EE / rose #FE2C55. Dessiné en SVG inline : zéro
 * requête réseau, net à toutes les tailles.
 */
export function TiktokNoteIcon({ size = 24, className }: { size?: number; className?: string }) {
  const k = size / 48;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
    >
      <g transform={`translate(${3 * k} ${3 * k}) scale(${k})`}>
        <path
          d="M22 6h7c.5 5.5 4.3 9.5 9.8 10v7c-3.7.1-7.1-1-9.9-3.1v13.6c0 6.3-4.7 10.5-10.6 10.5-5.5 0-9.6-3.9-9.6-9 0-5 4-8.8 9.3-8.8 1 0 2 .1 3 .4v7.4c-.8-.3-1.7-.5-2.6-.5-2.3 0-4 1.5-4 3.5s1.8 3.6 4.1 3.6c2.6 0 4.5-1.9 4.5-4.7V6z"
          fill="#25F4EE"
        />
        <path
          d="M22 6h7c.5 5.5 4.3 9.5 9.8 10v7c-3.7.1-7.1-1-9.9-3.1v13.6c0 6.3-4.7 10.5-10.6 10.5-5.5 0-9.6-3.9-9.6-9 0-5 4-8.8 9.3-8.8 1 0 2 .1 3 .4v7.4c-.8-.3-1.7-.5-2.6-.5-2.3 0-4 1.5-4 3.5s1.8 3.6 4.1 3.6c2.6 0 4.5-1.9 4.5-4.7V6z"
          fill="#FE2C55"
          transform="translate(-6 -6)"
        />
        <path
          d="M22 6h7c.5 5.5 4.3 9.5 9.8 10v7c-3.7.1-7.1-1-9.9-3.1v13.6c0 6.3-4.7 10.5-10.6 10.5-5.5 0-9.6-3.9-9.6-9 0-5 4-8.8 9.3-8.8 1 0 2 .1 3 .4v7.4c-.8-.3-1.7-.5-2.6-.5-2.3 0-4 1.5-4 3.5s1.8 3.6 4.1 3.6c2.6 0 4.5-1.9 4.5-4.7V6z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/**
 * Badge « TikTok » superposé à une miniature réelle (coin bas-droit) —
 * même esprit que le badge LIVE : reconnaît la source au premier coup
 * d'œil dans les grilles (site public + back-office).
 */
export function BadgeTikTok({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        "absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/70 text-white backdrop-blur-sm " +
        (compact ? "px-1.5 py-0.5" : "px-2 py-0.5")
      }
      style={{ fontSize: compact ? 8 : 9, fontWeight: 700, letterSpacing: "0.08em" }}
    >
      <TiktokNoteIcon size={compact ? 10 : 12} />
      TikTok
    </span>
  );
}
