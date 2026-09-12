"use client";

/**
 * ⭐ V3.66 — Coquille de navigation partagée des espaces dédiés
 * (secrétariat & trésorerie).
 *
 * Même structure que la sidebar du back-office (fixe, w-64, violet
 * #000000, or #C9A227, crème #F0E9DE) — seuls le nom de l'espace, les
 * sections de navigation et le point d'accès de déconnexion changent.
 * Sur la page de connexion de l'espace, la coquille ne s'affiche pas.
 */

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LogOut, Menu, X, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionNav {
  title: string;
  items: {
    label: string;
    href: string;
    icon: LucideIcon;
    badge?: string | null;
  }[];
}

export interface SpaceShellProps {
  /** Nom de l'espace (ex. « Secrétariat »). */
  titreEspace: string;
  /** Préfixe des routes (ex. /secretariat). */
  prefixeEspace: string;
  /** Libellé du sous-domaine dédié (ex. « secretariat » — sert à calculer
   *  « Voir le site » : secretariat.mouvementchristlibere.com → mouvementchristlibere.com).
   *  En dev : secretariat.localhost → localhost. */
  libelleSousDomaine: string;
  /** Sections de navigation. */
  sections: SectionNav[];
  children: React.ReactNode;
}

export function SpaceShell({
  titreEspace,
  prefixeEspace,
  libelleSousDomaine,
  sections,
  children,
}: SpaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sur le sous-domaine dédié, « Voir le site » doit ouvrir le site PUBLIC
  // et non la racine de ce même hôte (calcul client uniquement — état
  // initial "/" identique serveur/client → pas de décalage d'hydratation ;
  // même astuce que le back-office V3.44).
  const [sitePublicUrl, setSitePublicUrl] = useState("/");
  useEffect(() => {
    try {
      const hote = window.location.hostname;
      // secretariat.mouvementchristlibere.com → mouvementchristlibere.com
      // secretariat.localhost (dev)              → localhost
      if (hote.startsWith(`${libelleSousDomaine}.`)) {
        const url = new URL(window.location.origin);
        url.hostname = hote.slice(libelleSousDomaine.length + 1);
        setSitePublicUrl(url.origin);
      }
    } catch {
      // comportement par défaut "/"
    }
  }, [libelleSousDomaine]);

  // Page de connexion de l'espace : pas de sidebar, plein écran.
  if (pathname === `${prefixeEspace}/login`) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch(`${prefixeEspace}/api/logout`, { method: "POST" });
    router.push(`${prefixeEspace}/login`);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#F0E9DE] flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#000000] text-[#F0E9DE] flex-shrink-0 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* En-tête : logo + identité de l'espace */}
          <div className="px-5 py-5 border-b border-[#C9A227]/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-christ-libere-v2.png"
                  alt="Christ Libère"
                  width={40}
                  height={40}
                  className="relative w-10 h-10 object-contain"
                  priority
                />
                <div className="min-w-0">
                  <div
                    className="text-base font-bold leading-tight whitespace-nowrap"
                    style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
                  >
                    <span style={{ color: "#C9A227" }}>Christ</span>
                    <span style={{ color: "#F0E9DE" }}>&nbsp;Libère</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/70 font-semibold truncate">
                    {titreEspace}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[#F0E9DE]/70 hover:text-[#F0E9DE] hover:bg-[#F0E9DE]/10 transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto scrollbar-discrete py-4">
            {sections.map((section) => (
              <div key={section.title} className="mb-5">
                <p className="px-5 mb-2 text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/50 font-semibold">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-5 py-3 text-sm transition-colors",
                            isActive
                              ? "bg-[#C9A227]/15 text-[#C9A227] border-l-2 border-[#C9A227]"
                              : "text-[#F0E9DE]/70 hover:bg-[#161513]/40 hover:text-[#F0E9DE] border-l-2 border-transparent"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#C9A227] text-[#000000] text-[10px] font-bold">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Pied de sidebar */}
          <div className="px-5 py-4 border-t border-[#C9A227]/15 space-y-1">
            <Link
              href={sitePublicUrl}
              target="_blank"
              className="flex items-center gap-2 text-xs text-[#F0E9DE]/60 hover:text-[#FF7A1A] transition-colors py-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Voir le site
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-[#F0E9DE]/60 hover:text-[#B3452E] transition-colors py-1.5"
            >
              <LogOut className="w-3 h-3" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#000000]/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre supérieure mobile */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#000000] text-[#F0E9DE] px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 w-11 h-11 flex items-center justify-center rounded-lg text-[#F0E9DE] hover:bg-[#F0E9DE]/10 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/logo-christ-libere-v2.png"
              alt="Christ Libère"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <span className="text-sm font-semibold text-[#DDBE55]">
              {titreEspace}
            </span>
          </div>
          <div className="w-5" />
        </header>

        {/* Contenu — chaque module gère son propre conteneur scrollable
            (leçon V3.62 : pas d'overflow-x-auto global qui masquerait les
            débordements, min-w-0 sur les colonnes flexibles). */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
