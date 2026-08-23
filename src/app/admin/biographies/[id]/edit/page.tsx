import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditBiographyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const biography = await db.biography.findUnique({ where: { id } });
  if (!biography) notFound();

  const servants = await db.servant.findMany();

  const FIELDS: FieldDef[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    { name: "date", label: "Date / Période", type: "text", required: true },
    { name: "title", label: "Titre court", type: "text", required: true },
    { name: "description", label: "Récit", type: "textarea", fullWidth: true, required: true },
    { name: "verseRef", label: "Référence biblique", type: "text" },
    { name: "verseText", label: "Texte du verset", type: "textarea", fullWidth: true },
    { name: "order", label: "Ordre", type: "number" },
  ];

  return (
    <AdminForm
      entity="biographies"
      initialData={biography as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/biographies"
      title="Modifier le jalon"
      subtitle={biography.title}
    />
  );
}
