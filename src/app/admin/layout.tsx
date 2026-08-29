"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  Video,
  Radio,
  MessageSquare,
  UserCog,
  Inbox,
  Heart,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldAlert,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV_SECTIONS = [
  {
    title: "Vue d'ensemble",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Contenu",
    items: [
      { label: "Serviteurs", href: "/admin/servants", icon: Users },
      { label: "Biographies", href: "/admin/biographies", icon: BookOpen },
      { label: "Témoignages", href: "/admin/testimonies", icon: FileText },
      { label: "Enseignements", href: "/admin/teachings", icon: BookOpen },
    ],
  },
  {
    title: "Média",
    items: [
      { label: "Vidéos", href: "/admin/videos", icon: Video },
      { label: "Lives", href: "/admin/lives", icon: Radio },
    ],
  },
  {
    title: "Communauté",
    items: [
      { label: "Canaux", href: "/admin/channels", icon: MessageSquare },
      { label: "Membres Live", href: "/admin/live-members", icon: Users },
      { label: "Utilisateurs", href: "/admin/users", icon: UserCog },
    ],
  },
  {
    title: "Activité",
    items: [
      { label: "Demandes de contact", href: "/admin/contact-requests", icon: Inbox },
      { label: "Dons", href: "/admin/donations", icon: Heart },
      { label: "Intercession", href: "/intercession", icon: Heart },
      { label: "Dead Man's Switch", href: "/admin/dead-mans-switch", icon: ShieldAlert },
    ],
  },
  {
    title: "Système",
    items: [
      { label: "Stockage R2", href: "/admin/r2-test", icon: Cloud },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ⚠️ Sur /admin/login : pas de sidebar, pas de topbar, juste le contenu plein écran.
  // On ne doit rien afficher de l'interface d'administration tant que l'utilisateur
  // n'est pas authentifié.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/admin/api/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#2A0E3D] text-[#FAF6EF] flex-shrink-0 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header avec logo Christ Libère */}
          <div className="px-5 py-5 border-b border-[#C9A227]/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-christ-libere.png"
                  alt="Christ Libère"
                  width={40}
                  height={40}
                  className="relative w-10 h-10 object-contain"
                  priority
                />
                <div>
                  <div
                    className="text-lg font-bold leading-tight"
                    style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
                  >
                    <span style={{ color: "#C9A227" }}>Christ</span>
                    <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#DDBE55]/70 font-semibold">
                    Backoffice
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-[#FAF6EF]/70"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto scrollbar-discrete py-4">
            {NAV_SECTIONS.map((section) => (
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
                            "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors",
                            isActive
                              ? "bg-[#C9A227]/15 text-[#C9A227] border-l-2 border-[#C9A227]"
                              : "text-[#FAF6EF]/70 hover:bg-[#3D1A54]/40 hover:text-[#FAF6EF] border-l-2 border-transparent"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer sidebar */}
          <div className="px-5 py-4 border-t border-[#C9A227]/15 space-y-1">
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-2 text-xs text-[#FAF6EF]/60 hover:text-[#C9A227] transition-colors py-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Voir le site
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-[#FAF6EF]/60 hover:text-state-danger transition-colors py-1.5"
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
          className="fixed inset-0 bg-[#1A0826]/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile avec logo */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#2A0E3D] text-[#FAF6EF] px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#FAF6EF]"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/logo-christ-libere.png"
              alt="Christ Libère"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <span
              className="text-sm font-bold"
              style={{ fontFamily: "'Segoe UI', 'Segoe UI Variable', system-ui, sans-serif" }}
            >
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
            </span>
          </div>
          <div className="w-5" />
        </header>

        {/* Contenu */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
