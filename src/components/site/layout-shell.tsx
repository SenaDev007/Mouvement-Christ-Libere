"use client";

import { usePathname } from "next/navigation";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";
import { LiveAnnouncementBar } from "@/components/site/live-announcement-bar";

// Routes où la navbar, footer et barre live doivent être masqués
// (pages plein écran : auth, studio live, visionneuse live)
const HIDDEN_ROUTES = ["/login", "/register", "/admin/login", "/live/"];

// Routes où la barre d'annonce live ne doit pas s'afficher
const NO_LIVE_BAR_ROUTES = ["/admin", "/yeshua-connect", "/live/"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHiddenRoute = HIDDEN_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  const showLiveBar = !NO_LIVE_BAR_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  if (isHiddenRoute) {
    // Page plein écran : ni navbar, ni footer, ni padding-top, ni barre live
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <ContextualNav />
      <main className="flex-1 pt-16">
        {showLiveBar && <LiveAnnouncementBar />}
        {children}
      </main>
      <ConditionalFooter />
    </>
  );
}
