import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureChannelIsDirectColumn } from "@/lib/ensure-schema";

/** Rôles pouvant voir tous les canaux (y compris RESTRICTED). */
const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);

/**
 * GET /api/yeshua-connect/search?q=...
 * Global search across messages, channels, and users.
 *
 * - 🔒 Authentification NextAuth requise.
 * - 🔒 Les résultats dans canaux RESTRICTED ne sont retournés qu'aux rôles privilégiés.
 * - 🔒 Les messages retournés sont limités aux canaux dont l'utilisateur est membre
 *   (sauf rôles privilégiés qui voient tout pour modération).
 */
export async function GET(req: Request) {
  try {
    // 🔒 Authentification NextAuth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;
    const isPrivileged = PRIVILEGED_ROLES.has(userRole || "");

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) return NextResponse.json({ messages: [], channels: [], users: [] });

    // ⭐ V3.20 — La recherche interroge Channel.isDirect ci-dessous :
    // auto-réparation de la colonne AVANT de l'interroger.
    await ensureChannelIsDirectColumn();

    // Pour les utilisateurs non privilégiés, on limite la recherche aux canaux
    // dont ils sont membres (pour ne pas fuiter le contenu de canaux privés).
    // ⭐ V3.20 — CONFIDENTIALITÉ DES PRIVÉS : les messages d'un PRIVÉ
    // (isDirect) n'apparaissent JAMAIS dans la recherche globale — ni pour
    // les spectateurs ni pour les admins (directive : « même les admins ne
    // devraient pas voir le message envoyé »). Un privé ne ressort que pour
    // ses 2 membres (branche « members some userId »). AVANT : la branche
    // publique matchait les canaux TEXT des privés → le contenu des privés
    // d'autrui était cherchable par tout le monde.
    const accessibleChannelFilter = {
      channel: {
        OR: [
          isPrivileged
            ? { isDirect: false }
            : { isRestricted: false, type: { not: "RESTRICTED" }, isDirect: false },
          { members: { some: { userId } } },
        ],
      },
    };

    const [messages, channels, users] = await Promise.all([
      db.message.findMany({
        where: {
          content: { contains: q, mode: "insensitive" },
          isDeleted: false,
          ...accessibleChannelFilter,
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true } },
        },
      }),
      db.channel.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          // ⭐ V3.20 — Les privés ne ressortent pas dans la recherche de
          // canaux (leur « nom » est celui d'un membre — liste = fuite).
          isDirect: false,
          ...(isPrivileged
            ? {}
            : { isRestricted: false, type: { not: "RESTRICTED" } }),
        },
        take: 10,
      }),
      db.user.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 10,
        select: { id: true, name: true, avatarUrl: true, role: true },
      }),
    ]);

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        senderName: m.user.name,
        channelId: m.channel.id,
        channelName: m.channel.name,
      })),
      channels: channels.map(c => ({ id: c.id, name: c.name, type: c.type })),
      users: users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, role: u.role })),
    });
  } catch (error) {
    console.error("[yeshua-connect/search] Error:", error);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }
}
