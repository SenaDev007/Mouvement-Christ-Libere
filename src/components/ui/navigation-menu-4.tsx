"use client";

import {
  Sparkles,
  User,
  FileText,
  BookOpen,
  Video,
  Calendar,
  Globe,
  Users,
  MessageSquare,
  Mail,
  ChevronRight,
  Menu,
  LogOut,
  UserCircle,
  LogIn,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

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
      { href: "/disperses", label: "Dispersés d'Israël" },
      { href: "/intercession", label: "Intercession" },
    ],
  },
  {
    label: "Communauté",
    submenu: true,
    type: "simple",
    items: [
      { href: "/yeshua-connect", label: "Yeshua Connect — Chat" },
      { href: "/communaute", label: "Canaux & Groupes" },
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
  const isFullScreenPage = false; // /yeshua-connect utilise la navbar principale (pas de mode plein écran)
  const isAuthenticated = status === "authenticated" && session?.user;

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

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
                className="group size-8 md:hidden"
                variant="ghost"
                size="icon"
              >
                <Menu className="w-5 h-5 text-[#FAF6EF]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-1 md:hidden bg-[#2A0E3D] border-[#C9A227]/30">
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
                                  className="py-1.5 text-[#FAF6EF]/70 hover:text-[#C9A227]"
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
                          className="py-1.5 text-[#FAF6EF]/70 hover:text-[#C9A227]"
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

          {/* Desktop Navigation */}
          <div className="max-md:hidden ml-4">
            <NavigationMenu>
              <NavigationMenuList>
                {navigationLinks.map((link, index) => (
                  <NavigationMenuItem key={index}>
                    {link.submenu ? (
                      <>
                        <NavigationMenuTrigger className="text-[#FAF6EF]/70 hover:text-[#C9A227] bg-transparent px-2 py-1.5 text-sm font-medium data-[state=open]:text-[#C9A227]">
                          {link.label}
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <ul
                            className={cn(
                              "grid gap-3 p-4 bg-[#2A0E3D] border border-[#C9A227]/30 rounded-lg",
                              link.type === "description"
                                ? "w-[400px] md:w-[500px] md:grid-cols-1"
                                : "w-[280px] md:grid-cols-2"
                            )}
                          >
                            {link.items.map((item, itemIndex) => (
                              <li key={itemIndex}>
                                <NavigationMenuLink asChild>
                                  <Link
                                    href={item.href}
                                    className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[#C9A227]/10 hover:text-[#C9A227] focus:bg-[#C9A227]/10 focus:text-[#C9A227]"
                                  >
                                    {/* Icon type */}
                                    {link.type === "icon" && "icon" in item && (
                                      <div className="flex items-center gap-2">
                                        {iconMap[item.icon as string] &&
                                          (() => {
                                            const Icon = iconMap[item.icon as string];
                                            return <Icon size={16} className="text-[#C9A227] opacity-80" />;
                                          })()}
                                        <div className="text-sm font-medium leading-none text-[#FAF6EF]">
                                          {item.label}
                                        </div>
                                      </div>
                                    )}

                                    {/* Description type */}
                                    {link.type === "description" && "description" in item && (
                                      <>
                                        <div className="text-sm font-medium leading-none text-[#FAF6EF]">
                                          {item.label}
                                        </div>
                                        <p className="line-clamp-2 text-xs leading-snug text-[#FAF6EF]/50">
                                          {item.description}
                                        </p>
                                      </>
                                    )}

                                    {/* Simple type */}
                                    {link.type === "simple" && (
                                      <div className="text-sm font-medium leading-none text-[#FAF6EF]">
                                        {item.label}
                                      </div>
                                    )}
                                  </Link>
                                </NavigationMenuLink>
                              </li>
                            ))}
                          </ul>
                        </NavigationMenuContent>
                      </>
                    ) : (
                      <NavigationMenuLink asChild>
                        <Link
                          href={link.href}
                          className="text-[#FAF6EF]/70 hover:text-[#C9A227] py-1.5 px-2 text-sm font-medium"
                        >
                          {link.label}
                        </Link>
                      </NavigationMenuLink>
                    )}
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
              <NavigationMenuViewport />
            </NavigationMenu>
          </div>
        </div>

        {/* Right side — Auth + CTA */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            /* ═══ Utilisateur connecté — avatar + menu déroulant ═══ */
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-[#FAF6EF]/10 transition-colors"
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#C9A227] flex items-center justify-center text-[#1E0F2B] font-bold text-sm">
                    {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm font-medium text-[#FAF6EF] max-w-[100px] truncate">
                  {session.user.name || "Mon compte"}
                </span>
              </button>

              {/* Menu déroulant utilisateur */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-2xl border border-[#8A8378]/15 py-2 min-w-[200px]">
                    <div className="px-4 py-2 border-b border-[#8A8378]/10">
                      <p className="text-sm font-bold text-[#1E0F2B] truncate">
                        {session.user.name || "Utilisateur"}
                      </p>
                      {session.user.email && (
                        <p className="text-xs text-[#8A8378] truncate">{session.user.email}</p>
                      )}
                    </div>
                    <Link
                      href="/yeshua-connect"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#1E0F2B] hover:bg-[#2A0E3D]/5 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-[#8A8378]" />
                      Yeshua Connect
                    </Link>
                    <Link
                      href="/disperses"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#1E0F2B] hover:bg-[#2A0E3D]/5 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-[#8A8378]" />
                      Carte des dispersés
                    </Link>
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
                className="sm:hidden p-2 rounded-lg text-[#FAF6EF]/70 hover:text-[#C9A227] transition-colors"
                aria-label="Se connecter"
              >
                <LogIn className="w-5 h-5" />
              </Link>
              {/* Desktop: texte */}
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center text-sm font-medium text-[#FAF6EF]/70 hover:text-[#C9A227] transition-colors px-3 py-1.5"
              >
                Se connecter
              </Link>
              {/* Mobile: icône seule */}
              <Link
                href="/register"
                className="sm:hidden p-2 rounded-lg text-[#FAF6EF] hover:text-[#C9A227] hover:bg-[#FAF6EF]/5 transition-colors"
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
