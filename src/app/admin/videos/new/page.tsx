import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const servants = await db.servant.findMany({ where: { isActive: true } });

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
    { name: "duration", label: "Durée", type: "text", placeholder: "1:24:30 ou EN DIRECT" },
    { name: "videoUrl", label: "URL vidéo", type: "text", placeholder: "https://..." },
    { name: "hlsUrl", label: "URL HLS (streaming)", type: "text" },
    { name: "thumbnailUrl", label: "URL miniature", type: "text" },
    { name: "views", label: "Vues initiales", type: "number" },
    { name: "isLive", label: "En direct maintenant", type: "checkbox" },
  ];

  return (
    <AdminForm
      entity="videos"
      fields={FIELDS}
      redirectTo="/admin/videos"
      title="Nouvelle vidéo"
      subtitle="Ajouter une vidéo ou un live enregistré."
    />
  );
}
