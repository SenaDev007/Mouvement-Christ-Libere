import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { redirect } from "next/navigation";
import { YoutubeSetupClient } from "./youtube-setup-client";
import { isYouTubeOAuthConfigured } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function YoutubeSetupPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    redirect("/login");
  }

  // Vérifier si l'OAuth est déjà configuré (côté serveur)
  const oauthConfigured = isYouTubeOAuthConfigured();

  // Récupérer les lives récents pour le test
  const recentLives = await db.liveStream.findMany({
    where: { streamToYoutube: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      youtubeUrl: true,
      startedAt: true,
      endedAt: true,
    },
  });

  return (
    <YoutubeSetupClient
      oauthConfigured={oauthConfigured}
      recentLives={recentLives.map((l) => ({
        ...l,
        startedAt: l.startedAt?.toISOString() || null,
        endedAt: l.endedAt?.toISOString() || null,
      }))}
    />
  );
}
