import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { RUBRIQUE_OPTIONS } from "@/lib/video-rubrics";
// ⭐ V3.46 — colonne LiveStream.category : le findUnique ci-dessous la
// sélectionne (client Prisma régénéré) → garde avant lecture.
import { ensureLiveCategoryColumn } from "@/lib/ensure-schema";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureLiveCategoryColumn().catch(() => {});
  const live = await db.liveStream.findUnique({ where: { id } });
  if (!live) notFound();

  const servants = await db.servant.findMany();

  const FIELDS: FieldDef[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      // ⭐ V3.46 — Rubrique du live (le replay l'hérite à l'arrêt du direct).
      name: "category",
      label: "Rubrique",
      type: "select",
      options: RUBRIQUE_OPTIONS,
      fullWidth: true,
      help: "Le replay du live sera automatiquement classé dans cette rubrique",
    },
    { name: "title", label: "Titre", type: "text", required: true, fullWidth: true },
    { name: "description", label: "Description", type: "textarea", fullWidth: true },
    { name: "scheduledAt", label: "Date et heure", type: "datetime-local", required: true },
    {
      name: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "SCHEDULED", label: "Programmé" },
        { value: "LIVE", label: "En direct" },
        { value: "ENDED", label: "Terminé" },
        { value: "CANCELLED", label: "Annulé" },
      ],
    },
    { name: "rtmpUrl", label: "URL RTMP", type: "text" },
    { name: "hlsUrl", label: "URL HLS", type: "text" },
    { name: "youtubeUrl", label: "URL YouTube", type: "text" },
    { name: "facebookUrl", label: "URL Facebook", type: "text" },
    { name: "tiktokUrl", label: "URL TikTok", type: "text" },
    { name: "instagramUrl", label: "URL Instagram", type: "text" },
  ];

  return (
    <AdminForm
      entity="lives"
      initialData={live as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/lives"
      title="Modifier le live"
      subtitle={live.title}
    />
  );
}
