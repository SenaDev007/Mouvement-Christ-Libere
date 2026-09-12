"use client";

import { usePathname } from "next/navigation";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";
import { LiveAnnouncementBar } from "@/components/site/live-announcement-bar";
import { UpcomingLiveFloat } from "@/components/live/upcoming-live-float";

// Routes où navbar, footer et barre live sont masqués (pages d'auth)
// ⭐ V3.66 — Espaces secrétariat & trésorerie : MASQUÉS intégralement (ils
// possèdent leur propre coquille de navigation — sidebar violet/or — et leur
// propre page de connexion plein écran, comme le back-office).
const HIDDEN_ROUTES = ["/login", "/register", "/admin/login", "/secretariat", "/tresorerie"];

// Routes où le footer est masqué mais la navbar reste visible
const NO_FOOTER_ROUTES = ["/live/", "/yeshua-connect"];

// Routes où la barre d'annonce live ne doit pas s'afficher
// ⭐ V3.66 — idem espaces staff (ceinture + bretelles : même si HIDDEN_ROUTES
// les couvre déjà, le garde reste explicite).
const NO_LIVE_BAR_ROUTES = ["/admin", "/yeshua-connect", "/live/", "/secretariat", "/tresorerie"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHiddenRoute = HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));
  const showFooter = !NO_FOOTER_ROUTES.some((route) => pathname?.startsWith(route));
  const showLiveBar = !NO_LIVE_BAR_ROUTES.some((route) => pathname?.startsWith(route));

  if (isHiddenRoute) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <ContextualNav />
      <div className="pt-16 md:pt-20">
        {/* Barre d'annonce live (texte défilant) */}
        {showLiveBar && <LiveAnnouncementBar />}
        <main className="flex-1">
          {children}
        </main>
      </div>
      {showFooter && <ConditionalFooter />}
    </>
  );
}
