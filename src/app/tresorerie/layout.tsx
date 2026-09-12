"use client";

import { SpaceShell, type SectionNav } from "@/components/staff-space/space-shell";
import { LayoutDashboard, BookOpen, Wallet, FileText, ShieldCheck } from "lucide-react";

/**
 * ⭐ V3.66/V3.67 — Layout de l'espace Trésorerie.
 *
 * Navigation propre à l'espace (tableau de bord, journal des mouvements,
 * situation de caisse multicaisse, rapports financiers, journal d'audit).
 * Coquille partagée avec le secrétariat — cf. space-shell.tsx.
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
    title: "Documents & gouvernance",
    items: [
      {
        label: "Rapports financiers",
        href: "/tresorerie/rapports",
        icon: FileText,
      },
      {
        label: "Journal d'audit",
        href: "/tresorerie/audit",
        icon: ShieldCheck,
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
