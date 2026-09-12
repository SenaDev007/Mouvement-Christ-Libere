"use client";

import { SpaceShell, type SectionNav } from "@/components/staff-space/space-shell";
import { LayoutDashboard, Inbox, Megaphone, FileText } from "lucide-react";

/**
 * ⭐ V3.66 — Layout de l'espace Secrétariat.
 *
 * Navigation propre à l'espace (dashboard, demandes de rencontre,
 * annonces du ministère, rapports). La coquille (sidebar violet/or,
 * déconnexion, « Voir le site ») est partagée avec la trésorerie —
 * cf. src/components/staff-space/space-shell.tsx.
 */

const SECTIONS: SectionNav[] = [
  {
    title: "Vue d'ensemble",
    items: [
      {
        label: "Tableau de bord",
        href: "/secretariat/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Ministère",
    items: [
      {
        label: "Demandes de rencontre",
        href: "/secretariat/demandes",
        icon: Inbox,
      },
      {
        label: "Annonces",
        href: "/secretariat/annonces",
        icon: Megaphone,
      },
    ],
  },
  {
    title: "Documents",
    items: [
      {
        label: "Rapports PDF",
        href: "/secretariat/rapports",
        icon: FileText,
      },
    ],
  },
];

export default function SecretariatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpaceShell
      titreEspace="Secrétariat"
      prefixeEspace="/secretariat"
      libelleSousDomaine="secretariat"
      sections={SECTIONS}
    >
      {children}
    </SpaceShell>
  );
}
