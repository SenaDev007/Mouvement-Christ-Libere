/**
 * Page admin — /admin/bibliotheque
 * Gestion de la bibliothèque documentaire (livres gratuits).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { BibliothequeAdminClient } from "./bibliotheque-admin-client";

export const dynamic = "force-dynamic";

export default async function BibliothequeAdminPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    redirect("/login");
  }

  const [books, servants] = await Promise.all([
    db.book.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { servant: { select: { code: true, shortName: true } } },
    }),
    db.servant.findMany({
      where: { isActive: true },
      orderBy: { shortName: "asc" },
      select: { id: true, code: true, shortName: true, fullName: true },
    }),
  ]);

  return (
    <BibliothequeAdminClient
      books={books.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        servantCode: b.servant?.code || null,
        servantShortName: b.servant?.shortName || null,
      }))}
      servants={servants.map((s) => ({
        id: s.id,
        code: s.code,
        shortName: s.shortName,
        fullName: s.fullName,
      }))}
    />
  );
}
