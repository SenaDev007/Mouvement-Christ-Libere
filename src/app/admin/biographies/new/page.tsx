import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

export default async function NewBiographyPage() {
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
      name: "date",
      label: "Date / Période",
      type: "text",
      placeholder: "Enfance, 2024-03, etc.",
      required: true,
    },
    {
      name: "title",
      label: "Titre court",
      type: "text",
      placeholder: "Le premier appel",
      required: true,
    },
    {
      name: "description",
      label: "Récit",
      type: "textarea",
      placeholder: "2 à 4 phrases de récit, ton sobre...",
      fullWidth: true,
      required: true,
    },
    {
      name: "verseRef",
      label: "Référence biblique",
      type: "text",
      placeholder: "Genèse 5:24",
    },
    {
      name: "verseText",
      label: "Texte du verset",
      type: "textarea",
      placeholder: "« Et Hénoch marcha avec Dieu... »",
      fullWidth: true,
    },
    {
      name: "order",
      label: "Ordre d'affichage",
      type: "number",
      help: "Plus petit = plus tôt dans la frise",
    },
  ];

  return (
    <AdminForm
      entity="biographies"
      fields={FIELDS}
      redirectTo="/admin/biographies"
      title="Nouveau jalon biographique"
      subtitle="Ajouter une étape à la frise chronologique d'un serviteur."
    />
  );
}
