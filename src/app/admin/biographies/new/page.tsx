import { db } from "@/lib/db";
// ⭐ V3.48 — la route /new elle-même ouvre le MODAL professionnel de création
// (photo du jalon + photo de biographie publique) — cohérent avec le bouton
// « Nouveau jalon » de la liste ET avec la route /[id]/edit (V3.48).
import { BiographyAutoModal } from "@/components/admin/biography-modal";

export const dynamic = "force-dynamic";

export default async function NewBiographyPage() {
  const servants = await db.servant.findMany({
    where: { isActive: true },
    select: { id: true, shortName: true, code: true },
    orderBy: { code: "asc" },
  });

  return <BiographyAutoModal servants={servants} accentColor="#C9A227" />;
}
