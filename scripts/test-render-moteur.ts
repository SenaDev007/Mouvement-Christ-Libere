/**
 * ⭐ V3.16 — Test fonctionnel du moteur de rendu (filter_complex réécrit).
 * ============================================================================
 * Stratégie : executeRender s'exécute SANS R2 en local → l'upload échoue en
 * DERNIER, APRÈS toutes les commandes ffmpeg. Donc :
 *   - si l'erreur finale parle de R2/credentials/réseau → ffmpeg a TOUT
 *     exécuté avec succès (graphes de filtres VALIDES) ✓
 *   - si l'erreur vient de ffmpeg (Invalid/unrecognized/failed) → graphe
 *     cassé ✗
 * Les fichiers intermédiaires restent dans /tmp/render-test-v316/ pour
 * inspection (durée des sorties, présence des overlays…).
 *
 * Exécution : npx tsx scripts/test-render-moteur.ts
 */
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const TMP = "/tmp/render-test-v316";

async function main() {
  await fs.rm(TMP, { recursive: true, force: true });
  await fs.mkdir(TMP, { recursive: true });

  // ─── Assets de test (data URLs — le moteur n'accepte que data:/http(s)) ───
  const videoFile = path.join(TMP, "source.mp4");
  const imgFile = path.join(TMP, "logo.png");
  const audioFile = path.join(TMP, "musique.mp3");

  // Vidéo test : 4 s, 320x240, 10 fps, AVEC piste audio
  await execAsync(
    `ffmpeg -y -f lavfi -i testsrc=duration=4:size=320x240:rate=10 ` +
      `-f lavfi -i sine=frequency=440:duration=4 ` +
      `-c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${videoFile}"`,
  );
  // Image test : 64x64 rouge
  await execAsync(
    `ffmpeg -y -f lavfi -i color=c=red:size=64x64:duration=1 -frames:v 1 "${imgFile}"`,
  );
  // Audio test : 4 s de silence
  await execAsync(
    `ffmpeg -y -f lavfi -i anullsrc=duration=4 -c:a libmp3lame "${audioFile}"`,
  );
  console.log("✓ Assets de test générés (vidéo 4 s + image + audio)");

  const videoDataUrl = `data:video/mp4;base64,${(await fs.readFile(videoFile)).toString("base64")}`;
  const imgDataUrl = `data:image/png;base64,${(await fs.readFile(imgFile)).toString("base64")}`;
  const audioDataUrl = `data:audio/mpeg;base64,${(await fs.readFile(audioFile)).toString("base64")}`;

  // Import dynamique du moteur (chemins @/* résolus via tsconfig par tsx)
  const { executeRender } = await import("../src/lib/video-render");

  // La route API crée le répertoire de travail avant executeRender
  const workDir = path.join(TMP, "work");
  await fs.mkdir(workDir, { recursive: true });

  // ─── Scénario COMPLET : tout ce que le pasteur a testé ───
  const project = {
    videoId: "test-v316",
    segments: [
      {
        id: "main",
        type: "main" as const,
        url: videoDataUrl,
        label: "Replay principal",
        trimStart: 0.5,
        trimEnd: 3.5,
      },
    ],
    overlays: [
      {
        id: "texte-1",
        type: "text" as const,
        content: "Shalom !",
        x: 50,
        y: 20,
        fontSize: 24,
        fontColor: "#FFFFFF",
        bold: true,
        // PAS de startTime/endTime → toujours visible (bug V3.16 corrigé)
      },
      {
        id: "img-1",
        type: "image" as const,
        url: imgDataUrl,
        x: 80,
        y: 80,
        scale: 1,
        opacity: 0.9,
        // PAS de fenêtre temporelle → toujours visible
      },
      {
        id: "sticker-1",
        type: "sticker" as const,
        emoji: "🙏",
        x: 20,
        y: 50,
        size: 48,
        rotation: 0,
        opacity: 1,
      },
    ],
    colorAdjust: { brightness: 0.1, contrast: 1.2, saturation: 1.3, gamma: 1.1 },
    speed: { factor: 1.5 },
    transform: { rotate: 0, flipH: true, flipV: false },
    filters: "vintage" as const,
    audioTracks: [
      {
        id: "musique-1",
        url: audioDataUrl,
        volume: 0.5,
        name: "Musique",
        fadeIn: 0.2,
        fadeOut: 0.3,
      },
    ],
    mainVolume: 0.8,
    export: { aspectRatio: "original" as const, resolution: "original" as const, crf: 23 },
    title: "Test V3.16",
  };

  let erreurFinale = "";
  try {
    await executeRender(project as never, workDir);
    console.log("?! Rendu complet sans erreur (R2 configuré ?) — inattendu en local");
  } catch (e) {
    erreurFinale = e instanceof Error ? e.message : String(e);
    // stderr complet d'exec (structure d'erreur child_process)
    const err = e as { stderr?: string; code?: string };
    if (err.stderr) {
      console.log("\n──── STDERR FFMPEG ────");
      console.log(err.stderr.split("\n").filter((l) => l.trim()).slice(-8).join("\n"));
      console.log("────────────────────────");
    }
  }

  console.log("\nErreur finale du pipeline :", erreurFinale.slice(0, 200));

  // ─── Verdict : d'où vient l'échec ? ───
  const r2Erreur =
    /r2|credential|bucket|network|fetch|ENOTFOUND|ECONN|access.*key|getaddrinfo|403|signature/i.test(
      erreurFinale,
    );
  const ffmpegErreur = /invalid|unrecognized|failed to|no such filter|matches no streams|option not found|error while|cannot/i.test(
    erreurFinale,
  );

  if (r2Erreur && !ffmpegErreur) {
    console.log("\n✓✓✓ SUCCÈS : ffmpeg a exécuté TOUTES les étapes (normalisation + filtres)");
    console.log("    L'échec vient uniquement de l'upload R2 (attendu en local sans credentials).");
  } else {
    console.log("\n✗✗✗ ÉCHEC FFMPEG : le graphe de filtres est probablement invalide.");
    process.exitCode = 1;
  }

  // ─── Inspection des sorties intermédiaires ───
  try {
    const entries = await fs.readdir(path.join(TMP, "work"));
    console.log("\nFichiers intermédiaires :", entries.join(", "));
    for (const f of entries) {
      if (f.endsWith(".mp4")) {
        try {
          const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.join(TMP, "work", f)}"`,
          );
          console.log(`  · ${f} → durée ${stdout.trim()}s`);
        } catch {}
      }
    }
  } catch {}
}

main().catch((e) => {
  console.error("Erreur de test :", e);
  process.exit(1);
});
