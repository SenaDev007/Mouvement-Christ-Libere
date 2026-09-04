import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureChannelIsIntercessionColumn } from "@/lib/ensure-schema";
import { uploadToR2, isR2Configured, generateKey } from "@/lib/r2";

/** Rôles pouvant modérer (et donc poster dans) tous les canaux même sans y être membre. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** ⭐ V3.30 — Rôles autorisés sur le canal dédié d'intercession
 * (Sujets de prière) — SUPER_ADMIN/ADMIN uniquement. */
const ROLES_CANAL_INTERCESSION = new Set(["SUPER_ADMIN", "ADMIN"]);

/** Préfixe de clé R2 pour les pièces jointes Yeshua Connect. */
const R2_PREFIX = "yeshua-connect/attachments";

/**
 * POST /api/yeshua-connect/conversations/:id/messages/attachment
 * Upload a file/image/audio attachment and create a message.
 * Body: FormData { file, type }  ← userId vient de la session.
 *
 * Stratégie de stockage (⭐ V2.5 — corrigée pour Vercel serverless) :
 *   1. Si R2 est configuré : upload vers Cloudflare R2 (URL publique CDN).
 *   2. Sinon, si le fichier est petit (≤ 1,2 Mo) : stockage en data URL
 *      directement en base (PostgreSQL TEXT) — fonctionne SANS aucune
 *      configuration, y compris sur Vercel. L'ancien fallback filesystem
 *      écrivait dans /public qui est en LECTURE SEULE sur Vercel, ce qui
 *      provoquait l'erreur « Erreur d'upload » sur les messages vocaux.
 *   3. Sinon (fichier volumineux sans R2) : erreur explicite invitant à
 *      configurer R2 (page /admin/r2-test du back-office).
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 L'utilisateur doit être membre du canal.
 * - 🔒 userId est forcé depuis la session (ignore formData.userId).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    const { id } = await params;

    // ⭐ V3.30 — Garde du canal dédié d'intercession (Sujets de prière) :
    // SUPER_ADMIN/ADMIN uniquement — avant toute vérification de membre.
    await ensureChannelIsIntercessionColumn();
    {
      const canalIntercession = await db.channel.findUnique({
        where: { id },
        select: { isIntercession: true },
      });
      if (canalIntercession?.isIntercession && !ROLES_CANAL_INTERCESSION.has(userRole || "")) {
        return NextResponse.json(
          { error: "Canal réservé à l'administration" },
          { status: 403 },
        );
      }
    }

    // 🔒 Vérifier que l'utilisateur est membre du canal (sauf rôles privilégiés)
    if (!PRIVILEGED_ROLES.has(userRole || "")) {
      const membership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId } },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Vous n'êtes pas membre de ce canal" },
          { status: 403 },
        );
      }
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    // 🔒 userId vient de la session — on ignore formData.userId
    const type = (formData.get("type") as string) || "FILE";

    if (!file) {
      return NextResponse.json({ error: "file requis" }, { status: 400 });
    }

    // ─── Lecture du fichier en buffer (commun R2 + data URL) ──────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const ext = safeName.split(".").pop()?.toLowerCase() || "bin";

    // ⭐ V2.5 — Taille maximale pour le stockage intégré en base (data URL)
    const INLINE_MAX_BYTES = 1.2 * 1024 * 1024; // 1,2 Mo

    let attachmentUrl: string;
    let attachmentSize: number | undefined = file.size;

    if (isR2Configured()) {
      // ─── Production avec R2 : upload vers Cloudflare R2 ────────────
      // Clé unique sous yeshua-connect/attachments/{conversationId}/{timestamp}-{rand}.{ext}
      const key = generateKey(
        `${R2_PREFIX}/${id}`,
        `${Date.now()}`,
        ext,
      );
      try {
        attachmentUrl = await uploadToR2(
          key,
          buffer,
          file.type || "application/octet-stream",
        );
      } catch (r2Err) {
        console.error("[yeshua-connect/attachment] R2 upload failed:", r2Err);
        // ⭐ V2.5 — Fallback data URL (plus d'écriture filesystem : /public
        // est en lecture seule sur Vercel et causait « Erreur d'upload »).
        if (buffer.length <= INLINE_MAX_BYTES) {
          attachmentUrl = bufferToDataUrl(buffer, file.type);
        } else {
          return NextResponse.json(
            {
              error:
                "Fichier trop volumineux pour le stockage intégré (max 1,2 Mo). " +
                "Configurez Cloudflare R2 (back-office → Système → Stockage R2) pour autoriser les fichiers volumineux.",
            },
            { status: 507 }
          );
        }
      }
    } else if (buffer.length <= INLINE_MAX_BYTES) {
      // ⭐ V2.5 — Pas de R2 (dev local ou Vercel sans variables R2_*) :
      // stockage en data URL en base — fiable partout, y compris serverless.
      attachmentUrl = bufferToDataUrl(buffer, file.type);
    } else {
      // Fichier volumineux sans R2 : erreur explicite et actionnable
      return NextResponse.json(
        {
          error:
            "Fichier trop volumineux pour le stockage intégré (max 1,2 Mo). " +
            "Configurez Cloudflare R2 (back-office → Système → Stockage R2) pour autoriser les fichiers volumineux.",
        },
        { status: 507 }
      );
    }

    const message = await db.message.create({
      data: {
        channelId: id,
        userId, // 🔒 depuis la session
        content: file.name,
        type: type as any,
        attachmentUrl,
        // (S5) Persister les métadonnées du fichier pour qu'elles survivent
        // au rechargement de la page (avant, seul attachmentUrl était sauvé).
        attachmentName: file.name,
        attachmentSize,
        attachmentMime: file.type || "application/octet-stream",
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json({
      id: message.id,
      conversationId: message.channelId,
      senderId: message.userId,
      senderName: message.user.name ?? "Membre",
      senderRole: message.user.role,
      type: message.type,
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName ?? file.name,
      attachmentSize: message.attachmentSize ?? attachmentSize,
      attachmentMime: message.attachmentMime ?? file.type,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/attachment] Error:", error);
    return NextResponse.json({ error: "Erreur d'upload" }, { status: 500 });
  }
}

/**
 * ⭐ V2.5 — Convertit un buffer en data URL (base64) pour stockage direct
 * en base PostgreSQL (TEXT). Fiable sur Vercel (pas d'écriture disque),
 * en dev local, et partout ailleurs. Limite d'usage : fichiers ≤ 1,2 Mo
 * (vocaux courts, images, GIFs légers, petits documents).
 */
function bufferToDataUrl(buffer: Buffer, mime: string | null): string {
  const safeMime = mime && /^\w+[\/.+-]?\w*([\/.+]\w+)*$/.test(mime) ? mime : "application/octet-stream";
  return `data:${safeMime};base64,${buffer.toString("base64")}`;
}

// (⭐ V2.5) L'ancien fallback `saveToFilesystem` a été supprimé : écrire dans
// /public est impossible sur Vercel (filesystem en lecture seule) — c'était
// la cause de l'erreur « Erreur d'upload » sur les messages vocaux. Le
// stockage intégré passe désormais par des data URLs en base (voir
// bufferToDataUrl ci-dessus), et les fichiers volumineux passent par R2.
