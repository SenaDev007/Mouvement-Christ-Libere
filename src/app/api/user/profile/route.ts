import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ensureVoiceVideoColumns } from "@/lib/ensure-schema";

/**
 * GET /api/user/profile
 * Fetch the current user's profile + notification preferences.
 * ⭐ V2.7 : inclut la photo (avatarUrl) et le téléphone (phone).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // ⭐ V2.7 — Auto-réparation colonne User.phone (informations complètes)
    await ensureVoiceVideoColumns();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        country: true,
        city: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isVerified: true,
        notifMessages: true,
        notifAnnouncements: true,
        notifLive: true,
        notifCommunity: true,
        dndEnabled: true,
        dndUntil: true,
        pushEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[user/profile GET] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile
 * Update the current user's profile + notification preferences.
 * Body: { name?, bio?, country?, city?, phone?, avatarUrl?, notifMessages?,
 *         notifAnnouncements?, notifLive?, notifCommunity?, dndEnabled? }
 *
 * ⭐ V2.7 — « Informations complètes » des membres/viewers :
 *   - avatarUrl : photo de profil (data URL JPEG ≤ 60 KB compressée côté
 *     client par /lib/avatar-upload — stockage TEXT en base, aucun filesystem)
 *   - phone : numéro de téléphone
 *   Tout est persisté en base et visible dans le back-office /admin/users.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // ⭐ V2.7 — Auto-réparation colonne User.phone
    await ensureVoiceVideoColumns();

    const body = await req.json();
    const {
      name, bio, country, city, phone, avatarUrl,
      notifMessages, notifAnnouncements, notifLive, notifCommunity, dndEnabled,
    } = body;

    // Garde-fou : l'avatar doit être une data URL image raisonnable (≤ 100 KB)
    // ou null (retrait) — ou une URL http(s) existante.
    if (avatarUrl !== undefined && avatarUrl !== null) {
      if (typeof avatarUrl !== "string" || avatarUrl.length === 0) {
        return NextResponse.json({ error: "Avatar invalide" }, { status: 400 });
      }
      const isHttp = avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://");
      const isDataUrl = avatarUrl.startsWith("data:image/");
      if (!isHttp && !isDataUrl) {
        return NextResponse.json({ error: "Format d'image non supporté" }, { status: 400 });
      }
      if (isDataUrl && avatarUrl.length > 100 * 1024) {
        return NextResponse.json({ error: "Photo trop lourde (max 100 Ko)" }, { status: 413 });
      }
    }
    // Garde-fou téléphone : 20 caractères max, format libre (indicatifs etc.)
    if (phone !== undefined && phone !== null && (typeof phone !== "string" || phone.length > 20)) {
      return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(notifMessages !== undefined && { notifMessages }),
        ...(notifAnnouncements !== undefined && { notifAnnouncements }),
        ...(notifLive !== undefined && { notifLive }),
        ...(notifCommunity !== undefined && { notifCommunity }),
        ...(dndEnabled !== undefined && {
          dndEnabled,
          dndUntil: dndEnabled ? new Date(Date.now() + 8 * 60 * 60 * 1000) : null, // 8h DND
        }),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        avatarUrl: updated.avatarUrl,
        phone: updated.phone,
      },
    });
  } catch (error) {
    console.error("[user/profile PUT] Error:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
