import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAllHeroes } from "@/lib/heroes";
import { photosServiteurs } from "@/lib/servant-photos";
import {
  ensureVideoLikesColumn,
  ensureVideoCategoryColumn,
  ensureTiktokMp4UrlColumn,
  ensureBiographyPhotoColumn,
  ensureStaffSpaces,
  ensureCroyantTestimoniesTable,
} from "@/lib/ensure-schema";
import { categorizeVideo, estRubrique } from "@/lib/video-rubrics";
import { extraireTiktokId } from "@/lib/tiktok";
import { publierAnnoncesEchues, listerAnnoncesPubliees } from "@/lib/staff-space/annonces";

/**
 * ⭐ V4.09 — GET /api/app/sync — SYNCHRONISATION UNIFIÉE DE L'APP MOBILE.
 *
 * Une SEULE route publique renvoie TOUT le contenu éditorial de la
 * plateforme (application mobile « Mouvement Christ Libère » V2.0) :
 *   · serviteurs (bios + frises chronologiques + photos de profil) ;
 *   · sections hero paramétrables (bannières du back-office /admin/heroes) ;
 *   · témoignages CONFIRMÉS (page /temoignages) ;
 *   · enseignements (page /enseignements) ;
 *   · vidéos (même format que /api/videos — catégories, likes, vues…) ;
 *   · vies transformées (témoignages des croyants publiés) ;
 *   · annonces du ministère publiées (secrétariat) ;
 *   · lives programmés à venir + live EN COURS (bandeau DIRECT) ;
 *   · statistiques de la carte des dispersés.
 *
 * Objectif « hors-ligne d'abord » : l'app appelle cette route quand elle
 * a du réseau, met tout en base SQLite locale, puis TOUTES les pages de
 * contenu fonctionnent SANS connexion (seule la LECTURE des vidéos
 * exige Internet). Le back-office reste l'unique source de vérité : dès
 * qu'un serviteur publie, la prochaine synchronisation met l'app à jour.
 *
 * Aucune donnée privée : uniquement du contenu public (la messagerie
 * Yeshua Connect passe par ses routes /api/yeshua-connect/* dédiées,
 * authentifiées — jamais par ici).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ── Garde-fous idempotents (colonnes créées à la volée si absentes) ──
    await Promise.all([
      ensureVideoLikesColumn().catch(() => {}),
      ensureVideoCategoryColumn().catch(() => {}),
      ensureTiktokMp4UrlColumn().catch(() => {}),
      ensureBiographyPhotoColumn().catch(() => {}),
      ensureCroyantTestimoniesTable().catch(() => {}),
      ensureStaffSpaces().catch(() => {}),
    ]);

    // ── Chargement parallèle ──
    const [
      servants,
      heroes,
      photos,
      testimonies,
      teachings,
      videos,
      viesTransformees,
      annonces,
      livesAVenir,
      liveEnCours,
      disperses,
    ] = await Promise.all([
      db.servant.findMany({ where: { isActive: true } }),
      getAllHeroes().catch(() => ({})),
      photosServiteurs().catch(() => ({ afrika: "", kongo: "" })),
      db.testimony.findMany({
        where: { status: "CONFIRMED" },
        orderBy: { publishedAt: "desc" },
        include: { servant: true },
      }).catch(() => []),
      db.teaching.findMany({
        orderBy: { publishedAt: "desc" },
        include: { servant: true },
      }).catch(() => []),
      db.video.findMany({
        orderBy: { publishedAt: "desc" },
        include: { servant: true },
      }).catch(() => []),
      db.croyantTestimony.findMany({
        where: { statut: "publie" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 48,
        select: {
          id: true,
          nom: true,
          pays: true,
          ville: true,
          profession: true,
          eglise: true,
          categorie: true,
          titre: true,
          contenu: true,
          publishedAt: true,
        },
      }).catch(() => []),
      (async () => {
        // Bascule automatique des annonces planifiées arrivées à échéance
        // (même comportement que la page publique /annonces).
        await publierAnnoncesEchues().catch(() => {});
        const { items } = await listerAnnoncesPubliees(50, 0);
        return items;
      })().catch(() => []),
      db.liveStream.findMany({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: { servant: true },
      }).catch(() => []),
      db.liveStream.findFirst({
        where: { status: "LIVE" },
        orderBy: { startedAt: "desc" },
        include: { servant: true },
      }).catch(() => null),
      db.disperseMember.findMany({
        where: { isPublic: true },
        select: { pays: true, langue: true, niveau: true },
      }).catch(() => []),
    ]);

    // ── Frises chronologiques des serviteurs (jalons biographiques) ──
    const biographiesParServant = await Promise.all(
      servants.map(async (s) => {
        try {
          return {
            servantCode: s.code,
            jalons: await db.biography.findMany({
              where: { servant: { code: s.code } },
              orderBy: [{ order: "asc" }, { date: "asc" }],
              select: {
                id: true,
                date: true,
                title: true,
                description: true,
                verseRef: true,
                verseText: true,
                photoUrl: true,
                order: true,
              },
            }),
          };
        } catch {
          return { servantCode: s.code, jalons: [] };
        }
      })
    );

    // ── Statistiques dispersés (aucune donnée personnelle — que des comptes) ──
    const statsPays = new Map<string, number>();
    for (const d of disperses) {
      statsPays.set(d.pays, (statsPays.get(d.pays) || 0) + 1);
    }

    return NextResponse.json(
      {
        syncedAt: new Date().toISOString(),
        servants: servants.map((s) => ({
          id: s.id,
          code: s.code,
          fullName: s.fullName,
          shortName: s.shortName,
          role: s.role,
          bio: s.bio,
          portraitUrl: s.portraitUrl || "",
          photo: (photos as Record<string, string>)[s.code] || "",
          pays: s.pays || "",
          ville: s.ville || "",
          biographies:
            biographiesParServant.find((b) => b.servantCode === s.code)?.jalons || [],
        })),
        heroes,
        testimonies: testimonies.map((t) => ({
          id: t.id,
          title: t.title,
          short: t.short,
          content: t.content,
          themes: t.themes,
          bookRef: t.bookRef || "",
          readingTime: t.readingTime || "",
          publishedAt: t.publishedAt?.toISOString() || "",
          servant: t.servant?.code || "",
          servantName: t.servant?.shortName || "",
        })),
        teachings: teachings.map((t) => ({
          id: t.id,
          title: t.title,
          excerpt: t.excerpt,
          content: t.content,
          theme: t.theme,
          book: t.book,
          level: t.level,
          readingTime: t.readingTime || "",
          pdfUrl: t.pdfUrl || "",
          publishedAt: t.publishedAt?.toISOString() || "",
          servant: t.servant?.code || "",
          servantName: t.servant?.shortName || "",
        })),
        videos: videos.map((v) => {
          const youtubeId =
            v.videoUrl?.match(/v=([a-zA-Z0-9_-]{11})/)?.[1] ||
            v.videoUrl?.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1] ||
            "";
          const tiktokId = extraireTiktokId(v.videoUrl);
          const isDataUrl = v.videoUrl?.startsWith("data:") || false;
          const safeVideoUrl = isDataUrl ? null : v.videoUrl;
          return {
            id: v.id,
            youtubeId,
            tiktokId,
            videoUrl: safeVideoUrl,
            tiktokMp4Url:
              (v as unknown as { tiktokMp4Url?: string | null }).tiktokMp4Url ?? null,
            hlsUrl: v.hlsUrl,
            title: v.title,
            description: v.description,
            duration: v.duration || "",
            views: v.views,
            likes: (v as unknown as { likes?: number }).likes ?? 0,
            publishedAt: v.publishedAt?.toISOString() || "",
            category: categorizeVideo(v.title, v.servant.code, v.category),
            isRubric: estRubrique(v.category),
            servant: v.servant.code,
            servantName: v.servant.shortName,
            thumbnailUrl:
              v.thumbnailUrl ||
              (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : ""),
            isLive: v.isLive,
          };
        }),
        viesTransformees,
        annonces: annonces.map((a) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          category: a.category,
          publishedAt: a.publishedAt?.toISOString() || a.createdAt?.toISOString() || "",
        })),
        lives: {
          enCours: liveEnCours
            ? {
                id: liveEnCours.id,
                title: liveEnCours.title,
                servantName: liveEnCours.servant?.shortName || "",
                youtubeUrl: liveEnCours.youtubeUrl || "",
                hlsUrl: liveEnCours.hlsUrl || "",
                startedAt: liveEnCours.startedAt?.toISOString() || "",
              }
            : null,
          aVenir: livesAVenir.map((l) => ({
            id: l.id,
            title: l.title,
            servantName: l.servant?.shortName || "",
            scheduledAt: l.scheduledAt?.toISOString() || "",
            thumbnailUrl: l.thumbnailUrl || "",
          })),
        },
        disperses: {
          total: disperses.length,
          parPays: Object.fromEntries(statsPays),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/app/sync] Erreur :", error);
    return NextResponse.json(
      { error: "Synchronisation indisponible", syncedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
