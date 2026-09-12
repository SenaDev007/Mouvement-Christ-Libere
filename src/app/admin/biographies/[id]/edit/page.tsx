import { db } from "@/lib/db";
import { notFound } from "next/navigation";
// ⭐ V3.48 — la route /edit elle-même ouvre le MODAL professionnel (photo du
// jalon + photo de biographie publique) : quel que soit le chemin d'accès —
// stylo de la liste (V3.47), onglet encore chargé sur l'ancien JS qui
// naviguait ici, bookmark ou historique — le pasteur voit toujours le modal.
import { BiographyAutoModal } from "@/components/admin/biography-modal";
// ⭐ V3.47 — colonne Biography.photoUrl : le findUnique ci-dessous la
// sélectionne → garde avant lecture (pattern V3.46).
import { ensureBiographyPhotoColumn } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";

export default async function EditBiographyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureBiographyPhotoColumn().catch(() => {});
  const { id } = await params;
  // Le serviteur du jalon est inclus (code) pour l'accent doré/violet ET
  // pour rester robuste si le serviteur a été désactivé depuis.
  const [biography, servants] = await Promise.all([
    db.biography.findUnique({
      where: { id },
      include: { servant: { select: { code: true } } },
    }),
    db.servant.findMany({
      select: { id: true, shortName: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);
  if (!biography) notFound();

  const accentColor = biography.servant?.code === "pam" ? "#C9A227" : "#8A857C";

  return (
    <BiographyAutoModal
      servants={servants}
      biography={{
        id: biography.id,
        servantId: biography.servantId,
        date: biography.date,
        title: biography.title,
        description: biography.description,
        verseRef: biography.verseRef,
        verseText: biography.verseText,
        photoUrl: biography.photoUrl,
        order: biography.order,
      }}
      accentColor={accentColor}
    />
  );
}
