import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/og?url=...
 * Fetch Open Graph metadata from a URL for link embeds.
 * Returns { title, description, image, url }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YeshuaConnectBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ url, title: null, description: null, image: null });
    }

    const html = await res.text();

    // Extract OG metadata
    const getMeta = (property: string): string | null => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
      const match = html.match(regex);
      return match?.[1] || null;
    };

    const title = getMeta("og:title") || getMeta("twitter:title") || null;
    const description = getMeta("og:description") || getMeta("twitter:description") || null;
    let image = getMeta("og:image") || getMeta("twitter:image") || null;

    // Make image URL absolute
    if (image && !image.startsWith("http")) {
      const baseUrl = new URL(url);
      image = `${baseUrl.protocol}//${baseUrl.host}${image.startsWith("/") ? "" : "/"}${image}`;
    }

    return NextResponse.json({
      url,
      title,
      description,
      image,
    });
  } catch (e) {
    return NextResponse.json({ url, title: null, description: null, image: null });
  }
}
