import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const video = await db.video.findUnique({ where: { id } });
  if (!video) notFound();

  const servants = await db.servant.findMany();

  const FIELDS: FieldDef[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    { name: "title", label: "Titre", type: "text", required: true, fullWidth: true },
    { name: "description", label: "Description", type: "textarea", fullWidth: true },
    { name: "duration", label: "Durée", type: "text" },
    { name: "videoUrl", label: "URL vidéo", type: "text" },
    { name: "hlsUrl", label: "URL HLS", type: "text" },
    { name: "thumbnailUrl", label: "URL miniature", type: "text" },
    { name: "views", label: "Vues", type: "number" },
    { name: "isLive", label: "En direct", type: "checkbox" },
  ];

  return (
    <AdminForm
      entity="videos"
      initialData={video as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/videos"
      title="Modifier la vidéo"
      subtitle={video.title}
    />
  );
}
