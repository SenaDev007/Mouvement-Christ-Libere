"use client";

/**
 * ⭐ V3.89 — MCL CREATIVE STUDIO (Back-office — super admins).
 *
 * Générateur professionnel de miniatures vidéo et d'affiches
 * événementielles, intégré au back-office du Mouvement Christ Libère
 * (identité visuelle automatiquement respectée — spec complète §1-57).
 *
 * Ce module est PARTAGÉ avec le secrétariat (même composant StudioShell,
 * même service, mêmes tables) : la secrétaire y accède depuis
 * /secretariat/studio.
 */

import { StudioShell } from "@/components/studio/studio-shell";

export default function AdminStudioPage() {
  return <StudioShell apiBase="/admin/api/studio" espace="admin" />;
}
