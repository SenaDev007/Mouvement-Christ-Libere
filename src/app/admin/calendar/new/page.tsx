import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nom (translittération)", type: "text", placeholder: "Pessah", required: true },
  { name: "nameFr", label: "Nom en français", type: "text", placeholder: "Pâque", required: true },
  { name: "nameHe", label: "Nom en hébreu (optionnel)", type: "text", placeholder: "פֶּסַח" },
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
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Description de la fête, sa signification biblique et prophétique...",
    fullWidth: true,
    required: true,
  },
  {
    name: "startDate",
    label: "Date de début",
    type: "datetime-local",
    required: true,
  },
  { name: "endDate", label: "Date de fin (optionnel)", type: "datetime-local" },
  { name: "color", label: "Couleur (hex)", type: "text", placeholder: "#C9A227" },
  { name: "isShabbat", label: "Marquer comme shabbat", type: "checkbox" },
];

export default async function NewCalendarEventPage() {
  return (
    <AdminForm
      entity="calendar"
      fields={FIELDS}
      redirectTo="/admin/calendar"
      title="Nouvel événement liturgique"
      subtitle="Ajouter une fête biblique ou un événement au calendrier."
    />
  );
}
