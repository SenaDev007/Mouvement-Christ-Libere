/**
 * GET  /admin/api/storage/migrate-r2  — INVENTAIRE
 * POST /admin/api/storage/migrate-r2  — MIGRATION (1 fichier par appel)
 *
 * ⭐ V4.46 — Migration R2 → GitHub de TOUT le stockage existant.
 *
 * Le contexte : depuis V4.43-V4.45, chaque NOUVEL upload est transféré vers
 * GitHub après son enregistrement en base. Mais tous les médias DÉJÀ présents
 * dans Cloudflare R2 (vidéos, copies mp4 TikTok, notes vocales, PDF,
 * miniatures) y restaient — le plan gratuit R2 plafonne à 10 Go.
 *
 * Cette route automatise le rapatriement :
 *   GET  → inventaire complet : chaque média encore hébergé sur R2
 *          (URL reconnaissable par extraireCleR2) dans les tables
 *          Video, Book, CroyantTestimony, IntercessionRequest, LiveStream.
 *   POST → transfert du PROCHAIN média (ou de celui désigné par
 *          { table, field, id }) :
 *            ① Téléchargement depuis R2 (GetObjectCommand)
 *            ② Upload vers GitHub (Contents ≤ 75 Mo / Releases > 75 Mo)
 *            ③ Mise à jour du champ en base vers l'URL GitHub
 *            ④ Suppression de l'objet R2 (libère le quota 10 Go)
 *
 * Un seul fichier par appel : les vidéos peuvent dépasser plusieurs
 * dizaines de Mo et le timeout Vercel est de 60 s — le client (page
 * /admin/stockage) boucle jusqu'à ce que l'inventaire soit vide, avec
 * progression visible.
 *
 * Auth : session admin obligatoire.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  uploadToGithub,
  isGithubStorageConfigured,
  type MediaType,
} from "@/lib/github-storage";
import { extraireCleR2, deleteFromR2, getClient } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────
// Définition des champs à inspecter : table Prisma + champ URL + type de
// stockage GitHub cible (dossier storage/<type>/<subType>/…)
// ─────────────────────────────────────────────────────────────────────

type TableCible =
  | "video"
  | "book"
  | "croyantTestimony"
  | "intercessionRequest"
  | "liveStream";

interface ChampCible {
  table: TableCible;
  label: string;
  field: string;
  type: MediaType;
  subType: string | null;
}

const CHAMPS: ChampCible[] = [
  { table: "video", label: "Vidéos", field: "videoUrl", type: "videos", subType: null },
  { table: "video", label: "Copies mp4 TikTok", field: "tiktokMp4Url", type: "videos", subType: "tiktok" },
  { table: "video", label: "Miniatures vidéos", field: "thumbnailUrl", type: "images", subType: "miniatures" },
  { table: "book", label: "Livres (PDF)", field: "fileUrl", type: "documents", subType: "bibliotheque" },
  { table: "book", label: "Couvertures de livres", field: "coverUrl", type: "images", subType: "bibliotheque" },
  { table: "croyantTestimony", label: "Témoignages audio (Vie transformée)", field: "audioUrl", type: "audio", subType: "vie-transformee" },
  { table: "intercessionRequest", label: "Notes vocales d'intercession", field: "audioUrl", type: "audio", subType: "intercession" },
  { table: "liveStream", label: "Enregistrements de lives", field: "recordingUrl", type: "videos", subType: "lives" },
];

/** Un média R2 = URL non vide, non data:, non locale, dont la clé R2 est déductible. */
function estUrlR2(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("data:") || url.startsWith("/")) return false;
  return !!extraireCleR2(url);
}

interface MediaR2 {
  table: TableCible;
  label: string;
  field: string;
  id: string;
  title: string;
  url: string;
  type: MediaType;
  subType: string | null;
}

