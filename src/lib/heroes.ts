/**
 * ============================================================
 * ⭐ V3.45 — ACCÈS SERVEUR AUX SECTIONS HERO (table HeroSection)
 * ============================================================
 *
 * Utilisé par :
 *   - les PAGES SERVEUR du site public (getHero) ;
 *   - l'API publique /api/heroes (getAllHeroes) ;
 *   - le back-office /admin/heroes (via l'API générique
 *     /admin/api/heroes — ENTITY_MAP).
 *
 * Robustesse : si la table n'existe pas / DB injoignable / ligne
 * manquante → les VALEURS PAR DÉFAUT du code sont retournées
 * (jamais de crash, jamais de hero vide).
 */

import { db } from "@/lib/db";
import { ensureHeroSectionsTable } from "@/lib/ensure-schema";
import { DEFAULT_HEROES, HeroConfig } from "@/lib/hero-defaults";

interface HeroRow {
  page: string;
  kicker: string | null;
  title: string | null;
  titleAccent: string | null;
  titleSuffix: string | null;
  subtitle: string | null;
  backgroundImage: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  cta2Label: string | null;
  cta2Href: string | null;
  dataJson: string | null;
}

function defaultFor(page: string): HeroConfig {
  return (
    DEFAULT_HEROES[page] ?? {
      page,
      kicker: "",
      title: page,
      titleAccent: "",
      titleSuffix: "",
      subtitle: "",
      backgroundImage: "",
      ctaLabel: "",
      ctaHref: "",
      cta2Label: "",
      cta2Href: "",
      data: {},
    }
  );
}

/** Fusionne une ligne DB sur les défauts (NULL ⇒ valeur par défaut). */
function mergeRow(row: HeroRow): HeroConfig {
  const base = defaultFor(row.page);
  let data = base.data;
  if (row.dataJson) {
    try {
      const parsed = JSON.parse(row.dataJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // On part des défauts et on écrase par les clés présentes :
        // une clé supprimée en back-office retombe sur le défaut.
        data = { ...base.data };
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string") data[k] = v;
        }
      }
    } catch {
      // dataJson corrompu — on garde les défauts
    }
  }
  return {
    page: row.page,
    kicker: row.kicker ?? base.kicker,
    title: row.title ?? base.title,
    titleAccent: row.titleAccent ?? base.titleAccent,
    titleSuffix: row.titleSuffix ?? base.titleSuffix,
    subtitle: row.subtitle ?? base.subtitle,
    backgroundImage: row.backgroundImage ?? base.backgroundImage,
    ctaLabel: row.ctaLabel ?? base.ctaLabel,
    ctaHref: row.ctaHref ?? base.ctaHref,
    cta2Label: row.cta2Label ?? base.cta2Label,
    cta2Href: row.cta2Href ?? base.cta2Href,
    data,
  };
}

/**
 * Hero d'UNE page (config fusionnée DB + défauts).
 * Échec DB ⇒ défauts du code (site jamais cassé).
 */
export async function getHero(page: string): Promise<HeroConfig> {
  try {
    await ensureHeroSectionsTable();
    const row = (await db.heroSection.findUnique({
      where: { page },
    })) as unknown as HeroRow | null;
    if (!row) return defaultFor(page);
    return mergeRow(row);
  } catch (e) {
    console.warn(
      `[heroes] Lecture HeroSection « ${page} » impossible — valeurs par défaut :`,
      e instanceof Error ? e.message : e
    );
    return defaultFor(page);
  }
}

/**
 * Tous les heroes (clé → config fusionnée). Utilisé par l'API publique
 * /api/heroes. Les pages inconnues en base sont couvertes par les défauts.
 */
export async function getAllHeroes(): Promise<Record<string, HeroConfig>> {
  const result: Record<string, HeroConfig> = {};
  for (const key of Object.keys(DEFAULT_HEROES)) {
    result[key] = defaultFor(key);
  }
  try {
    await ensureHeroSectionsTable();
    const rows = (await db.heroSection.findMany()) as unknown as HeroRow[];
    for (const row of rows) {
      if (!row.page) continue;
      if (!(row.page in DEFAULT_HEROES) && !result[row.page]) {
        result[row.page] = defaultFor(row.page);
      }
      result[row.page] = mergeRow(row);
    }
  } catch (e) {
    console.warn(
      "[heroes] Lecture HeroSection impossible — valeurs par défaut :",
      e instanceof Error ? e.message : e
    );
  }
  return result;
}
