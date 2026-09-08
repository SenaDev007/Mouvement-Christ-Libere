import { db } from "@/lib/db";
import { AdminForm, type FieldDef } from "@/components/admin/admin-form";
import { RUBRIQUE_OPTIONS } from "@/lib/video-rubrics";

export const dynamic = "force-dynamic";

export default async function NewVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ servant?: string }>;
}) {
  const params = await searchParams;
  const servants = await db.servant.findMany({ where: { isActive: true } });

  // Si ?servant=pam ou ?servant=kongo, pré-remplir le serviteur
  const preselectedServant = params.servant
    ? servants.find((s) => s.code === params.servant)
    : null;

  const FIELDS: FieldDef[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      // ⭐ V3.46 — Rubrique signature de la vidéo (« Saint-Esprit réponds-moi »
      // Pam, « Rhema du matin »/« Rhema du soir » Pasteur Kongo…). Vide =
      // catégorisation automatique par mots-clés du titre (historique).
      name: "category",
      label: "Rubrique",
      type: "select",
      options: RUBRIQUE_OPTIONS,
      fullWidth: true,
      help: "Les rubriques ★ sont mises en avant sur la page publique /videos",
    },
    { name: "title", label: "Titre", type: "text", required: true, fullWidth: true },
    { name: "description", label: "Description", type: "textarea", fullWidth: true },
    { name: "duration", label: "Durée", type: "text", placeholder: "1:24:30 ou EN DIRECT" },
    { name: "videoUrl", label: "URL vidéo", type: "text", placeholder: "https://..." },
    { name: "hlsUrl", label: "URL HLS (streaming)", type: "text" },
    // ⭐ V3.48 — miniature PAR UPLOAD (plus de champ « URL miniature ») :
    // même mécanique que le modal « Nouvelle vidéo » — image compressée
    // côté client (ratio préservé, ≤ 150 Ko), affichée sur la page publique.
    {
      name: "thumbnailUrl",
      label: "Miniature de la vidéo",
      type: "image",
      fullWidth: true,
      help: "Affichée sur la page publique /videos — facultative (détectée automatiquement via le bouton « Nouvelle vidéo »)",
    },
    { name: "views", label: "Vues initiales", type: "number" },
    { name: "isLive", label: "En direct maintenant", type: "checkbox" },
  ];

  const subtitle = preselectedServant
    ? `Ajouter une vidéo pour ${preselectedServant.shortName}.`
    : "Ajouter une vidéo ou un live enregistré.";

  // Pré-remplir servantId si un serviteur est sélectionné via ?servant=
  const initialData = preselectedServant ? { servantId: preselectedServant.id } : undefined;

  return (
    <div className="space-y-4">
      {/* ⭐ V3.47 — Upload direct de fichier : disponible dans le modal
          « Nouvelle vidéo » de la page Vidéos (barre de progression,
          miniature et durée auto-détectées). */}
      <div className="rounded-xl border border-[#C9A227]/40 bg-[#C9A227]/10 px-4 py-3 text-sm text-[#1E0F2B]/80">
        <strong className="font-bold">Pour envoyer directement un fichier vidéo</strong> (sans
        passer par YouTube), utilisez le bouton «&nbsp;Nouvelle vidéo&nbsp;» de la page{" "}
        <a href="/admin/videos" className="font-bold underline hover:text-[#C9A227]">
          Vidéos
        </a>{" "}
        puis l&apos;onglet «&nbsp;Fichier vidéo&nbsp;» — l&apos;envoi, la miniature et la durée
        sont gérés automatiquement.
      </div>
      <AdminForm
        entity="videos"
        fields={FIELDS}
        initialData={initialData}
        redirectTo="/admin/videos"
        title="Nouvelle vidéo (formulaire complet)"
        subtitle={subtitle}
      />
    </div>
  );
}

