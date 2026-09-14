#!/usr/bin/env node
/**
 * ⭐ V3.79 — Validation locale (avant push).
 *
 * Page dédiée Adoration & Louanges (Afrika, chantre de l'Éternel) :
 *  ① navigation : sous-bouton « Adoration & Louanges » sous Média
 *     (site-header + navigation-menu-4 + footers + carte page Afrika) ;
 *  ② page publique /adoration-louanges : hero back-office, sections
 *     SCINDÉES Adoration / Louanges, lecteur intégré (TikTok/YouTube/
 *     natif), likes, partage, lien profond ?v= ;
 *  ③ scission : /videos EXCLUT les catégories Adoration/Louanges ;
 *  ④ back-office : module /admin/adoration (onglets, modal création
 *     lien/fichier + miniature + catégorie, bascule en ligne, édition
 *     post-production, suppression) + entrée sidebar ;
 *  ⑤ rubriques partagées : CATEGORIES_ADORATION + options back-office ;
 *  ⑥ hero « adoration-louanges » dans HERO_PAGES + DEFAULT_HEROES
 *     (back-office /admin/heroes).
 *
 * Usage : node scripts/valider-v379.cjs
 */
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "..");
let ok = 0;
function verifie(etiquette, condition) {
  if (condition) {
    ok++;
    console.log(`  ✔ ${etiquette}`);
  } else {
    console.error(`  ✗ ${etiquette}`);
    process.exitCode = 1;
  }
}
function lit(rel) {
  return fs.readFileSync(path.join(racine, rel), "utf8");
}

