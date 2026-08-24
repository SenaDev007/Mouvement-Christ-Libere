import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditTeachingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teaching = await db.teaching.findUnique({ where: { id } });
  if (!teaching) notFound();

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
    { name: "excerpt", label: "Extrait", type: "textarea", fullWidth: true },
    { name: "content", label: "Contenu", type: "textarea", fullWidth: true },
    { name: "theme", label: "Thème", type: "text" },
    { name: "book", label: "Livre biblique", type: "text" },
    {
      name: "level",
      label: "Niveau",
      type: "select",
      options: [
        { value: "DECOUVERTE", label: "Découverte" },
        { value: "INTERMEDIAIRE", label: "Intermédiaire" },
        { value: "AVANCE", label: "Avancé" },
      ],
    },
    { name: "readingTime", label: "Temps de lecture", type: "text" },
    { name: "pdfUrl", label: "URL PDF", type: "text" },
  ];

  return (
    <AdminForm
      entity="teachings"
      initialData={teaching as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/teachings"
      title="Modifier l'enseignement"
      subtitle={teaching.title}
    />
  );
}
