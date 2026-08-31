import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PostProduction } from "@/components/post-production/post-production";

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

  // Ne pas passer videoUrl via les props SSR — les data URLs base64 géantes
  // dépassent la limite de sérialisation Next.js (~128KB).
  // Le Client Component fetch l'URL via /api/videos/[id]/source.
  return (
    <PostProduction
      videoId={video.id}
      title={video.title}
      servantName={video.servant?.shortName || "Serviteur"}
    />
  );
}
