import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16 convention) — multi-tenant routing + admin guard.
 *
 * 1. /admin/* — vérifie le cookie admin_session, redirige vers /admin/login si absent
 * 2. Sous-domaines — amela.dali.* → PAM, pasteurkongo.* → Kongo
 */

const PAM_HOSTS = new Set(["amela.dali", "ameladali", "pam"]);
const KONGO_HOSTS = new Set(["pasteurkongo", "kongo"]);

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/api/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  // ============================================================
  // 1. Protection routes /admin (sauf /admin/login)
  // ============================================================
  if (pathname.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const session = request.cookies.get("admin_session");
    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Note: la validation du token se fait côté serveur dans le layout admin
  }

  // ============================================================
  // 2. Routing multi-sous-domaines
  // ============================================================
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return NextResponse.next();
  }

  const subdomain = hostname.split(".")[0];
  let servant = "commun";
  if (PAM_HOSTS.has(subdomain)) servant = "pam";
  else if (KONGO_HOSTS.has(subdomain)) servant = "kongo";

  const currentHeader = request.headers.get("x-servant");
  if (currentHeader === servant) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-servant", servant);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
