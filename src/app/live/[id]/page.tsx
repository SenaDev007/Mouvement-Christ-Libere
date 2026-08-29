import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { LiveViewerClient } from "@/components/live/live-viewer-client";

export const dynamic = "force-dynamic"; // Force dynamic — évite le pré-render au build (pas de DB au build)

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const live = await db.liveStream.findUnique({
    where: { id },
    include: { servant: true },
  });

  if (!live) {
    notFound();
  }

  return (
    <LiveViewerClient
      live={{
        id: live.id,
        title: live.title,
        description: live.description,
        scheduledAt: live.scheduledAt.toISOString(),
        startedAt: live.startedAt?.toISOString() || null,
        endedAt: live.endedAt?.toISOString() || null,
        status: live.status,
        servantName: live.servant.shortName,
        servantCode: live.servant.code,
        servantPortraitUrl: live.servant.portraitUrl,
        youtubeUrl: live.youtubeUrl,
        facebookUrl: live.facebookUrl,
        tiktokUrl: live.tiktokUrl,
        livekitRoomName: live.livekitRoomName,
        viewerCount: live.viewerCount,
        thumbnailUrl: live.thumbnailUrl,
      }}
    />
  );
}
