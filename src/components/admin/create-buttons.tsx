"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { CreateEntityModal, type CreateField } from "@/components/admin/create-entity-modal";
import type { Servant } from "@prisma/client";

interface ServantLite {
  id: string;
  shortName: string;
  code: string;
}

// =============================================
// Bouton + Modal pour Nouveau Serviteur
// =============================================
interface NewServantButtonProps {
  accentColor?: string;
}

export function NewServantButton({ accentColor = "#C9A227" }: NewServantButtonProps) {
  const [open, setOpen] = useState(false);

  const fields: CreateField[] = [
    {
      name: "code",
      label: "Code",
      type: "text",
      placeholder: "pam ou kongo",
      help: "Identifiant unique (minuscules, sans espaces)",
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
      name: "fullName",
      label: "Nom complet",
      type: "text",
      placeholder: "Afrika Alkebulane Pamela Dali",
      required: true,
      fullWidth: true,
    },
    {
      name: "role",
      label: "Rôle / Titre",
      type: "text",
      placeholder: "Servante de l'Éternel",
      required: true,
      fullWidth: true,
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
      label: "URL portrait",
      type: "text",
      placeholder: "/pam.jpeg ou https://...",
      fullWidth: true,
    },
    {
      name: "isActive",
      label: "Serviteur actif",
      type: "checkbox",
      help: "Afficher ce serviteur sur le site public",
      defaultValue: true,
      fullWidth: true,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-bold transition-colors shadow-md"
        style={{ backgroundColor: accentColor, color: "#1E0F2B" }}
      >
        <Plus className="w-4 h-4" />
        Nouveau serviteur
      </button>
      <CreateEntityModal
        open={open}
        onClose={() => setOpen(false)}
        entity="servants"
        title="Nouveau serviteur"
        subtitle="Ajouter un serviteur au mouvement"
        fields={fields}
        accentColor={accentColor}
        size="lg"
      />
    </>
  );
}

// =============================================
// Bouton + Modal pour Nouvelle Biographie
// =============================================
interface NewBiographyButtonProps {
  servants: ServantLite[];
  accentColor?: string;
}

export function NewBiographyButton({ servants, accentColor = "#C9A227" }: NewBiographyButtonProps) {
  const [open, setOpen] = useState(false);

  const fields: CreateField[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      name: "order",
      label: "Ordre",
      type: "number",
      help: "Plus petit = plus tôt",
      defaultValue: 1,
    },
    {
      name: "date",
      label: "Date / Période",
      type: "text",
      placeholder: "Enfance, 2024-03, etc.",
      required: true,
      fullWidth: true,
    },
    {
      name: "title",
      label: "Titre court",
      type: "text",
      placeholder: "Le premier appel",
      required: true,
      fullWidth: true,
    },
    {
      name: "description",
      label: "Récit",
      type: "textarea",
      placeholder: "2 à 4 phrases de récit, ton sobre...",
      required: true,
      fullWidth: true,
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
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-bold transition-colors shadow-md"
        style={{ backgroundColor: accentColor, color: "#1E0F2B" }}
      >
        <Plus className="w-4 h-4" />
        Nouveau jalon
      </button>
      <CreateEntityModal
        open={open}
        onClose={() => setOpen(false)}
        entity="biographies"
        title="Nouveau jalon biographique"
        subtitle="Ajouter un événement à la frise chronologique"
        fields={fields}
        accentColor={accentColor}
        size="lg"
      />
    </>
  );
}

// =============================================
// Bouton + Modal pour Nouveau Témoignage
// =============================================
interface NewTestimonyButtonProps {
  servants: ServantLite[];
  accentColor?: string;
}

export function NewTestimonyButton({ servants, accentColor = "#C9A227" }: NewTestimonyButtonProps) {
  const [open, setOpen] = useState(false);

  const fields: CreateField[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      name: "status",
      label: "Statut",
      type: "select",
      options: [
        { value: "TO_DISCERN", label: "À discerner" },
        { value: "CONFIRMED", label: "Confirmé" },
        { value: "ARCHIVED", label: "Archivé" },
      ],
      defaultValue: "TO_DISCERN",
      required: true,
    },
    {
      name: "title",
      label: "Titre",
      type: "text",
      placeholder: "Titre du témoignage",
      required: true,
      fullWidth: true,
    },
    {
      name: "short",
      label: "Résumé court",
      type: "textarea",
      placeholder: "Résumé en 2-3 lignes",
      fullWidth: true,
    },
    {
      name: "content",
      label: "Contenu complet",
      type: "textarea",
      placeholder: "Récit détaillé...",
      fullWidth: true,
    },
    {
      name: "themes",
      label: "Thèmes",
      type: "tags",
      placeholder: "Vision, Ciel, Lumière",
      fullWidth: true,
    },
    {
      name: "bookRef",
      label: "Référence biblique",
      type: "text",
      placeholder: "Ézéchiel 1:1",
    },
    {
      name: "readingTime",
      label: "Temps de lecture",
      type: "text",
      placeholder: "8 min",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-bold transition-colors shadow-md"
        style={{ backgroundColor: accentColor, color: "#1E0F2B" }}
      >
        <Plus className="w-4 h-4" />
        Nouveau témoignage
      </button>
      <CreateEntityModal
        open={open}
        onClose={() => setOpen(false)}
        entity="testimonies"
        title="Nouveau témoignage"
        subtitle="Ajouter un récit d'expérience spirituelle"
        fields={fields}
        accentColor={accentColor}
        size="lg"
      />
    </>
  );
}

// =============================================
// Bouton + Modal pour Nouvel Enseignement
// =============================================
interface NewTeachingButtonProps {
  servants: ServantLite[];
  accentColor?: string;
}

export function NewTeachingButton({ servants, accentColor = "#C9A227" }: NewTeachingButtonProps) {
  const [open, setOpen] = useState(false);

  const fields: CreateField[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      name: "level",
      label: "Niveau",
      type: "select",
      options: [
        { value: "DECOUVERTE", label: "Découverte" },
        { value: "INTERMEDIAIRE", label: "Intermédiaire" },
        { value: "AVANCE", label: "Avancé" },
      ],
      defaultValue: "DECOUVERTE",
    },
    {
      name: "title",
      label: "Titre",
      type: "text",
      placeholder: "Titre de l'enseignement",
      required: true,
      fullWidth: true,
    },
    {
      name: "theme",
      label: "Thème",
      type: "text",
      placeholder: "Prière, Prophétie...",
    },
    {
      name: "book",
      label: "Livre biblique",
      type: "text",
      placeholder: "Genèse",
    },
    {
      name: "excerpt",
      label: "Extrait",
      type: "textarea",
      placeholder: "Introduction courte...",
      fullWidth: true,
    },
    {
      name: "content",
      label: "Contenu",
      type: "textarea",
      placeholder: "Étude détaillée...",
      fullWidth: true,
    },
    {
      name: "readingTime",
      label: "Temps de lecture",
      type: "text",
      placeholder: "15 min",
    },
    {
      name: "pdfUrl",
      label: "URL PDF",
      type: "text",
      placeholder: "https://...",
      fullWidth: true,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-bold transition-colors shadow-md"
        style={{ backgroundColor: accentColor, color: "#1E0F2B" }}
      >
        <Plus className="w-4 h-4" />
        Nouvel enseignement
      </button>
      <CreateEntityModal
        open={open}
        onClose={() => setOpen(false)}
        entity="teachings"
        title="Nouvel enseignement"
        subtitle="Ajouter une étude biblique"
        fields={fields}
        accentColor={accentColor}
        size="lg"
      />
    </>
  );
}

// =============================================
// Bouton + Modal pour Programmer un Live
// =============================================
interface NewLiveButtonProps {
  servants: ServantLite[];
  accentColor?: string;
}

export function NewLiveButton({ servants, accentColor = "#C9A227" }: NewLiveButtonProps) {
  const [open, setOpen] = useState(false);

  const fields: CreateField[] = [
    {
      name: "servantId",
      label: "Serviteur",
      type: "select",
      options: servants.map((s) => ({ value: s.id, label: s.shortName })),
      required: true,
    },
    {
      name: "scheduledAt",
      label: "Date & heure",
      type: "datetime-local",
      required: true,
    },
    {
      name: "title",
      label: "Titre du live",
      type: "text",
      placeholder: "Ex: Enseignement sur l'horloge céleste",
      required: true,
      fullWidth: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Décrivez le sujet du live...",
      fullWidth: true,
    },
    {
      name: "thumbnailUrl",
      label: "URL miniature (optionnel)",
      type: "text",
      placeholder: "https://...",
      fullWidth: true,
    },
    {
      name: "streamToYoutube",
      label: "Diffuser sur YouTube",
      type: "checkbox",
      defaultValue: true,
      fullWidth: true,
    },
    {
      name: "streamToFacebook",
      label: "Diffuser sur Facebook",
      type: "checkbox",
      defaultValue: false,
      fullWidth: true,
    },
    {
      name: "streamToTiktok",
      label: "Diffuser sur TikTok",
      type: "checkbox",
      defaultValue: false,
      fullWidth: true,
    },
    {
      name: "multistreamEnabled",
      label: "Activer le multistreaming",
      type: "checkbox",
      defaultValue: true,
      fullWidth: true,
      help: "Si activé, le live sera diffusé simultanément sur les plateformes cochées ci-dessus (nécessite les clés RTMP configurées pour le serviteur)",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-bold transition-colors shadow-md"
        style={{ backgroundColor: accentColor, color: "#1E0F2B" }}
      >
        <Plus className="w-4 h-4" />
        Programmer un live
      </button>
      <CreateEntityModal
        open={open}
        onClose={() => setOpen(false)}
        entity="lives"
        title="Programmer un live"
        subtitle="Planifier une session de streaming en direct"
        fields={fields}
        accentColor={accentColor}
        size="lg"
      />
    </>
  );
}
