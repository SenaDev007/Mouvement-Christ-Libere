import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewTeachingPage() {
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
    { name: "excerpt", label: "Extrait", type: "textarea", fullWidth: true },
    { name: "content", label: "Contenu", type: "textarea", fullWidth: true },
    { name: "theme", label: "Thème", type: "text", placeholder: "Prière, Prophétie..." },
    { name: "book", label: "Livre biblique", type: "text", placeholder: "Genèse" },
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
    { name: "readingTime", label: "Temps de lecture", type: "text", placeholder: "15 min" },
    { name: "pdfUrl", label: "URL PDF (optionnel)", type: "text" },
  ];

  return (
    <AdminForm
      entity="teachings"
      fields={FIELDS}
      redirectTo="/admin/teachings"
      title="Nouvel enseignement"
      subtitle="Ajouter une étude biblique."
    />
  );
}
