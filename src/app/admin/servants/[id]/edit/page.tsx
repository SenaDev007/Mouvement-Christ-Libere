import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * ⭐ V2.8 — La page d'édition plein écran des serviteurs est remplacée par
 * un MODAL professionnel ouvert depuis /admin/servants (cf. ServantEditButton
 * + EditServantModal). Cette route redirige donc vers la liste pour ne pas
 * casser les anciens liens / favoris.
 */
export default async function EditServantRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params; // id non utilisé : le modal se charge de tout
  redirect("/admin/servants");
}
