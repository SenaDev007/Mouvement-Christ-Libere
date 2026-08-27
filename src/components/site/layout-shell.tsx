"use client";

import { usePathname } from "next/navigation";
import { ContextualNav } from "@/components/ui/navigation-menu-4";
import { ConditionalFooter } from "@/components/site/conditional-footer";

// Routes où la navbar et le footer doivent être masqués
// (pages d'authentification : login membre, login admin, inscription)
const HIDDEN_ROUTES = ["/login", "/register", "/admin/login"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHiddenRoute = HIDDEN_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  if (isHiddenRoute) {
    // Page d'authentification : ni navbar, ni footer, ni padding-top
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <ContextualNav />
      <main className="flex-1 pt-16">{children}</main>
      <ConditionalFooter />
    </>
  );
}
