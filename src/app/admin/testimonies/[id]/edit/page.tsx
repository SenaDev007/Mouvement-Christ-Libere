import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditTestimonyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const testimony = await db.testimony.findUnique({ where: { id } });
  if (!testimony) notFound();

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
    { name: "short", label: "Résumé court", type: "textarea", fullWidth: true },
    { name: "content", label: "Contenu complet", type: "textarea", fullWidth: true },
    { name: "themes", label: "Thèmes (virgules)", type: "tags" },
    { name: "bookRef", label: "Référence biblique", type: "text" },
    { name: "readingTime", label: "Temps de lecture", type: "text" },
    {
      name: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "TO_DISCERN", label: "À discerner" },
        { value: "CONFIRMED", label: "Confirmé" },
        { value: "ARCHIVED", label: "Archivé" },
      ],
      required: true,
    },
  ];

  return (
    <AdminForm
      entity="testimonies"
      initialData={testimony as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/testimonies"
      title="Modifier le témoignage"
      subtitle={testimony.title}
    />
  );
}
