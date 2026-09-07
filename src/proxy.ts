import { NextResponse, type NextRequest } from "next/server";

const PAM_HOSTS = new Set(["amela.dali", "ameladali", "pam"]);
const KONGO_HOSTS = new Set(["pasteurkongo", "kongo"]);
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/api/login"];

// ⭐ V3.44 — Back-office sur son propre sous-domaine : admin.mouvementchristlibere.com
// (DNS Cloudflare → Vercel : le Host d'origine est préservé jusqu'à l'app Next.js).
// En développement local, le même comportement est testable via admin.localhost:3000.
const ADMIN_HOSTS = new Set(["admin.mouvementchristlibere.com", "admin.localhost"]);

// Fichiers servis depuis /public (logo du back-office, manifest, sons…) et
// assets divers : ils restent accessibles TELS QUELS sur le sous-domaine admin —
// jamais réécrits vers /admin/* (sinon /logo-christ-libere.png renverrait 404).
const FICHIER_STATIQUE =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|heic|mp3|wav|ogg|m4a|mp4|webm|js|mjs|css|json|txt|xml|webmanifest|woff2?|ttf|otf|eot|map|wasm|pdf|dat)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const hoteAdmin = ADMIN_HOSTS.has(hostname);

  // ------------------------------------------------------------------
  // ⭐ V3.44 — Sous-domaine admin : la racine et les chemins « propres »
  // servent le BACK-OFFICE via réécriture INTERNE vers /admin/* :
  //   admin.mouvementchristlibere.com/        → /admin/dashboard
  //   admin.mouvementchristlibere.com/login   → /admin/login
  //   admin.mouvementchristlibere.com/videos  → /admin/videos
  // Les URLs en /admin/... continuent de fonctionner en direct (liens de la
  // sidebar, appels /admin/api/*…) — aucune réécriture pour elles.
  // Les autres hôtes (www, apex, vercel.app, localhost) restent inchangés.
  // ------------------------------------------------------------------
  let cheminInterne = pathname;
  let reecrire = false;

  if (hoteAdmin && !pathname.startsWith("/_next")) {
    if (
      pathname === "/" ||
      pathname === "" ||
      pathname === "/admin" ||
      pathname === "/admin/"
    ) {
      cheminInterne = "/admin/dashboard";
      reecrire = pathname !== "/admin/dashboard";
    } else if (!pathname.startsWith("/admin") && !FICHIER_STATIQUE.test(pathname)) {
      cheminInterne = `/admin${pathname}`;
      reecrire = true;
    }
  }

  // --- Garde d'authentification back-office (appliquée au chemin INTERNE,
  //    donc aussi aux chemins « propres » du sous-domaine admin) ---
  if (
    cheminInterne.startsWith("/admin") &&
    !PUBLIC_ADMIN_PATHS.some((p) => cheminInterne.startsWith(p))
  ) {
    const session = request.cookies.get("admin_session");
    if (!session) {
      // Sur le sous-domaine admin, on renvoie vers le login « propre » (/login)
      // qui sera réécrit vers /admin/login ; ailleurs : comportement inchangé.
      const loginUrl = new URL(hoteAdmin ? "/login" : "/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Réécriture interne (la query string est préservée par .clone()) ---
  if (reecrire) {
    const cible = request.nextUrl.clone();
    cible.pathname = cheminInterne;
    return NextResponse.rewrite(cible);
  }

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
