"use client";

import { useEffect, useState } from "react";
import { SpaceShell, type SectionNav } from "@/components/staff-space/space-shell";
import { ClocheNotifications } from "@/components/staff-space/notifications";
import { LayoutDashboard, Inbox, Megaphone, FileText, ShieldCheck, Mail, Sparkles, Mountain } from "lucide-react";

/**
 * ⭐ V3.66/V3.67 — Layout CLIENT de l'espace Secrétariat.
 * ⭐ V3.89 — scindé depuis src/app/secretariat/layout.tsx pour que CE
 * dernier (serveur) porte les MÉTADONNÉES PWA du manifest dédié
 * « Secrétariat Christ Libère » (même scission que le back-office V3.80).
 *
 * Navigation propre à l'espace (dashboard, demandes de rencontre,
 * annonces du ministère, rapports, journal d'audit).
 *
 * ⭐ V3.67 — NOTIFICATION D'ARRIVÉE : un badge doré sur « Demandes de
 * rencontre » compte les demandes à examiner (RECUE + urgentes en
 * attente) et se rafraîchit par polling toutes les 60 s.
 *
 * ⭐ V3.74 — CLOCHE DE NOTIFICATIONS (sidebar + barre mobile) : quand un
 * serviteur VALIDE une demande transmise (back-office /admin/demandes),
 * la secrétaire est notifiée ici (badge + panneau).
 */

/**
 * ⭐ V3.67 — Badge des demandes de rencontre à examiner (RECUE + urgentes).
 * ⭐ V4.43 — étendu aux demandes de RETRAITE SPIRITUELLE (SOUMISE +
 * EN_EXAMEN) : UNE seule requête /secretariat/api/stats alimente les deux
 * badges (un seul polling 60 s).
 */
function useBadges(): { demandes: string | null; retraites: string | null } {
  const [badges, setBadges] = useState<{
    demandes: string | null;
    retraites: string | null;
  }>({ demandes: null, retraites: null });

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
        const retraitesAExaminer =
          (json?.retraites?.soumises || 0) +
          (json?.retraites?.enExamen || 0);
        setBadges({
          demandes: aExaminer > 0 ? String(aExaminer) : null,
          retraites: retraitesAExaminer > 0 ? String(retraitesAExaminer) : null,
        });
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

  return badges;
}

export function SecretariatLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { demandes: badge, retraites: badgeRetraites } = useBadges();

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
          // ⭐ V4.43 — retraite spirituelle : demandes de séjour sur le
          // lieu aménagé (formulaire public + app mobile → ici).
          label: "Retraites spirituelles",
          href: "/secretariat/retraites",
          icon: Mountain,
          badge: badgeRetraites,
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
        // ⭐ V3.89 — MCL Creative Studio : le MÊME générateur de miniatures
        // vidéo et d'affiches que le back-office (composant et service
        // partagés — directive du pasteur).
        {
          label: "Studio Créatif",
          href: "/secretariat/studio",
          icon: Sparkles,
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
      contextePwa="secretariat"
      actionsSupplementaires={<ClocheNotifications prefixeEspace="/secretariat" />}
    >
      {children}
    </SpaceShell>
  );
}
