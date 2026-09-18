/**
 * ⭐ V3.93 — JsonLd : données structurées schema.org (spéc SEO).
 *
 * Rend un <script type="application/ld+json"> dans le flux serveur —
 * composant SERVEUR pur (aucun JS envoyé au navigateur), utilisable dans
 * n'importe quelle page RSC.
 *
 * Sécurité : les « < » sont échappés en \u003c pour empêcher toute
 * sortie de contexte HTML depuis les contenus dynamiques (titres,
 * extraits saisis dans le back-office).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

/** Constantes partagées entre les entités schema.org du site. */
export const ORGANISATION_MCL = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mouvement Christ Libère",
  alternateName: "Christ Libère",
  url: "https://www.mouvementchristlibere.com",
  logo: "https://www.mouvementchristlibere.com/logo-christ-libere-v3.png",
  description:
    "Mouvement chrétien d'Afrika Alkebulane Pamela Dali et du Pasteur Kongo — enseignements, témoignages, adoration et vie de communauté autour de la marche avec Yeshoua.",
} as const;
