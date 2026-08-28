"use client";

import { usePathname } from "next/navigation";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";
import { LiveAnnouncementBar } from "@/components/site/live-announcement-bar";

// Routes où navbar, footer et barre live sont masqués (pages d'auth)
const HIDDEN_ROUTES = ["/login", "/register", "/admin/login"];

// Routes où le footer est masqué mais la navbar reste visible
const NO_FOOTER_ROUTES = ["/live/", "/yeshua-connect"];

// Routes où la barre d'annonce live ne doit pas s'afficher
const NO_LIVE_BAR_ROUTES = ["/admin", "/yeshua-connect", "/live/"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHiddenRoute = HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));
  const showFooter = !NO_FOOTER_ROUTES.some((route) => pathname?.startsWith(route));
  const showLiveBar = !NO_LIVE_BAR_ROUTES.some((route) => pathname?.startsWith(route));

  if (isHiddenRoute) {
    return <main className="flex-1">{children}</main>;
  }

  // La navbar est fixed top-0 avec h-16 (64px mobile) / md:h-20 (80px desktop)
  // pt-16 = 64px (mobile), md:pt-20 = 80px (desktop) → contenu sous la navbar
  return (
    <>
      <ContextualNav />
      <div className="pt-16 md:pt-20">
        {showLiveBar && <LiveAnnouncementBar />}
        <main className="flex-1">
          {children}
        </main>
      </div>
      {showFooter && <ConditionalFooter />}
    </>
  );
}
