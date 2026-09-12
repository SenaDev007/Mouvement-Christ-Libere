import { JournalAuditView } from "@/components/staff-space/journal-audit-view";

/**
 * ⭐ V3.67 — /tresorerie/audit : journal d'audit de la trésorerie
 * (gouvernance). Force dynamic : données sensibles, jamais de cache.
 */
export const dynamic = "force-dynamic";

export default function TresorerieAuditPage() {
  return <JournalAuditView endpoint="/tresorerie/api/audit" titreEspace="Trésorerie" />;
}
