import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", type: "text", required: true },
  { name: "fullName", label: "Nom complet", type: "text", required: true },
  { name: "shortName", label: "Nom court", type: "text", required: true },
  { name: "role", label: "Rôle", type: "text", required: true },
  { name: "bio", label: "Biographie courte", type: "textarea", fullWidth: true },
  // ⭐ V2.7 — Photo du serviteur : upload compressé (≤ 60 KB) au lieu d'une
  // URL texte. La photo est SYNCHRONISÉE vers le compte User correspondant
  // (avatarUrl) pour l'affichage dans les canaux vocaux Yeshua Connect.
  {
    name: "portraitUrl",
    label: "Photo du serviteur",
    type: "photo",
    fullWidth: true,
    help: "Affichée sur le site public ET dans Yeshua Connect (canaux vocaux, chat)",
  },
  { name: "isActive", label: "Serviteur actif", type: "checkbox", help: "Afficher ce serviteur sur le site public" },
];

export default async function EditServantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const servant = await db.servant.findUnique({ where: { id } });
  if (!servant) notFound();

  return (
    <AdminForm
      entity="servants"
      initialData={servant as unknown as Record<string, unknown>}
      fields={FIELDS}
      redirectTo="/admin/servants"
      title="Modifier le serviteur"
      subtitle={servant.fullName}
    />
  );
}
