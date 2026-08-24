"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
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
  Calendar,
  ShieldAlert,
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
      { label: "Calendrier", href: "/admin/calendar", icon: Calendar },
    ],
  },
  {
    title: "Communauté",
    items: [
      { label: "Canaux", href: "/admin/channels", icon: MessageSquare },
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
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/admin/api/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-imperial text-ivory flex-shrink-0 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-5 py-5 border-b border-gold/15">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-lg font-semibold text-ivory">
                  Backoffice
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-gold-light/70 font-semibold">
                  Christ Libère
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-ivory/70"
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
                <p className="px-5 mb-2 text-[10px] uppercase tracking-[0.18em] text-gold-light/50 font-semibold">
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
                              ? "bg-gold/15 text-gold border-l-2 border-gold"
                              : "text-ivory/70 hover:bg-imperial-light/40 hover:text-ivory border-l-2 border-transparent"
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
          <div className="px-5 py-4 border-t border-gold/15 space-y-1">
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-2 text-xs text-ivory/60 hover:text-gold transition-colors py-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Voir le site
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-ivory/60 hover:text-state-danger transition-colors py-1.5"
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
          className="fixed inset-0 bg-imperial-dark/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-20 bg-imperial text-ivory px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-ivory"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif text-sm font-semibold">Backoffice</span>
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
