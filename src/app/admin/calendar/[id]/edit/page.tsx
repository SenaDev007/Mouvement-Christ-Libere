import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nom (translittération)", type: "text", required: true },
  { name: "nameFr", label: "Nom en français", type: "text", required: true },
  { name: "nameHe", label: "Nom en hébreu", type: "text" },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "SPRING_FEAST", label: "Fête de printemps" },
      { value: "FALL_FEAST", label: "Fête d'automne" },
      { value: "SHABBAT", label: "Shabbat" },
      { value: "NEW_MOON", label: "Nouvelle lune" },
      { value: "OTHER", label: "Autre" },
    ],
    required: true,
  },
  { name: "description", label: "Description", type: "textarea", fullWidth: true, required: true },
  { name: "startDate", label: "Date de début", type: "datetime-local", required: true },
  { name: "endDate", label: "Date de fin", type: "datetime-local" },
  { name: "color", label: "Couleur (hex)", type: "text" },
  { name: "isShabbat", label: "Marquer comme shabbat", type: "checkbox" },
];

export default async function EditCalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await db.liturgicalEvent.findUnique({ where: { id } });
  if (!event) notFound();

  return (
    <AdminForm
      entity="calendar"
      initialData={event as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/calendar"
      title="Modifier l'événement"
      subtitle={event.nameFr}
    />
  );
}
