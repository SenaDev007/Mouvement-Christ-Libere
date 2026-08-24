import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";

export const dynamic = "force-dynamic";

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
    placeholder: "PAM",
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
    name: "isActive",
    label: "Serviteur actif",
    type: "checkbox",
    help: "Afficher ce serviteur sur le site public",
  },
];

export default async function NewServantPage() {
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
