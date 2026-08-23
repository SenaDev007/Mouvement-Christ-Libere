import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewTestimonyPage() {
  const servants = await db.servant.findMany({ where: { isActive: true } });

  const FIELDS: FieldDef[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      name: "title",
      label: "Titre",
      type: "text",
      required: true,
      fullWidth: true,
    },
    {
      name: "short",
      label: "Résumé court",
      type: "textarea",
      placeholder: "Résumé en 2-3 lignes",
      fullWidth: true,
    },
    {
      name: "content",
      label: "Contenu complet",
      type: "textarea",
      placeholder: "Récit détaillé...",
      fullWidth: true,
    },
    {
      name: "themes",
      label: "Thèmes (séparés par virgules)",
      type: "tags",
      placeholder: "Vision, Ciel, Lumière",
    },
    {
      name: "bookRef",
      label: "Référence biblique",
      type: "text",
      placeholder: "Ézéchiel 1:1",
    },
    {
      name: "readingTime",
      label: "Temps de lecture",
      type: "text",
      placeholder: "8 min",
    },
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
      fields={FIELDS}
      redirectTo="/admin/testimonies"
      title="Nouveau témoignage"
      subtitle="Ajouter un récit d'expérience spirituelle."
    />
  );
}
