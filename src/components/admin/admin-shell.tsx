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
  Music,
  MessageSquare,
  Megaphone,
  Sparkles,
  UserCog,
  Inbox,
  Heart,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldAlert,
  Cloud,
  Youtube,
  Image as ImageIcon,
  Building2,
  Wallet,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { InstallAppButton } from "@/components/pwa/install-app-button";

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
      // ⭐ V3.45 — Sections hero paramétrables (photos + textes de
      // toutes les bannières du site public)
      { label: "Sections Hero", href: "/admin/heroes", icon: ImageIcon },
    ],
  },
  {
    title: "Média",
    items: [
      { label: "Vidéos", href: "/admin/videos", icon: Video },
      { label: "Lives", href: "/admin/lives", icon: Radio },
      // ⭐ V3.79 — Module dédié Adoration & Louanges (Afrika, chantre de
      // l'Éternel) : upload/édition de ses chants → page publique
      // /adoration-louanges.
      { label: "Adoration & Louanges", href: "/admin/adoration", icon: Music },
      // ⭐ V3.89 — MCL Creative Studio : miniatures vidéo & affiches
      // professionnelles sans Canva ni Photoshop (module partagé avec le
      // secrétariat).
      { label: "Studio Créatif", href: "/admin/studio", icon: Sparkles },
    ],
  },
  {
    title: "Communauté",
    items: [
      { label: "Canaux", href: "/admin/channels", icon: MessageSquare },
      { label: "Membres Live", href: "/admin/live-members", icon: Users },
      { label: "Utilisateurs", href: "/admin/users", icon: UserCog },
      // ⭐ V3.89 — Annonces du ministère : les super admins rédigent et
      // gèrent les MÊMES annonces que le secrétariat (composant et table
      // partagés — /admin/annonces règle aussi le 404 du sous-domaine).
      { label: "Annonces", href: "/admin/annonces", icon: Megaphone },
    ],
  },
  {
    title: "Activité",
    items: [
      // ⭐ V3.74 — « Demandes de contact » SUPPRIMÉ (obsolète : le
      // Secrétariat couvre les demandes de rencontre, la Trésorerie les
      // finances). Remplacé par le module de RÉCEPTION des demandes
      // transmises par la secrétaire (validation → notification).
      { label: "Demandes reçues", href: "/admin/demandes", icon: Inbox },
      { label: "Dons", href: "/admin/donations", icon: Heart },
      // ⭐ V3.83 — Configuration des passerelles de paiement (FedaPay /
      // Paystack : clés API chiffrées, webhooks, activation, test) —
      // réservée aux super admins (Pasteur Kongo & Sœur Afrika).
      { label: "Passerelles de paiement", href: "/admin/paiements", icon: CreditCard },
      // ⭐ V3.2 — Intercession : les demandes arrivent DIRECTEMENT ici
      // (plus de redirection vers la page publique — confidentialité).
      { label: "Intercession", href: "/admin/intercession", icon: Heart },
      { label: "Dead Man's Switch", href: "/admin/dead-mans-switch", icon: ShieldAlert },
    ],
  },
  {
    // ⭐ V3.66 — Accréditation des sous-domaines secrétariat & trésorerie
    title: "Espaces du ministère",
    items: [
      { label: "Secrétariat & Trésorerie", href: "/admin/staff", icon: Building2 },
      // ⭐ V3.74 — Consultation de la trésorerie SANS entrer dans l'espace
      // dédié (directive : le pasteur Congo et la sœur Afrika veulent un
      // simple coup d'œil depuis leur back-office — lecture seule).
      { label: "Trésorerie (consultation)", href: "/admin/tresorerie", icon: Wallet },
    ],
  },
  {
    title: "Système",
    items: [
      { label: "YouTube Setup", href: "/admin/youtube-setup", icon: Youtube },
      { label: "Stockage R2", href: "/admin/r2-test", icon: Cloud },
    ],
  },
];

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ⭐ V3.44 — Sur le sous-domaine admin (admin.mouvementchristlibere.com),
  // « Voir le site » doit ouvrir le site PUBLIC et non le back-office réécrit
  // à la racine de ce même hôte. Calcul côté client uniquement (pas de
  // décalage d'hydratation : l'état initial "/" reste identique serveur/client).
  const [sitePublicUrl, setSitePublicUrl] = useState("/");
  useEffect(() => {
    try {
      if (/^admin\./i.test(window.location.hostname)) {
        const url = new URL(window.location.origin);
        url.hostname = window.location.hostname.replace(/^admin\./i, "");
        setSitePublicUrl(url.origin);
      }
    } catch {
      // window indisponible ou origin invalide — comportement par défaut ("/")
    }
  }, []);

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
    // ⭐ V3.98 — Thème Win Agro du back-office : fond violet nuit profond
    // (équivalent CL du noir-vert Win Agro #07130A) + grain clair discret
    // + halo doré d'ambiance — la palette Christ Libère est conservée.
    <div className="bo-winagro relative min-h-screen bg-[#150920] flex">
      {/* Halo d'ambiance doré (fixe, derrière le contenu) */}
      <div className="pointer-events-none fixed top-0 right-0 w-[32rem] h-[32rem] rounded-full bg-[#C9A227]/[0.05] blur-3xl" aria-hidden />
      <div className="pointer-events-none fixed bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-[#8C5FA8]/[0.06] blur-3xl" aria-hidden />
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#3D1A54] text-[#FAF6EF] flex-shrink-0 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header avec logo Christ Libère — ⭐ V3.97 halo conique Win Agro */}
          <div className="px-5 py-5 border-b border-[#C9A227]/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-full overflow-hidden border border-[#C9A227]/30 bg-[#1A0826] logo-light-beam shadow-md flex items-center justify-center p-0.5">
                  <Image
                    src="/logo-christ-libere-v3.png"
                    alt="Christ Libère"
                    width={40}
                    height={40}
                    className="object-contain w-full h-full"
                    priority
                  />
                </div>
                <div>
                  <div className="text-lg font-bold leading-tight font-serif">
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
                className="lg:hidden -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[#FAF6EF]/70 hover:text-[#FAF6EF] hover:bg-[#C9A227]/10 transition-colors"
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
                            "flex items-center gap-3 px-5 py-3 text-sm transition-colors",
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
            {/* ⭐ V3.80 — PWA : installation du back-office comme application
                (« Back-office Christ Libère », même logo que le site public —
                manifest dédié lié par src/app/admin/layout.tsx). toujoursVisible :
                le clic ouvre les instructions par navigateur quand le dialogue
                natif n'est pas disponible (Firefox, iOS…). */}
            <InstallAppButton contexte="admin" variante="sidebar" toujoursVisible />
            <Link
              href={sitePublicUrl}
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
        <header className="lg:hidden sticky top-0 z-20 bg-[#3D1A54] text-[#FAF6EF] px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 w-11 h-11 flex items-center justify-center rounded-lg text-[#FAF6EF] hover:bg-[#C9A227]/10 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/logo-christ-libere-v3.png"
              alt="Christ Libère"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <span className="text-sm font-bold font-serif">
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span style={{ color: "#FAF6EF" }}>&nbsp;Libère</span>
            </span>
          </div>
          <div className="w-5" />
        </header>

        {/* Contenu — plus d'overflow-x-auto global (échappatoire qui masquait
            les débordements) : chaque tableau gère son propre conteneur scrollable */}
        <main className="relative flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
