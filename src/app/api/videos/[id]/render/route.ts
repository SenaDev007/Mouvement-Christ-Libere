import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { uploadToR2, generateKey, isR2Configured } from "@/lib/r2";

const execAsync = promisify(exec);

/**
 * POST /api/videos/[id]/render
 *
 * Concatène intro + replay + outro avec FFmpeg.
 * Trim le replay (début/fin).
 * Sauvegarde le résultat final.
 *
 * FIX H8 : le fichier final produit par FFmpeg est uploadé vers Cloudflare R2
 *          (via uploadToR2) au lieu d'être copié dans `public/rendered-videos/`
 *          qui est read-only sur Vercel (EROFS). L'URL R2 est ensuite stockée
 *          dans `Video.videoUrl`.
 *
 * Body: {
 *   trimStart?: number,     // secondes
 *   trimEnd?: number,       // secondes
 *   introUrl?: string,      // URL ou base64 de la vidéo d'intro
 *   outroUrl?: string,      // URL ou base64 de la vidéo d'outro
 *   thumbnailUrl?: string,  // nouvelle miniature
 *   title?: string,         // nouveau titre
 * }
 */

// Chemin vers ffmpeg (ffmpeg-static en production, système en dev)
function getFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) return ffmpegStatic as string;
  } catch {}
  return "ffmpeg"; // fallback système
}

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

    // FIX H8 : le rendu final doit être uploadé vers R2. Sans R2 configuré,
    // on ne peut pas écrire dans public/ (read-only sur Vercel) ni stocker un
    // gros fichier en base64. On échoue tôt avec un message clair.
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
    const { trimStart, trimEnd, introUrl, outroUrl, thumbnailUrl, title } = body;

    // Récupérer la vidéo
    const video = await db.video.findUnique({
      where: { id },
      include: { servant: true },
    });
    if (!video) {
      return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
    }

    const ffmpegPath = getFfmpegPath();
    // /tmp est le SEUL répertoire inscriptible sur Vercel serverless.
    const tmpDir = path.join("/tmp", `render-${id}-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const steps: string[] = [];

    // ─── 1. Télécharger/téléverser la vidéo principale ───
    let mainFile = path.join(tmpDir, "main.mp4");
    if (video.videoUrl?.startsWith("http")) {
      // Télécharger depuis URL
      const res = await fetch(video.videoUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(mainFile, buf);
      steps.push("Téléchargement vidéo principale");
    } else if (video.videoUrl?.startsWith("data:")) {
      // Base64
      const base64 = video.videoUrl.split(",")[1];
      await fs.writeFile(mainFile, Buffer.from(base64, "base64"));
      steps.push("Décodage vidéo principale (base64)");
    } else {
      return NextResponse.json({ error: "Aucune vidéo source à éditer" }, { status: 400 });
    }

    // ─── 2. Trim la vidéo principale ───
    let trimmedFile = mainFile;
    if (trimStart != null && trimEnd != null && trimEnd > trimStart) {
      trimmedFile = path.join(tmpDir, "trimmed.mp4");
      const duration = trimEnd - trimStart;
      const cmd = `"${ffmpegPath}" -y -ss ${trimStart} -i "${mainFile}" -t ${duration} -c copy "${trimmedFile}"`;
      await execAsync(cmd);
      steps.push(`Trim: ${trimStart}s → ${trimEnd}s (${duration}s)`);
    }

    // ─── 3. Télécharger intro et outro ───
    const filesToConcat: string[] = [];

    if (introUrl) {
      const introFile = path.join(tmpDir, "intro.mp4");
      if (introUrl.startsWith("data:")) {
        const base64 = introUrl.split(",")[1];
        await fs.writeFile(introFile, Buffer.from(base64, "base64"));
      } else if (introUrl.startsWith("http")) {
        const res = await fetch(introUrl);
        await fs.writeFile(introFile, Buffer.from(await res.arrayBuffer()));
      }
      filesToConcat.push(introFile);
      steps.push("Intro ajoutée");
    }

    filesToConcat.push(trimmedFile);

    if (outroUrl) {
      const outroFile = path.join(tmpDir, "outro.mp4");
      if (outroUrl.startsWith("data:")) {
        const base64 = outroUrl.split(",")[1];
        await fs.writeFile(outroFile, Buffer.from(base64, "base64"));
      } else if (outroUrl.startsWith("http")) {
        const res = await fetch(outroUrl);
        await fs.writeFile(outroFile, Buffer.from(await res.arrayBuffer()));
      }
      filesToConcat.push(outroFile);
      steps.push("Outro ajouté");
    }

    // ─── 4. Concaténer ───
    let finalFile = trimmedFile;
    if (filesToConcat.length > 1) {
      // Créer le fichier de liste concat
      const listFile = path.join(tmpDir, "concat.txt");
      const listContent = filesToConcat.map((f) => `file '${f}'`).join("\n");
      await fs.writeFile(listFile, listContent);

      finalFile = path.join(tmpDir, "final.mp4");
      const cmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${listFile}" -c copy "${finalFile}"`;
      await execAsync(cmd);
      steps.push(`Concaténation de ${filesToConcat.length} segments`);
    }

    // ─── 5. FIX H8 : uploader le fichier final vers R2 ───
    // Au lieu de `fs.copyFile(finalFile, public/rendered-videos/...)` qui
    // déclenche EROFS sur Vercel, on lit le buffer final et on l'envoie sur R2.
    const finalBuffer = await fs.readFile(finalFile);
    const r2Key = generateKey("rendered-videos", `video-${id}`, "mp4");
    const outputUrl = await uploadToR2(r2Key, finalBuffer, "video/mp4");
    steps.push(`Upload R2 (${Math.round(finalBuffer.length / 1024 / 1024)}MB)`);

    // ─── 6. Mettre à jour la vidéo en DB ───
    await db.video.update({
      where: { id },
      data: {
        videoUrl: outputUrl,
        thumbnailUrl: thumbnailUrl || video.thumbnailUrl,
        title: title || video.title,
      },
    });

    // ─── 7. Nettoyer les fichiers temporaires ───
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
      { error: `Erreur de rendu: ${error instanceof Error ? error.message : "inconnue"}` },
      { status: 500 }
    );
  }
}
