import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await db.channel.findUnique({ where: { id } });
  if (!channel) notFound();

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
    { name: "isEncrypted", label: "Chiffré E2E", type: "checkbox" },
    { name: "isRestricted", label: "Accès restreint", type: "checkbox" },
    { name: "order", label: "Ordre", type: "number" },
  ];

  return (
    <AdminForm
      entity="channels"
      initialData={channel as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/channels"
      title="Modifier le canal"
      subtitle={channel.name}
    />
  );
}
