import Link from "next/link";

const FOOTER_LINKS = {
  discover: {
    title: "Découvrir",
    links: [
      { label: "Biographie", href: "/biographie" },
      { label: "Témoignages", href: "/temoignages" },
      { label: "Enseignements", href: "/enseignements" },
      { label: "Vidéos & Lives", href: "/videos" },
    ],
  },
  community: {
    title: "Communauté",
    links: [
      { label: "Rejoindre un canal", href: "/communaute" },
      { label: "Charte de la communauté", href: "/communaute/charte" },
      { label: "Contribuer", href: "/contribuer" },
    ],
  },
  info: {
    title: "Informations",
    links: [
      { label: "Politique de confidentialité", href: "/confidentialite" },
      { label: "Conditions d'utilisation", href: "/conditions" },
      { label: "Contact", href: "/contact" },
    ],
  },
};

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-imperial text-ivory border-t border-gold/20">
      {/* Filet or supérieur */}
      <div className="h-[3px] bg-gold" />

      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Colonne baseline */}
          <div className="md:col-span-1">
            <div className="font-serif text-2xl font-semibold text-ivory mb-2">
              Mouvement Christ Libère
            </div>
            <p className="text-sm text-ivory/70 leading-relaxed mb-4">
              Témoignages, enseignements et vie de communauté au service du
              rassemblement.
            </p>
            <p className="font-serif italic text-gold text-lg">
              Au son du chofar.
            </p>
          </div>

          {/* Colonnes liens */}
          {Object.values(FOOTER_LINKS).map((col) => (
            <div key={col.title}>
              <h3 className="text-xs uppercase tracking-[0.18em] text-gold-light/80 font-semibold mb-4">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ivory/75 hover:text-gold transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mention légale */}
        <div className="mt-10 pt-6 border-t border-imperial-light/40">
          <p className="text-xs text-ivory/55 text-center">
            © {year} — Tous les contenus appartiennent à leurs auteurs. Usage
            personnel et non commercial.
          </p>
        </div>
      </div>
    </footer>
  );
}
