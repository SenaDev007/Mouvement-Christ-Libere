import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isR2Configured, uploadToR2, getPublicUrl, generateKey } from "@/lib/r2";

/**
 * GET /api/admin/r2-test
 *
 * Vérifie la configuration Cloudflare R2 et teste un upload.
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
        configured: isR2Configured(),
        provider: "Cloudflare R2",
        accountId: process.env.R2_ACCOUNT_ID ? `${process.env.R2_ACCOUNT_ID.substring(0, 8)}...` : "(non défini)",
        bucket: process.env.R2_BUCKET_NAME || "(non défini)",
        publicUrl: process.env.R2_PUBLIC_URL || "(non défini — utilisera r2.dev)",
        accessKeyId: process.env.R2_ACCESS_KEY_ID ? `${process.env.R2_ACCESS_KEY_ID.substring(0, 8)}...` : "(non défini)",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ? "(défini)" : "(non défini)",
      });
    }

    // ─── Test : upload un petit fichier de test ───
    if (action === "test") {
      if (!isR2Configured()) {
        return NextResponse.json({ error: "R2 non configuré" }, { status: 503 });
      }

      const testContent = `Christ Libère — test R2 ${new Date().toISOString()}`;
      const buffer = Buffer.from(testContent, "utf-8");
      const key = generateKey("test", "r2", "txt");

      const publicUrl = await uploadToR2(key, buffer, "text/plain");

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
    console.error("[r2-test] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur test R2" },
      { status: 500 }
    );
  }
}
