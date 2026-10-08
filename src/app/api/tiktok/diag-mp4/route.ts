/**
 * TEMPORAIRE (V4.04 diag) — GET /api/tiktok/diag-mp4?url=<tiktok-url>
 *
 * Diagnostic de la résolution playAddr depuis la production Vercel :
 * teste les 2 méthodes et retourne status/contenu de chaque étape.
 * ⚠️ À retirer après diagnostic (commit suivant).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

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

  const id = url.match(/(?:video|photo)\/(\d{5,25})/)?.[1] || "";
  const rapport: Record<string, unknown> = { url, id, region: "vercel" };

  // ── ① API mobile tiktokv ──
  try {
    const res = await fetch(
      `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${id}&version_code=262&app_name=musical_lyrics&channel=App&device_id=0&os_version=17.4&app_version=26.2.3&device_platform=iphone&device_type=iPhone9,3`,
      {
        headers: {
          "user-agent":
            "TikTok 26.2.3 rv:262303 (iPhone; iOS 17.4; fr_FR) Cronet",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      }
    );
    const texte = await res.text();
    rapport.apiMobile = {
      status: res.status,
      contentType: res.headers.get("content-type"),
      longueur: texte.length,
      extrait: texte.slice(0, 400),
      contientAwemeList: texte.includes("aweme_list"),
      contientPlayAddr: texte.includes("play_addr"),
    };
  } catch (e) {
    rapport.apiMobile = { erreur: e instanceof Error ? e.message : String(e) };
  }

  // ── ② Page vidéo HTML ──
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA_NAV,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const html = await res.text();
    const idx = html.indexOf("playAddr");
    const idxUniversal = html.indexOf("__UNIVERSAL_DATA_FOR_REHYDRATION__");
    const idxSigi = html.indexOf("SIGI_STATE");
    rapport.pageHtml = {
      status: res.status,
      urlFinale: res.url,
      contentType: res.headers.get("content-type"),
      longueur: html.length,
      contientPlayAddr: idx !== -1,
      positionPlayAddr: idx,
      contientUniversalData: idxUniversal !== -1,
      contientSigiState: idxSigi !== -1,
      extraitPlayAddr:
        idx !== -1 ? html.slice(Math.max(0, idx - 60), idx + 300) : null,
      titre: html.match(/<title[^>]*>(.*?)<\/title>/)?.[1]?.slice(0, 120) || null,
    };
  } catch (e) {
    rapport.pageHtml = { erreur: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(rapport);
}
