import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy file (Next.js 16 convention, replaces middleware.ts).
 *
 * Multi-tenant routing via subdomains:
 *   - amela.dali.<domain>     → PAM identity active
 *   - pasteurkongo.<domain>   → Pasteur Kongo identity active
 *   - <domain> (root)         → Commun (both servants)
 *
 * In dev (localhost / IP), no routing is applied.
 *
 * The proxy sets an `x-servant` header readable by downstream server components.
 * Client-side reading of the active servant is handled by <ServantProvider>.
 */

const PAM_HOSTS = new Set(["amela.dali", "ameladali", "pam"]);
const KONGO_HOSTS = new Set(["pasteurkongo", "kongo"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  // Skip dev / IP / localhost
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

  // Only add header if not already correct (avoid loops)
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
