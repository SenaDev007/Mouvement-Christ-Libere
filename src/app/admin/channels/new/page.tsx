import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewChannelPage() {
  const communities = await db.community.findMany();

  const FIELDS: FieldDef[] = [
    {
      name: "communityId",
      label: "Communauté",
      type: "select",
      options: communities.map((c) => ({ value: c.id, label: c.name })),
      required: true,
    },
    { name: "name", label: "Nom du canal", type: "text", required: true, fullWidth: true },
    { name: "description", label: "Description", type: "textarea", fullWidth: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      options: [
        { value: "TEXT", label: "Texte" },
        { value: "VOICE", label: "Voix" },
        { value: "VIDEO", label: "Vidéo" },
        { value: "ANNOUNCEMENT", label: "Annonce" },
        { value: "RESTRICTED", label: "Restreint" },
      ],
      required: true,
    },
    { name: "isEncrypted", label: "Chiffré E2E", type: "checkbox", help: "Canal chiffré de bout en bout" },
    { name: "isRestricted", label: "Accès restreint", type: "checkbox", help: "Accès sur invitation uniquement" },
    { name: "order", label: "Ordre d'affichage", type: "number" },
  ];

  return (
    <AdminForm
      entity="channels"
      fields={FIELDS}
      redirectTo="/admin/channels"
      title="Nouveau canal"
      subtitle="Créer un canal de communauté."
    />
  );
}
