/**
 * ⭐ V3.60 — Catalogue de STICKERS PROFESSIONNELS (SVG vectoriel).
 * ============================================================================
 * Réponse à la demande pasteur : « des stickers professionnels, des boutons
 * comme dans CapCut pour les partages, les notifications, les likes ».
 *
 * Mixkit / Pixabay ne proposent PAS ce type d'assets (pas de stickers
 * d'interface animée ni de boutons sociaux) → nous construisons NOTRE
 * bibliothèque intégrée, dessinée en SVG :
 *   - qualité vectorielle (rasterisée en 512 px côté navigateur à l'ajout) ;
 *   - zéro dépendance réseau, zéro licence, zéro coût ;
 *   - reprend le pipeline ImageOverlay EXISTANT : glisser / redimensionner /
 *     opacité / fenêtre temporelle en preview + rendu à l'export (PNG).
 *
 * ⚠️ Fichier importé UNIQUEMENT côté client (rastérisation via <img> + canvas).
 * Textes : Arial/Segoe UI (polices système — toujours disponibles).
 */

export interface StickerPro {
  id: string;
  name: string;
  category: "social" | "arrows" | "badges" | "shapes";
  svg: string;
}

export const STICKER_CATEGORIES: { id: StickerPro["category"]; name: string }[] = [
  { id: "social", name: "Réseaux sociaux" },
  { id: "arrows", name: "Flèches & repères" },
  { id: "badges", name: "Badges & bulles" },
  { id: "shapes", name: "Formes & effets" },
];

// ─── Helpers de dessin (factories réutilisables) ───

function pill(
  w: number,
  h: number,
  fill: string,
  stroke = "none",
  strokeWidth = 0,
): string {
  const r = h / 2;
  return `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${r - 2}" fill="${fill}"${stroke !== "none" ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : ""}/>`;
}

function txt(
  x: number,
  y: number,
  size: number,
  fill: string,
  label: string,
  weight = 900,
): string {
  return `<text x="${x}" y="${y}" font-family="Arial, 'Segoe UI', Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
}

function svgRoot(w: number, h: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

/** Cœur plein (path centré sur cx,cy, taille ~ s). */
function heartPath(cx: number, cy: number, s: number, fill: string): string {
  const k = s / 16;
  return `<path transform="translate(${cx - 8 * k},${cy - 8 * k}) scale(${k})" d="M8 14.2 1.6 7.8C.5 6.7 0 5.5 0 4.2 0 1.9 1.9 0 4.2 0c1.3 0 2.5.5 3.4 1.5L8 2l.4-.5C9.3.5 10.5 0 11.8 0 14.1 0 16 1.9 16 4.2c0 1.3-.5 2.5-1.6 3.6L8 14.2z" fill="${fill}"/>`;
}

/** Pouce levé simplifié (style J'aime). */
function thumbPath(cx: number, cy: number, s: number, fill: string): string {
  const k = s / 24;
  return `<path transform="translate(${cx - 12 * k},${cy - 12 * k}) scale(${k})" d="M2 10h3v12H2c-.6 0-1-.4-1-1v-10c0-.6.4-1 1-1zm6 0 4-7.5c.3-.6 1-1 1.7-.8 1 .2 1.6 1.1 1.4 2.1L14.5 9H20c1.7 0 3 1.3 3 3 0 .3 0 .5-.1.8l-2.2 8c-.2 1-1.1 1.7-2.1 1.7H8c-.6 0-1-.4-1-1V11c0-.6.4-1 1-1z" fill="${fill}"/>`;
}

/** Cloche de notification. */
function bellPath(cx: number, cy: number, s: number, fill: string): string {
  const k = s / 24;
  return `<path transform="translate(${cx - 12 * k},${cy - 12 * k}) scale(${k})" d="M12 2a6 6 0 0 0-6 6v3.6l-1.8 3.6A1 1 0 0 0 5.1 17h13.8a1 1 0 0 0 .9-1.4L18 11.6V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z" fill="${fill}"/>`;
}

/** Étoile à 5 branches. */
function starPath(cx: number, cy: number, outer: number, fill: string, inner?: number): string {
  const r2 = inner ?? outer * 0.42;
  let pts = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : r2;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return `<polygon points="${pts.trim()}" fill="${fill}"/>`;
}

/** Personne (tête + épaules). */
function personPath(cx: number, cy: number, s: number, fill: string): string {
  const k = s / 24;
  return `<path transform="translate(${cx - 12 * k},${cy - 12 * k}) scale(${k})" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.7-8 6v1.5c0 .6.4 1 1 1h14c.6 0 1-.4 1-1V20c0-3.3-3.6-6-8-6z" fill="${fill}"/>`;
}

/** Œil (compteur de vues). */
function eyeIcon(cx: number, cy: number, s: number, fill: string): string {
  const k = s / 24;
  return `<path transform="translate(${cx - 12 * k},${cy - 12 * k}) scale(${k})" d="M12 5C6.5 5 2.1 8.9 1 12c1.1 3.1 5.5 7 11 7s9.9-3.9 11-7c-1.1-3.1-5.5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="${fill}"/>`;
}

/** Bulle de dialogue avec queue. */
function bubbleShape(w: number, h: number, fill: string, stroke = "none"): string {
  const r = Math.min(28, h / 4);
  return `<path d="M${r} 4 H${w - r} A${r} ${r} 0 0 1 ${w - 4} ${r + 4} V${h - r - 26} A${r} ${r} 0 0 1 ${w - r} ${h - 26} H${w * 0.38 + 22} L${w * 0.38} ${h - 2} L${w * 0.38 - 10} ${h - 26} H${r} A${r} ${r} 0 0 1 4 ${h - r - 26} V${r + 4} A${r} ${r} 0 0 1 ${r} 4 Z" fill="${fill}"${stroke !== "none" ? ` stroke="${stroke}" stroke-width="4"` : ""}/>`;
}

