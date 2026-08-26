import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { webpush } from "@/app/api/push/vapid/route";

/**
 * POST /api/push/subscribe
 * Save the user's push subscription (from the browser's PushManager).
 * Body: { subscription: PushSubscription } (endpoint + keys)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { subscription } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    // Save subscription as JSON in the user record
    await db.user.update({
      where: { id: session.user.id },
      data: {
        pushSubscription: JSON.stringify(subscription),
        pushEnabled: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[push/subscribe] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Remove the user's push subscription (unsubscribe).
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        pushSubscription: null,
        pushEnabled: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[push/subscribe DELETE] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