/** Lève un média R2 = télécharge → GitHub → met à jour la base → supprime R2. */
async function transfererMedia(
  media: MediaR2
): Promise<{ githubUrl: string; storage: string; size: number; r2Deleted: boolean }> {
  const keyR2 = extraireCleR2(media.url);
  if (!keyR2) throw new Error("Clé R2 introuvable pour cette URL");

  // ① Télécharger depuis R2
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: keyR2 })
  );
  if (!response.Body) throw new Error(`Objet R2 vide : ${keyR2}`);
  const chunks: Buffer[] = [];
  const corps = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of corps) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  // ② Upload vers GitHub (nom de fichier préfixé par l'id : unicité garantie)
  const base = keyR2.split("/").pop() || `fichier-${media.id}`;
  const filename = `${media.id}-${base}`;
  const resultat = await uploadToGithub(buffer, media.type, media.subType, filename);

  // ③ Mettre à jour le champ en base vers l'URL GitHub
  // (délégue Prisma choisi dynamiquement — le champ est toujours l'un des
  // champs URL déclarés dans CHAMPS, jamais une donnée utilisateur).
  const delegates = {
    video: db.video,
    book: db.book,
    croyantTestimony: db.croyantTestimony,
    intercessionRequest: db.intercessionRequest,
    liveStream: db.liveStream,
  } as unknown as Record<string, { update: (args: { where: { id: string }; data: Record<string, string> }) => Promise<unknown> }>;
  await delegates[media.table].update({
    where: { id: media.id },
    data: { [media.field]: resultat.url },
  });

  // ④ Supprimer l'objet R2 (best-effort — libère le quota du plan gratuit)
  let r2Deleted = false;
  try {
    await deleteFromR2(keyR2);
    r2Deleted = true;
  } catch (delErr) {
    console.warn(
      "[storage/migrate-r2] Échec suppression R2 (best-effort) :",
      delErr instanceof Error ? delErr.message : delErr
    );
  }

  return { githubUrl: resultat.url, storage: resultat.storage, size: buffer.length, r2Deleted };
}

async function garderSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) return false;
  return true;
}

