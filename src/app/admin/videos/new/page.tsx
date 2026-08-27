import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ servant?: string }>;
}) {
  const params = await searchParams;
  const servants = await db.servant.findMany({ where: { isActive: true } });

  // Si ?servant=pam ou ?servant=kongo, pré-remplir le serviteur
  const preselectedServant = params.servant
    ? servants.find((s) => s.code === params.servant)
    : null;

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

  const subtitle = preselectedServant
    ? `Ajouter une vidéo pour ${preselectedServant.shortName}.`
    : "Ajouter une vidéo ou un live enregistré.";

  // Pré-remplir servantId si un serviteur est sélectionné via ?servant=
  const initialData = preselectedServant ? { servantId: preselectedServant.id } : undefined;

  return (
    <AdminForm
      entity="videos"
      fields={FIELDS}
      initialData={initialData}
      redirectTo="/admin/videos"
      title="Nouvelle vidéo"
      subtitle={subtitle}
    />
  );
}

