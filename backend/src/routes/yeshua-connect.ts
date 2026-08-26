/**
 * Yeshua Connect — messaging routes.
 *
 *   GET    /api/yeshua-connect/conversations
 *   GET    /api/yeshua-connect/conversations/:id/messages
 *   POST   /api/yeshua-connect/conversations/:id/messages
 *   POST   /api/yeshua-connect/conversations/:id/messages/attachment
 *   GET    /api/yeshua-connect/channels
 *   POST   /api/yeshua-connect/channels
 *   GET    /api/yeshua-connect/announcements
 *   POST   /api/yeshua-connect/announcements
 *   GET    /api/yeshua-connect/search?q=...
 *   GET    /api/yeshua-connect/calls
 *   PUT    /api/yeshua-connect/messages/:messageId/edit
 *   DELETE /api/yeshua-connect/messages/:messageId/delete
 *   POST   /api/yeshua-connect/messages/:messageId/react
 *   POST   /api/yeshua-connect/messages/:messageId/forward
 *   POST   /api/yeshua-connect/messages/:messageId/pin
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../lib/db";

const router = Router();

// --- Multer config for attachments ---
const uploadsDir = path.join(process.cwd(), "public", "uploads", "yeshua-connect");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ============================================================
// CONVERSATIONS
// ============================================================

router.get("/conversations", async (_req, res) => {
  try {
    const channels = await db.channel.findMany({
      orderBy: [{ communityId: "asc" }, { order: "asc" }],
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, role: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { user: { select: { id: true, name: true } } },
        },
        community: { select: { id: true, name: true } },
      },
    });

    const conversations = channels.map((ch) => {
      const lastMsg = ch.messages[0];
      let convType: "CHANNEL" | "GROUP" | "DIRECT" | "PASTORS";
      if (ch.type === "ANNOUNCEMENT") convType = "CHANNEL";
      else if (ch.type === "RESTRICTED") convType = "PASTORS";
      else if (ch.members.length > 2) convType = "GROUP";
      else convType = "DIRECT";

      return {
        id: ch.id,
        type: convType,
        name: ch.name,
        description: ch.description ?? undefined,
        avatarUrl: undefined,
        createdBy: ch.members[0]?.userId ?? "",
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
        lastMessageAt: lastMsg?.createdAt.toISOString(),
        lastMessagePreview: lastMsg?.content?.substring(0, 80) ?? undefined,
        lastMessageSenderId: lastMsg?.userId,
        participants: ch.members.map((m) => ({
          userId: m.user.id,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          muted: false,
          name: m.user.name ?? "Membre",
          avatarUrl: m.user.avatarUrl ?? undefined,
          roleLabel: m.role,
          online: false,
        })),
        isEncrypted: ch.isEncrypted,
        unreadCount: 0,
      };
    });

    return res.json(conversations);
  } catch (error) {
    console.error("[yeshua-connect/conversations] Error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des conversations" });
  }
});

// ============================================================
// MESSAGES
// ============================================================

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt((req.query.limit as string) || "50", 10);

    const messages = await db.message.findMany({
      where: { channelId: id, isDeleted: false },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    const replyIds = messages
      .map((m) => m.replyToId)
      .filter(Boolean) as string[];
    const replyMessages =
      replyIds.length > 0
        ? await db.message.findMany({
            where: { id: { in: replyIds } },
            include: { user: { select: { id: true, name: true } } },
          })
        : [];
    const replyMap = new Map(replyMessages.map((r) => [r.id, r]));

    const formatted = messages.map((m) => ({
      id: m.id,
      conversationId: m.channelId,
      senderId: m.userId,
      senderName: m.user.name ?? "Membre",
      senderRole: m.user.role,
      type: m.type,
      content: m.content,
      attachmentUrl: m.attachmentUrl ?? undefined,
      replyToId: m.replyToId ?? undefined,
      replyTo: m.replyToId
        ? (() => {
            const parent = replyMap.get(m.replyToId!);
            return parent
              ? {
                  senderName: parent.user.name ?? "Membre",
                  content: parent.content,
                }
              : undefined;
          })()
        : undefined,
      reactions: [],
      createdAt: m.createdAt.toISOString(),
      editedAt: m.isEdited ? m.updatedAt.toISOString() : undefined,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/messages] Error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, content, type = "TEXT", replyToId } = req.body || {};

    if (!userId || !content) {
      return res
        .status(400)
        .json({ error: "userId et content sont requis" });
    }

    const message = await db.message.create({
      data: {
        channelId: id,
        userId,
        content,
        type,
        replyToId: replyToId ?? null,
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
      },
    });

    return res.json({
      id: message.id,
      conversationId: message.channelId,
      senderId: message.userId,
      senderName: message.user.name ?? "Membre",
      senderRole: message.user.role,
      type: message.type,
      content: message.content,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/messages POST] Error:", error);
    return res
      .status(500)
      .json({ error: "Erreur lors de l'envoi du message" });
  }
});

router.post(
  "/conversations/:id/messages/attachment",
  upload.single("file"),
  async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const file = req.file;
      const userId = req.body?.userId;
      const type = (req.body?.type || "FILE") as any; // MessageType

      if (!file || !userId) {
        return res
          .status(400)
          .json({ error: "file et userId requis" });
      }

      const attachmentUrl = `/uploads/yeshua-connect/${file.filename}`;

      const message = await db.message.create({
        data: {
          channelId: id,
          userId,
          content: file.originalname,
          type,
          attachmentUrl,
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      }) as any;

      return res.json({
        id: message.id,
        conversationId: message.channelId,
        senderId: message.userId,
        senderName: message.user.name ?? "Membre",
        senderRole: message.user.role,
        type: message.type,
        content: message.content,
        attachmentUrl: message.attachmentUrl,
        attachmentName: file.originalname,
        reactions: [],
        createdAt: message.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("[yeshua-connect/attachment] Error:", error);
      return res.status(500).json({ error: "Erreur d'upload" });
    }
  },
);

// ============================================================
// CHANNELS
// ============================================================

router.get("/channels", async (_req, res) => {
  try {
    const channels = await db.channel.findMany({
      orderBy: [{ communityId: "asc" }, { order: "asc" }],
      include: {
        community: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    return res.json(channels);
  } catch (error) {
    console.error("[yeshua-connect/channels] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/channels", async (req, res) => {
  try {
    const {
      name,
      description,
      type = "TEXT",
      communityId,
      isEncrypted = false,
      createdBy,
    } = req.body || {};

    if (!name || !communityId) {
      return res
        .status(400)
        .json({ error: "name et communityId requis" });
    }

    const channel = await db.channel.create({
      data: {
        name,
        description,
        type,
        communityId,
        isEncrypted,
        order: 0,
      },
    });

    if (createdBy) {
      await db.channelMember.create({
        data: { channelId: channel.id, userId: createdBy, role: "ADMIN" },
      });
    }

    return res.json(channel);
  } catch (error) {
    console.error("[yeshua-connect/channels POST] Error:", error);
    return res.status(500).json({ error: "Erreur de création" });
  }
});

// ============================================================
// ANNOUNCEMENTS
// ============================================================

router.get("/announcements", async (_req, res) => {
  try {
    const announcements = await db.message.findMany({
      where: { channel: { type: "ANNOUNCEMENT" }, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true, role: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    const formatted = announcements.map((m) => ({
      id: m.id,
      authorName: m.user.name ?? "Membre",
      authorRole: m.user.role,
      title: m.content.split("\n")[0].substring(0, 100),
      body: m.content,
      priority: "NORMAL" as const,
      target: "ALL" as const,
      requiresConfirmation: false,
      publishedAt: m.createdAt.toISOString(),
      confirmedByCurrentUser: false,
      confirmCount: 0,
      totalRecipients: 0,
      channelId: m.channel.id,
      channelName: m.channel.name,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/announcements] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/announcements", async (req, res) => {
  try {
    const {
      title,
      body,
      channelId,
      userId,
      priority = "NORMAL",
      target = "ALL",
    } = req.body || {};

    if (!title || !body || !channelId || !userId) {
      return res
        .status(400)
        .json({ error: "title, body, channelId, userId requis" });
    }

    const message = await db.message.create({
      data: {
        channelId,
        userId,
        content: `${title}\n\n${body}`,
        type: "TEXT",
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    return res.json({
      id: message.id,
      authorName: message.user.name ?? "Membre",
      authorRole: message.user.role,
      title,
      body,
      priority,
      target,
      requiresConfirmation: false,
      publishedAt: message.createdAt.toISOString(),
      confirmedByCurrentUser: false,
      confirmCount: 0,
      totalRecipients: 0,
    });
  } catch (error) {
    console.error("[yeshua-connect/announcements POST] Error:", error);
    return res.status(500).json({ error: "Erreur de publication" });
  }
});

// ============================================================
// SEARCH
// ============================================================

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    if (!q.trim()) {
      return res.json({ messages: [], channels: [], users: [] });
    }

    const [messages, channels, users] = await Promise.all([
      db.message.findMany({
        where: { content: { contains: q, mode: "insensitive" }, isDeleted: false },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true } },
        },
      }),
      db.channel.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
      }),
      db.user.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
        select: { id: true, name: true, avatarUrl: true, role: true },
      }),
    ]);

    return res.json({
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        senderName: m.user.name,
        channelId: m.channel.id,
        channelName: m.channel.name,
      })),
      channels: channels.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        role: u.role,
      })),
    });
  } catch (error) {
    console.error("[yeshua-connect/search] Error:", error);
    return res.status(500).json({ error: "Erreur de recherche" });
  }
});

// ============================================================
// CALLS
// ============================================================

router.get("/calls", async (_req, res) => {
  try {
    const calls = await db.call.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        initiator: {
          select: { id: true, name: true, avatarUrl: true },
        },
        recipient: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const formatted = calls.map((c) => ({
      id: c.id,
      type: c.type,
      direction: "outgoing" as const,
      contact: c.initiator.name ?? c.recipient.name ?? "Membre",
      duration: c.duration ?? 0,
      status: c.status,
      date: c.createdAt.toISOString(),
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("[yeshua-connect/calls] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

// ============================================================
// MESSAGE ACTIONS (edit, delete, react, forward, pin)
// ============================================================

router.put("/messages/:messageId/edit", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body || {};
    if (!content?.trim()) {
      return res.status(400).json({ error: "content requis" });
    }
    const updated = await db.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return res.json({
      id: updated.id,
      content: updated.content,
      isEdited: updated.isEdited,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/edit] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.delete("/messages/:messageId/delete", async (req, res) => {
  try {
    const { messageId } = req.params;
    const forEveryone = req.query.forEveryone === "true";
    const updated = await db.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: forEveryone ? "🗑️ Message supprimé" : "",
      },
    });
    return res.json({ success: true, id: updated.id, isDeleted: true });
  } catch (error) {
    console.error("[yeshua-connect/delete] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/messages/:messageId/react", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji, userId, userName } = req.body || {};
    if (!emoji || !userId) {
      return res
        .status(400)
        .json({ error: "emoji et userId requis" });
    }
    const message = await db.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      return res.status(404).json({ error: "Message introuvable" });
    }
    return res.json({
      success: true,
      messageId,
      emoji,
      userId,
      userName: userName || "Membre",
    });
  } catch (error) {
    console.error("[yeshua-connect/react] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/messages/:messageId/forward", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetChannelId, userId } = req.body || {};
    if (!targetChannelId || !userId) {
      return res
        .status(400)
        .json({ error: "targetChannelId et userId requis" });
    }
    const original = await db.message.findUnique({
      where: { id: messageId },
    });
    if (!original) {
      return res.status(404).json({ error: "Message introuvable" });
    }
    const forwarded = await db.message.create({
      data: {
        channelId: targetChannelId,
        userId,
        content: original.content,
        type: original.type,
        attachmentUrl: original.attachmentUrl,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return res.json({
      id: forwarded.id,
      conversationId: forwarded.channelId,
      senderId: forwarded.userId,
      senderName: forwarded.user.name ?? "Membre",
      senderRole: forwarded.user.role,
      type: forwarded.type,
      content: forwarded.content,
      reactions: [],
      createdAt: forwarded.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[yeshua-connect/forward] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

router.post("/messages/:messageId/pin", (req, res) => {
  try {
    const { messageId } = req.params;
    return res.json({ success: true, messageId, isPinned: true });
  } catch (error) {
    console.error("[yeshua-connect/pin] Error:", error);
    return res.status(500).json({ error: "Erreur" });
  }
});

export default router;
