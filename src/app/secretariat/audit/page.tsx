import { JournalAuditView } from "@/components/staff-space/journal-audit-view";

/**
 * ⭐ V3.67 — /secretariat/audit : journal d'audit du secrétariat
 * (gouvernance). Force dynamic : données sensibles, jamais de cache.
 */
export const dynamic = "force-dynamic";

export default function SecretariatAuditPage() {
  return (
    <JournalAuditView endpoint="/secretariat/api/audit" titreEspace="Secrétariat" />
  );
}
