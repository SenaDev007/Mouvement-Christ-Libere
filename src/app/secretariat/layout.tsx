"use client";

import { useEffect, useState } from "react";
import { SpaceShell, type SectionNav } from "@/components/staff-space/space-shell";
import { ClocheNotifications } from "@/components/staff-space/notifications";
import { LayoutDashboard, Inbox, Megaphone, FileText, ShieldCheck, Mail } from "lucide-react";

/**
 * ⭐ V3.66/V3.67 — Layout de l'espace Secrétariat.
 *
 * Navigation propre à l'espace (dashboard, demandes de rencontre,
 * annonces du ministère, rapports, journal d'audit).
 *
 * ⭐ V3.67 — NOTIFICATION D'ARRIVÉE (gap du bilan : « pas de notification
 * d'arrivée de demande ») : un badge doré sur « Demandes de rencontre »
 * compte les demandes à examiner (RECUE + urgentes en attente) et se
 * rafraîchit par polling toutes les 60 s — visible sur TOUTES les pages
 * de l'espace, la secrétaire ne peut plus passer à côté d'une demande.
 *
 * ⭐ V3.74 — CLOCHE DE NOTIFICATIONS (sidebar + barre mobile) : quand un
 * serviteur VALIDE une demande transmise (back-office /admin/demandes),
 * la secrétaire est notifiée ici (badge + panneau).
 */

function useBadgeDemandes(): string | null {
  const [badge, setBadge] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    const interroger = async () => {
      try {
        const res = await fetch("/secretariat/api/stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (annule) return;
        const aExaminer =
          (json?.demandes?.recues || 0) +
          (json?.demandes?.transmises || 0) +
          (json?.demandes?.validees || 0);
        setBadge(aExaminer > 0 ? String(aExaminer) : null);
      } catch {
        // silencieux : le badge n'est pas critique.
      }
    };

    interroger();
    const minuteur = setInterval(interroger, 60_000);
    return () => {
      annule = true;
      clearInterval(minuteur);
    };
  }, []);

  return badge;
}

export default function SecretariatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const badge = useBadgeDemandes();

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
          badge,
        },
        {
          label: "Annonces",
          href: "/secretariat/annonces",
          icon: Megaphone,
        },
        {
          label: "Courrier au serviteur",
          href: "/secretariat/courrier",
          icon: Mail,
        },
      ],
    },
    {
      title: "Documents & gouvernance",
      items: [
        {
          label: "Rapports PDF",
          href: "/secretariat/rapports",
          icon: FileText,
        },
        {
          label: "Journal d'audit",
          href: "/secretariat/audit",
          icon: ShieldCheck,
        },
      ],
    },
  ];

  return (
    <SpaceShell
      titreEspace="Secrétariat"
      prefixeEspace="/secretariat"
      libelleSousDomaine="secretariat"
      sections={SECTIONS}
      actionsSupplementaires={<ClocheNotifications prefixeEspace="/secretariat" />}
    >
      {children}
    </SpaceShell>
  );
}
