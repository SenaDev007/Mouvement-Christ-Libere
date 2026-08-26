import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/yeshua-connect/conversations/:id/messages/attachment
 * Upload a file/image/audio attachment and create a message.
 * Body: FormData { file, userId, type }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const type = (formData.get("type") as string) || "FILE";

    if (!file || !userId) {
      return NextResponse.json({ error: "file et userId requis" }, { status: 400 });
    }

    // TODO: Upload to S3/R2/Cloudinary in production.
    // For now, we store the file in /public/uploads/yeshua-connect/ (dev only).
    const uploadDir = "/public/uploads/yeshua-connect";
    const fs = await import("fs/promises");
    const path = await import("path");
    const fullDir = path.join(process.cwd(), uploadDir);
    await fs.mkdir(fullDir, { recursive: true });
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(fullDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    const attachmentUrl = `/uploads/yeshua-connect/${fileName}`;

    const message = await db.message.create({
      data: {
        channelId: id,
        userId,
        content: file.name,
        type: type as any,
        attachmentUrl,
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
      attachmentName: file.name,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/attachment] Error:", error);
    return NextResponse.json({ error: "Erreur d'upload" }, { status: 500 });
  }
}
