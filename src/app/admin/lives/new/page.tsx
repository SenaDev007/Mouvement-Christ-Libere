import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewLivePage() {
  const servants = await db.servant.findMany({ where: { isActive: true } });
  const communities = await db.community.findMany();

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
    {
      name: "scheduledAt",
      label: "Date et heure prévues",
      type: "datetime-local",
      required: true,
    },
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
    { name: "rtmpUrl", label: "URL RTMP entrant", type: "text" },
    { name: "hlsUrl", label: "URL HLS sortant", type: "text" },
    { name: "youtubeUrl", label: "URL YouTube", type: "text" },
    { name: "facebookUrl", label: "URL Facebook", type: "text" },
    { name: "tiktokUrl", label: "URL TikTok", type: "text" },
    { name: "odyseeUrl", label: "URL Odysee", type: "text" },
  ];

  return (
    <AdminForm
      entity="lives"
      fields={FIELDS}
      redirectTo="/admin/lives"
      title="Programmer un live"
      subtitle="Planifier une session de streaming."
    />
  );
}