export async function GET() {
  if (!(await garderSession())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isGithubStorageConfigured()) {
    return NextResponse.json(
      { error: "GITHUB_STORAGE_TOKEN n'est pas configuré sur Vercel." },
      { status: 503 }
    );
  }

  // ─── Inventaire : balayer chaque champ de chaque table ───
  const medias: MediaR2[] = [];

  const [videos, books, temoignages, demandes, lives] = await Promise.all([
    db.video.findMany({
      select: { id: true, title: true, videoUrl: true, tiktokMp4Url: true, thumbnailUrl: true },
      take: 2000,
    }),
    db.book.findMany({ select: { id: true, title: true, fileUrl: true, coverUrl: true }, take: 2000 }),
    db.croyantTestimony.findMany({ select: { id: true, titre: true, audioUrl: true }, take: 2000 }),
    db.intercessionRequest.findMany({ select: { id: true, sujet: true, audioUrl: true }, take: 2000 }),
    db.liveStream.findMany({ select: { id: true, title: true, recordingUrl: true }, take: 2000 }),
  ]);

  for (const v of videos) {
    for (const champ of CHAMPS.filter((c) => c.table === "video")) {
      const url = v[champ.field as "videoUrl" | "tiktokMp4Url" | "thumbnailUrl"];
      if (estUrlR2(url)) {
        medias.push({
          table: "video", label: champ.label, field: champ.field, id: v.id,
          title: v.title, url, type: champ.type, subType: champ.subType,
        });
      }
    }
  }
  for (const b of books) {
    for (const champ of CHAMPS.filter((c) => c.table === "book")) {
      const url = b[champ.field as "fileUrl" | "coverUrl"];
      if (estUrlR2(url)) {
        medias.push({
          table: "book", label: champ.label, field: champ.field, id: b.id,
          title: b.title, url, type: champ.type, subType: champ.subType,
        });
      }
    }
  }
  for (const t of temoignages) {
    if (estUrlR2(t.audioUrl)) {
      medias.push({
        table: "croyantTestimony", label: "Témoignages audio (Vie transformée)", field: "audioUrl",
        id: t.id, title: t.titre, url: t.audioUrl, type: "audio", subType: "vie-transformee",
      });
    }
  }
  for (const d of demandes) {
    if (estUrlR2(d.audioUrl)) {
      medias.push({
        table: "intercessionRequest", label: "Notes vocales d'intercession", field: "audioUrl",
        id: d.id, title: d.sujet, url: d.audioUrl, type: "audio", subType: "intercession",
      });
    }
  }
  for (const l of lives) {
    if (estUrlR2(l.recordingUrl)) {
      medias.push({
        table: "liveStream", label: "Enregistrements de lives", field: "recordingUrl",
        id: l.id, title: l.title, url: l.recordingUrl, type: "videos", subType: "lives",
      });
    }
  }

  // Regrouper par catégorie pour l'affichage
  const parCategorie = new Map<string, number>();
  for (const m of medias) {
    parCategorie.set(m.label, (parCategorie.get(m.label) || 0) + 1);
  }

  return NextResponse.json({
    total: medias.length,
    categories: Array.from(parCategorie, ([label, count]) => ({ label, count })),
    medias: medias.map((m) => ({
      table: m.table, field: m.field, id: m.id, label: m.label,
      title: m.title.slice(0, 80), type: m.type, subType: m.subType,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!(await garderSession())) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isGithubStorageConfigured()) {
    return NextResponse.json(
      { error: "GITHUB_STORAGE_TOKEN n'est pas configuré sur Vercel." },
      { status: 503 }
    );
  }

  // Cible facultative { table, field, id } — sinon le prochain média trouvé
  let cible: { table?: TableCible; field?: string; id?: string } = {};
  try {
    cible = (await request.json()) || {};
  } catch {
    // body vide → prochain disponible
  }

  // ─── Retrouver le média à transférer ───
  let media: MediaR2 | null = null;

  if (cible.table && cible.field && cible.id) {
    const champ = CHAMPS.find((c) => c.table === cible.table && c.field === cible.field);
    if (!champ) {
      return NextResponse.json({ error: "Couple table/champ inconnu" }, { status: 400 });
    }
    let urlCible: string | null = null;
    let titre = "";
    if (cible.table === "video") {
      const v = await db.video.findUnique({
        where: { id: cible.id },
        select: { id: true, title: true, videoUrl: true, tiktokMp4Url: true, thumbnailUrl: true },
      });
      if (v) {
        urlCible = (v as unknown as Record<string, string | null>)[cible.field] || null;
        titre = v.title;
      }
    } else if (cible.table === "book") {
      const b = await db.book.findUnique({
        where: { id: cible.id },
        select: { id: true, title: true, fileUrl: true, coverUrl: true },
      });
      if (b) {
        urlCible = (b as unknown as Record<string, string | null>)[cible.field] || null;
        titre = b.title;
      }
    } else if (cible.table === "croyantTestimony") {
      const t = await db.croyantTestimony.findUnique({ where: { id: cible.id }, select: { id: true, titre: true, audioUrl: true } });
      if (t) {
        urlCible = t.audioUrl;
        titre = t.titre;
      }
    } else if (cible.table === "intercessionRequest") {
      const d = await db.intercessionRequest.findUnique({ where: { id: cible.id }, select: { id: true, sujet: true, audioUrl: true } });
      if (d) {
        urlCible = d.audioUrl;
        titre = d.sujet;
      }
    } else if (cible.table === "liveStream") {
      const l = await db.liveStream.findUnique({ where: { id: cible.id }, select: { id: true, title: true, recordingUrl: true } });
      if (l) {
        urlCible = l.recordingUrl;
        titre = l.title;
      }
    }

    if (estUrlR2(urlCible)) {
      media = {
        table: cible.table, label: champ.label, field: cible.field, id: cible.id,
        title: titre, url: urlCible!, type: champ.type, subType: champ.subType,
      };
    } else {
      return NextResponse.json(
        { error: "Ce média n'est plus hébergé sur R2 (déjà migré ?)" },
        { status: 409 }
      );
    }
  } else {
    // ─── Prochain média R2 disponible (ordre : vidéos d'abord — les plus gros) ───
    const [videos, books, temoignages, demandes, lives] = await Promise.all([
      db.video.findMany({
        select: { id: true, title: true, videoUrl: true, tiktokMp4Url: true, thumbnailUrl: true },
        take: 500,
      }),
      db.book.findMany({ select: { id: true, title: true, fileUrl: true, coverUrl: true }, take: 500 }),
      db.croyantTestimony.findMany({ select: { id: true, titre: true, audioUrl: true }, take: 500 }),
      db.intercessionRequest.findMany({ select: { id: true, sujet: true, audioUrl: true }, take: 500 }),
      db.liveStream.findMany({ select: { id: true, title: true, recordingUrl: true }, take: 500 }),
    ]);

    for (const v of videos) {
      for (const champ of CHAMPS.filter((c) => c.table === "video")) {
        const url = v[champ.field as "videoUrl" | "tiktokMp4Url" | "thumbnailUrl"];
        if (estUrlR2(url)) {
          media = { table: "video", label: champ.label, field: champ.field, id: v.id, title: v.title, url, type: champ.type, subType: champ.subType };
          break;
        }
      }
      if (media) break;
    }
    if (!media) {
      for (const l of lives) {
        if (estUrlR2(l.recordingUrl)) {
          media = { table: "liveStream", label: "Enregistrements de lives", field: "recordingUrl", id: l.id, title: l.title, url: l.recordingUrl, type: "videos", subType: "lives" };
          break;
        }
      }
    }
    if (!media) {
      for (const b of books) {
        for (const champ of CHAMPS.filter((c) => c.table === "book")) {
          const url = b[champ.field as "fileUrl" | "coverUrl"];
          if (estUrlR2(url)) {
            media = { table: "book", label: champ.label, field: champ.field, id: b.id, title: b.title, url, type: champ.type, subType: champ.subType };
            break;
          }
        }
        if (media) break;
      }
    }
    if (!media) {
      for (const t of temoignages) {
        if (estUrlR2(t.audioUrl)) {
          media = { table: "croyantTestimony", label: "Témoignages audio (Vie transformée)", field: "audioUrl", id: t.id, title: t.titre, url: t.audioUrl, type: "audio", subType: "vie-transformee" };
          break;
        }
      }
    }
    if (!media) {
      for (const d of demandes) {
        if (estUrlR2(d.audioUrl)) {
          media = { table: "intercessionRequest", label: "Notes vocales d'intercession", field: "audioUrl", id: d.id, title: d.sujet, url: d.audioUrl, type: "audio", subType: "intercession" };
          break;
        }
      }
    }

    if (!media) {
      return NextResponse.json({ ok: true, termine: true, message: "Aucun média R2 restant — migration déjà terminée." });
    }
  }

  try {
    const resultat = await transfererMedia(media);
    console.log(
      `[storage/migrate-r2] Migration OK : ${media.table}.${media.field} (${media.id}) → ${resultat.storage}, ${(resultat.size / 1024 / 1024).toFixed(2)} Mo, r2Deleted=${resultat.r2Deleted}`
    );
    return NextResponse.json({
      ok: true,
      termine: false,
      migre: {
        table: media.table,
        field: media.field,
        id: media.id,
        label: media.label,
        title: media.title.slice(0, 80),
        githubUrl: resultat.githubUrl,
        storage: resultat.storage,
        tailleMo: Math.round((resultat.size / 1024 / 1024) * 100) / 100,
        r2Deleted: resultat.r2Deleted,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de transfert";
    console.error("[storage/migrate-r2] Échec transfert :", media.table, media.id, message);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        echec: { table: media.table, field: media.field, id: media.id, label: media.label, title: media.title.slice(0, 80) },
      },
      { status: 500 }
    );
  }
}
