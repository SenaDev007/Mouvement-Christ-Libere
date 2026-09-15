/**
 * ⭐ V3.86 — Tests de la SUPPRESSION DÉFINITIVE des vidéos (mémoire
 * anti-résurrection « tombstones »).
 *
 * Couverture :
 *   ① cleMediaDe — clé canonique : toutes les formes d'URL YouTube d'un
 *      même média → UNE clé ; TikTok /video/ et /photo/ → UNE clé ;
 *      URLs R2 (query signée retirée) ; null / data / relative → null ;
 *   ② cycle de vie de la mémoire AVEC BASE SIMULÉE (Prisma mocké) :
 *      enregistrer → retrouver (forme d'URL différente) → lever ;
 *      best-effort (échec base = jamais d'exception) ;
 *   ③ cohérence du CODE (fs) : garde 409 au POST, garde 409 au PATCH
 *      (changement d'URL uniquement), mémorisation au DELETE, garde de la
 *      récupération de replays (Passe 1 + /api/live/stop + webhook LiveKit),
 *      confirmation de réintégration dans les 2 modals (Vidéos + Adoration),
 *      scripts d'import 409 = ignoré.
 *
 * Exécution : bun scripts/v386-tests-suppression.ts
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";

let passes = 0;
let echecs = 0;

function verifie(libelle: string, condition: boolean, detail = "") {
  if (condition) {
    passes++;
    console.log(`  ✔ ${libelle}`);
  } else {
    echecs++;
    console.error(`  ✘ ${libelle}${detail ? " — " + detail : ""}`);
  }
}

const fs = await import("fs");
const path = await import("path");
const R = (p: string) => path.resolve(import.meta.dirname, "..", p);
const lire = (p: string) => fs.readFileSync(R(p), "utf8");

// ── ① cleMediaDe — clé canonique ─────────────────────────────────────
console.log("── ① Clé média canonique (cleMediaDe) ──");
{
  const { cleMediaDe } = await import("../src/lib/suppression-video");

  const formesYoutube = [
    "https://www.youtube.com/watch?v=UWgM2ELFI3M",
    "https://youtu.be/UWgM2ELFI3M",
    "https://www.youtube.com/embed/UWgM2ELFI3M",
    "https://www.youtube.com/shorts/UWgM2ELFI3M",
    "https://www.youtube.com/live/UWgM2ELFI3M",
    "https://m.youtube.com/watch?v=UWgM2ELFI3M&t=30s",
  ];
  const clesYoutube = formesYoutube.map((u) => cleMediaDe(u));
  verifie(
    "YouTube : toutes les formes d'URL d'un même média → UNE seule clé",
    clesYoutube.every((c) => c === "youtube:UWgM2ELFI3M"),
    `clés obtenues : ${clesYoutube.join(", ")}`
  );

  const idTiktok = "7683371620924230944";
  verifie(
    "TikTok : /video/ et /photo/ d'un même identifiant → UNE seule clé",
    cleMediaDe(`https://www.tiktok.com/@pamela.dali7/video/${idTiktok}`) ===
      cleMediaDe(`https://www.tiktok.com/@autre/photo/${idTiktok}`) &&
      cleMediaDe(`https://www.tiktok.com/@pamela.dali7/video/${idTiktok}`) ===
        `tiktok:${idTiktok}`
  );

  verifie(
    "Identifiants TikTok distincts → clés distinctes",
    cleMediaDe("https://www.tiktok.com/@a/video/1111111111111111111") !==
      cleMediaDe("https://www.tiktok.com/@a/video/2222222222222222222")
  );

  const r2a = cleMediaDe(
    "https://pub-62cf84fc54c94c528348970b93c9a2db.r2.dev/thumbnails/tt-123.jpg?X-Amz-Signature=abc&X-Amz-Expires=3600"
  );
  const r2b = cleMediaDe(
    "https://pub-62cf84fc54c94c528348970b93c9a2db.r2.dev/thumbnails/tt-123.jpg"
  );
  verifie(
    "URL R2 : la signature (query) est retirée → même fichier = même clé",
    r2a !== null && r2a === r2b && r2a.startsWith("url:"),
    `a=${r2a} b=${r2b}`
  );

  verifie("URL vide / null → null", cleMediaDe(null) === null && cleMediaDe("") === null);
  verifie(
    "Data URL / chemin relatif → null (rien à mémoriser)",
    cleMediaDe("data:video/mp4;base64,AAAA") === null &&
      cleMediaDe("/rendered-videos/video-x.mp4") === null
  );

  verifie(
    "YouTube ≠ TikTok ≠ autre (espaces de clés disjoints)",
    cleMediaDe("https://youtu.be/UWgM2ELFI3M") !==
      cleMediaDe("https://www.tiktok.com/@a/video/7683371620924230944") &&
      cleMediaDe("https://youtu.be/UWgM2ELFI3M") !== r2a
  );
}

// ── ② Cycle de vie de la mémoire (base SIMULÉE) ───────────────────────
console.log("\n── ② Mémoire des suppressions — base simulée ──");
{
  // Base simulée : le proxy lazy de lib/db lit globalThis.prisma → on
  // fournit NOTRE faux client AVANT tout accès (aucun Prisma réel créé).
  type Ligne = {
    id: string;
    cleMedia: string;
    videoUrl: string | null;
    titre: string | null;
    servantId: string | null;
    videoId: string | null;
    supprimeAt: Date;
  };
  const table = new Map<string, Ligne>();
  let modeEchec = false;
  let compteurId = 0;

  (globalThis as unknown as Record<string, unknown>).prisma = {
    $executeRawUnsafe: async (sql: string, ...args: unknown[]) => {
      if (modeEchec) throw new Error("base simulée indisponible");
      if (sql.includes("CREATE TABLE") || sql.includes("CREATE UNIQUE INDEX")) return;
      if (sql.includes("INSERT INTO")) {
        // args: id, cleMedia, videoUrl, titre, servantId, videoId
        const ligne: Ligne = {
          id: String(args[0]),
          cleMedia: String(args[1]),
          videoUrl: (args[2] as string | null) ?? null,
          titre: (args[3] as string | null) ?? null,
          servantId: (args[4] as string | null) ?? null,
          videoId: (args[5] as string | null) ?? null,
          supprimeAt: new Date(),
        };
        const existante = table.get(ligne.cleMedia);
        if (existante) {
          // ON CONFLICT DO UPDATE → rafraîchit la ligne existante.
          table.set(ligne.cleMedia, { ...existante, ...ligne, id: existante.id });
        } else {
          table.set(ligne.cleMedia, ligne);
          compteurId++;
        }
        return 1;
      }
      if (sql.includes("DELETE FROM")) {
        table.delete(String(args[0]));
        return 1;
      }
      return 0;
    },
    $queryRawUnsafe: async (sql: string, ...args: unknown[]) => {
      if (modeEchec) throw new Error("base simulée indisponible");
      if (sql.includes("CREATE TABLE") || sql.includes("CREATE UNIQUE INDEX")) return [];
      if (sql.includes("SELECT")) {
        const l = table.get(String(args[0]));
        return l
          ? [{ supprimeAt: l.supprimeAt, titre: l.titre, videoUrl: l.videoUrl }]
          : [];
      }
      return [];
    },
  };

  // Le drapeau mémoïsé de ensureSuppressionVideoTable vit dans le module —
  // la table simulée est déjà « créée » : les DDL sont des no-op ci-dessus.
  const {
    enregistrerSuppressionVideo,
    verifierSuppressionVideo,
    estVideoSupprimee,
    leverSuppressionVideo,
  } = await import("../src/lib/suppression-video");

  const URL_TIKTOK = "https://www.tiktok.com/@pamela.dali7/video/7683371620924230944";
  const URL_YT = "https://www.youtube.com/watch?v=UWgM2ELFI3M";
  const URL_YT_AUTRE_FORME = "https://youtu.be/UWgM2ELFI3M";

  await enregistrerSuppressionVideo({
    videoId: "vid-1",
    videoUrl: URL_YT,
    titre: "La vision de l'apôtre Jean",
    servantId: "serv-afrika",
  });
  verifie(
    "enregistrer → la mémoire contient la clé canonique",
    table.has("youtube:UWgM2ELFI3M")
  );

  const trouve = await verifierSuppressionVideo(URL_YT_AUTRE_FORME);
  verifie(
    "retrouver via UNE AUTRE FORME d'URL du même média (youtu.be) → trouvé",
    trouve !== null && trouve.titre === "La vision de l'apôtre Jean"
  );

  verifie(
    "estVideoSupprimee : vrai pour le média enregistré, faux pour un autre",
    (await estVideoSupprimee(URL_YT)) === true &&
      (await estVideoSupprimee("https://www.youtube.com/watch?v=aaaaaaaaaaa")) === false
  );

  // Ré-enregistrement (supprimer → réintégrer → re-supprimer) : upsert.
  await enregistrerSuppressionVideo({
    videoId: "vid-2",
    videoUrl: URL_YT_AUTRE_FORME,
    titre: "Nouveau titre",
    servantId: "serv-afrika",
  });
  verifie(
    "ré-enregistrement = MISE À JOUR (une seule ligne, pas de doublon)",
    table.size === 1 && table.get("youtube:UWgM2ELFI3M")?.titre === "Nouveau titre"
  );

  // Best-effort : base en panne → aucune exception.
  modeEchec = true;
  let aucuneException = true;
  try {
    await enregistrerSuppressionVideo({ videoId: "x", videoUrl: URL_TIKTOK, titre: "t", servantId: "s" });
    await verifierSuppressionVideo(URL_YT);
    await estVideoSupprimee(URL_TIKTOK);
    await leverSuppressionVideo(URL_YT);
  } catch {
    aucuneException = false;
  }
  verifie(
    "base indisponible → AUCUNE exception (best-effort absolu)",
    aucuneException
  );
  verifie(
    "base indisponible → estVideoSupprimee = false (la garde s'efface, rien ne casse)",
    (await estVideoSupprimee(URL_TIKTOK)) === false
  );
  modeEchec = false;

  await leverSuppressionVideo(URL_YT_AUTRE_FORME);
  verifie(
    "lever la mémoire (réintégration confirmée) → le média redevient ré-intégrable",
    (await verifierSuppressionVideo(URL_YT)) === null && table.size === 0
  );

  verifie(
    "URL sans clé (data:, relative) : rien n'est mémorisé",
    (await enregistrerSuppressionVideo({ videoId: "v", videoUrl: "data:video/mp4;base64,AA", titre: "", servantId: "" }),
    table.size === 0)
  );
}

// ── ③ Cohérence du code ──────────────────────────────────────────────
console.log("\n── ③ Cohérence du code (garde anti-résurrection) ──");
{
  const post = lire("src/app/admin/api/[entity]/route.ts");
  verifie(
    "POST /admin/api/[entity] : 409 VIDEO_SUPPRIMEE quand l'URL a été supprimée",
    post.includes("VIDEO_SUPPRIMEE") && post.includes("status: 409")
  );
  verifie(
    "POST : drapeau reintegration accepté et RETIRÉ du corps Prisma",
    post.includes("const { reintegration, ...donnees }") &&
      post.includes("delegate.create({ data: donnees })") &&
      !post.includes("delegate.create({ data: body })")
  );
  verifie(
    "POST : la mémoire est levée uniquement après confirmation",
    post.includes("await leverSuppressionVideo(donnees.videoUrl)")
  );

  const patch = lire("src/app/admin/api/[entity]/[id]/route.ts");
  verifie(
    "PATCH : garde 409 UNIQUEMENT si la clé média CHANGE (même média via autre forme d'URL = autorisé)",
    patch.includes("cleCible !== cleActuelle") && patch.includes("VIDEO_SUPPRIMEE")
  );
  verifie(
    "PATCH : drapeau reintegration retiré du corps Prisma",
    patch.includes("const { reintegration, ...donnees }") &&
      patch.includes("delegate.update({ where: { id }, data: donnees })") &&
      !patch.includes("delegate.update({ where: { id }, data: body })")
  );
  const idxDelete = patch.indexOf("await delegate.delete");
  const idxMemo = patch.indexOf("await enregistrerSuppressionVideo({");
  verifie(
    "DELETE : mémorisation de la suppression après le DELETE physique",
    idxMemo !== -1 && idxDelete !== -1 && idxDelete < idxMemo
  );

  const recovery = lire("src/lib/live-replay-recovery.ts");
  verifie(
    "Récupération de replays (Passe 1/2) : un replay supprimé n'est JAMAIS recréé",
    recovery.includes("estVideoSupprimee(youtubeUrl)")
  );

  const stop = lire("src/app/api/live/stop/route.ts");
  verifie(
    "/api/live/stop : le replay supprimé n'est pas recréé à l'arrêt du live",
    stop.includes("replaySupprime") && stop.includes("estVideoSupprimee(replayUrl)")
  );

  const webhook = lire("src/app/api/live/webhook/route.ts");
  verifie(
    "Webhook LiveKit : le replay supprimé n'est pas recréé (recording_available)",
    webhook.includes("estVideoSupprimee(recordingUrl)")
  );

  const modalVideos = lire("src/components/admin/videos-tabs-client.tsx");
  verifie(
    "Modal Nouvelle vidéo : 409 → confirmation « Réintégrer cette vidéo »",
    modalVideos.includes('data.code === "VIDEO_SUPPRIMEE"') &&
      modalVideos.includes("Réintégrer cette vidéo") &&
      modalVideos.includes("envoyer(false, true)") &&
      modalVideos.includes("reintegration: true")
  );

  const modalAdoration = lire("src/components/admin/adoration-tabs-client.tsx");
  verifie(
    "Modal Adoration/Louanges : même confirmation de réintégration",
    modalAdoration.includes('data.code === "VIDEO_SUPPRIMEE"') &&
      modalAdoration.includes("Réintégrer ce média")
  );

  const s363 = lire("scripts/inserer-tiktok-v363.mjs");
  const s377 = lire("scripts/inserer-tiktok-enseignement-v377.mjs");
  const s378 = lire("scripts/corriger-titres-saint-esprit-v378.mjs");
  verifie(
    "Scripts d'import TikTok (v363/v377/v378) : 409 = supprimée volontairement → ignorée",
    s363.includes("r.status === 409") &&
      s377.includes("r.status === 409") &&
      s378.includes("r.status === 409")
  );

  // Le drapeau ne doit JAMAIS fuiter vers Prisma (aucune route ne passe
  // `reintegration` dans un create/update).
  verifie(
    "Le drapeau reintegration n'est jamais transmis à Prisma",
    !post.includes("data: body") && !patch.includes("data: body")
  );
}

console.log(`\n════════════════════════════════════════`);
console.log(`  RÉSULTAT : ${passes} ✔ · ${echecs} ✘`);
if (echecs > 0) process.exit(1);
