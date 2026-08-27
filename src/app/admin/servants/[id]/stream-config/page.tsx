import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { StreamConfigClient } from "@/components/admin/stream-config-client";

export const dynamic = "force-dynamic";

export default async function StreamConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const servant = await db.servant.findUnique({
    where: { id },
    include: { streamConfig: true },
  });

  if (!servant) {
    notFound();
  }

  return (
    <StreamConfigClient
      servantId={servant.id}
      servantName={servant.shortName}
      initialConfig={servant.streamConfig}
    />
  );
}
