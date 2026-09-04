"use client";

import {
  Sparkles,
  FileText,
  BookOpen,
  Calendar,
  MessageSquare,
  ChevronDown,
  Menu,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCallback, useEffect, useRef, useState } from "react";

// Navigation links — contextualisés pour Christ Libère
const navigationLinks = [
  { href: "/", label: "Accueil" },
  {
    label: "Serviteurs",
    submenu: true,
    type: "description",
    items: [
      {
        href: "/pam",
        label: "Pam — Afrika Alkebulane Pamela Dali",
        description: "Servante de l'Éternel, biographie, témoignages et révélations prophétiques.",
      },
      {
        href: "/pasteur-kongo",
        label: "Pasteur Kongo",
        description: "Ministère pastoral complémentaire, enseignements et soins des brebis.",
      },
    ],
  },
  {
    label: "Parole",
    submenu: true,
    type: "icon",
    items: [
      { href: "/temoignages", label: "Témoignages", icon: "FileText" },
      { href: "/enseignements", label: "Enseignements", icon: "BookOpen" },
      { href: "/bible", label: "Bible en ligne", icon: "Sparkles" },
      { href: "/calendrier-biblique", label: "Calendrier biblique", icon: "Calendar" },
    ],
  },
  {
    label: "Médias",
    submenu: true,
    type: "simple",
    items: [
      { href: "/videos", label: "Vidéos & Lives" },
    ],
  },
  {
    label: "Communauté",
    submenu: true,
    type: "simple",
    items: [
      { href: "/yeshua-connect", label: "Yeshua Connect — Chat" },
      // ⭐ V3.2 — Intercession et Dispersés d'Israël regroupés sous le bouton
      // principal « Communauté » (demande explicite).
      { href: "/intercession", label: "Intercession" },
      { href: "/disperses", label: "Dispersés d'Israël" },
      { href: "/contribuer", label: "Contribuer (Don/Dîme)" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText,
  BookOpen,
  Sparkles,
  Calendar,
};

export function ContextualNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // ⭐ V3.0 — Profil FRAIS (photo + nom) chargé depuis la base via
  // /api/user/profile. La session NextAuth (JWT 30 jours) fige
  // session.user.image au moment de la connexion : si l'utilisateur
  // change sa photo ensuite (page /profil ou modal Yeshua Connect), la
  // navbar continuait d'afficher un placeholder avec initiale.
  // On recharge : au montage, au focus de la fenêtre, et sur l'événement
  // global « profile-updated » (émis après chaque sauvegarde de profil).
  const [freshProfile, setFreshProfile] = useState<{
    name?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const loadFreshProfile = useCallback(() => {
    if (status !== "authenticated") return;
    fetch(api.url("/api/user/profile"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === "object") setFreshProfile(data);
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    loadFreshProfile();
    const onFocus = () => loadFreshProfile();
    const onProfileUpdated = () => loadFreshProfile();
    window.addEventListener("focus", onFocus);
    window.addEventListener("profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("profile-updated", onProfileUpdated);
    };
  }, [loadFreshProfile]);

  // ⭐ V3.0 — Détection mobile (masque le libellé à côté de l'avatar).
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // ⭐ V2.6.1 — Menu déroulant desktop ouvert (label du menu parent).
  // Chaque sous-menu s'ancre sous SON bouton (plus de viewport partagé
  // qui centrait tous les panneaux au même endroit).
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFullScreenPage = false; // /yeshua-connect utilise la navbar principale (pas de mode plein écran)
  const isAuthenticated = status === "authenticated" && session?.user;

  // Ouvre au survol (avec annulation du retard de fermeture)
  const hoverOpen = (label: string) => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    setOpenMenu(label);
  };
  // Fermeture différée (~140 ms) : évite le clignotement quand la souris
  // traverse l'espace entre le bouton et son panneau.
  const hoverClose = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => setOpenMenu(null), 140);
  };

  // Échap / clic extérieur / changement de route → fermer le sous-menu
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        desktopNavRef.current &&
        !desktopNavRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  // Navigation → fermer systématiquement (desktop ET mobile)
  useEffect(() => {
    setOpenMenu(null);
    setUserMenuOpen(false);
  }, [pathname]);

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  // ⭐ V3.0 — Photo + nom ACTUELS : profil frais de la base en priorité,
  // sinon session (valeur figée à la connexion). ⚠️ <img> natif et NON
  // next/image : l'avatar est stocké en data URL (JPEG base64), que
  // next/image ne sait pas optimiser — d'où la photo qui ne s'affichait
  // JAMAIS dans la navbar, même juste après connexion.
  const displayName =
    freshProfile?.name || session?.user?.name || "Mon compte";
  const displayAvatar =
    freshProfile?.avatarUrl || session?.user?.image || null;

  // Navbar fixe en haut sur toutes les pages (y compris /yeshua-connect)
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b border-[#C9A227]/20 bg-[#2A0E3D]/95 backdrop-blur-lg"
      )}
    >
      <div className="flex h-16 md:h-20 items-center justify-between gap-4 px-4 md:px-6 max-w-7xl mx-auto">
        {/* Left side */}
        <div className="flex items-center gap-2">
          {/* Mobile menu trigger */}
          <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
            <PopoverTrigger asChild>
              <Button
                // ⭐ V3.28 — 44px minimum (norme tactile) au lieu de 32px
                className="group size-11 md:hidden"
                variant="ghost"
                size="icon"
                aria-label="Ouvrir le menu de navigation"
              >
                <Menu className="w-5 h-5 text-[#FAF6EF]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 max-w-[calc(100vw-1.5rem)] p-1 md:hidden bg-[#2A0E3D] border-[#C9A227]/30">
              <NavigationMenu className="max-w-none *:w-full">
                <NavigationMenuList className="flex-col items-start gap-0 md:gap-2">
                  {navigationLinks.map((link, index) => (
                    <NavigationMenuItem key={index} className="w-full">
                      {link.submenu ? (
                        <>
                          <div className="text-[#C9A227] px-2 py-1.5 text-xs font-semibold uppercase tracking-wider">
                            {link.label}
                          </div>
                          <ul>
                            {link.items.map((item, itemIndex) => (
                              <li key={itemIndex}>
                                <NavigationMenuLink
                                  href={item.href}
                                  className="py-3 text-[#FAF6EF]/70 hover:text-[#C9A227]"
                                  onClick={() => setMobileOpen(false)}
                                >
                                  {item.label}
                                </NavigationMenuLink>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <NavigationMenuLink
                          href={link.href}
                          className="py-3 text-[#FAF6EF]/70 hover:text-[#C9A227]"
                          onClick={() => setMobileOpen(false)}
                        >
                          {link.label}
                        </NavigationMenuLink>
                      )}
                      {index < navigationLinks.length - 1 &&
                        ((!link.submenu && navigationLinks[index + 1].submenu) ||
                          (link.submenu && !navigationLinks[index + 1].submenu) ||
                          (link.submenu &&
                            navigationLinks[index + 1].submenu &&
                            link.type !== navigationLinks[index + 1].type)) && (
                          <div
                            role="separator"
                            aria-orientation="horizontal"
                            className="bg-[#C9A227]/20 -mx-1 my-1 h-px w-full"
                          />
                        )}
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </PopoverContent>
          </Popover>

          {/* Logo Christ Libère */}
          <Link href="/" className="flex items-center gap-1 group/logo">
            <Image
              src="/logo-christ-libere.png"
              alt="Christ Libère"
              width={56}
              height={56}
              sizes="(max-width: 767px) 48px, 56px"
              className="relative w-12 h-12 md:w-14 md:h-14 object-contain"
              priority
            />
            <span
              className="text-xl md:text-2xl font-bold whitespace-nowrap"
              style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
            >
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span style={{ color: "#FAF6EF" }} className="ml-0.5">Libère</span>
            </span>
          </Link>

          {/* Desktop Navigation — ⭐ V2.6.1 : chaque sous-menu s'ancre
              sous SON propre bouton (les libellés tiennent sur UNE ligne,
              plus de grille 2 colonnes qui les coupait en deux). */}
          <nav
            ref={desktopNavRef}
            aria-label="Navigation principale"
            className="max-md:hidden ml-4 flex items-center gap-0.5"
          >
            {navigationLinks.map((link, index) =>
              link.submenu ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => hoverOpen(link.label)}
                  onMouseLeave={hoverClose}
                >
                  {/* Bouton parent */}
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === link.label}
                    onClick={() =>
                      setOpenMenu(
                        openMenu === link.label ? null : link.label
                      )
                    }
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#C9A227]/40",
                      openMenu === link.label
                        ? "text-[#C9A227] bg-[#C9A227]/10"
                        : "text-[#FAF6EF]/70 hover:text-[#C9A227] hover:bg-[#C9A227]/10"
                    )}
                  >
                    {link.label}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "w-3 h-3 transition-transform duration-200",
                        openMenu === link.label && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Panneau ancré sous CE bouton (⭐ V2.6.1) */}
                  {openMenu === link.label && (
                    <div
                      role="menu"
                      aria-label={link.label}
                      onMouseEnter={() => hoverOpen(link.label)}
                      onMouseLeave={hoverClose}
                      className={cn(
                        "absolute top-full pt-1.5 z-50 min-w-max",
                        // Dernier menu (Communauté) : ancré à droite pour
                        // ne jamais déborder de l'écran.
                        index === navigationLinks.length - 1
                          ? "right-0"
                          : "left-0"
                      )}
                    >
                      <ul
                        className={cn(
                          "bg-[#2A0E3D]/95 backdrop-blur-md border border-[#C9A227]/30 rounded-xl shadow-2xl shadow-black/50 py-1.5",
                          link.type === "description" ? "w-[380px]" : "min-w-[220px]"
                        )}
                      >
                        {link.items.map((item) => (
                          <li key={item.href} role="none">
                            <Link
                              href={item.href}
                              role="menuitem"
                              onClick={() => setOpenMenu(null)}
                              className="flex items-start gap-2.5 mx-1 px-3 py-2 rounded-lg text-[#FAF6EF]/85 hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors outline-none focus-visible:bg-[#C9A227]/10 focus-visible:text-[#C9A227] whitespace-nowrap"
                            >
                              {/* Icône (type icon) */}
                              {link.type === "icon" && "icon" in item &&
                                iconMap[item.icon as string] &&
                                (() => {
                                  const Icon = iconMap[item.icon as string];
                                  return (
                                    <Icon
                                      size={16}
                                      className="text-[#C9A227] opacity-80 shrink-0 mt-0.5"
                                    />
                                  );
                                })()}
                              <span className="min-w-0">
                                {/* ⭐ Libellé TOUJOURS sur une seule ligne */}
                                <span className="block text-sm font-medium leading-5 whitespace-nowrap">
                                  {item.label}
                                </span>
                                {/* Description (type description) — texte
                                    secondaire, peut se plier sur 2 lignes */}
                                {link.type === "description" &&
                                  "description" in item && (
                                    <span className="block text-xs leading-snug text-[#FAF6EF]/50 mt-0.5 whitespace-normal line-clamp-2">
                                      {item.description}
                                    </span>
                                  )}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  href={link.href!}
                  className="px-2 py-1.5 rounded-md text-sm font-medium text-[#FAF6EF]/70 hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Right side — Auth + CTA */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            /* ═══ Utilisateur connecté — avatar + menu déroulant ═══ */
            <div className="relative">
              <div className="flex items-center gap-1">
                {/* ⭐ V3.0 — Accès DIRECT aux paramètres (engrenage) :
                    visible pour TOUT membre connecté, avant même d'ouvrir
                    le menu — le profil/photo se modifie en 1 geste. */}
                <Link
                  href="/profil"
                  aria-label="Paramètres de mon compte"
                  title="Modifier ma photo et mes informations"
                  className="inline-flex items-center justify-center size-11 rounded-lg text-[#FAF6EF]/70 hover:text-[#C9A227] hover:bg-[#FAF6EF]/10 transition-colors"
                >
                  <Settings className="w-4.5 h-4.5" />
                </Link>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 min-h-11 p-1.5 pr-2.5 rounded-full hover:bg-[#FAF6EF]/10 transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-[#C9A227]/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#C9A227] flex items-center justify-center text-[#1E0F2B] font-bold text-sm">
                      {(displayName || session?.user?.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  {!isMobile && (
                    <span className="hidden sm:inline text-sm font-medium text-[#FAF6EF] max-w-[100px] truncate">
                      {displayName}
                    </span>
                  )}
                </button>
              </div>

              {/* Menu déroulant utilisateur */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-2xl border border-[#8A8378]/15 py-2 min-w-[230px]">
                    <div className="px-4 py-2 border-b border-[#8A8378]/10 flex items-center gap-3">
                      {displayAvatar ? (
                        <img src={displayAvatar} alt={displayName} className="w-10 h-10 rounded-full object-cover ring-1 ring-[#C9A227]/40 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#C9A227] flex items-center justify-center text-[#1E0F2B] font-bold flex-shrink-0">
                          {(displayName || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1E0F2B] truncate">
                          {displayName}
                        </p>
                        {session?.user?.email && (
                          <p className="text-xs text-[#8A8378] truncate">{session?.user?.email}</p>
                        )}
                      </div>
                    </div>
                    {/* ⭐ V3.0 — MON PROFIL & PARAMÈTRES : entrée principale
                        (photo, nom, téléphone, pays, ville, bio). Avant, la
                        page /profil existait mais n'était liée NULLE PART :
                        aucun membre ne pouvait modifier ses informations. */}
                    <Link
                      href="/profil"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#1E0F2B] hover:bg-[#C9A227]/10 hover:text-[#A3821C] transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-[#C9A227]" />
                      Mon profil & paramètres
                    </Link>
                    <Link
                      href="/yeshua-connect"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#1E0F2B] hover:bg-[#2A0E3D]/5 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-[#8A8378]" />
                      Yeshua Connect
                    </Link>
                    {/* ⭐ V3.2 — « Carte des dispersés » retirée du menu
                        utilisateur : désormais sous le bouton principal
                        « Communauté » (avec l'Intercession). */}
                    <div className="border-t border-[#8A8378]/10 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ═══ Utilisateur non connecté — boutons auth ═══ */
            <>
              {/* Mobile: icône seule */}
              <Link
                href="/login"
                className="sm:hidden inline-flex items-center justify-center size-11 rounded-lg text-[#FAF6EF]/70 hover:text-[#C9A227] transition-colors"
                aria-label="Se connecter"
              >
                <LogIn className="w-5 h-5" />
              </Link>
              {/* Desktop: texte */}
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center text-sm font-medium text-[#FAF6EF]/70 hover:text-[#C9A227] transition-colors px-3 py-2.5"
              >
                Se connecter
              </Link>
              {/* Mobile: icône seule */}
              <Link
                href="/register"
                className="sm:hidden inline-flex items-center justify-center size-11 rounded-lg text-[#FAF6EF] hover:text-[#C9A227] hover:bg-[#FAF6EF]/5 transition-colors"
                aria-label="Créer un compte"
              >
                <UserPlus className="w-5 h-5" />
              </Link>
              {/* Desktop: texte */}
              <Button asChild size="sm" variant="ghost" className="hidden sm:flex text-[#FAF6EF] hover:text-[#C9A227] hover:bg-[#FAF6EF]/5 text-sm">
                <Link href="/register">
                  Créer un compte
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
