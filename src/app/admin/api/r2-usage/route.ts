import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  isR2Configured,
  listerObjetsR2,
  deleteFromR2,
  extractKeyFromUrl,
} from "@/lib/r2";
import { db } from "@/lib/db";
import {
  PREFIXE_MP4_TIKTOK,
  PLAFOND_MP4_TIKTOK_OCTETS,
} from "@/lib/tiktok-video";

/**
 * ⭐ V4.18 — OCCUPATION DU STOCKAGE R2 (back-office).
 *
 * Retour pasteur : le ministère reste sur le PLAN GRATUIT de Cloudflare
 * (10 Go de stockage/mois — pas de consensus pour la version payante) :
 * il ne faut PAS le dépasser. Cette route donne la mesure EXACTE du
 * bucket et permet de retirer les copies MP4 TikTok les moins populaires
 * (elles sont une OPTIMISATION — le repli iframe reste disponible).
 *
 *   GET  /admin/api/r2-usage
 *        → occupation totale + par groupe + vidéos TikTok avec copie.
 *
 *   POST /admin/api/r2-usage  { mode: "retirer-mp4", videoIds: [...] }
 *        → pour chaque vidéo : supprime l'objet R2 `videos/tiktok-<id>.mp4`
 *          ET remet tiktokMp4Url à null (les lecteurs repassent sur
 *          l'embed TikTok). Garde : seules les clés videos/tiktok- sont
 *          supprimables depuis cette route.
 *
 * Sécurité : session back-office obligatoire (même pattern que le pont).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_GRATUITE_OCTETS = 10 * 1024 * 1024 * 1024; // 10 Go

/** Groupe de rapport d'une clé R2. */
function groupeDeCle(cle: string): string {
  if (cle.startsWith(PREFIXE_MP4_TIKTOK)) return "videos/tiktok-*.mp4";
  if (cle.startsWith("miniatures/")) return "miniatures";
  const premier = cle.split("/")[0] || "(racine)";
  return cle.includes("/") ? `${premier}/*` : premier;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 non configuré" },
      { status: 503 }
    );
  }

  const objets = await listerObjetsR2("").catch(() => null);
  if (!objets) {
    return NextResponse.json(
      { error: "Listing du bucket impossible" },
      { status: 502 }
    );
  }

  let totalOctets = 0;
  const parGroupe = new Map<string, { octets: number; objets: number }>();
  for (const o of objets) {
    totalOctets += o.octets;
    const g = groupeDeCle(o.cle);
    const courant = parGroupe.get(g) ?? { octets: 0, objets: 0 };
    courant.octets += o.octets;
    courant.objets += 1;
    parGroupe.set(g, courant);
  }

  const videosAvecMp4 = await db.video.count({
    where: { tiktokMp4Url: { not: null } },
  });

  const go = (octets: number) => Math.round((octets / 1024 ** 3) * 100) / 100;
  return NextResponse.json({
    totalOctets,
    totalGo: go(totalOctets),
    totalObjets: objets.length,
    limiteGratuiteOctets: LIMITE_GRATUITE_OCTETS,
    plafondMp4TiktokOctets: PLAFOND_MP4_TIKTOK_OCTETS,
    depasseGratuit: totalOctets >= LIMITE_GRATUITE_OCTETS,
    videosAvecMp4Tiktok: videosAvecMp4,
    parGroupe: Array.from(parGroupe.entries())
      .map(([groupe, v]) => ({
        groupe,
        octets: v.octets,
        go: go(v.octets),
        objets: v.objets,
      }))
      .sort((a, b) => b.octets - a.octets),
  });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 non configuré" },
      { status: 503 }
    );
  }

  let body: { mode?: string; videoIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  // ─── Mode : purger les MP4 TikTok ORPHELINS ───
  // Objets `videos/tiktok-*.mp4` présents dans R2 mais plus référencés
  // par AUCUNE ligne Video (lots interrompus entre upload et commit,
  // vidéos supprimées du back-office…). ⭐ V4.18 — chasse au gaspillage
  // du stockage gratuit.
  if (body.mode === "purger-orphelins-mp4") {
    const objets = await listerObjetsR2(PREFIXE_MP4_TIKTOK).catch(() => null);
    if (!objets) {
      return NextResponse.json(
        { error: "Listing R2 impossible" },
        { status: 502 }
      );
    }
    const videos = await db.video.findMany({
      where: { tiktokMp4Url: { not: null } },
      select: { tiktokMp4Url: true },
    });
    const clesReferees = new Set(
      videos
        .map((v) => v.tiktokMp4Url)
        .map((u) => (u ? extractKeyFromUrl(u) : null))
    );
    const orphelins = objets.filter(
      (o) => o.cle.startsWith(PREFIXE_MP4_TIKTOK) && !clesReferees.has(o.cle)
    );
    let purges = 0;
    let octetsLiberes = 0;
    for (const o of orphelins) {
      try {
        await deleteFromR2(o.cle);
        purges++;
        octetsLiberes += o.octets;
      } catch {
        // objet suivant
      }
    }
    console.log(
      `[r2-usage] Purge orphelins : ${purges}/${orphelins.length} ` +
        `(${Math.round(octetsLiberes / 1e6)} Mo libérés)`
    );
    return NextResponse.json({
      success: true,
      purges,
      octetsLiberes,
      orphelinsDetectes: orphelins.length,
    });
  }

  if (body.mode !== "retirer-mp4" && body.mode !== "purger-orphelins-mp4") {
    return NextResponse.json(
      { error: "mode inconnu (retirer-mp4 | purger-orphelins-mp4)" },
      { status: 400 }
    );
  }

  const videoIds = Array.isArray(body.videoIds)
    ? body.videoIds.filter((v): v is string => typeof v === "string")
    : [];
  if (videoIds.length === 0) {
    return NextResponse.json({ error: "videoIds manquant" }, { status: 400 });
  }
  if (videoIds.length > 200) {
    return NextResponse.json(
      { error: "200 vidéos maximum par appel" },
      { status: 400 }
    );
  }

  const resultats: Array<{
    videoId: string;
    statut: "retire" | "sans-mp4" | "introuvable" | "erreur";
    cle?: string;
    erreur?: string;
  }> = [];

  for (const videoId of videoIds) {
    try {
      const video = await db.video.findUnique({
        where: { id: videoId },
        select: { tiktokMp4Url: true },
      });
      if (!video) {
        resultats.push({ videoId, statut: "introuvable" });
        continue;
      }
      if (!video.tiktokMp4Url) {
        resultats.push({ videoId, statut: "sans-mp4" });
        continue;
      }
      const cle = extractKeyFromUrl(video.tiktokMp4Url);
      // Garde : cette route ne supprime QUE nos copies TikTok.
      if (!cle || !cle.startsWith(PREFIXE_MP4_TIKTOK)) {
        resultats.push({
          videoId,
          statut: "erreur",
          erreur: "clé hors périmètre TikTok — refusée",
        });
        continue;
      }
      await deleteFromR2(cle);
      await db.video.updateMany({
        where: { id: videoId },
        data: { tiktokMp4Url: null },
      });
      resultats.push({ videoId, statut: "retire", cle });
    } catch (e) {
      resultats.push({
        videoId,
        statut: "erreur",
        erreur: e instanceof Error ? e.message : "erreur inconnue",
      });
    }
  }

  const retires = resultats.filter((r) => r.statut === "retire").length;
  console.log(
    `[r2-usage] Retrait de ${retires}/${videoIds.length} copies MP4 TikTok`
  );
  return NextResponse.json({ success: true, retires, resultats });
}
