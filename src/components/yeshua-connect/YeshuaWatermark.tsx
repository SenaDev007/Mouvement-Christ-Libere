/**
 * ============================================================================
 * YESHUA CONNECT — Background watermark pattern (celestial theme)
 * ============================================================================
 *
 * Creates a subtle, beautiful background pattern like WhatsApp's doodle
 * background, but with Yeshua Connect branding (celestial/spiritual theme):
 *   - Chofar (shofar — appel du Royaume)
 *   - Colombe (Saint-Esprit)
 *   - Croix (rédemption)
 *   - Couronne (royauté céleste)
 *   - Bible ouverte (Parole)
 *   - Flamme (baptême de feu)
 *   - Étoile (Bethléhem)
 *   - Cœur (amour divin)
 *
 * The pattern is rendered as an SVG data URL, with the imperial violet +
 * gold color tint. Applied to the conversation view background + empty state.
 * ============================================================================
 */

import React from "react";

interface YeshuaWatermarkProps {
  opacity?: number;
  className?: string;
}

/**
 * Generates the SVG pattern as a data URL.
 * 8 spiritual icons spread across a 240x240 tile that repeats.
 */
function generateWatermarkSvg(opacity: number): string {
  // Each icon is a simple SVG path, tinted with the gold color (#C9A227)
  const icons = [
    // Chofar (shofar) — simplified
    '<g transform="translate(20,20) scale(0.8)"><path d="M5,20 Q5,10 15,10 L25,10 Q35,10 35,20 L35,25 Q35,30 30,30 L25,30 L25,25 L30,25 L30,20 Q30,15 25,15 L15,15 Q10,15 10,20 Z" fill="none" stroke="#C9A227" stroke-width="2.25"/></g>',
    // Colombe (dove) — simplified
    '<g transform="translate(100,30) scale(0.7)"><path d="M10,20 Q15,10 25,15 Q35,10 40,20 Q35,25 25,22 Q15,25 10,20 Z" fill="none" stroke="#C9A227" stroke-width="2.25"/><circle cx="35" cy="18" r="2" fill="#C9A227"/></g>',
    // Croix (cross)
    '<g transform="translate(180,20) scale(0.6)"><rect x="18" y="5" width="4" height="30" fill="none" stroke="#C9A227" stroke-width="2.25"/><rect x="10" y="15" width="20" height="4" fill="none" stroke="#C9A227" stroke-width="2.25"/></g>',
    // Couronne (crown)
    '<g transform="translate(30,90) scale(0.7)"><path d="M5,25 L5,15 L12,20 L20,10 L28,20 L35,15 L35,25 Z" fill="none" stroke="#C9A227" stroke-width="2.25"/><circle cx="20" cy="12" r="2" fill="#C9A227"/></g>',
    // Bible ouverte (open book)
    '<g transform="translate(110,100) scale(0.7)"><path d="M5,10 L20,15 L35,10 L35,25 L20,30 L5,25 Z M20,15 L20,30" fill="none" stroke="#C9A227" stroke-width="2.25"/></g>',
    // Flamme (flame)
    '<g transform="translate(190,95) scale(0.6)"><path d="M20,5 Q15,15 18,20 Q12,18 15,25 Q20,22 20,28 Q25,22 22,15 Q28,18 25,10 Q22,8 20,5 Z" fill="none" stroke="#C9A227" stroke-width="2.25"/></g>',
    // Étoile (star)
    '<g transform="translate(20,170) scale(0.6)"><path d="M20,5 L23,15 L33,15 L25,21 L28,31 L20,25 L12,31 L15,21 L7,15 L17,15 Z" fill="none" stroke="#C9A227" stroke-width="2.25"/></g>',
    // Cœur (heart)
    '<g transform="translate(100,180) scale(0.7)"><path d="M20,30 Q5,20 10,12 Q15,5 20,12 Q25,5 30,12 Q35,20 20,30 Z" fill="none" stroke="#C9A227" stroke-width="2.25"/></g>',
    // Arc-en-ciel (rainbow — alliance)
    '<g transform="translate(180,175) scale(0.6)"><path d="M5,25 Q20,5 35,25" fill="none" stroke="#C9A227" stroke-width="2.25"/><path d="M8,25 Q20,10 32,25" fill="none" stroke="#8C5FA8" stroke-width="2.25"/></g>',
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <rect width="240" height="240" fill="none"/>
    <g opacity="${opacity}">
      ${icons.join("\n      ")}
    </g>
  </svg>`;

  // Encode as data URL (URL-encode the SVG)
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Returns a CSS style object with the watermark background.
 * Usage: <div style={getYeshuaWatermarkStyle({ opacity: 0.08 })}>...</div>
 */
export function getYeshuaWatermarkStyle(opts: { opacity?: number } = {}): React.CSSProperties {
  const opacity = opts.opacity ?? 0.08;
  return {
    backgroundImage: generateWatermarkSvg(opacity),
    backgroundRepeat: "repeat",
    backgroundSize: "240px 240px",
  };
}

/**
 * Full component version (for use as <YeshuaWatermark />)
 */
export function YeshuaWatermark({ opacity = 0.08, className }: YeshuaWatermarkProps) {
  return (
    <div
      className={className}
      style={getYeshuaWatermarkStyle({ opacity })}
      aria-hidden="true"
    />
  );
}