// ─── CATÉGORIE : RÉSEAUX SOCIAUX (style CapCut — ⭐ V3.63 refonte PRO) ───
//
// AVANT (V3.60) : largeurs de pilules DEVINÉES à la main → les textes gras
// larges (« MERCI DE PARTAGER », « S'ABONNER »…) DÉBORDAIENT et chevauchaient
// les icônes — retour pasteur : « les boutons ne sont pas professionnels,
// les textes et les icônes se chevauchent ».
// MAINTENANT : fabrique `bouton()` à MISE EN PAGE MESURÉE — la largeur de la
// pilule est CALCULÉE à partir du texte (largeur par caractère + espacement),
// l'icône et le texte ont chacun leur zone garantie : plus AUCUN chevauchement
// possible, quel que soit le libellé. + nombreuses variantes de styles.

/** Largeur approximative d'un caractère en Arial Black (weight 900), × fontSize.
 *  Estimation VOLONTAIREMENT généreuse : mieux vaut un peu plus de padding
 *  qu'un chevauchement. */
const LARGEUR_CAR: Record<string, number> = {
  M: 1.05, W: 1.05, A: 0.85, B: 0.8, C: 0.82, D: 0.85, E: 0.78, F: 0.75,
  G: 0.88, H: 0.85, I: 0.4, J: 0.45, K: 0.8, L: 0.7, N: 0.85, O: 0.88,
  P: 0.78, Q: 0.88, R: 0.82, S: 0.78, T: 0.72, U: 0.85, V: 0.8, X: 0.8,
  Y: 0.78, Z: 0.75, É: 0.78, À: 0.85, Ê: 0.78, Ô: 0.88, Ù: 0.85, Ç: 0.82,
  "0": 0.68, "1": 0.45, "2": 0.65, "3": 0.65, "4": 0.68, "5": 0.65,
  "6": 0.68, "7": 0.62, "8": 0.68, "9": 0.65, " ": 0.35, "!": 0.35,
  "?": 0.6, ".": 0.32, ",": 0.32, "'": 0.25, "-": 0.42, "+": 0.6,
  ":": 0.35, "/": 0.42, "→": 0.9, "★": 0.9, "✓": 0.8, "&": 0.75,
};

function mesurerTexte(texte: string, fontSize: number, letterSpacing: number): number {
  let w = 0;
  for (const ch of texte.toUpperCase()) {
    w += (LARGEUR_CAR[ch] ?? 0.8) * fontSize;
  }
  w += Math.max(0, texte.length - 1) * letterSpacing;
  return w;
}

type IconeBouton =
  | "coeur" | "pouce" | "cloche" | "partage" | "commentaire" | "personne"
  | "oeil" | "play" | "check" | "plus" | "lien" | "eclair" | "marquepage";

/** Chemins d'icônes (boîte 24×24, dessinés centrés sur cx/cy, taille s). */
function iconeBouton(kind: IconeBouton, cx: number, cy: number, s: number, fill: string): string {
  const k = s / 24;
  const t = (x: number, y: number) => `translate(${(cx - 12 * k).toFixed(1)},${(cy - 12 * k).toFixed(1)}) scale(${k.toFixed(3)})`;
  switch (kind) {
    case "coeur":
      return heartPath(cx, cy, s, fill);
    case "pouce":
      return thumbPath(cx, cy, s, fill);
    case "cloche":
      return bellPath(cx, cy, s, fill);
    case "personne":
      return personPath(cx, cy, s, fill);
    case "oeil":
      return eyeIcon(cx, cy, s, fill);
    case "play":
      return `<path transform="${t(0, 0)}" d="M8 5.2 18.8 12 8 18.8z" fill="${fill}"/>`;
    case "check":
      return `<path transform="${t(0, 0)}" d="M4.5 12.6 9.4 17.5 19.5 7.4" stroke="${fill}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "plus":
      return `<path transform="${t(0, 0)}" d="M12 5v14M5 12h14" stroke="${fill}" stroke-width="3.2" stroke-linecap="round"/>`;
    case "partage":
      return `<g transform="${t(0, 0)}" fill="${fill}"><path d="M12 3.2 19.4 8.1 12 13z"/><path d="M8.2 10.4c.9 0 1.7.2 2.4.5l.9-1.4c-1-.4-2.1-.7-3.3-.7C4.9 8.8 2.2 11 2.2 11s1.2 3 2.9 5.1l1.4-2.1c-.7-.9-1.2-1.8-1.4-2.4.8-.7 1.9-1.2 3.1-1.2zm-1 1.9c.5.7 1.1 1.4 1.7 1.9l1.4-2.1c-.6-.4-1.2-.6-1.9-.6-.4 0-.8.1-1.2.2l0 0 1-1.3z" opacity="0"/><path d="M14.6 6.6v3.1c-5 .5-8 3.4-9.2 7.6 2.2-2.6 5.1-3.8 9.2-3.8v3.1L21 11.5z"/></g>`;
    case "commentaire":
      return `<path transform="${t(0, 0)}" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 5.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm5 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm5 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" fill="${fill}"/>`;
    case "lien":
      return `<g transform="${t(0, 0)}" fill="none" stroke="${fill}" stroke-width="2.4" stroke-linecap="round"><path d="M10.2 13.8a4.2 4.2 0 0 0 6 0l3.2-3.2a4.24 4.24 0 0 0-6-6l-1.4 1.4"/><path d="M13.8 10.2a4.2 4.2 0 0 0-6 0l-3.2 3.2a4.24 4.24 0 0 0 6 6l1.4-1.4"/></g>`;
    case "eclair":
      return `<path transform="${t(0, 0)}" d="M13.4 2 4.6 13.4h5.5L9.6 22l9.8-12.2h-6.1z" fill="${fill}"/>`;
    case "marquepage":
      return `<path transform="${t(0, 0)}" d="M6 2h12a1 1 0 0 1 1 1v18.2l-7-4.2-7 4.2V3a1 1 0 0 1 1-1z" fill="${fill}"/>`;
  }
}

type StyleBouton = "blanc" | "rouge" | "noir" | "or" | "vert" | "violet" | "verre" | "gris";

