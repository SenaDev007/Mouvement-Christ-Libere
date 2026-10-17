"use client";

/**
 * ⭐ V4.09 — SHELL DE L'APPLICATION MOBILE « CHRIST LIBÈRE » (/app/*).
 * ⭐ V4.10 — MODE HORS LIGNE : moteur local (IndexedDB) + synchro temps
 *    réel + indicateur de connexion (cf. src/lib/offline/).
 *
 * L'application mobile étend Yeshua Connect (le canal de communication)
 * pour offrir la MÊME STRUCTURE que le site public : une page principale
 * (cf. /app/page.tsx) + les pages de sections, toutes servies dans cette
 * coquille.
 *
 * EN-TÊTE FIXE : hauteur VOLONTAIREMENT calibrée 4rem (mobile) / 5rem (md)
 * — exactement la hauteur que soustrait MessagingView (Yeshua Connect) :
 *   h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)]
 * → NE PAS modifier ces hauteurs sans mettre à jour MessagingView.tsx.
 * L'indicateur hors ligne respecte ce gabarit (pastille size-11, aucune
 * barre supplémentaire).
 *
 * MENU HAMBURGER : tiroir latéral qui S'OUVRE, SE DÉPLIE et SE REPLIE
 * (demande explicite du pasteur) — backdrop cliquable, fermeture par ✕,
 * Échap ou navigation ; défilement du corps verrouillé pendant l'ouverture.
 *
 * CONNEXION BACK-OFFICE : les pages rendues ici sont les MÊMES composants
 * que le site public (force-dynamic) + la barre d'annonces des lives
 * (LiveAnnouncementBar, rafraîchie toutes les 60 s) + ⭐ V4.10 le moteur
 * hors ligne qui détecte les changements de contenu (hash /api/app/content)
 * et appelle router.refresh() → tout ce qui est publié depuis le
 * back-office se met à jour automatiquement, images comprises.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { IsololeText } from "@/lib/isolole";
import { LiveAnnouncementBar } from "@/components/site/live-announcement-bar";
import { initOfflineEngine, syncContent } from "@/lib/offline/engine";
import { wipePersonalLocalData } from "@/lib/offline/db";
import { useOfflineStatus, OfflineChip, DrawerSyncStatus } from "@/components/app/offline-status";
import {
  Menu,
  X,
  Home,
  FileText,
  BookOpen,
  PlayCircle,
  Music,
  Heart,
  Globe2,
  MessageSquare,
  HandCoins,
  Megaphone,
  CalendarCheck,
  LogOut,
  LogIn,
  UserPlus,
  User,
  ExternalLink,
} from "lucide-react";

/* ============================================================
   NAVIGATION DE L'APPLICATION — mêmes pages que le site public
   ============================================================ */

interface DrawerItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Libellé contenant « Israël » → rendu via <IsololeText>. */
  isolole?: boolean;
  /** Élément mis en avant (or). */
  highlight?: boolean;
}

