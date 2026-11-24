/**
 * GET /admin/api/tiktok/diagnostic?username=<username>
 *
 * ⭐ V4.35 — Endpoint de diagnostic : fetch la page profil TikTok et renvoie
 * un rapport détaillé de ce qui a été trouvé (ou pas). Permet de comprendre
 * exactement pourquoi la synchro échoue et d'adapter le code.
 *
 * Réponse JSON :
 *   {
 *     username, httpStatus, htmlSize, finalUrl,
 *     hasUniversalData, scopeKeys, hasSecUid, secUidStrategy, secUidPreview,
 *     videoUrlCount, awemeIdCount, itemIdCount,
 *     cookieCount, htmlSnippet (premiers 1500 chars)
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA_NAVIGATEUR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  // Auth admin
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get("username")?.trim() || "";
  if (!username) {
    return NextResponse.json({ error: "Paramètre 'username' requis" }, { status: 400 });
  }

  const url = `https://www.tiktok.com/@${username.replace(/^@/, "")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA_NAVIGATEUR,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "cross-site",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    clearTimeout(timeout);

    const html = await res.text();
    const setCookie = res.headers.get("set-cookie");
    const cookieCount = setCookie
      ? (Array.isArray(setCookie) ? setCookie : [setCookie]).length
      : 0;

    // ① Vérifier __UNIVERSAL_DATA_FOR_REHYDRATION__
    const MARKER = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
    const idxDebut = html.indexOf(MARKER);
    let hasUniversalData = false;
    let scopeKeys: string[] = [];
    let hasSecUid = false;
    let secUidStrategy = "";
    let secUidPreview = "";

    if (idxDebut !== -1) {
      hasUniversalData = true;
      const idxJson = idxDebut + MARKER.length;
      const idxFin = html.indexOf("</script>", idxJson);
      if (idxFin !== -1) {
        try {
          const data = JSON.parse(html.slice(idxJson, idxFin).trim()) as Record<string, unknown>;
          const scopes = data.__DEFAULT_SCOPE as Record<string, unknown> | undefined;
          if (scopes && typeof scopes === "object") {
            scopeKeys = Object.keys(scopes);
          }

          // Chercher secUid
          const userDetail = scopes?.["webapp.user-detail"] as Record<string, unknown> | undefined;
          const userInfo = userDetail?.userInfo as Record<string, unknown> | undefined;
          const user = userInfo?.user as Record<string, unknown> | undefined;
          const secUidDirect = (user?.secUid as string) || (user?.sec_uid as string);
          if (secUidDirect) {
            hasSecUid = true;
            secUidStrategy = "direct (webapp.user-detail.userInfo.user)";
            secUidPreview = String(secUidDirect).slice(0, 30) + "…";
          } else {
            // Recherche récursive
            const found = chercherSecUidRecursif(data);
            if (found) {
              hasSecUid = true;
              secUidStrategy = "récursive";
              secUidPreview = found.slice(0, 30) + "…";
            } else {
              // Regex sur HTML
              const regexMatch = html.match(/"secUid"\s*:\s*"(MS4[A-Za-z0-9_\-]{50,120})"/);
              if (regexMatch?.[1]) {
                hasSecUid = true;
                secUidStrategy = "regex HTML";
                secUidPreview = regexMatch[1].slice(0, 30) + "…";
              }
            }
          }
        } catch {
          // JSON parse failed
        }
      }
    }

    // ② Compter les patterns vidéo dans le HTML
    const videoUrlMatches = html.match(/tiktok\.com\/@[^/"]+\/video\/\d{5,25}/g) || [];
    const videoUrlRelativeMatches = html.match(/\/@[^/"]+\/video\/\d{5,25}/g) || [];
    const awemeIdMatches = html.match(/"aweme_id"\s*:\s*"\d{5,25}"/g) || [];
    const itemIdMatches = html.match(/"item_id"\s*:\s*"\d{5,25}"/g) || [];

    return NextResponse.json({
      username: username.replace(/^@/, ""),
      url,
      httpStatus: res.status,
      htmlSize: html.length,
      contentType: res.headers.get("content-type"),
      cookieCount,
      hasUniversalData,
      scopeKeys,
      hasSecUid,
      secUidStrategy,
      secUidPreview,
      videoUrlCount: videoUrlMatches.length,
      videoUrlRelativeCount: videoUrlRelativeMatches.length,
      awemeIdCount: awemeIdMatches.length,
      itemIdCount: itemIdMatches.length,
      htmlSnippet: html.slice(0, 1500),
      // Premiers patterns trouvés (pour inspection)
      videoUrlSamples: videoUrlMatches.slice(0, 5),
      awemeIdSamples: awemeIdMatches.slice(0, 5),
    });
  } catch (e) {
    clearTimeout(timeout);
    return NextResponse.json({
      username: username.replace(/^@/, ""),
      error: e instanceof Error ? e.message : String(e),
      errorType: e instanceof Error ? e.name : "Unknown",
    }, { status: 500 });
  }
}

// Helper récursif pour chercher secUid
function chercherSecUidRecursif(o: unknown, profondeur = 0): string | null {
  if (profondeur > 8 || !o) return null;
  if (typeof o === "object") {
    const obj = o as Record<string, unknown>;
    const secUid = (obj.secUid as string) || (obj.sec_uid as string);
    const uniqueId = (obj.uniqueId as string) || (obj.unique_id as string);
    if (secUid && (uniqueId || obj.nickname)) {
      return String(secUid);
    }
    for (const key of Object.keys(obj)) {
      const result = chercherSecUidRecursif(obj[key], profondeur + 1);
      if (result) return result;
    }
  }
  return null;
}
