/**
 * TEMPORAIRE (V4.04 diag v3) — GET /api/tiktok/diag-mp4?url=<tiktok-url>
 * Teste plusieurs stratégies de téléchargement du MP4 en un cycle.
 * ⚠️ À retirer après diagnostic.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { resoudreMp4Tiktok } from "@/lib/tiktok-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA_NAV =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const UA_TT_MOBILE =
  "TikTok 26.2.3 rv:262303 (iPhone; iOS 17.4; fr_FR) Cronet";

async function essayer(
  nom: string,
  url: string,
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, {
      headers: { range: "bytes=0-65535", ...headers },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      redirect: "follow",
    });
    const morceau = await res.arrayBuffer();
    const octets = new Uint8Array(morceau.slice(0, 12));
    return {
      essai: nom,
      status: res.status,
      contentType: res.headers.get("content-type"),
      octetsRecus: morceau.byteLength,
      signatureMp4: Array.from(octets)
        .slice(4, 8)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
  } catch (err) {
    return {
      essai: nom,
      erreur: err instanceof Error ? err.message.slice(0, 150) : String(err),
    };
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "?url= requis" }, { status: 400 });

  const rapport: Record<string, unknown> = { url, region: "vercel" };

  const source = await resoudreMp4Tiktok("", url);
  rapport.resolution = source
    ? { ok: true, methode: source.methode }
    : { ok: false };
  if (!source) return NextResponse.json(rapport);

  const essais: Promise<Record<string, unknown>>[] = [
    essayer("playAddr + UA mobile TikTok", source.url, {
      "user-agent": UA_TT_MOBILE,
    }),
    essayer("playAddr + UA navigateur", source.url, { "user-agent": UA_NAV }),
    essayer("playAddr domaine non-prime + UA mobile", source.url.replace("-prime.", "."), {
      "user-agent": UA_TT_MOBILE,
    }),
    essayer("playAddr sans query + UA mobile", source.url.split("?")[0], {
      "user-agent": UA_TT_MOBILE,
    }),
  ];

  // Variante tikwm (service public de résolution) : play sans watermark.
  try {
    const resTk = await fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
      {
        headers: { "user-agent": UA_NAV, accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      }
    );
    const texte = await resTk.text();
    rapport.tikwm = {
      status: resTk.status,
      extrait: texte.slice(0, 600),
    };
    try {
      const data = JSON.parse(texte) as {
        code?: number;
        data?: { play?: string; hdplay?: string; wmplay?: string; size?: number };
      };
      if (data.data?.play) {
        const play = data.data.play.startsWith("http")
          ? data.data.play
          : `https://www.tikwm.com${data.data.play}`;
        essais.push(
          essayer("tikwm play (absolu)", play, { "user-agent": UA_NAV }),
          essayer("tikwm play (relatif www)", `https://www.tikwm.com${data.data.play.startsWith("/") ? "" : ""}${data.data.play.replace(/^https?:\/\/[^/]+/, "")}`, { "user-agent": UA_NAV })
        );
      }
    } catch {
      // JSON tikwm illisible — déjà noté dans extrait.
    }
  } catch (e) {
    rapport.tikwm = {
      erreur: e instanceof Error ? e.message.slice(0, 150) : String(e),
    };
  }

  rapport.telechargement = await Promise.all(essais);
  return NextResponse.json(rapport);
}
