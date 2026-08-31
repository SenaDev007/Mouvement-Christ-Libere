import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { LiveStudioClient } from "@/components/admin/live-studio-client";

export const dynamic = "force-dynamic";

export default async function LiveStudioPage({
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

  // Générer le roomName si pas déjà fait
  const roomName = live.livekitRoomName || `live-${live.id}`;

  // Mettre à jour le roomName en DB si pas déjà fait
  if (!live.livekitRoomName) {
    await db.liveStream.update({
      where: { id: live.id },
      data: { livekitRoomName: roomName },
    });
  }

  return (
    <LiveStudioClient
      liveId={live.id}
      roomName={roomName}
      title={live.title}
      servantName={live.servant.shortName}
      servantPortraitUrl={live.servant.portraitUrl}
      thumbnailUrl={live.thumbnailUrl}
      status={live.status}
      // ⭐ V2.6.2 — Restaurer l'état de pause et la durée réelle quand on
      // revient dans le studio d'un live DÉJÀ en cours : avant, le studio
      // repartait en « lecture » tout seul avec une durée remise à zéro.
      initialIsPaused={live.isPaused}
      initialStartedAt={live.startedAt ? live.startedAt.toISOString() : null}
      initialPausedAt={live.pausedAt ? live.pausedAt.toISOString() : null}
      multistream={{
        enabled: live.multistreamEnabled,
        youtube: live.streamToYoutube,
        facebook: live.streamToFacebook,
        tiktok: live.streamToTiktok,
        instagram: live.streamToInstagram,
      }}
    />
  );
}
