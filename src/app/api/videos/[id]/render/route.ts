import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { isR2Configured } from "@/lib/r2";
import { executeRender, type RenderProject } from "@/lib/video-render";

/**
 * POST /api/videos/[id]/render
 *
 * Moteur de rendu post-production complet (Sprints 1-4).
 *
 * Accepte un RenderProject JSON décrivant :
 *  - segments (intro, main, outro, clips)
 *  - overlays (texte + image avec position/timing/style/animation)
 *  - subtitles (SRT brûlé avec style)
 *  - transitions (xfade entre segments)
 *  - colorAdjust (brightness/contrast/saturation/gamma)
 *  - speed (ralenti/accéléré)
 *  - transform (crop/scale/rotate/flip)
 *  - audioTracks (BGM, voiceover avec volume/fade)
 *  - export (aspect ratio, resolution, fps, bitrate/crf)
 *
 * Pipeline :
 *  1. Probe chaque input avec ffprobe
 *  2. Normalise chaque segment en H.264/AAC (même résolution/fps/SAR)
 *  3. Concatène les segments normalisés
 *  4. Applique le filter_complex (overlays + color + speed + transform + sous-titres + audio mix)
 *  5. Upload le résultat vers R2
 *  6. Met à jour Video en DB
 *  7. Nettoie /tmp
 *
 * maxDuration = 300 (5 min) — nécessaire pour les gros replays.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error:
            "Cloudflare R2 n'est pas configuré. Le rendu post-production nécessite R2 (variables R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
        },
        { status: 500 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    // Récupérer la vidéo
    const video = await db.video.findUnique({
      where: { id },
      include: { servant: true },
    });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    if (!video.videoUrl) {
      return NextResponse.json({ error: "Aucune vidéo source à éditer" }, { status: 400 });
    }

    // ─── Construire le RenderProject ───
    // Si le client envoie un RenderProject complet, l'utiliser tel quel.
    // Sinon, construire un projet minimal à partir de l'ancien format (rétro-compatibilité).
    let project: RenderProject;

    if (body.segments && Array.isArray(body.segments)) {
      // Nouveau format : RenderProject complet
      // ⭐ V3.16 — BUG CORRIGÉ : filters / stabilisation / chromaKey envoyés
      // par le client étaient ABANDONNÉS ici (le moteur de rendu ne les
      // recevait jamais → « les filtres ne fonctionnent pas », même à
      // l'export). Ils sont désormais transmis tels quels.
      project = {
        videoId: id,
        segments: body.segments,
        overlays: body.overlays || [],
        subtitles: body.subtitles,
        transitions: body.transitions,
        colorAdjust: body.colorAdjust,
        speed: body.speed,
        transform: body.transform,
        audioTracks: body.audioTracks,
        mainVolume: body.mainVolume,
        export: body.export || { aspectRatio: "original", resolution: "original" },
        thumbnailUrl: body.thumbnailUrl,
        title: body.title,
        filters: body.filters,
        stabilisation: body.stabilisation,
        chromaKey: body.chromaKey,
      };
    } else {
      // Ancien format (rétro-compatibilité) : trim + intro/outro
      const segments: RenderProject["segments"] = [];
      if (body.introUrl) {
        segments.push({
          id: "intro",
          type: "intro",
          url: body.introUrl,
          label: "Intro",
        });
      }
      segments.push({
        id: "main",
        type: "main",
        url: video.videoUrl,
        label: "Replay principal",
        trimStart: body.trimStart,
        trimEnd: body.trimEnd,
      });
      if (body.outroUrl) {
        segments.push({
          id: "outro",
          type: "outro",
          url: body.outroUrl,
          label: "Outro",
        });
      }

      project = {
        videoId: id,
        segments,
        overlays: [],
        export: { aspectRatio: "original", resolution: "original" },
        thumbnailUrl: body.thumbnailUrl,
        title: body.title,
      };
    }

    // ─── Exécuter le rendu ───
    const tmpDir = path.join("/tmp", `render-${id}-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const { outputUrl, steps } = await executeRender(project, tmpDir);

    // ─── Mettre à jour la vidéo en DB ───
    await db.video.update({
      where: { id },
      data: {
        videoUrl: outputUrl,
        thumbnailUrl: project.thumbnailUrl || video.thumbnailUrl,
        title: project.title || video.title,
      },
    });

    // ─── Nettoyer le répertoire temporaire ───
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}

    return NextResponse.json({
      success: true,
      videoUrl: outputUrl,
      storage: "r2",
      steps,
      message: `Rendu terminé: ${steps.length} étapes effectuées`,
    });
  } catch (error) {
    console.error("[render] Error:", error);
    return NextResponse.json(
      {
        error: `Erreur de rendu: ${error instanceof Error ? error.message : "inconnue"}`,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
