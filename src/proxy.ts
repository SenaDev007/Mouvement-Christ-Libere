import { NextResponse, type NextRequest } from "next/server";

// ⭐ V3.76 — « pam » (et ses alias historiques) restent acceptés en
// sous-domaine par compatibilité ; le code serviteur émis est « afrika ».
const AFRIKA_HOSTS = new Set(["afrika", "amela.dali", "ameladali", "pam"]);
const KONGO_HOSTS = new Set(["pasteurkongo", "kongo"]);
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/api/login"];

// ⭐ V3.67 — Routes API du back-office qui possèdent LEUR PROPRE garde de
// session (exigerSession → 401/403 JSON). Le proxy les laisse passer SANS
// redirection 307 vers le login : un fetch reçoit un statut JSON exploitable
// (bilan V3.66 : GET /admin/api/staff sans session renvoyait « 307 HTML
// Redirecting… » au lieu de 401). ⚠️ N'ajouter ICI que des routes vérifiées
// portant leur propre exigerSession — les routes génériques
// /admin/api/[entity] n'en ont PAS et dépendent de la garde du proxy.
// ⭐ V3.74 — /admin/api/demandes : module de réception des serviteurs
// (garde exigerSession SUPER_ADMIN — 401/403 JSON).
// ⭐ V3.83 — /admin/api/paiements : configuration des passerelles de
// paiement FedaPay/Paystack (garde exigerSession SUPER_ADMIN — 401/403 JSON).
// ⭐ V3.89 — /admin/api/annonces : registre partagé des annonces du
// ministère (garde exigerSession SUPER_ADMIN — 401/403 JSON ; mêmes
// données que le secrétariat, cf. annonces-api.ts).
// ⭐ V3.89 — /admin/api/studio : MCL Creative Studio (miniatures &
// affiches — garde exigerSession SUPER_ADMIN — 401/403 JSON).
const ADMIN_API_AVEC_GARDE_PROPRE = [
  "/admin/api/staff",
  "/admin/api/demandes",
  "/admin/api/paiements",
  "/admin/api/annonces",
  "/admin/api/studio",
];

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

// ⭐ V3.89 — Pages PUBLIQUES du site : sur un sous-domaine d'espace (admin,
// secrétariat, trésorerie), elles n'ont RIEN à faire — la redirection générique
// les préfixait (/rendez-vous → /admin/rendez-vous → 404, signalé par le
// pasteur). Elles sont désormais REDIRIGÉES vers le site public (même domaine,
// sans le préfixe de sous-domaine) : la page de demande de rendez-vous et le
// registre public des annonces restent accessibles depuis N'IMPORTE QUEL
// espace, dans un onglet classique.
// NB : /annonces fait exception sur les hôtes admin et secrétariat — ces
// deux espaces possèdent leur PROPRE module d'annonces (/admin/annonces
// V3.89, /secretariat/annonces V3.66) que la redirection générique sert.
const PAGES_PUBLIQUES_ESPACE = [
  "/rendez-vous",
  "/annonces",
  "/contact",
  "/temoignages",
  "/enseignements",
  "/videos",
  "/live",
  "/communaute",
  "/contribuer",
  "/calendrier",
  "/calendrier-biblique",
  "/bible",
  "/intercession",
  "/adoration-louanges",
  "/afrika",
  "/pasteur-kongo",
];

/** Le chemin correspond-il à une page publique à réexpédier au site www ? */
function estPagePublique(pathname: string): boolean {
  return PAGES_PUBLIQUES_ESPACE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** URL du site public pour un hôte d'espace (admin.x → x, localhost en dev).
 * Protocole : x-forwarded-proto (Cloudflare/Vercel) sinon http (dev local). */
function urlSitePublic(request: NextRequest): string {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const port = host.includes(":") ? host.split(":")[1] : "";
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] || "http";
  // admin.mouvementchristlibere.com → mouvementchristlibere.com
  // secretariat.localhost:3000 (dev) → localhost:3000
  const sansSousDomaine = hostname.split(".").slice(1).join(".") || hostname;
  return `${proto}://${sansSousDomaine}${port ? `:${port}` : ""}`;
}

// Fichiers servis depuis /public (logo du back-office, manifest, sons…) et
// assets divers : ils restent accessibles TELS QUELS sur le sous-domaine admin —
// jamais réécrits vers /admin/* (sinon /logo-christ-libere-v3.png renverrait 404).
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
  const hoteEspace = hoteAdmin || hoteSecretariat || hoteTresorerie;

  // ------------------------------------------------------------------
  // ⭐ V3.89 — Pages PUBLIQUES sur un sous-domaine d'espace : redirection
  // vers le site public (fix « /rendez-vous et /annonces → 404 »).
  // AVANT la redirection générique d'espace, sinon /rendez-vous devenait
  // /admin/rendez-vous → 404. Exception : /annonces sur les hôtes admin et
  // secrétariat, qui tombent volontairement sur leurs modules respectifs.
  // ------------------------------------------------------------------
  if (
    hoteEspace &&
    !pathname.startsWith("/_next") &&
    !FICHIER_STATIQUE.test(pathname) &&
    estPagePublique(pathname) &&
    !(
      (hoteAdmin || hoteSecretariat) &&
      (pathname === "/annonces" || pathname.startsWith("/annonces/"))
    )
  ) {
    const url = new URL(`${urlSitePublic(request)}${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url, 307);
  }

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
  // Les routes API de ADMIN_API_AVEC_GARDE_PROPRE répondent elles-mêmes en
  // 401/403 JSON (V3.67) — pas de redirection HTML pour un appel fetch.
  if (
    pathname.startsWith("/admin") &&
    !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p)) &&
    !ADMIN_API_AVEC_GARDE_PROPRE.some((p) => pathname.startsWith(p))
  ) {
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
  if (AFRIKA_HOSTS.has(subdomain)) servant = "afrika";
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
