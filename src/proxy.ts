import { NextResponse, type NextRequest } from "next/server";

const PAM_HOSTS = new Set(["amela.dali", "ameladali", "pam"]);
const KONGO_HOSTS = new Set(["pasteurkongo", "kongo"]);
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/api/login"];

// ⭐ V3.44 — Back-office sur son propre sous-domaine : admin.mouvementchristlibere.com
// (DNS Cloudflare → Vercel : le Host d'origine est préservé jusqu'à l'app Next.js).
// En développement local, le même comportement est testable via admin.localhost:3000.
const ADMIN_HOSTS = new Set(["admin.mouvementchristlibere.com", "admin.localhost"]);

// ⭐ V3.66 — Espaces dédiés sur leurs propres sous-domaines, même mécanisme
// V3.44 que le back-office (Host préservé par le DNS Cloudflare → Vercel) :
//   · secretariat.mouvementchristlibere.com  → routes /secretariat/*
//   · tresorerie.mouvementchristlibere.com   → routes /tresorerie/*
// En local : secretariat.localhost:3000 / tresorerie.localhost:3000.
// Chaque espace possède sa page de connexion et ses rôles (la secrétaire
// n'entre pas dans la trésorerie et réciproquement — les super admins
// accèdent aux deux). Les routes API vérifient la session elles-mêmes
// (401 JSON) : le proxy ne redirige que les PAGES non authentifiées.
const SECRETARIAT_HOSTS = new Set([
  "secretariat.mouvementchristlibere.com",
  "secretariat.localhost",
]);
const TRESORERIE_HOSTS = new Set([
  "tresorerie.mouvementchristlibere.com",
  "tresorerie.localhost",
]);
const PUBLIC_SECRETARIAT_PATHS = ["/secretariat/login", "/secretariat/api/login", "/secretariat/api/logout"];
const PUBLIC_TRESORERIE_PATHS = ["/tresorerie/login", "/tresorerie/api/login", "/tresorerie/api/logout"];

// Fichiers servis depuis /public (logo du back-office, manifest, sons…) et
// assets divers : ils restent accessibles TELS QUELS sur le sous-domaine admin —
// jamais réécrits vers /admin/* (sinon /logo-christ-libere-v2.png renverrait 404).
const FICHIER_STATIQUE =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|heic|mp3|wav|ogg|m4a|mp4|webm|js|mjs|css|json|txt|xml|webmanifest|woff2?|ttf|otf|eot|map|wasm|pdf|dat)$/i;

/**
 * ⭐ V3.44.1 (généralisé V3.66) — Sous-domaine d'espace : REDIRECTION vers
 * les VRAIES routes (et non réécriture interne — usePathname() côté client
 * verrait « /login » et le layout afficherait la sidebar autour du
 * formulaire de connexion). Avec la redirection, l'URL devient réellement
 * /<espace>/login → la page de connexion s'affiche SEULE (plein écran).
 *   <espace>.mouvementchristlibere.com/         → /<espace>/dashboard
 *   <espace>.mouvementchristlibere.com/demandes → /<espace>/demandes
 * 307 (non mis en cache par les navigateurs). Les URLs /<espace>/… et
 * appels /<espace>/api/* restent inchangés.
 */
function redirigerVersEspace(
  request: NextRequest,
  prefixe: string
): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next")) return null;

  let cible: string | null = null;
  if (
    pathname === "/" ||
    pathname === "" ||
    pathname === prefixe ||
    pathname === `${prefixe}/`
  ) {
    cible = `${prefixe}/dashboard`;
  } else if (
    !pathname.startsWith(prefixe) &&
    !FICHIER_STATIQUE.test(pathname)
  ) {
    cible = `${prefixe}${pathname}`;
  }
  if (!cible) return null;

  const url = request.nextUrl.clone();
  url.pathname = cible;
  return NextResponse.redirect(url, 307);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const hoteAdmin = ADMIN_HOSTS.has(hostname);
  const hoteSecretariat = SECRETARIAT_HOSTS.has(hostname);
  const hoteTresorerie = TRESORERIE_HOSTS.has(hostname);

  // ------------------------------------------------------------------
  // ⭐ V3.66 — Sous-domaines secrétariat / trésorerie (même mécanisme
  // V3.44.1 que le back-office — cf. redirigerVersEspace ci-dessus).
  // ------------------------------------------------------------------
  if (hoteSecretariat) {
    const r = redirigerVersEspace(request, "/secretariat");
    if (r) return r;
  }
  if (hoteTresorerie) {
    const r = redirigerVersEspace(request, "/tresorerie");
    if (r) return r;
  }

  // ------------------------------------------------------------------
  // ⭐ V3.44.1 — Sous-domaine admin : REDIRECTION vers les VRAIES routes
  // /admin/* (et non plus réécriture interne — V3.44 l'avait fait, mais
  // usePathname() côté client voyait « /login » : le layout back-office
  // croyait ne pas être sur la page de connexion et affichait la SIDEBAR
  // autour du formulaire de login).
  // Avec la redirection, l'URL devient réellement /admin/login → la page de
  // connexion s'affiche SEULE (plein écran, fond violet profond — comportement
  // historique), et après identification → back-office + sidebar normalement.
  //   admin.mouvementchristlibere.com/        → /admin/dashboard
  //   admin.mouvementchristlibere.com/login   → /admin/login
  //   admin.mouvementchristlibere.com/videos  → /admin/videos
  // 307 (non mis en cache par les navigateurs — ajustable à tout moment).
  // Les URLs /admin/... et appels /admin/api/* restent inchangés.
  // ------------------------------------------------------------------
  if (hoteAdmin && !pathname.startsWith("/_next")) {
    let cible: string | null = null;
    if (
      pathname === "/" ||
      pathname === "" ||
      pathname === "/admin" ||
      pathname === "/admin/"
    ) {
      cible = "/admin/dashboard";
    } else if (!pathname.startsWith("/admin") && !FICHIER_STATIQUE.test(pathname)) {
      cible = `/admin${pathname}`;
    }
    if (cible) {
      const url = request.nextUrl.clone();
      url.pathname = cible;
      return NextResponse.redirect(url, 307);
    }
  }

  // --- Garde d'authentification back-office (comportement historique) ---
  if (pathname.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const session = request.cookies.get("admin_session");
    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ------------------------------------------------------------------
  // ⭐ V3.66 — Garde d'authentification des espaces secrétariat /
  // trésorerie : PAGES uniquement (les routes API répondent elles-mêmes
  // en 401/403 JSON — un fetch ne doit jamais recevoir un HTML de login).
  // Le cookie « admin_session » est host-scoped : la session de cet
  // hôte est indépendante de celle du back-office.
  // ------------------------------------------------------------------
  if (
    (pathname.startsWith("/secretariat/") || pathname === "/secretariat") &&
    !PUBLIC_SECRETARIAT_PATHS.some((p) => pathname.startsWith(p)) &&
    !pathname.startsWith("/secretariat/api/")
  ) {
    const session = request.cookies.get("admin_session");
    if (!session) {
      const loginUrl = new URL("/secretariat/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  if (
    (pathname.startsWith("/tresorerie/") || pathname === "/tresorerie") &&
    !PUBLIC_TRESORERIE_PATHS.some((p) => pathname.startsWith(p)) &&
    !pathname.startsWith("/tresorerie/api/")
  ) {
    const session = request.cookies.get("admin_session");
    if (!session) {
      const loginUrl = new URL("/tresorerie/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
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
