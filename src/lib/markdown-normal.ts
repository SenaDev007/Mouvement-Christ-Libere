/**
 * ============================================================
 * ⭐ V4.13 — NORMALISATEUR MARKDOWN (anti-astérisques visibles)
 * ============================================================
 *
 * Constat terrain : les articles rédigés dans le back-office
 * contiennent parfois des emphases « mal formées » au sens
 * CommonMark — par exemple :
 *
 *   ** ainsi **            ← espaces À L'INTÉRIEUR des délimiteurs
 *   * italique *
 *   __gras__ / _italique_  ← soulignés au lieu d'astérisques
 *   #Titre                 ← pas d'espace après le dièse
 *
 * CommonMark EXIGE qu'une emphase ne commence pas par une espace
 * juste après le délimiteur ouvrant, ni ne finisse par une espace
 * juste avant le délimiteur fermant. Résultat : react-markdown
 * affiche les astérisques BRUTS à l'écran.
 *
 * Ce module répare le markdown AVANT le rendu — les mots concernés
 * s'affichent enfin EN GRAS / ITALIQUE, jamais entre astérisques.
 * Aucune donnée n'est modifiée : transformation purement au rendu
 * (même philosophie qu'isolole.tsx).
 *
 * GARDE-FOUS (ne jamais casser ce qui est déjà correct) :
 *   · une emphase ne traverse JAMAIS un retour à la ligne
 *     (sinon les puces « * item ⏎ * item » seraient dévorées) ;
 *   · l'italique simple exige un contenu qui commence par une
 *     lettre ou un guillemet (ne touche pas « 3 * 4 * 5 ») ;
 *   · idempotent : un texte propre ressort identique.
 */

/**
 * Répare les emphases mal espacées et harmonise les marqueurs.
 */
export function normaliserMarkdown(texte: string | null | undefined): string {
  if (!texte) return "";

  let out = texte;

  // ── 1. Titres : « #Titre » → « # Titre » (dièses 1 à 4) ──
  out = out.replace(/^(#{1,4})([^\s#])/gm, "$1 $2");

  // ── 2. Gras+italique « *** *** » avec espaces internes (même ligne) ──
  out = out.replace(/\*\*\*[ \t]+([^*\n]+?)[ \t]+\*\*\*/g, "***$1***");
  out = out.replace(/\*\*\*([^*\n]+?)\*\*\*/g, (m, corps: string) =>
    corps.trim() === "" ? m : `***${corps.trim()}***`,
  );

  // ── 3. Gras « ** ** » avec espaces internes (même ligne) ──
  //     « ** ainsi ** » → « **ainsi** » (CommonMark l'ignore sinon)
  out = out.replace(/\*\*[ \t]+([^*\n]+?)[ \t]+\*\*/g, "**$1**");

  // ── 4. Italique « * * » avec espaces internes (même ligne) ──
  //     Garde : contenu commençant par lettre/guillemet (pas « 3 * 4 * 5 »),
  //     fermant suivi d'espace/ponctuation/fin de ligne.
  out = out.replace(
    /(^|[\s(\u00AB\u201C[])\*[ \t]+([a-zA-Z\u00C0-\u017F\u00AB\u201C"'][^*\n]*?)[ \t]+\*(?=$|[\s).,;:!?\u00BB\u201D"])/g,
    "$1*$2*",
  );

  // ── 5. Soulignés → astérisques (markdown classique) ──
  //     « __gras__ » → « **gras** », « _italique_ » → « *italique* »
  out = out.replace(/__([^_\n]+?)__/g, (m, corps: string) =>
    corps.trim() === "" ? m : `**${corps.trim()}**`,
  );
  out = out.replace(
    /(^|[\s(\u00AB\u201C[])_([^_\n]+?)_(?=$|[\s).,;:!?\u00BB\u201D"])/g,
    "$1*$2*",
  );

  // ── 6. Gras/italique collés aux guillemets français ──
  //     « ** « x » ** » → « **« x »** » (espaces internes resserrés)
  out = out.replace(/\*\*[ \t]*\u00AB[ \t]*/g, "**\u00AB");
  out = out.replace(/[ \t]*\u00BB[ \t]*\*\*/g, "\u00BB**");

  return out;
}

/**
 * Version PLAIN-TEXT pour les extraits courts (cartes, métadonnées,
 * attributs alt…) : supprime les marqueurs markdown au lieu de les
 * rendre, pour n'afficher QUE les mots.
 */
export function texteSansMarkdown(texte: string | null | undefined): string {
  if (!texte) return "";
  return normaliserMarkdown(texte)
    // titres → texte simple
    .replace(/^#{1,6}\s+/gm, "")
    // gras/italique → nu
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // séparateurs et puces résiduels
    .replace(/^\s*([-*\u2022])\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^[-=*_]{3,}\s*$/gm, "")
    // espaces doubles restantes
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
