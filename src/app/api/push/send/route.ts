import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webpush } from "@/app/api/push/vapid/route";

/**
 * POST /api/push/send
 * Send a push notification to a specific user (or all users).
 * Body: { userId?: string, title, body, url?, icon? }
 *
 * If userId is omitted, sends to all users with a subscription.
 * Respects user preferences: notifMessages, notifAnnouncements, notifLive,
 * notifCommunity, dndEnabled.
 */

type NotificationType = "messages" | "announcements" | "live" | "community";

interface SendPayload {
  userId?: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, type, title, body, url, icon } = (await req.json()) as SendPayload;

    if (!title || !body) {
      return NextResponse.json({ error: "title et body requis" }, { status: 400 });
    }

    // Build the where clause
    const where: any = {
      pushEnabled: true,
      pushSubscription: { not: null },
    };

    // Respect DND
    where.OR = [
      { dndEnabled: false },
      { dndEnabled: true, dndUntil: { lt: new Date() } }, // DND expired
    ];

    // Respect notification type preference
    switch (type) {
      case "messages": where.notifMessages = true; break;
      case "announcements": where.notifAnnouncements = true; break;
      case "live": where.notifLive = true; break;
      case "community": where.notifCommunity = true; break;
    }

    if (userId) {
      where.id = userId;
    }

    const users = await db.user.findMany({ where, select: { id: true, pushSubscription: true } });

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/yeshua-connect",
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: type,
    });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.pushSubscription) continue;
      try {
        const subscription = JSON.parse(user.pushSubscription);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (error: any) {
        // 410 = subscription expired, 404 = not found → remove it
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          await db.user.update({
            where: { id: user.id },
            data: { pushSubscription: null },
          });
        }
        failed++;
      }
    }

    return NextResponse.json({ success: true, sent, failed, total: users.length });
  } catch (error) {
    console.error("[push/send] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
