/**
 * TEMPORAIRE (V4.04 diag) — GET /api/tiktok/diag-mp4?url=<tiktok-url>
 *
 * Diagnostic de la résolution playAddr + du téléchargement depuis la
 * production Vercel, en réutilisant les VRAIES fonctions de la lib
 * (resoudreMp4Tiktok) puis en testant le GET du MP4 trouvé.
 * ⚠️ À retirer après diagnostic (commit suivant).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { resoudreMp4Tiktok } from "@/lib/tiktok-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA_NAV =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "?url= requis" }, { status: 400 });

  const rapport: Record<string, unknown> = { url, region: "vercel" };

  // ── ① VRAIE résolution (fonction de production) ──
  try {
    const source = await resoudreMp4Tiktok("", url);
    rapport.resolution = source
      ? { ok: true, methode: source.methode, url: source.url.slice(0, 160) + "…" }
      : { ok: false };

    // ── ② Test de téléchargement (Range 64 Ko, SANS stocker) ──
    if (source) {
      const essais: Array<{ nom: string; init: RequestInit }> = [
        {
          nom: "avec referer",
          init: {
            headers: {
              "user-agent": UA_NAV,
              referer: "https://www.tiktok.com/",
              range: "bytes=0-65535",
            },
          },
        },
        {
          nom: "sans referer",
          init: { headers: { "user-agent": UA_NAV, range: "bytes=0-65535" } },
        },
      ];
      const telech: Record<string, unknown>[] = [];
      for (const e of essais) {
        try {
          const res = await fetch(source.url, {
            ...e.init,
            signal: AbortSignal.timeout(20_000),
            cache: "no-store",
            redirect: "follow",
          });
          const morceau = await res.arrayBuffer();
          const octets = new Uint8Array(morceau.slice(0, 16));
          telech.push({
            essai: e.nom,
            status: res.status,
            contentType: res.headers.get("content-type"),
            contentLength: res.headers.get("content-length"),
            urlFinale: res.url.slice(0, 140),
            octetsRecus: morceau.byteLength,
            signature: Array.from(octets)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(" ")
              .slice(0, 47),
          });
        } catch (err) {
          telech.push({
            essai: e.nom,
            erreur: err instanceof Error ? err.message.slice(0, 200) : String(err),
          });
        }
      }
      rapport.telechargement = telech;
    }
  } catch (e) {
    rapport.resolution = {
      ok: false,
      erreur: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }

  return NextResponse.json(rapport);
}
