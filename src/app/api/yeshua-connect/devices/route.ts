import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { registerDevice, unregisterDevice } from "@/lib/push-notifications";

/**
 * ⭐ V3.23 — /api/yeshua-connect/devices : enregistrement de l'appareil
 * mobile pour les NOTIFICATIONS PUSH (FCM).
 *
 * POST   { token, platform: "android"|"ios" }   — auth NextAuth requise :
 *        le token FCM est associé à l'utilisateur DE LA SESSION (jamais du
 *        body — un token ne peut pas espionner les notifications d'autrui).
 * DELETE { token }                               — déconnexion (désactive).
 *
 * Mobile : appelé après login + à chaque rotation du token FCM.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token;
    if (!token || typeof token !== "string" || token.length < 20) {
      return NextResponse.json({ error: "token FCM requis" }, { status: 400 });
    }
    const platform: string | undefined =
      body?.platform === "ios" ? "ios" : body?.platform === "android" ? "android" : undefined;

    await registerDevice(token, session.user.id, platform);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[yeshua-connect/devices POST]:", error);
    return NextResponse.json({ error: "Erreur d'enregistrement" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    // Token dans le body {token} OU en query ?token= (Dio DELETE ne pose
    // pas de body facilement côté Flutter).
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token || req.nextUrl.searchParams.get("token") || undefined;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token requis" }, { status: 400 });
    }
    await unregisterDevice(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[yeshua-connect/devices DELETE]:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
