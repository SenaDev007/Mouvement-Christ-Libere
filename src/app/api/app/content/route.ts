/**
 * API PUBLIQUE — Bundle de contenu de l'application mobile (⭐ V4.10).
 *
 *   GET /api/app/content → { hash, generatedAt, data }
 *
 * Rôle : PILE TEMPS RÉEL + BASE LOCALE de l'app « Christ Libère ».
 *
 * ① TEMPS RÉEL — la coquille de l'app interroge cette route toutes les 60 s
 *   (quand elle est en ligne). Le `hash` change dès qu'un contenu public
 *   évolue (photo remplacée dans le back-office, nouvelle vidéo, nouvelle
 *   annonce, hero modifié…) → l'app appelle `router.refresh()` → les pages
 *   se re-rendent avec les données fraîches, exactement comme le site.
 *
 * ② BASE LOCALE — la réponse complète est stockée dans IndexedDB (Dexie,
 *   cf. src/lib/offline/db.ts) : c'est la « base de données locale » de
 *   l'app, consultable hors ligne.
 *
 * Contenu : PUBLIC uniquement (aucune donnée de membre). Agrégats légers
 * (compteurs + max updatedAt) + hero landing + photos effectives des
 * serviteurs.
 */

import { NextResponse } from "next/server";
import { getHero } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   Hash FNV-1a 32 bits — léger, déterministe, sans dépendance
   ============================================================ */

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Agrégat (nb + dernière maj) d'une table — null si injoignable. */
async function stampOf(
  model: {
    aggregate: (args: {
      _count: true;
      _max: { updatedAt?: true; publishedAt?: true; createdAt?: true };
    }) => Promise<{ _count: number; _max: Record<string, Date | null> }>;
  },
  dateField: "updatedAt" | "publishedAt" | "createdAt"
): Promise<{ count: number; latest: string | null }> {
  const _max: Record<string, true> = { [dateField]: true };
  const res = await model.aggregate({ _count: true, _max });
  const latest = res._max?.[dateField] ?? null;
  return { count: res._count, latest: latest ? latest.toISOString() : null };
}

/* ============================================================
   GET
   ============================================================ */

export async function GET() {
  const generatedAt = new Date().toISOString();

  // ── Données directes (hero landing + photos serviteurs) ─────────────
  const [heroLanding, serviteurs] = await Promise.all([
    getHero("landing").catch(() => null),
    photosServiteurs().catch(() => null),
  ]);

  // ── Tampons d'horodatage par section publique ───────────────────────
  const stamps: Record<string, { count: number; latest: string | null } | null> = {};

  try {
    const { db } = await import("@/lib/db");

    // Toutes les configurations hero (landing, serviteurs, adoration,
    // intercession, disperses…) : un changement d'image ou de texte
    // quelconque modifie updatedAt → le hash change.
    try {
      const rows = await db.heroSection.findMany({
        select: { page: true, updatedAt: true },
      });
      (stamps as Record<string, unknown>).heroSections = rows
        .map((r) => `${r.page}:${r.updatedAt?.toISOString?.() ?? ""}`)
        .sort();
    } catch {
      (stamps as Record<string, unknown>).heroSections = null;
    }

    try { stamps.videos = await stampOf(db.video as never, "updatedAt"); } catch { stamps.videos = null; }
    try { stamps.temoignages = await stampOf(db.testimony as never, "publishedAt"); } catch { stamps.temoignages = null; }
    try { stamps.enseignements = await stampOf(db.teaching as never, "publishedAt"); } catch { stamps.enseignements = null; }
    try { stamps.temoignagesCroyants = await stampOf(db.croyantTestimony as never, "createdAt"); } catch { stamps.temoignagesCroyants = null; }
    try { stamps.annonces = await stampOf(db.ministryAnnouncement as never, "updatedAt"); } catch { stamps.annonces = null; }
    try { stamps.intercessions = await stampOf(db.intercessionRequest as never, "updatedAt"); } catch { stamps.intercessions = null; }
    try { stamps.disperses = await stampOf(db.disperseMember as never, "createdAt"); } catch { stamps.disperses = null; }
    try { stamps.lives = await stampOf(db.liveStream as never, "updatedAt"); } catch { stamps.lives = null; }

    // Configurations du back-office (rendez-vous, module staff…) : toute
    // sauvegarde d'un paramètre fait bouger StaffSetting.updatedAt.
    try {
      const cfg = await db.staffSetting.aggregate({
        _count: true,
        _max: { updatedAt: true },
      });
      (stamps as Record<string, unknown>).parametrages = {
        count: cfg._count,
        latest: cfg._max.updatedAt ? cfg._max.updatedAt.toISOString() : null,
      };
    } catch {
      (stamps as Record<string, unknown>).parametrages = null;
    }
  } catch (e) {
    // Base injoignable → bundle dégradé mais STABLE (pas de boucle de
    // rafraîchissement) : les tampons restent absents.
    console.warn("[api/app/content] Base injoignable :", e instanceof Error ? e.message : e);
  }

  const data = { heroLanding, serviteurs, sections: stamps };
  // ⚠ Le hash ne dépend QUE du contenu — jamais de generatedAt — sinon il
  // changerait à chaque appel et l'app se rafraîchirait en boucle.
  const hash = `fnv-${fnv1a(JSON.stringify(data))}`;

  return NextResponse.json(
    { hash, generatedAt, data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
