/** GET /api/home — Données pour la page d'accueil (avec fallback) */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 30; // Cache 30s (évite cold start DB à chaque visite)

export async function GET() {
  const mockData = {
    servants: [
      { code: "pam", fullName: "Afrika Alkebulane Pamela Dali", shortName: "Pam", role: "Servante de l'Éternel", bio: "Témoignages d'enlèvements au ciel, instructions reçues du Seigneur Yeshoua, conformité à la Parole. Figure contemporaine du patriarche Hénoch." },
      { code: "kongo", fullName: "Pasteur Kongo", shortName: "Pasteur Kongo", role: "Époux, ministre pastoral", bio: "Ministère pastoral complémentaire, enseignements et partages spirituels." },
    ],
    testimonies: [],
    teachings: [],
    videos: [],
    liveStreams: null,
  };

  try {
    const { db } = await import("@/lib/db");

    const [servants, testimonies, teachings, videos, liveStreams] = await Promise.all([
      db.servant.findMany({ where: { isActive: true } }),
      db.testimony.findMany({ where: { status: "CONFIRMED" }, take: 3, orderBy: { publishedAt: "desc" }, include: { servant: true } }),
      db.teaching.findMany({ take: 1, orderBy: { publishedAt: "desc" }, include: { servant: true } }),
      db.video.findMany({ take: 4, orderBy: { publishedAt: "desc" }, include: { servant: true } }),
      db.liveStream.findFirst({ where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, include: { servant: true } }),
    ]);

    return NextResponse.json({
      servants: servants.length > 0 ? servants : mockData.servants,
      testimonies,
      teachings,
      videos,
      liveStreams,
    });
  } catch (error) {
    console.error("[api/home] Erreur, retour mock:", error);
    return NextResponse.json(mockData);
  }
}
