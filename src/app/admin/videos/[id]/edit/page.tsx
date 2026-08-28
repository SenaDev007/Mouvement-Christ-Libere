import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PostProduction } from "@/components/live/post-production";

export const dynamic = "force-dynamic";

export default async function VideoEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const video = await db.video.findUnique({
    where: { id },
    include: { servant: true },
  });

  if (!video) {
    notFound();
  }

  return (
    <PostProduction
      videoId={video.id}
      videoUrl={video.videoUrl}
      title={video.title}
      servantName={video.servant.shortName}
    />
  );
}
