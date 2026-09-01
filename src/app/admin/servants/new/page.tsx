import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { COUNTRIES } from "@/lib/data/countries";
import { ensureServantLocationColumns } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";

// ⭐ V3.3 — Options pays (191 pays) pour le sélecteur du nouveau serviteur
const PAYS_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: `${c.name}` }));

const FIELDS: FieldDef[] = [
  {
    name: "code",
    label: "Code",
    type: "text",
    placeholder: "pam ou kongo",
    help: "Identifiant unique du serviteur",
    required: true,
  },
  {
    name: "fullName",
    label: "Nom complet",
    type: "text",
    placeholder: "Afrika Alkebulane Pamela Dali",
    required: true,
  },
  {
    name: "shortName",
    label: "Nom court",
    type: "text",
    placeholder: "Pam",
    required: true,
  },
  {
    name: "role",
    label: "Rôle",
    type: "text",
    placeholder: "Servante de l'Éternel",
    required: true,
  },
  {
    name: "bio",
    label: "Biographie courte",
    type: "textarea",
    placeholder: "Description courte du serviteur...",
    fullWidth: true,
  },
  {
    name: "portraitUrl",
    label: "URL portrait (optionnel)",
    type: "text",
    placeholder: "https://...",
  },
  {
    name: "pays",
    label: "Pays",
    type: "select",
    options: PAYS_OPTIONS,
    placeholder: "— Choisir un pays —",
    help: "Le serviteur apparaîtra sur la carte des dispersés avec le niveau « Pasteur »",
  },
  {
    name: "ville",
    label: "Ville",
    type: "text",
    placeholder: "Abidjan",
    help: "Affichée à côté du pays sur la page des dispersés et sur la carte",
  },
  {
    name: "isActive",
    label: "Serviteur actif",
    type: "checkbox",
    help: "Afficher ce serviteur sur le site public",
  },
];

export default async function NewServantPage() {
  // ⭐ V3.3 — Auto-réparation des colonnes Servant.pays / Servant.ville
  await ensureServantLocationColumns();

  return (
    <AdminForm
      entity="servants"
      fields={FIELDS}
      redirectTo="/admin/servants"
      title="Nouveau serviteur"
      subtitle="Ajouter un nouveau serviteur à la plateforme."
    />
  );
}
