/**
 * Home page data route.
 *   GET /api/home — returns servants, testimonies, teachings, videos, liveStreams
 */

import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

const MOCK_DATA = {
  servants: [
    {
      code: "pam",
      fullName: "Afrika Alkebulane Pamela Dali",
      shortName: "Pam",
      role: "Servante de l'Éternel",
      bio: "Témoignages d'enlèvements au ciel, instructions reçues du Seigneur Yeshoua, conformité à la Parole. Figure contemporaine du patriarche Hénoch.",
    },
    {
      code: "kongo",
      fullName: "Pasteur Kongo",
      shortName: "Pasteur Kongo",
      role: "Époux, ministre pastoral",
      bio: "Ministère pastoral complémentaire, enseignements et partages spirituels.",
    },
  ],
  testimonies: [],
  teachings: [],
  videos: [],
  liveStreams: null,
};

router.get("/", async (_req, res) => {
  try {
    const [servants, testimonies, teachings, videos, liveStreams] =
      await Promise.all([
        db.servant.findMany({ where: { isActive: true } }),
        db.testimony.findMany({
          where: { status: "CONFIRMED" },
          take: 3,
          orderBy: { publishedAt: "desc" },
          include: { servant: true },
        }),
        db.teaching.findMany({
          take: 1,
          orderBy: { publishedAt: "desc" },
          include: { servant: true },
        }),
        db.video.findMany({
          take: 4,
          orderBy: { publishedAt: "desc" },
          include: { servant: true },
        }),
        db.liveStream.findFirst({
          where: {
            status: "SCHEDULED",
            scheduledAt: { gte: new Date() },
          },
          orderBy: { scheduledAt: "asc" },
          include: { servant: true },
        }),
      ]);

    return res.json({
      servants: servants.length > 0 ? servants : MOCK_DATA.servants,
      testimonies,
      teachings,
      videos,
      liveStreams,
    });
  } catch (error) {
    console.error("[api/home] Erreur, retour mock:", error);
    return res.json(MOCK_DATA);
  }
});

export default router;
