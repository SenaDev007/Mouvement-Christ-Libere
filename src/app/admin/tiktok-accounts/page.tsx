/**
 * Page admin — /admin/tiktok-accounts
 *
 * ⭐ V4.26 — Gestion des comptes TikTok multi-serviteurs.
 * L'admin saisit le username TikTok du serviteur (pas d'OAuth — TikTok
 * n'expose pas d'API read publique). Le scraping du feed se fait via
 * tikwm.com dans src/lib/tiktok-sync.ts (cron 2×/jour + bouton manuel).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { TiktokAccountsClient } from "./tiktok-accounts-client";

export const dynamic = "force-dynamic";

export default async function TiktokAccountsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    redirect("/login");
  }

  const servants = await db.servant.findMany({
    where: { isActive: true },
    orderBy: { shortName: "asc" },
    select: { id: true, code: true, shortName: true, fullName: true },
  });

  const comptes = await db.tiktokAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      servant: { select: { code: true, shortName: true, fullName: true } },
    },
  });

  return (
    <TiktokAccountsClient
      servants={servants.map((s) => ({
        id: s.id,
        code: s.code,
        shortName: s.shortName,
        fullName: s.fullName,
      }))}
      comptes={comptes.map((c) => ({
        id: c.id,
        servantId: c.servantId,
        servantCode: c.servant?.code || null,
        servantShortName: c.servant?.shortName || null,
        servantFullName: c.servant?.fullName || null,
        username: c.username,
        displayName: c.displayName,
        actif: c.actif,
        dernierSyncAt: c.dernierSyncAt?.toISOString() || null,
        derniereErreur: c.derniereErreur,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
