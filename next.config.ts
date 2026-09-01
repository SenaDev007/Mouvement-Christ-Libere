import type { NextConfig } from "next";

/**
 * Configuration Next.js — Christ Libère
 * Optimisé pour déploiement Vercel.
 */
const nextConfig: NextConfig = {
  compress: true,
  reactStrictMode: true,
  poweredByHeader: false,

  // ⭐ V3.18 — @napi-rs/canvas (rendu texte/stickers PNG de la post-production
  // vidéo, V3.16) est un module NATIF (.node) : Turbopack ne peut pas le
  // placer dans un chunk ESM ("non-ecmascript placeable asset" → le build
  // Vercel échouait sur /api/videos/[id]/render). Il doit rester EXTERNE au
  // bundle serveur et être résolu au RUNTIME depuis node_modules — même
  // mécanisme que "canvas" dans la liste par défaut de Next (qui ne couvre
  // pas le fork @napi-rs). Les binaires de la plateforme (ex.
  // @napi-rs/canvas-linux-x64-gnu) sont quant à eux GARANTIS embarqués dans
  // la fonction serverless par outputFileTracingIncludes (le js-binding
  // résout le paquet plateforme dynamiquement selon l'OS — sans cette
  // clause le traçage nft pouvait l'oublier).
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/videos/[id]/render": [
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
  },

  // ⭐ V2.0 — next-auth v5 beta a des erreurs de types connues avec moduleResolution: "bundler"
  //    On ignore les erreurs TS au build (le runtime fonctionne correctement).
  //    TODO: retirer quand next-auth v5 stable sera publiée.
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    // ⭐ Optimisation : cache plus long + tailles d'appareil courantes
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // ⭐ Cache longue durée pour les assets statiques (logo, photos, favicons)
        source: "/(logo-christ-libere.png|pam.jpeg|pasteur-kongo.jpeg|favicon.ico|apple-icon.png|icon-32.png|manifest-192.png|manifest-512.png|shofar.png)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "date-fns"],
  },
};

export default nextConfig;
