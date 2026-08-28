import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isB2Configured, uploadToB2, getPublicUrl, generateKey } from "@/lib/b2";

/**
 * GET /api/admin/b2-test
 *
 * Vérifie la configuration Backblaze B2 et teste un upload.
 * Utile pour diagnostiquer les problèmes de stockage.
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";

    // ─── Status : vérifier la config ───
    if (action === "status") {
      return NextResponse.json({
        configured: isB2Configured(),
        bucket: process.env.B2_BUCKET_NAME || "(non défini)",
        endpoint: process.env.B2_ENDPOINT || "(non défini)",
        keyId: process.env.B2_KEY_ID ? `${process.env.B2_KEY_ID.substring(0, 8)}...` : "(non défini)",
        applicationKey: process.env.B2_APPLICATION_KEY ? "(défini)" : "(non défini)",
      });
    }

    // ─── Test : upload un petit fichier de test ───
    if (action === "test") {
      if (!isB2Configured()) {
        return NextResponse.json({ error: "B2 non configuré" }, { status: 503 });
      }

      const testContent = `Christ Libère — test B2 ${new Date().toISOString()}`;
      const buffer = Buffer.from(testContent, "utf-8");
      const key = generateKey("test", "b2", "txt");

      const publicUrl = await uploadToB2(key, buffer, "text/plain");

      return NextResponse.json({
        success: true,
        message: "Upload test réussi",
        publicUrl,
        size: buffer.length,
        content: testContent,
      });
    }

    return NextResponse.json({ error: "Action inconnue (status ou test)" }, { status: 400 });
  } catch (error) {
    console.error("[b2-test] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur test B2" },
      { status: 500 }
    );
  }
}
