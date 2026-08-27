import { db } from "@/lib/db";
import { VideosTabsClient } from "@/components/admin/videos-tabs-client";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [videos, servants] = await Promise.all([
    db.video.findMany({
      orderBy: { createdAt: "desc" },
      include: { servant: true },
    }),
    db.servant.findMany({
      orderBy: { code: "asc" },
    }),
  ]);

  return <VideosTabsClient videos={videos} servants={servants} />;
}