console.log("── V3.79 · ① Rubriques partagées (video-rubrics.ts) ──────");
const rubrics = lit("src/lib/video-rubrics.ts");
verifie(
  "CATEGORIES_ADORATION = [Adoration, Louanges] définie",
  /export const CATEGORIES_ADORATION: string\[\] = \["Adoration", "Louanges"\]/.test(rubrics)
);
verifie(
  "helper estCategorieAdoration exporté",
  /export function estCategorieAdoration\(/.test(rubrics)
);
verifie(
  "Adoration et Louanges proposées dans RUBRIQUE_OPTIONS (back-office)",
  /value: "Adoration"/.test(rubrics) && /value: "Louanges"/.test(rubrics)
);
verifie(
  "les catégories adoration ne sont PAS des rubriques épinglées /videos (pas dans RUBRIQUES.afrika)",
  !/afrika: \["Saint-Esprit réponds-moi", "Adoration"/.test(rubrics)
);
verifie(
  "catégorisation automatique incapable de produire Adoration/Louanges (explicite uniquement)",
  !/return "Adoration"|return "Louanges"/.test(rubrics)
);

console.log("── V3.79 · ② Hero paramétrable (hero-defaults.ts) ─────────");
const heroDefaults = lit("src/lib/hero-defaults.ts");
verifie(
  "HERO_PAGES contient « adoration-louanges » (back-office /admin/heroes)",
  /page: "adoration-louanges", label: "Adoration & Louanges"/.test(heroDefaults)
);
verifie(
  "DEFAULT_HEROES contient le hero « adoration-louanges »",
  /"adoration-louanges": \{/.test(heroDefaults)
);
verifie(
  "hero par défaut : kicker « Chantre de l'Éternel » + accent « Louanges »",
  /kicker: "Chantre de l'Éternel"/.test(heroDefaults) &&
    /titleAccent: "Louanges"/.test(heroDefaults)
);

console.log("── V3.79 · ③ Navigation publique ─────────────────────────");
const header = lit("src/components/site/site-header.tsx");
verifie(
  "site-header : sous-bouton « Adoration & Louanges » dans le groupe Média",
  /label: "Média"[\s\S]{0,220}?label: "Adoration & Louanges", href: "\/adoration-louanges"/.test(header)
);
const nav4 = lit("src/components/ui/navigation-menu-4.tsx");
verifie(
  "navigation-menu-4 : entrée « Adoration & Louanges » dans le groupe Médias",
  /label: "Médias"[\s\S]{0,450}?href: "\/adoration-louanges", label: "Adoration & Louanges"/.test(nav4)
);
const footC = lit("src/components/site/conditional-footer.tsx");
verifie(
  "conditional-footer : lien « Adoration & Louanges »",
  /label: "Adoration & Louanges", href: "\/adoration-louanges"/.test(footC)
);
const footS = lit("src/components/site/site-footer.tsx");
verifie(
  "site-footer : lien « Adoration & Louanges » (Découvrir)",
  /label: "Adoration & Louanges", href: "\/adoration-louanges"/.test(footS)
);
const afrika = lit("src/components/site/afrika-view.tsx");
verifie(
  "page Afrika : carte « Adoration & Louanges » → /adoration-louanges (grille 4 colonnes)",
  /lg:grid-cols-4/.test(afrika) &&
    /href="\/adoration-louanges"/.test(afrika) &&
    /Adoration & Louanges/.test(afrika)
);
verifie(
  "page Afrika : icône Music importée (lucide) pour la carte chantre",
  /import \{[^}]*\bMusic\b[^}]*\} from "lucide-react"/.test(afrika)
);

console.log("── V3.79 · ④ Page publique /adoration-louanges ───────────");
const pagePub = lit("src/app/adoration-louanges/page.tsx");
verifie(
  "page serveur créée (getHero + photosServiteurs → AdorationView)",
  /getHero\("adoration-louanges"\)/.test(pagePub) &&
    /AdorationView/.test(pagePub)
);
verifie(
  "page serveur force-dynamic (publications visibles immédiatement)",
  /export const dynamic = "force-dynamic"/.test(pagePub)
);
verifie(
  "metadata : titre « Adoration & Louanges | Christ Libère »",
  /title: "Adoration & Louanges \| Christ Libère"/.test(pagePub)
);
const vue = lit("src/components/adoration/adoration-view.tsx");
verifie(
  "vue : ne retient que les médias d'Afrika des catégories Adoration/Louanges",
  /v\.servant === "afrika" && estCategorieAdoration\(v\.category\)/.test(vue)
);
verifie(
  "vue : sections SCINDÉES construites depuis CATEGORIES_ADORATION",
  /CATEGORIES_ADORATION\.map\(\(name\) => \(\{/.test(vue) &&
    /sectionsAffichees/.test(vue)
);
verifie(
  "vue : lecteur TikTok intégré (LecteurTikTok importé et utilisé)",
  /import \{ LecteurTikTok \}/.test(vue) && /<LecteurTikTok/.test(vue)
);
verifie(
  "vue : lecteur YouTube (iframe embed) ET lecteur natif (<video controls>)",
  /youtube\.com\/embed\//.test(vue) && /<video[\s\S]{0,300}?controls/.test(vue)
);
verifie(
  "vue : likes réels persistés (/api/videos/[id]/like + localStorage)",
  /\/api\/videos\/\$\{video\.id\}\/like/.test(vue) &&
    /localStorage\.getItem\("likedVideos"/.test(vue)
);
verifie(
  "vue : modal de partage (ShareModal) + URL publique /adoration-louanges?v=",
  /ShareModal/.test(vue) &&
    /\/adoration-louanges\?v=\$\{video\.id\}/.test(vue)
);
verifie(
  "vue : lien profond ?v= résolu au chargement (partages jouent le chant)",
  /URLSearchParams\(window\.location\.search\)\.get\("v"\)/.test(vue)
);
verifie(
  "vue : IsololeText autour des textes du hero (convention Isolélé)",
  /IsololeText>\{hero\.kicker\}/.test(vue)
);
verifie(
  "vue : identité de la chantre (photo + « Artiste · Chantre de l'Éternel »)",
  /photos\.afrika/.test(vue) && /Chantre de l&apos;Éternel/.test(vue)
);
verifie(
  "vue : recherche + tri (même mécanique que /videos)",
  /searchQuery/.test(vue) && /sortOrder/.test(vue)
);
verifie(
  "vue : états vides élégants (« arrivent bientôt », pas d'erreur)",
  /arrivent bientôt/.test(vue)
);

console.log("── V3.79 · ⑤ Scission : /videos exclut l'adoration ───────");
const videosView = lit("src/components/videos/videos-view.tsx");
verifie(
  "videos-view : import estCategorieAdoration",
  /estCategorieAdoration/.test(videosView.split("video-rubrics")[1] || "")
    ? true
    : /estCategorieAdoration,/.test(videosView)
);
verifie(
  "videos-view : filtre d'exclusion appliqué au chargement",
  /\.filter\(\s*\(v: VideoItem\) => !estCategorieAdoration\(v\.category\)/.test(videosView)
);

console.log("── V3.79 · ⑥ Back-office /admin/adoration ───────────────");
const pageAdmin = lit("src/app/admin/adoration/page.tsx");
verifie(
  "page serveur admin créée (module dédié, force-dynamic)",
  /export const dynamic = "force-dynamic"/.test(pageAdmin) &&
    /AdorationTabsClient/.test(pageAdmin)
);
verifie(
  "page serveur : where category IN CATEGORIES_ADORATION",
  /category: \{ in: CATEGORIES_ADORATION \}/.test(pageAdmin)
);
verifie(
  "page serveur : garde ensureVideoCategoryColumn (base froide)",
  /ensureVideoCategoryColumn/.test(pageAdmin)
);
verifie(
  "page serveur : format RSC-safe (projectState null, data URLs filtrées)",
  /projectState: null/.test(pageAdmin)
);
const moduleAdmin = lit("src/components/admin/adoration-tabs-client.tsx");
verifie(
  "module : onglets scindés Adoration / Louanges avec comptes",
  /mediasParCategorie/.test(moduleAdmin) && /CATEGORIES_ADORATION\.map/.test(moduleAdmin)
);
verifie(
  "module : création via POST /admin/api/videos (même API que le module Vidéos)",
  /\/admin\/api\/videos"/.test(moduleAdmin)
);
verifie(
  "module : catégorie explicite envoyée à la création (scission garantie)",
  /category: form\.category/.test(moduleAdmin)
);
verifie(
  "module : upload séquentiel R2 (uploaderSequentielVersR2 + multipart)",
  /uploaderSequentielVersR2/.test(moduleAdmin) &&
    /\/api\/videos\/\$\{mediaId\}\/multipart/.test(moduleAdmin)
);
verifie(
  "module : commit d'upload (/api/videos/[id]/upload)",
  /\/api\/videos\/\$\{mediaId\}\/upload/.test(moduleAdmin)
);
verifie(
  "module : pré-remplissage TikTok (proxy oEmbed → titre + miniature)",
  /\/api\/tiktok\/oembed\?url=/.test(moduleAdmin)
);
verifie(
  "module : miniature par upload (compressHeroImage + MiniatureField)",
  /compressHeroImage/.test(moduleAdmin) && /MiniatureField/.test(moduleAdmin)
);
verifie(
  "module : bascule Adoration ↔ Louanges EN LIGNE (PATCH /admin/api/videos/[id])",
  /\/admin\/api\/videos\/\$\{mediaId\}`/.test(moduleAdmin) &&
    /changerCategorie/.test(moduleAdmin)
);
verifie(
  "module : édition via le système de post-production (/admin/videos/[id]/edit)",
  /\/admin\/videos\/\$\{media\.id\}\/edit/.test(moduleAdmin)
);
verifie(
  "module : suppression via DeleteButton (purge R2 synchronisée)",
  /DeleteButton entity="videos"/.test(moduleAdmin)
);
verifie(
  "module : Afrika pré-sélectionnée (serviteur + lien page publique)",
  /preselectedServantId/.test(moduleAdmin) && /Voir la page publique/.test(moduleAdmin)
);
const layout = lit("src/app/admin/layout.tsx");
verifie(
  "sidebar admin : « Adoration & Louanges » dans la section Média (icône Music)",
  /label: "Adoration & Louanges", href: "\/admin\/adoration", icon: Music/.test(layout)
);

console.log("── V3.79 · ⑦ Route upload restaurée (déletion locale) ────");
verifie(
  "/api/videos/[id]/upload/route.ts présent (commit d'upload du modal)",
  fs.existsSync(path.join(racine, "src/app/api/videos/[id]/upload/route.ts"))
);

console.log(`\n${ok} vérifications passées${process.exitCode ? " — AVEC ÉCHECS ⚠" : ""}`);
process.exit(process.exitCode || 0);
