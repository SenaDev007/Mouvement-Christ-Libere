/**
 * Génère le drapeau emoji (Unicode regional indicator) à partir du code ISO 2 lettres d'un pays.
 *
 * Exemple : "FR" → 🇫🇷, "CI" → 🇨🇮, "BJ" → 🇧🇯, "US" → 🇺🇸
 *
 * Pourquoi cette approche ?
 * - Couverture universelle : 191 pays gérés automatiquement sans maintenance
 * - Pas d'images à charger (rapide, pas de latence réseau)
 * - Fonctionne dans les éléments <button> et <div> sur tous les navigateurs
 * - Sur Windows 10/11, les emojis de drapeaux s'affichent correctement dans le DOM
 *   (contrairement aux <option> de <select> natifs qui les ignorent)
 */
export function flagFromCountryCode(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  const chars = upper.split("").map((c) => {
    const codePoint = 0x1f1e6 + (c.charCodeAt(0) - "A".charCodeAt(0));
    return String.fromCodePoint(codePoint);
  });
  return chars.join("");
}

/**
 * Drapeau par code langue (pour les sélecteurs de langue).
 */
export function flagFromLanguageCode(code: string): string {
  const LANG_TO_COUNTRY: Record<string, string> = {
    FR: "FR",
    EN: "GB",
    ES: "ES",
    PT: "PT",
    DE: "DE",
    IT: "IT",
    HE: "IL",
    AM: "ET",
    SW: "KE",
    LN: "CD",
    MG: "MG",
    YO: "NG",
    HA: "NG",
  };
  const country = LANG_TO_COUNTRY[code.toUpperCase()];
  if (country) return flagFromCountryCode(country);
  return "🌐";
}