const MENU_GROUPS: { label: string; items: DrawerItem[] }[] = [
  {
    label: "Serviteurs",
    items: [
      { href: "/app/afrika", label: "Afrika", icon: User },
      { href: "/app/pasteur-kongo", label: "Pasteur Kongo", icon: User },
    ],
  },
  {
    label: "Parole de vie",
    items: [
      { href: "/app/temoignages", label: "Témoignages", icon: FileText },
      { href: "/app/enseignements", label: "Enseignements", icon: BookOpen },
    ],
  },
  {
    label: "Médias",
    items: [
      { href: "/app/videos", label: "Vidéos & Lives", icon: PlayCircle },
      { href: "/app/adoration-louanges", label: "Adoration & Louanges", icon: Music },
    ],
  },
  {
    label: "Communauté",
    items: [
      // ⭐ Le canal de communication — la raison d'être initiale de l'app.
      { href: "/app/yeshua-connect", label: "Yeshua Connect — Chat", icon: MessageSquare, highlight: true },
      { href: "/app/intercession", label: "Intercession", icon: Heart },
      { href: "/app/disperses", label: "Dispersés d'Israël", icon: Globe2, isolole: true },
    ],
  },
  {
    label: "Ministère",
    items: [
      { href: "/app/contribuer", label: "Contribuer (Don & Dîme)", icon: HandCoins },
      { href: "/app/annonces", label: "Annonces du ministère", icon: Megaphone },
      { href: "/app/rendez-vous", label: "Demander un rendez-vous", icon: CalendarCheck },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  // ⭐ V4.10 — ÉTAT DE CONNEXION (moteur hors ligne : base locale + file
  // d'envoi + synchro de contenu). L'indicateur remplace le bouton
  // Rendez-vous dans l'en-tête quand la connexion est coupée — même
  // gabarit size-11, aucune variation de hauteur (calibre MessagingView).
  const { online } = useOfflineStatus();
  // ⭐ Profil FRAIS (photo + nom) — même mécanique que la navbar du site
  // (la session NextAuth fige l'image à la connexion ; on recharge ici).
  const [freshProfile, setFreshProfile] = useState<{
    name?: string | null;
    avatarUrl?: string | null;
  } | null>(null);

  // Le chat calcule sa hauteur sur la hauteur EXACTE du header : aucune
  // barre supplémentaire au-dessus (comme sur le site — NO_LIVE_BAR_ROUTES).
  const isChatRoute = pathname === "/app/yeshua-connect";

  /* ⭐ V4.10 — MOTEUR HORS LIGNE : démarré une seule fois par onglet
     (garde-fou interne). Écoute online/offline, vide la file d'envoi
     des messages à la reconnexion (comportement WhatsApp), et surveille
     le contenu back-office (poll du hash toutes les 60 s en ligne). */
  useEffect(() => {
    initOfflineEngine();
  }, []);

  /* ⭐ V4.10 — SYNCHRO TEMPS RÉEL : quand le hash de contenu change
     (image remplacée, vidéo publiée, annonce…), on re-rend la page
     courante avec les données fraîches — SANS recharger l'app. */
  useEffect(() => {
    const onContentUpdated = () => {
      router.refresh();
    };
    window.addEventListener("ycl:content-updated", onContentUpdated);
    return () => {
      window.removeEventListener("ycl:content-updated", onContentUpdated);
    };
  }, [router]);

  /* ⭐ V4.10 — Au retour au premier plan de l'app (visibilité) : resynchro
     immédiate du contenu (détection rapide des publications). */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncContent();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* Fermeture du tiroir à chaque navigation */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Échap → replier le menu */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* Verrou du défilement du corps pendant que le menu est déplié */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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

  const isAuthenticated = status === "authenticated" && session?.user;
  const displayName =
    freshProfile?.name || session?.user?.name || "Mon compte";
  const displayAvatar =
    freshProfile?.avatarUrl || session?.user?.image || null;

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const handleLogout = () => {
    // ⭐ V4.10 — Hygiène hors ligne : effacer la base locale PERSONNELLE
    // (file d'envoi + caches de conversations) pour qu'aucun message en
    // attente d'un compte ne parte sous un autre compte.
    void wipePersonalLocalData();
    signOut({ callbackUrl: "/app" });
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAF6EF]">
      {/* ═══════════════ EN-TÊTE FIXE DE L'APPLICATION ═══════════════
          4rem (mobile) / 5rem (md) — calibre partagé avec MessagingView. */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 md:h-20 bg-[#2A0E3D]/95 backdrop-blur border-b border-[#C9A227]/20 shadow-lg">
        <div className="h-full max-w-7xl mx-auto px-2 sm:px-4 flex items-center justify-between gap-1">
          {/* Bouton hamburger — le menu se déplie / se replie */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            className="flex items-center justify-center size-11 rounded-xl text-[#FAF6EF] hover:text-[#C9A227] hover:bg-white/5 active:scale-95 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo + marque */}
          <Link
            href="/app"
            className="flex items-center gap-2 group min-w-0"
            aria-label="Accueil de l'application"
          >
            <Image
              src="/logo-christ-libere-v3.png"
              alt="Christ Libère"
              width={32}
              height={32}
              className="w-8 h-8 object-contain shrink-0"
              priority
            />
            <span className="font-serif text-lg font-semibold whitespace-nowrap">
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span className="ml-0.5 text-[#FAF6EF]">Libère</span>
            </span>
          </Link>

          {/* Accès rapide Rendez-vous (porte d'entrée du secrétariat) —
              ⭐ V4.10 : remplacé par la pastille hors ligne quand la
              connexion est coupée (même gabarit size-11 : aucune
              variation de hauteur ; Rendez-vous reste dans le menu). */}
          {online ? (
            <Link
              href="/app/rendez-vous"
              aria-label="Demander un rendez-vous"
              className="flex items-center justify-center size-11 rounded-xl bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] active:scale-95 transition-all"
            >
              <CalendarCheck className="w-5 h-5" />
            </Link>
          ) : (
            <OfflineChip />
          )}
        </div>
      </header>

      {/* ═══════════════ CONTENU (padding = hauteur de l'en-tête) ═══════════════ */}
      <div className="pt-16 md:pt-20 flex-1 flex flex-col min-w-0">
        {/* Annonces des lives programmés (back-office → maj auto) ;
            masquées sur le chat (hauteur critique, comme sur le site). */}
        {!isChatRoute && <LiveAnnouncementBar />}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* ═══════════════ LE MENU HAMBURGER — tiroir ═══════════════ */}

      {/* Backdrop — clic pour replier */}
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Panneau — se déplie depuis la gauche, se replie vers la gauche */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-[110] w-80 max-w-[85vw]",
          "bg-gradient-to-b from-[#2A0E3D] to-[#1A0826] border-r border-[#C9A227]/25 shadow-2xl",
          "transition-transform duration-300 ease-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
      >
        {/* En-tête du tiroir */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#C9A227]/15 shrink-0">
          <Link href="/app" className="flex items-center gap-2 min-w-0">
            <Image
              src="/logo-christ-libere-v3.png"
              alt="Christ Libère"
              width={30}
              height={30}
              className="w-[30px] h-[30px] object-contain shrink-0"
            />
            <span className="font-serif text-base font-semibold whitespace-nowrap">
              <span style={{ color: "#C9A227" }}>Christ</span>
              <span className="ml-0.5 text-[#FAF6EF]">Libère</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="flex items-center justify-center size-10 rounded-xl text-[#FAF6EF]/80 hover:text-[#C9A227] hover:bg-white/5 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation — toutes les pages de l'application */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 flex flex-col gap-5">
          <DrawerLink
            item={{ href: "/app", label: "Accueil", icon: Home }}
            active={isActive("/app")}
          />
          {MENU_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#C9A227]/60 px-3 mb-1.5">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <DrawerLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bloc compte + lien vers le site complet */}
        <div className="border-t border-[#C9A227]/15 p-3 space-y-2 shrink-0">
          {/* ⭐ V4.10 — État de connexion + file d'envoi locale */}
          <DrawerSyncStatus />
          {isAuthenticated ? (
            <>
              <Link
                href="/profil"
                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors min-w-0"
              >
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-[#C9A227]/50 shrink-0"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-[#C9A227] flex items-center justify-center text-[#1E0F2B] font-bold text-sm shrink-0">
                    {(displayName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#FAF6EF] truncate">
                    {displayName}
                  </span>
                  <span className="block text-[11px] text-[#C9A227]/70">
                    Mon profil &amp; paramètres
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login?callbackUrl=/app"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border border-[#C9A227]/40 text-[#FAF6EF] hover:bg-white/5 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Connexion
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-[#C9A227] text-[#1E0F2B] hover:bg-[#DDBE55] transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Créer un compte
              </Link>
            </div>
          )}
          {/* Le reste du site (Bible, calendrier biblique, communauté…) */}
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#FAF6EF]/50 hover:text-[#C9A227] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Voir le site complet
          </Link>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   LIEN DU TIROIR — actif doré, zone tactile confortable (≥ 44 px)
   ============================================================ */
function DrawerLink({
  item,
  active,
}: {
  item: DrawerItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        active
          ? "bg-[#C9A227]/15 text-[#DDBE55]"
          : item.highlight
            ? "text-[#DDBE55]/90 hover:bg-[#C9A227]/10 hover:text-[#DDBE55]"
            : "text-[#FAF6EF]/85 hover:bg-white/5 hover:text-[#C9A227]"
      )}
    >
      <Icon
        className={cn(
          "w-[18px] h-[18px] shrink-0",
          item.highlight ? "text-[#C9A227]" : active ? "text-[#C9A227]" : "text-[#C9A227]/60"
        )}
      />
      <span className="min-w-0">
        {item.isolole ? <IsololeText>{item.label}</IsololeText> : item.label}
      </span>
    </Link>
  );
}
