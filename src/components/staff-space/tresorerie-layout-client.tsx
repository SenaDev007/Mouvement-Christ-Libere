"use client";

import { SpaceShell, type SectionNav } from "@/components/staff-space/space-shell";
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  FileText,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";

/**
 * ⭐ V3.66/V3.67/V3.88 — Layout CLIENT de l'espace Trésorerie.
 * ⭐ V3.89 — scindé depuis src/app/tresorerie/layout.tsx pour que CE
 * dernier (serveur) porte les MÉTADONNÉES PWA du manifest dédié
 * « Trésorerie Christ Libère » (même scission que le back-office V3.80).
 *
 * Navigation propre à l'espace (tableau de bord, journal des mouvements,
 * ⭐ V3.88 donateurs — historique pour la prière, situation de caisse
 * multicaisse, rapports financiers, journal d'audit).
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
        // ⭐ V3.88 — tous ceux qui ont donné, sur une période, pour que
        // les serviteurs de Dieu puissent prier pour eux.
        label: "Donateurs",
        href: "/tresorerie/donateurs",
        icon: HeartHandshake,
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

export function TresorerieLayoutClient({
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
      contextePwa="tresorerie"
    >
      {children}
    </SpaceShell>
  );
}