const STYLES_BOUTON: Record<StyleBouton, {
  fond: string; stroke: string; texte: string; icone: string; suffixeId: string; nom: string;
}> = {
  blanc: { fond: "url(#gbtn-blanc)", stroke: "#dcdce2", texte: "#18181b", icone: "#E0245E", suffixeId: "blanc", nom: "blanc" },
  rouge: { fond: "url(#gbtn-rouge)", stroke: "#a31212", texte: "#ffffff", icone: "#ffffff", suffixeId: "rouge", nom: "rouge" },
  noir: { fond: "url(#gbtn-noir)", stroke: "#000000", texte: "#ffffff", icone: "#C9A227", suffixeId: "noir", nom: "noir" },
  or: { fond: "url(#gbtn-or)", stroke: "#8a6a10", texte: "#221607", icone: "#7f1d1d", suffixeId: "or", nom: "doré" },
  vert: { fond: "url(#gbtn-vert)", stroke: "#14532d", texte: "#ffffff", icone: "#ffffff", suffixeId: "vert", nom: "vert" },
  violet: { fond: "url(#gbtn-violet)", stroke: "#4c1d95", texte: "#ffffff", icone: "#ffffff", suffixeId: "violet", nom: "violet" },
  verre: { fond: "rgba(255,255,255,0.16)", stroke: "rgba(255,255,255,0.75)", texte: "#ffffff", icone: "#ffffff", suffixeId: "verre", nom: "verre" },
  gris: { fond: "url(#gbtn-gris)", stroke: "#9ca3af", texte: "#52525b", icone: "#71717a", suffixeId: "gris", nom: "gris" },
};

/** DEFS communes aux boutons (dégradés + ombre) — un seul bloc par SVG. */
const DEFS_BOUTON = `<defs>
<linearGradient id="gbtn-blanc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ececf1"/></linearGradient>
<linearGradient id="gbtn-rouge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset="1" stop-color="#c81e1e"/></linearGradient>
<linearGradient id="gbtn-noir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2b33"/><stop offset="1" stop-color="#101014"/></linearGradient>
<linearGradient id="gbtn-or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d774"/><stop offset="1" stop-color="#d3a017"/></linearGradient>
<linearGradient id="gbtn-vert" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient>
<linearGradient id="gbtn-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
<linearGradient id="gbtn-gris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e4e7"/><stop offset="1" stop-color="#d4d4d8"/></linearGradient>
<filter id="gbtn-shadow" x="-20%" y="-25%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000000" flood-opacity="0.32"/></filter>
</defs>`;

interface OptionsBouton {
  texte: string;
  icone?: IconeBouton;
  style?: StyleBouton;
  fontSize?: number;
  letterSpacing?: number;
  /** Icône à droite EN PLUS (ex. flèche après le texte). */
  iconeDroite?: IconeBouton;
}

/** Fabrique un bouton professionnel à mise en page MESURÉE :
 *  largeur = padding + icône + espace + TEXTE(mesuré) + [icône droite] + padding.
 *  Baseline explicite (y = centre + 0.36×fontSize) — robuste y compris quand
 *  le rasteriseur ignore dominant-baseline. */
function bouton(opts: OptionsBouton): { svg: string; largeur: number; hauteur: number } {
  const h = 150;
  const fs = opts.fontSize ?? 56;
  const ls = opts.letterSpacing ?? 3;
  const st = STYLES_BOUTON[opts.style || "blanc"];
  const texteL = mesurerTexte(opts.texte, fs, ls);
  const iconeG = opts.icone ? 58 : 0;
  const icoleD = opts.iconeDroite ? 46 : 0;
  const gapG = opts.icone ? 30 : 0;
  const gapD = opts.iconeDroite ? 24 : 0;
  // libellés COURTS : padding renforcé (respiration visuelle pro)
  const pad = opts.texte.length < 8 ? 82 : 68;
  const w = Math.round(pad + iconeG + gapG + texteL + gapD + icoleD + pad);

  const parts: string[] = [];
  parts.push(DEFS_BOUTON);
  parts.push(`<g filter="url(#gbtn-shadow)">`);
  parts.push(`<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="34" fill="${st.fond}"${st.stroke !== "none" ? ` stroke="${st.stroke}" stroke-width="2.5"` : ""}/>`);
  // liseré intérieur subtil (finition pro)
  parts.push(`<rect x="14" y="13" width="${w - 28}" height="${h - 26}" rx="24" fill="none" stroke="${opts.style === "verre" ? "rgba(255,255,255,0.35)" : "#ffffff"}" stroke-width="2" opacity="${opts.style === "verre" ? 0.4 : 0.35}"/>`);

  let x = pad;
  if (opts.icone) {
    parts.push(iconeBouton(opts.icone, x + 29, h / 2, 58, st.icone));
    x += iconeG + gapG;
  }
  // texte — baseline EXPLICITE (pas de dominant-baseline : robuste partout)
  const yTexte = h / 2 + fs * 0.36;
  parts.push(`<text x="${x.toFixed(1)}" y="${yTexte.toFixed(1)}" font-family="'Arial Black', Arial, 'Segoe UI', sans-serif" font-size="${fs}" font-weight="900" letter-spacing="${ls}" fill="${st.texte}">${opts.texte}</text>`);
  x += texteL;
  if (opts.iconeDroite) {
    parts.push(iconeBouton(opts.iconeDroite, x + gapD + 23, h / 2, 46, st.icone));
  }
  parts.push(`</g>`);
  return { svg: svgRoot(w, h, parts.join("\n")), largeur: w, hauteur: h };
}

/** Enregistre un bouton dans le catalogue (avec largeur/hauteur réelles). */
function boutonSticker(id: string, name: string, opts: OptionsBouton): StickerPro {
  const b = bouton(opts);
  return { id, name, category: "social", svg: b.svg };
}

