/**
 * POST /admin/api/tiktok/import-urls
 *
 * ⭐ V4.35 — Import manuel d'un batch d'URLs TikTok.
 *
 * Comme TikTok bloque de plus en plus le scraping automatique de la page
 * profil (X-Bogus, JavaScript rendering, captcha), cet endpoint permet à
 * l'admin d'importer manuellement les URLs TikTok qu'il a copiées depuis
 * son navigateur.
 *
 * Body JSON :
 *   {
 *     servantCode: string,        // "afrika" | "kongo"
 *     urls: string[],             // ["https://www.tiktok.com/@user/video/123", ...]
 *   }
 *
 * Pour chaque URL :
 *   ① Valider que c'est une URL TikTok valide
 *   ② Vérifier l'idempotence (déjà en base → ignorée)
 *   ③ Vérifier la mémoire des suppressions (V3.86)
 *   ④ Résoudre via tikwm : GET https://www.tikwm.com/api/?url=<url>
 *      → title, cover, play_count, digg_count, create_time
 *   ⑤ Filtrer par âge (> 10 jours → filtrée)
 *   ⑥ Insérer en DB avec catégorisation intelligente V4.28
 *
 * Rate limit : tikwm ~1 req/s → 1.3s de garde entre chaque résolution.
 * Limite : 30 URLs max par appel (pour rester sous le timeout serverless).
 *
 * Réponse 200 :
 *   {
 *     traitées: number,
 *     ajoutees: number,
 *     ignorees: number,
 *     sautees: number,
 *     filtrees: number,
 *     erreurs: string[],
 *     titres: string[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { estUrlTiktok, extraireTiktokId } from "@/lib/tiktok";
import { estVideoSupprimee } from "@/lib/suppression-video";
import { devinerCategorieSync } from "@/lib/video-rubrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TIKWM_ENDPOINT = "https://www.tikwm.com/api/";
const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const GARDE_TIKWM_MS = 1300;
const MAX_URLS = 30;

interface ReponseTikwmVideo {
  code?: number;
  msg?: string;
  data?: {
    id?: string | number;
    title?: string;
    desc?: string;
    cover?: string;
    origin_cover?: string;
    play_count?: number;
    digg_count?: number;
    create_time?: number;
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resoudreVideoViaTikwm(url: string): Promise<{
  video_id: string;
  title: string;
  cover?: string;
  play_count?: number;
  digg_count?: number;
  create_time?: number;
} | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const tikwmUrl = `${TIKWM_ENDPOINT}?url=${encodeURIComponent(url)}`;
    const res = await fetch(tikwmUrl, {
      headers: { "User-Agent": UA_NAVIGATEUR, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const reponse = (await res.json()) as ReponseTikwmVideo;
    if (reponse.code !== 0 || !reponse.data) return null;

    const d = reponse.data;
    const videoId = String(d.id || "");
    if (!videoId) return null;

    return {
      video_id: videoId,
      title: d.title || d.desc || "",
      cover: d.cover,
      play_count: d.play_count,
      digg_count: d.digg_count,
      create_time: d.create_time,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { servantCode?: string; urls?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const servantCode = body.servantCode?.trim();
  const urls = body.urls;

  if (!servantCode) {
    return NextResponse.json({ error: "servantCode requis" }, { status: 400 });
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls (tableau non vide) requis" }, { status: 400 });
  }

  // Résolution du serviteur
  const servant = await db.servant.findFirst({
    where: { code: { equals: servantCode, mode: "insensitive" } },
    select: { id: true, shortName: true },
  });
  if (!servant) {
    return NextResponse.json(
      { error: `Serviteur « ${servantCode} » introuvable en base.` },
      { status: 404 }
    );
  }

  // Filtrer + dédupliquer les URLs
  const urlsValides: string[] = [];
  const urlsDejaVues = new Set<string>();
  for (const url of urls) {
    if (typeof url !== "string") continue;
    const trimmed = url.trim();
    if (!trimmed) continue;
    if (!estUrlTiktok(trimmed)) continue;
    const id = extraireTiktokId(trimmed);
    if (!id) continue;
    if (urlsDejaVues.has(id)) continue;
    urlsDejaVues.add(id);
    urlsValides.push(trimmed);
  }

  if (urlsValides.length === 0) {
    return NextResponse.json({
      traitées: 0,
      ajoutees: 0,
      ignorees: 0,
      sautees: 0,
      filtrees: 0,
      erreurs: ["Aucune URL TikTok valide dans la liste fournie."],
      titres: [],
    });
  }

  // Limiter à MAX_URLS
  const urlsATraiter = urlsValides.slice(0, MAX_URLS);
  if (urlsValides.length > MAX_URLS) {
    console.warn(
      `[tiktok/import-urls] ${urlsValides.length} URLs reçues, limite à ${MAX_URLS}`
    );
  }

  // Idempotence : charger les IDs déjà en base
  const existantes = await db.video.findMany({
    where: { videoUrl: { not: null } },
    select: { videoUrl: true },
  });
  const idsExistants = new Set<string>();
  for (const v of existantes) {
    const id = extraireTiktokId(v.videoUrl);
    if (id) idsExistants.add(id);
  }

  // Filtre d'âge
  const LIMITE_JOURS = Math.max(1, Math.min(365, Number(process.env.SYNC_LIMITE_JOURS_TIKTOK) || 10));
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  const dateLimiteMs = Date.now() - LIMITE_JOURS * MS_PAR_JOUR;

  let ajoutees = 0;
  let ignorees = 0;
  let sautees = 0;
  let filtrees = 0;
  const titres: string[] = [];
  const erreurs: string[] = [];

  for (let i = 0; i < urlsATraiter.length; i++) {
    const url = urlsATraiter[i];
    const videoId = extraireTiktokId(url) || "";

    // Idempotence
    if (idsExistants.has(videoId)) {
      ignorees++;
      continue;
    }

    // Mémoire des suppressions
    if (await estVideoSupprimee(url)) {
      sautees++;
      continue;
    }

    // Résoudre via tikwm
    const video = await resoudreVideoViaTikwm(url);
    if (!video || !video.title) {
      erreurs.push(`Échec résolution tikwm : ${url}`);
      // Garde quand même entre les appels
      if (i < urlsATraiter.length - 1) await delay(GARDE_TIKWM_MS);
      continue;
    }

    // Filtre d'âge
    const datePublication = video.create_time
      ? new Date(video.create_time * 1000)
      : new Date();
    if (datePublication.getTime() < dateLimiteMs) {
      filtrees++;
      continue;
    }

    // Insertion
    try {
      await db.video.create({
        data: {
          servantId: servant.id,
          title: video.title,
          description: video.title.slice(0, 5000) || `Vidéo TikTok de ${servant.shortName}`,
          duration: "",
          videoUrl: url,
          thumbnailUrl: video.cover || null,
          views: video.play_count || 0,
          likes: video.digg_count || 0,
          isLive: false,
          category: devinerCategorieSync(video.title, servantCode),
          publishedAt: datePublication,
        },
      });
      idsExistants.add(videoId);
      ajoutees++;
      titres.push(video.title);
    } catch (e) {
      if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
        ignorees++;
        idsExistants.add(videoId);
      } else {
        erreurs.push(`Erreur DB : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Garde entre les appels tikwm
    if (i < urlsATraiter.length - 1) await delay(GARDE_TIKWM_MS);
  }

  return NextResponse.json({
    traitées: urlsATraiter.length,
    totalRecues: urlsValides.length,
    ajoutees,
    ignorees,
    sautees,
    filtrees,
    erreurs: erreurs.slice(0, 10),
    titres: titres.slice(0, 5),
  });
}
