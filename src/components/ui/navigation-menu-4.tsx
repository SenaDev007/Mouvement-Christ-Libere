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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

// Navigation links — contextualisés pour Mouvement Christ Libère
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
        description: "Servante de l'Éternel, témoignages de visites au ciel, révélations prophétiques.",
      },
      {
        href: "/pasteur-kongo",
        label: "Pasteur Kongo",
        description: "Ministère pastoral complémentaire, enseignements et soins des brebis.",
      },
      {
        href: "/biographie",
        label: "Biographies complètes",
        description: "Frises chronologiques détaillées de chaque parcours.",
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const isFullScreenPage = pathname?.startsWith("/yeshua-connect");

  // Sur /yeshua-connect, la navbar est en haut fixe (pas en bas flottante)
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b border-[#C9A227]/20 bg-[#2A0E3D]/95 backdrop-blur-lg",
        isFullScreenPage && "hidden"
      )}
    >
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6 max-w-7xl mx-auto">
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

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#C9A227]" />
            <span className="font-serif text-base font-bold text-[#FAF6EF] hidden sm:inline">
              Mouvement Christ Libère
            </span>
            <span className="font-serif text-base font-bold text-[#FAF6EF] sm:hidden">
              Christ Libère
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

        {/* Right side — CTA */}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] text-sm">
            <Link href="/yeshua-connect">
              Rejoindre
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