const SOCIAL: StickerPro[] = [
  // ── Famille J'AIME ──
  boutonSticker("like-blanc", "J'aime — blanc", { texte: "J'AIME", icone: "coeur", style: "blanc" }),
  boutonSticker("like-rouge", "J'aime — rouge", { texte: "J'AIME", icone: "coeur", style: "rouge" }),
  boutonSticker("like-or", "J'aime — doré", { texte: "J'AIME", icone: "coeur", style: "or" }),
  // ── Famille S'ABONNER ──
  boutonSticker("subscribe-rouge", "S'abonner — rouge", { texte: "S'ABONNER", icone: "cloche", style: "rouge" }),
  boutonSticker("subscribe-noir", "S'abonner — noir", { texte: "S'ABONNER", icone: "cloche", style: "noir" }),
  boutonSticker("subscribe-abonne", "Abonné ✓ (après clic)", { texte: "ABONNÉ", icone: "check", style: "gris" }),
  boutonSticker("abonne-toi", "Abonne-toi ! (grand)", { texte: "ABONNE-TOI !", icone: "cloche", style: "rouge", fontSize: 62 }),
  // ⭐ LE classique CapCut : double action
  boutonSticker("like-subscribe", "J'aime + S'abonner", { texte: "J'AIME + S'ABONNER", icone: "coeur", style: "rouge", fontSize: 52 }),
  // ── Famille PARTAGER ──
  boutonSticker("share-blanc", "Partager — blanc", { texte: "PARTAGER", icone: "partage", style: "blanc" }),
  boutonSticker("share-or", "Partager — doré", { texte: "PARTAGER", icone: "partage", style: "or" }),
  boutonSticker("share-quelquun", "Partage à quelqu'un", { texte: "PARTAGE À QUELQU'UN", icone: "partage", style: "blanc", fontSize: 48 }),
  boutonSticker("merci-partager", "Merci de partager", { texte: "MERCI DE PARTAGER", icone: "coeur", style: "or", fontSize: 48 }),
  // ── Famille COMMENTER ──
  boutonSticker("comment-blanc", "Commenter", { texte: "COMMENTER", icone: "commentaire", style: "blanc" }),
  boutonSticker("dis-moi", "Dis-moi en commentaire", { texte: "DIS-MOI EN COMMENTAIRE", icone: "commentaire", style: "noir", fontSize: 44 }),
  // ── Famille SUIVRE ──
  boutonSticker("follow-vert", "Suivre — vert", { texte: "SUIVRE", icone: "personne", style: "vert" }),
  boutonSticker("follow-or", "Suivre — doré", { texte: "SUIVRE", icone: "personne", style: "or" }),
  // ── Famille ENREGISTRER ──
  boutonSticker("enregistrer", "Enregistrer", { texte: "ENREGISTRER", icone: "marquepage", style: "blanc" }),
  // ── Rendez-vous / accroches ──
  boutonSticker("nouvelle-video", "Nouvelle vidéo", { texte: "NOUVELLE VIDÉO", icone: "play", style: "violet" }),
  boutonSticker("chaque-dimanche", "Chaque dimanche", { texte: "CHAQUE DIMANCHE", icone: "eclair", style: "noir" }),
  boutonSticker("regarde-fin", "Regarde jusqu'à la fin", { texte: "REGARDE JUSQU'À LA FIN", icone: "eclair", style: "or", fontSize: 44 }),
  boutonSticker("lien-bio", "Lien en bio", { texte: "LIEN EN BIO", icone: "lien", style: "verre" }),
  boutonSticker("gloire-dieu", "Gloire à Dieu", { texte: "GLOIRE À DIEU", icone: "coeur", style: "or" }),
  boutonSticker("notif-activee", "Notifications activées", { texte: "NOTIFICATIONS ACTIVÉES", icone: "check", style: "vert", fontSize: 42 }),
  // ── Compteurs (fond sombre) ──
  boutonSticker("views-count", "Compteur de vues", { texte: "12 846 VUES", icone: "oeil", style: "noir", fontSize: 48 }),
  boutonSticker("followers-count", "Compteur d'abonnés", { texte: "12 345 ABONNÉS", icone: "personne", style: "noir", fontSize: 46 }),
  boutonSticker("likes-count", "Compteur de likes", { texte: "1,2K J'AIME", icone: "pouce", style: "noir", fontSize: 48 }),

  // ── Stickers illustrés (conservés de la V3.60 — ils ne chevauchent rien) ──
  {
    id: "love-burst",
    name: "Cœur amoureux",
    category: "social",
    svg: svgRoot(
      300, 300,
      `<defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5e7e"/><stop offset="1" stop-color="#d61f47"/></linearGradient></defs>
      <g stroke="#ff8fa8" stroke-width="10" stroke-linecap="round">
        <line x1="150" y1="18" x2="150" y2="52"/><line x1="34" y1="70" x2="62" y2="90"/><line x1="266" y1="70" x2="238" y2="90"/><line x1="16" y1="150" x2="50" y2="150"/><line x1="284" y1="150" x2="250" y2="150"/>
      </g>
      ${heartPath(150, 152, 210, "url(#g2)")}
      <ellipse cx="118" cy="112" rx="30" ry="18" fill="#ffffff" opacity="0.45" transform="rotate(-25 118 112)"/>
      ${heartPath(46, 232, 44, "#ff9db1")}${heartPath(258, 226, 36, "#ff9db1")}`,
    ),
  },
  {
    id: "bell-waves",
    name: "Notification (cloche)",
    category: "social",
    svg: svgRoot(
      300, 300,
      `<defs><linearGradient id="g4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76b"/><stop offset="1" stop-color="#e8a70c"/></linearGradient></defs>
      <g fill="none" stroke="#ffcf4d" stroke-width="14" stroke-linecap="round">
        <path d="M52 120 Q38 150 52 180"/><path d="M24 104 Q2 150 24 196"/>
        <path d="M248 120 Q262 150 248 180"/><path d="M276 104 Q298 150 276 196"/>
      </g>
      ${starPath(150, 26, 22, "#ffe28a")}
      ${bellPath(150, 140, 180, "url(#g4)")}
      <circle cx="150" cy="256" r="22" fill="#e8a70c"/>
      <path d="M142 256 l6 8 12-14" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: "notif-1",
    name: "Badge notification 1",
    category: "social",
    svg: svgRoot(
      260, 260,
      `<defs><linearGradient id="g12" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76b"/><stop offset="1" stop-color="#e8a70c"/></linearGradient></defs>
      ${bellPath(118, 124, 170, "url(#g12)")}
      <circle cx="196" cy="196" r="46" fill="#dc2626" stroke="#ffffff" stroke-width="6"/>
      ${txt(196, 197, 56, "#ffffff", "1")}`,
    ),
  },
  {
    id: "like-plus1",
    name: "Like +1",
    category: "social",
    svg: svgRoot(
      300, 190,
      `<defs><linearGradient id="g13" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>
      <circle cx="96" cy="95" r="84" fill="url(#g13)"/>
      ${thumbPath(96, 95, 92, "#ffffff")}
      <g transform="rotate(12 232 92)">
        <circle cx="232" cy="92" r="52" fill="#ffffff" opacity="0.94"/>
        ${txt(232, 92, 62, "#1d4ed8", "+1")}
      </g>`,
    ),
  },
  {
    id: "live-red",
    name: "Badge EN DIRECT",
    category: "social",
    svg: svgRoot(
      340, 120,
      `<defs><linearGradient id="g11" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset="1" stop-color="#b91c1c"/></linearGradient><filter id="sh11" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/></filter></defs>
      <g filter="url(#sh11)">${pill(340, 120, "url(#g11)")}
      <circle cx="64" cy="60" r="14" fill="#ffffff"/><circle cx="64" cy="60" r="7" fill="#ff4d4d" opacity="0.35"/>
      ${txt(210, 60, 50, "#ffffff", "EN DIRECT")}</g>`,
    ),
  },
  {
    id: "swipe-up",
    name: "Swipe up",
    category: "social",
    svg: svgRoot(
      300, 240,
      `<defs><linearGradient id="g9" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
      <rect x="10" y="128" width="280" height="100" rx="18" fill="url(#g9)"/>
      ${txt(150, 180, 52, "#1e0f2b", "SWIPE UP")}
      <g stroke="#fbbf24" stroke-width="16" stroke-linecap="round" fill="none">
        <path d="M150 104 V30"/><path d="M110 62 L150 22 L190 62"/>
      </g>
      <circle cx="150" cy="18" r="10" fill="#fde68a"/>`,
    ),
  },
  {
    id: "tap-here",
    name: "Appuyez ici",
    category: "social",
    svg: svgRoot(
      340, 190,
      `<defs><linearGradient id="g10" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></linearGradient></defs>
      <circle cx="170" cy="72" r="46" fill="none" stroke="#fde047" stroke-width="7" opacity="0.55"/>
      <circle cx="170" cy="72" r="30" fill="none" stroke="#fde047" stroke-width="8" opacity="0.85"/>
      <circle cx="170" cy="72" r="14" fill="#fde047"/>
      <rect x="8" y="112" width="324" height="72" rx="16" fill="url(#g10)"/>
      ${txt(170, 148, 48, "#1e0f2b", "APPUYEZ ICI")}`,
    ),
  },
  {
    id: "social-triple",
    name: "Compteurs likes/comments/partages",
    category: "social",
    svg: svgRoot(
      520, 130,
      `<defs><filter id="sh17" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.3"/></filter></defs>
      <g filter="url(#sh17)">${pill(520, 130, "#ffffff")}
        <rect x="6" y="6" width="164" height="118" rx="59" fill="#fee2e2"/>
        ${heartPath(64, 65, 40, "#dc2626")}${txt(122, 65, 40, "#18181b", "1,2K")}
        <rect x="178" y="6" width="164" height="118" rx="59" fill="#ede9fe"/>
        <path d="M222 38 h76 a12 12 0 0 1 12 12 v34 a12 12 0 0 1 -12 12 h-46 l-14 12 v-12 h-16 a12 12 0 0 1 -12 -12 v-34 a12 12 0 0 1 12 -12 z" fill="#7c3aed"/>${txt(296, 65, 40, "#18181b", "89")}
        <rect x="350" y="6" width="164" height="118" rx="59" fill="#dbeafe"/>
        <path d="M396 74 Q390 52 422 50 L422 40 L446 58 L422 76 L422 66 Q410 68 414 74 Z" fill="#1d4ed8"/>${txt(474, 65, 40, "#18181b", "45")}
      </g>`,
    ),
  },
];

// ─── CATÉGORIE : FLÈCHES & REPÈRES ───

function curvedArrow(dir: "right" | "left" | "up" | "down"): StickerPro {
  const paths = {
    right: `<g stroke="#fbbf24" stroke-width="30" fill="none" stroke-linecap="round"><path d="M30 170 Q150 170 210 90"/><path d="M170 66 L222 74 L196 120"/></g>`,
    left: `<g stroke="#fbbf24" stroke-width="30" fill="none" stroke-linecap="round"><path d="M270 170 Q150 170 90 90"/><path d="M130 66 L78 74 L104 120"/></g>`,
    up: `<g stroke="#fbbf24" stroke-width="30" fill="none" stroke-linecap="round"><path d="M40 270 Q40 150 120 100"/><path d="M94 140 L116 88 L162 114"/></g>`,
    down: `<g stroke="#fbbf24" stroke-width="30" fill="none" stroke-linecap="round"><path d="M40 30 Q40 150 120 200"/><path d="M94 160 L116 212 L162 186"/></g>`,
  };
  const dims = { right: [300, 200], left: [300, 200], up: [200, 300], down: [200, 300] } as const;
  const [w, h] = dims[dir];
  return {
    id: `arrow-${dir}`,
    name: `Flèche ${dir === "right" ? "droite" : dir === "left" ? "gauche" : dir === "up" ? "haut" : "bas"}`,
    category: "arrows",
    svg: svgRoot(w, h, paths[dir]),
  };
}

const ARROWS: StickerPro[] = [
  curvedArrow("right"),
  curvedArrow("left"),
  curvedArrow("up"),
  curvedArrow("down"),
  {
    id: "arrow-fat-right",
    name: "Flèche 3D droite",
    category: "arrows",
    svg: svgRoot(
      320, 140,
      `<defs><linearGradient id="ga1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
      <path d="M8 50 h150 V22 l70 48 -70 48 v-28 H8 z" fill="url(#ga1)" stroke="#78350f" stroke-width="6" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: "arrow-fat-left",
    name: "Flèche 3D gauche",
    category: "arrows",
    svg: svgRoot(
      320, 140,
      `<defs><linearGradient id="ga2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
      <path d="M312 50 h-150 V22 l-70 48 70 48 v-28 h150 z" fill="url(#ga2)" stroke="#78350f" stroke-width="6" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: "circle-highlight",
    name: "Cercle de mise en valeur",
    category: "arrows",
    svg: svgRoot(
      320, 320,
      `<ellipse cx="160" cy="160" rx="140" ry="108" fill="none" stroke="#22d3ee" stroke-width="14" stroke-dasharray="34 22" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "rect-highlight",
    name: "Cadre néon",
    category: "arrows",
    svg: svgRoot(
      360, 240,
      `<rect x="14" y="14" width="332" height="212" rx="24" fill="rgba(34,211,238,0.12)" stroke="#22d3ee" stroke-width="12" stroke-linejoin="round"/>
      <rect x="34" y="34" width="292" height="172" rx="14" fill="none" stroke="#a5f3fc" stroke-width="4" opacity="0.7"/>`,
    ),
  },
  {
    id: "underline-swoosh",
    name: "Soulignement doré",
    category: "arrows",
    svg: svgRoot(
      400, 110,
      `<defs><linearGradient id="gu1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b45309"/><stop offset="0.5" stop-color="#fcd34d"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
      <path d="M12 72 Q200 20 388 62 Q200 110 12 72 Z" fill="url(#gu1)"/>`,
    ),
  },
  {
    id: "star-burst-badge",
    name: "Éclat d'étoile",
    category: "arrows",
    svg: svgRoot(
      320, 320,
      starPath(160, 160, 150, "#fde047") + starPath(160, 160, 104, "#f59e0b") + starPath(160, 160, 58, "#fde68a"),
    ),
  },
];

// ─── CATÉGORIE : BADGES & BULLES ───

const BADGES: StickerPro[] = [
  {
    id: "badge-nouveau",
    name: "Badge Nouveau",
    category: "badges",
    svg: svgRoot(
      300, 300,
      `<defs><linearGradient id="gb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#b91c1c"/></linearGradient></defs>
      ${starPath(150, 150, 146, "url(#gb1)")}
      ${starPath(150, 150, 112, "#ffffff")}
      ${txt(150, 150, 56, "#b91c1c", "NOUVEAU")}`,
    ),
  },
  {
    id: "badge-top",
    name: "Badge Top",
    category: "badges",
    svg: svgRoot(
      280, 280,
      `<defs><linearGradient id="gb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#92400e"/></linearGradient></defs>
      <circle cx="140" cy="118" r="100" fill="url(#gb2)"/>
      <circle cx="140" cy="118" r="80" fill="#fffbeb"/>
      ${txt(140, 118, 66, "#92400e", "TOP")}
      <path d="M86 198 L64 272 L140 236 L216 272 L194 198 Z" fill="#b45309"/>`,
    ),
  },
  {
    id: "badge-alerte",
    name: "Alerte",
    category: "badges",
    svg: svgRoot(
      260, 230,
      `<defs><linearGradient id="gb3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#c2410c"/></linearGradient></defs>
      <path d="M130 12 L248 214 H12 Z" fill="url(#gb3)" stroke="#7c2d12" stroke-width="8" stroke-linejoin="round"/>
      <rect x="118" y="76" width="24" height="70" rx="12" fill="#ffffff"/>
      <circle cx="130" cy="178" r="14" fill="#ffffff"/>`,
    ),
  },
  {
    id: "badge-live-tv",
    name: "Badge Live TV",
    category: "badges",
    svg: svgRoot(
      380, 120,
      `<defs><filter id="shb4" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/></filter></defs>
      <g filter="url(#shb4)">${pill(380, 120, "#18181b")}
      <rect x="10" y="10" width="360" height="100" rx="50" fill="none" stroke="#dc2626" stroke-width="6"/>
      <circle cx="66" cy="60" r="13" fill="#dc2626"><animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/></circle>
      ${txt(228, 60, 46, "#ffffff", "EN DIRECT")}</g>`,
    ),
  },
  {
    id: "bubble-amen",
    name: "Bulle AMEN !",
    category: "badges",
    svg: svgRoot(
      380, 180,
      `<defs><filter id="shb5" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/></filter></defs>
      <g filter="url(#shb5)">${bubbleShape(380, 176, "#ffffff", "#e4e4e7")}
      ${txt(196, 84, 62, "#18181b", "AMEN !")}</g>`,
    ),
  },
  {
    id: "bubble-halleluja",
    name: "Bulle ALLELUIA !",
    category: "badges",
    svg: svgRoot(
      440, 180,
      `<defs><linearGradient id="gb6" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#fde68a"/></linearGradient><filter id="shb6" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/></filter></defs>
      <g filter="url(#shb6)">${bubbleShape(440, 176, "url(#gb6)", "#d97706")}
      ${txt(228, 84, 54, "#7c2d12", "ALLELUIA !")}</g>`,
    ),
  },
  {
    id: "bubble-merci",
    name: "Bulle MERCI !",
    category: "badges",
    svg: svgRoot(
      340, 170,
      `<defs><filter id="shb7" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/></filter></defs>
      <g filter="url(#shb7)">${bubbleShape(340, 166, "#ffffff", "#e4e4e7")}
      ${txt(178, 80, 58, "#2563eb", "MERCI !")}</g>`,
    ),
  },
  {
    id: "bubble-wow",
    name: "Bulle WOW !",
    category: "badges",
    svg: svgRoot(
      340, 200,
      `<defs><linearGradient id="gb8" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c084fc"/><stop offset="1" stop-color="#7c3aed"/></linearGradient><filter id="shb8" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.3"/></filter></defs>
      <g filter="url(#shb8)">
        ${starPath(170, 92, 132, "url(#gb8)")}
        ${starPath(170, 92, 100, "#ffffff")}
        ${txt(170, 90, 72, "#7c3aed", "WOW !")}
        <circle cx="42" cy="160" r="10" fill="#c084fc"/><circle cx="74" cy="182" r="7" fill="#a78bfa"/><circle cx="298" cy="160" r="10" fill="#c084fc"/><circle cx="266" cy="182" r="7" fill="#a78bfa"/>
      </g>`,
    ),
  },
  {
    id: "bubble-gloria",
    name: "Bulle GLORIA !",
    category: "badges",
    svg: svgRoot(
      360, 170,
      `<defs><filter id="shb9" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/></filter></defs>
      <g filter="url(#shb9)">${bubbleShape(360, 166, "#ffffff", "#e4e4e7")}
      ${txt(188, 80, 58, "#C9A227", "GLORIA !")}</g>`,
    ),
  },
  {
    id: "badge-soli-deo",
    name: "Soli Deo Gloria",
    category: "badges",
    svg: svgRoot(
      480, 130,
      `<defs><linearGradient id="gb10" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d28d9"/><stop offset="1" stop-color="#2e1065"/></linearGradient><filter id="shb10" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/></filter></defs>
      <g filter="url(#shb10)">
        <path d="M18 4 h444 q18 0 18 22 v82 q0 22 -18 22 H18 q-18 0 -18 -22 V26 q0 -22 18 -22 z" fill="url(#gb10)"/>
        <path d="M6 26 q226 -30 456 0" stroke="#fcd34d" stroke-width="10" fill="none" opacity="0.6"/>
        ${txt(240, 65, 46, "#fde68a", "SOLI DEO GLORIA")}
      </g>`,
    ),
  },
  {
    id: "check-badge",
    name: "Badge Validé",
    category: "badges",
    svg: svgRoot(
      240, 240,
      `<defs><linearGradient id="gb11" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>
      <circle cx="120" cy="120" r="110" fill="url(#gb11)"/>
      <circle cx="120" cy="120" r="88" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.5"/>
      <path d="M74 124 L108 158 L170 88" stroke="#ffffff" stroke-width="24" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: "badge-beni",
    name: "BÉNI !",
    category: "badges",
    svg: svgRoot(
      340, 170,
      `<defs><linearGradient id="gb12" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#b45309"/></linearGradient><filter id="shb12" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.3"/></filter></defs>
      <g filter="url(#shb12)">
        ${starPath(170, 85, 130, "url(#gb12)")}
        ${starPath(170, 85, 98, "#fffbeb")}
        ${txt(170, 84, 60, "#92400e", "BÉNI !")}
        ${starPath(56, 142, 26, "#fbbf24")}${starPath(284, 142, 26, "#fbbf24")}
      </g>`,
    ),
  },
];

// ─── CATÉGORIE : FORMES & EFFETS ───

const SHAPES: StickerPro[] = [
  {
    id: "sparkles",
    name: "Étincelles",
    category: "shapes",
    svg: svgRoot(
      300, 300,
      `<g fill="#fde047">
        <path d="M150 30 L168 108 L246 126 L168 144 L150 222 L132 144 L54 126 L132 108 Z"/>
        <path d="M52 40 L60 70 L90 78 L60 86 L52 116 L44 86 L14 78 L44 70 Z" opacity="0.85"/>
        <path d="M248 190 L257 223 L290 232 L257 241 L248 274 L239 241 L206 232 L239 223 Z" opacity="0.85"/>
        <circle cx="244" cy="70" r="9"/><circle cx="58" cy="238" r="7"/>
      </g>`,
    ),
  },
  {
    id: "confetti",
    name: "Confettis",
    category: "shapes",
    svg: svgRoot(
      360, 260,
      `<g>
        <rect x="30" y="40" width="34" height="14" rx="7" fill="#f87171" transform="rotate(24 47 47)"/>
        <rect x="90" y="24" width="34" height="14" rx="7" fill="#fbbf24" transform="rotate(-18 107 31)"/>
        <rect x="160" y="52" width="34" height="14" rx="7" fill="#34d399" transform="rotate(40 177 59)"/>
        <rect x="236" y="30" width="34" height="14" rx="7" fill="#60a5fa" transform="rotate(-30 253 37)"/>
        <rect x="300" y="70" width="34" height="14" rx="7" fill="#c084fc" transform="rotate(14 317 77)"/>
        <rect x="60" y="150" width="34" height="14" rx="7" fill="#60a5fa" transform="rotate(-24 77 157)"/>
        <rect x="140" y="170" width="34" height="14" rx="7" fill="#f87171" transform="rotate(32 157 177)"/>
        <rect x="220" y="200" width="34" height="14" rx="7" fill="#fbbf24" transform="rotate(-40 237 207)"/>
        <rect x="310" y="180" width="34" height="14" rx="7" fill="#34d399" transform="rotate(20 327 187)"/>
        <circle cx="120" cy="110" r="10" fill="#f472b6"/><circle cx="270" cy="120" r="12" fill="#c084fc"/>
        <circle cx="50" cy="220" r="9" fill="#fbbf24"/><circle cx="190" cy="120" r="8" fill="#34d399"/>
        <path d="M320 108 l10 6 v12 l-10 6 -10 -6 v-12 z" fill="#f87171"/>
        <path d="M90 90 l9 5 v11 l-9 5 -9 -5 v-11 z" fill="#60a5fa"/>
      </g>`,
    ),
  },
  {
    id: "fire",
    name: "Flamme",
    category: "shapes",
    svg: svgRoot(
      240, 300,
      `<defs><linearGradient id="gf1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f97316"/><stop offset="0.6" stop-color="#fbbf24"/><stop offset="1" stop-color="#fef08a"/></linearGradient></defs>
      <path d="M120 8 C170 60 210 96 210 170 C210 240 172 288 120 288 C68 288 30 240 30 170 C30 140 44 110 70 82 C66 122 82 142 96 140 C80 96 96 44 120 8 Z" fill="url(#gf1)"/>
      <path d="M120 150 C146 186 158 208 158 236 C158 264 142 282 120 282 C98 282 82 264 82 236 C82 216 96 196 108 176 C106 196 112 208 120 210 C128 204 130 188 126 172 Z" fill="#fff7ed" opacity="0.85"/>`,
    ),
  },
  {
    id: "glow-ring",
    name: "Anneau lumineux",
    category: "shapes",
    svg: svgRoot(
      320, 320,
      `<defs><radialGradient id="gr1" cx="0.5" cy="0.5" r="0.5"><stop offset="0.62" stop-color="#22d3ee" stop-opacity="0"/><stop offset="0.78" stop-color="#22d3ee" stop-opacity="0.35"/><stop offset="0.86" stop-color="#a5f3fc" stop-opacity="0.9"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs>
      <circle cx="160" cy="160" r="160" fill="url(#gr1)"/>`,
    ),
  },
  {
    id: "hearts-confetti",
    name: "Cœurs confettis",
    category: "shapes",
    svg: svgRoot(
      360, 250,
      `<g>
        ${heartPath(50, 60, 56, "#f87171")}${heartPath(150, 40, 40, "#fb7185")}${heartPath(250, 70, 62, "#ef4444")}
        ${heartPath(330, 40, 36, "#f9a8d4")}${heartPath(90, 150, 44, "#f472b6")}${heartPath(200, 170, 58, "#e11d48")}
        ${heartPath(310, 160, 42, "#fb7185")}${heartPath(30, 210, 34, "#fda4af")}
      </g>`,
    ),
  },
  {
    id: "light-rays",
    name: "Rayons lumineux",
    category: "shapes",
    svg: svgRoot(
      380, 300,
      `<defs><linearGradient id="glr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047" stop-opacity="0.95"/><stop offset="1" stop-color="#fde047" stop-opacity="0.05"/></linearGradient></defs>
      <g fill="url(#glr1)">
        <path d="M190 0 L206 0 L188 300 L172 300 Z" transform="rotate(-38 190 150)"/>
        <path d="M190 0 L206 0 L188 300 L172 300 Z" transform="rotate(-19 190 150)"/>
        <path d="M190 0 L206 0 L188 300 L172 300 Z"/>
        <path d="M190 0 L206 0 L188 300 L172 300 Z" transform="rotate(19 190 150)"/>
        <path d="M190 0 L206 0 L188 300 L172 300 Z" transform="rotate(38 190 150)"/>
      </g>`,
    ),
  },
  {
    id: "star-gold",
    name: "Étoile dorée",
    category: "shapes",
    svg: svgRoot(
      280, 280,
      `<defs><linearGradient id="gs1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset="0.55" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>
      ${starPath(140, 140, 130, "url(#gs1)")}
      <path d="M96 74 Q118 52 148 56 Q128 66 124 84 Z" fill="#ffffff" opacity="0.55"/>`,
    ),
  },
  {
    id: "burst-lines",
    name: "Éclats d'insistance",
    category: "shapes",
    svg: svgRoot(
      340, 240,
      `<g stroke="#fbbf24" stroke-width="16" stroke-linecap="round">
        <line x1="170" y1="18" x2="170" y2="60"/>
        <line x1="170" y1="180" x2="170" y2="222"/>
        <line x1="30" y1="120" x2="72" y2="120"/>
        <line x1="268" y1="120" x2="310" y2="120"/>
        <line x1="70" y1="40" x2="100" y2="70"/>
        <line x1="240" y1="170" x2="270" y2="200"/>
        <line x1="270" y1="40" x2="240" y2="70"/>
        <line x1="100" y1="170" x2="70" y2="200"/>
      </g>`,
    ),
  },
];

export const STICKERS_V360: StickerPro[] = [...SOCIAL, ...ARROWS, ...BADGES, ...SHAPES];

export const stickersParCategorie = (cat: StickerPro["category"]): StickerPro[] =>
  STICKERS_V360.filter((s) => s.category === cat);

/**
 * ⭐ V3.60 — Rastériser un sticker SVG en PNG data-URL (côté navigateur).
 * Le PNG passe dans le pipeline ImageOverlay EXISTANT :
 *   - preview : <img> pleinne résolution, glisser / poignées / opacité ;
 *   - export  : downloadToTemp gère les data: URLs (ffmpeg overlay).
 * @param svg      le source SVG du sticker
 * @param maxCote  taille max en px du plus grand côté (512 par défaut)
 * @returns promesse du PNG data-URL
 */
/**
 * ⭐ V3.60 → V3.63 — Rastériser un sticker SVG en PNG data-URL (côté
 * navigateur). Le PNG passe dans le pipeline ImageOverlay EXISTANT :
 *   - preview : <img> pleine résolution, glisser / poignées / opacité ;
 *   - export  : downloadToTemp gère les data: URLs (ffmpeg overlay).
 * ⭐ V3.63 — 2048 px (AVANT : 512) : les boutons restaient NETS une fois
 * posés sur le canevas d'export 1920-2160 px — 512 px rastérisés étaient
 * agrandis 3-4× → flous/pixelisés (« pas professionnel »). 2048 px couvre
 * tous les usages courants (largeur pleine en 1080p) sans exploser le
 * poids du PNG (200-400 Ko par sticker).
 */
export function rasteriserStickerEnPng(svg: string, maxCote = 2048): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = maxCote / Math.max(img.naturalWidth || maxCote, img.naturalHeight || maxCote);
      const w = Math.max(1, Math.round((img.naturalWidth || maxCote) * ratio));
      const h = Math.max(1, Math.round((img.naturalHeight || maxCote) * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D indisponible"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Chargement du SVG impossible"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
