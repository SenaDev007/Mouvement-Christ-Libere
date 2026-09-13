/**
 * ⭐ V3.77 — PHOTOS DE PROFIL DES SERVITEURS (« partout où il y a profil »).
 *
 * Demande de la servante de Dieu : « la photo de profil dans la barre de
 * navigation sur la page vidéo, partout où il y a profil — je voudrais que
 * ce soit la photo qui a été uploadée dans le back-office au niveau du
 * module serviteur, pour Afrika comme pour Pasteur Congo. Que cette
 * photo-là s'affiche partout sur le site. »
 *
 * UN SEUL point de vérité par serviteur, priorité décroissante :
 *   ① Servant.portraitUrl — photo uploadée dans le MODULE SERVITEURS
 *      (/admin/servants, compressée en data URL JPEG 256×256 ≤ 60 Ko —
 *      cf. compressAvatar). PRIORITÉ ABSOLUE : dès qu'une photo y est
 *      uploadée, elle remplace partout les autres sources ;
 *   ② data.bioPhoto du hero de la PAGE DU SERVITEUR (/afrika ou
 *      /pasteur-kongo — back-office /admin/heroes) : photos actuellement
 *      uploadées (data URLs) — c'est ELLES que la demande fait « passer »
 *      sur tout le site (onglets /videos, cartes de la landing, choix du
 *      serviteur de /rendez-vous) ;
 *   ③ repli : fichiers statiques historiques (/pam.jpeg,
 *      /pasteur-kongo.jpeg).
 *
 * Avant V3.77, chaque emplacement codait sa source en dur : les onglets
 * de /videos et le choix de /rendez-vous affichaient TOUJOURS les
 * fichiers statiques, même après un upload en back-office.
 *
 * ⚠️ Côté CLIENT : importer UNIQUEMENT le type (`import type`) — ce module
 * importe Prisma (serveur). Les vues rendent la photo via SmartImage,
 * qui bascule en <img> natif pour les data URLs (next/image ne les
 * optimise pas).
 */

import { db } from "@/lib/db";
import { getHero } from "@/lib/heroes";

/** Photos de profil effectives des deux serviteurs (jamais vides). */
export interface PhotosServiteurs {
  afrika: string;
  kongo: string;
}

/** Replis historiques (fichiers statiques du dépôt). */
export const PHOTOS_SERVITEURS_DEFAUT: PhotosServiteurs = {
  afrika: "/pam.jpeg",
  kongo: "/pasteur-kongo.jpeg",
};

/**
 * Une photo est-elle un VRAI upload back-office ?
 * (data URL — compression compressAvatar/compressHeroImage — ou URL http
 * externe ; les chemins locaux "/…" sont les fichiers statiques.)
 */
function estPhotoUpload(v: string | null | undefined): boolean {
  return !!v && (v.startsWith("data:") || /^https?:\/\//i.test(v));
}

/** Première photo « uploadée » parmi les candidates, sinon null. */
function priorite(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (estPhotoUpload(c)) return c as string;
  }
  return null;
}

/**
 * Photos de profil EFFECTIVES des deux serviteurs — la même photo pour
 * tous les emplacements « profil » du site (onglets /videos, barre du
 * lecteur, avatars des cartes, cartes serviteurs de la landing, cadre
 * doré des biographies, choix du serviteur de /rendez-vous).
 *
 * Robustesse : DB injoignable → défauts statiques (site jamais cassé).
 */
export async function photosServiteurs(): Promise<PhotosServiteurs> {
  // ① Portraits du module serviteurs (Servant.portraitUrl).
  let portraitAfrika: string | null = null;
  let portraitKongo: string | null = null;
  try {
    const rows = await db.servant.findMany({
      where: { code: { in: ["afrika", "kongo"] } },
      select: { code: true, portraitUrl: true },
    });
    portraitAfrika = rows.find((r) => r.code === "afrika")?.portraitUrl || null;
    portraitKongo = rows.find((r) => r.code === "kongo")?.portraitUrl || null;
  } catch (e) {
    console.warn(
      "[servant-photos] Lecture des portraits impossible :",
      e instanceof Error ? e.message : e
    );
  }

  // ② Photos « cadre doré » des pages serviteurs (hero data.bioPhoto).
  let bioAfrika: string | null = null;
  let bioKongo: string | null = null;
  try {
    const [heroAfrika, heroKongo] = await Promise.all([
      getHero("afrika"),
      getHero("pasteur-kongo"),
    ]);
    bioAfrika = heroAfrika.data.bioPhoto || null;
    bioKongo = heroKongo.data.bioPhoto || null;
  } catch (e) {
    console.warn(
      "[servant-photos] Lecture des heroes serviteurs impossible :",
      e instanceof Error ? e.message : e
    );
  }

  return {
    afrika:
      priorite(portraitAfrika, bioAfrika) || PHOTOS_SERVITEURS_DEFAUT.afrika,
    kongo: priorite(portraitKongo, bioKongo) || PHOTOS_SERVITEURS_DEFAUT.kongo,
  };
}
