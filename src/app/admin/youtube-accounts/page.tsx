/**
 * Page admin — /admin/youtube-accounts
 *
 * ⭐ V4.26 — Gestion multi-comptes YouTube : permet de lier une chaîne
 * YouTube DISTINCTE par serviteur (Afrika + Pasteur Kongo + …). Chaque
 * compte est persisté en base (table YoutubeAccount) avec ses credentials
 * OAuth chiffrés AES-256-GCM. La synchronisation automatique (cron 2×/jour
 * + bouton back-office) itère sur tous les comptes actifs.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { YoutubeAccountsClient } from "./youtube-accounts-client";

export const dynamic = "force-dynamic";

export default async function YoutubeAccountsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    redirect("/login");
  }

  // Liste des serviteurs (pour le sélecteur du flux d'autorisation).
  const servants = await db.servant.findMany({
    where: { isActive: true },
    orderBy: { shortName: "asc" },
    select: {
      id: true,
      code: true,
      shortName: true,
      fullName: true,
    },
  });

  // Comptes YouTube existants (non chiffrés côté serveur, on envoie juste
  // les métadonnées au client).
  const comptes = await db.youtubeAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      servant: { select: { code: true, shortName: true, fullName: true } },
    },
  });

  return (
    <YoutubeAccountsClient
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
        channelId: c.channelId,
        channelTitle: c.channelTitle,
        clientId: c.clientId,
        actif: c.actif,
        dernierSyncAt: c.dernierSyncAt?.toISOString() || null,
        derniereErreur: c.derniereErreur,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
