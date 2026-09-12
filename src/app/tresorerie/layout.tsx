"use client";

import { SpaceShell, type SectionNav } from "@/components/staff-space/space-shell";
import { LayoutDashboard, BookOpen, Wallet, FileText } from "lucide-react";

/**
 * ⭐ V3.66 — Layout de l'espace Trésorerie.
 *
 * Navigation propre à l'espace (tableau de bord, journal des mouvements,
 * situation de caisse, rapports financiers). Coquille partagée avec le
 * secrétariat — cf. src/components/staff-space/space-shell.tsx.
 */

const SECTIONS: SectionNav[] = [
  {
    title: "Vue d'ensemble",
    items: [
      {
        label: "Tableau de bord",
        href: "/tresorerie/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Comptabilité",
    items: [
      {
        label: "Journal des mouvements",
        href: "/tresorerie/transactions",
        icon: BookOpen,
      },
      {
        label: "Situation de caisse",
        href: "/tresorerie/caisse",
        icon: Wallet,
      },
    ],
  },
  {
    title: "Documents",
    items: [
      {
        label: "Rapports financiers",
        href: "/tresorerie/rapports",
        icon: FileText,
      },
    ],
  },
];

export default function TresorerieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpaceShell
      titreEspace="Trésorerie"
      prefixeEspace="/tresorerie"
      libelleSousDomaine="tresorerie"
      sections={SECTIONS}
    >
      {children}
    </SpaceShell>
  );
}
