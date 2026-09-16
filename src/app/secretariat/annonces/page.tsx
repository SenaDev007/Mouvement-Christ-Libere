"use client";

/**
 * ⭐ V3.66 — Annonces du ministère (Secrétariat).
 * ⭐ V3.89 — UI déplacée dans le composant partagé AnnoncesView (le
 * back-office des super admins gère les mêmes annonces via
 * /admin/api/annonces) — cette page est une coquille fine.
 */

import { AnnoncesView } from "@/components/staff-space/annonces-view";

export default function SecretariatAnnoncesPage() {
  return <AnnoncesView apiBase="/secretariat/api/annonces" />;
}
