import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { uploadToR2, isR2Configured, generateKey } from "@/lib/r2";

/** Rôles pouvant modérer (et donc poster dans) tous les canaux même sans y être membre. */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/** Préfixe de clé R2 pour les pièces jointes Yeshua Connect. */
const R2_PREFIX = "yeshua-connect/attachments";

/**
 * POST /api/yeshua-connect/conversations/:id/messages/attachment
 * Upload a file/image/audio attachment and create a message.
 * Body: FormData { file, type }  ← userId vient de la session.
 *
 * Stratégie de stockage :
 *   - Si R2 est configuré (variables R2_* présentes) : upload vers Cloudflare R2
 *     via `uploadToR2` (URL publique CDN/r2.dev retournée).
 *   - Sinon (dev local sans R2) : fallback filesystem dans /public/uploads/yeshua-connect/.
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

    // ─── Lecture du fichier en buffer (commun R2 + filesystem) ────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const ext = safeName.split(".").pop()?.toLowerCase() || "bin";

    let attachmentUrl: string;
    let attachmentSize: number | undefined = file.size;

    if (isR2Configured()) {
      // ─── Production / Staging : upload vers Cloudflare R2 ──────────
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
        console.error("[yeshua-connect/attachment] R2 upload failed, fallback filesystem:", r2Err);
        // Fallback filesystem si R2 échoue à l'exécution (credentials invalides, etc.)
        attachmentUrl = await saveToFilesystem(buffer, safeName);
      }
    } else {
      // ─── Dev local : stockage filesystem (pas de R2 configuré) ──────
      attachmentUrl = await saveToFilesystem(buffer, safeName);
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
 * Fallback filesystem — stocke le fichier dans /public/uploads/yeshua-connect/
 * et retourne une URL relative servie par Next.js.
 *
 * Utilisé uniquement en dev local quand R2 n'est pas configuré, ou en
 * fallback si l'upload R2 échoue à l'exécution.
 */
async function saveToFilesystem(buffer: Buffer, safeName: string): Promise<string> {
  const uploadDir = "/public/uploads/yeshua-connect";
  const fs = await import("fs/promises");
  const path = await import("path");
  const fullDir = path.join(process.cwd(), uploadDir);
  await fs.mkdir(fullDir, { recursive: true });
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = path.join(fullDir, fileName);
  await fs.writeFile(filePath, buffer);
  return `/uploads/yeshua-connect/${fileName}`;
}
