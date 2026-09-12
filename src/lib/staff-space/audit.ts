/**
 * ⭐ V3.67 — Gouvernance : journal d'audit CONSULTABLE des espaces.
 *
 * Chaque espace affiche les traces des actions qui le concernent
 * (créations, corrections, suppressions, publications, accréditations,
 * connexions) : QUI a fait QUOI, QUAND, sur QUOI. Les métadonnées
 * (avant/après, motifs) sont affichées en clair — la transparence
 * interne est la base de la gouvernance du ministère.
 */

import { db } from "@/lib/db";

export interface EntreeAudit {
  id: string;
  action: string;
  userId: string;
  userName: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
}

/** Lit le journal d'audit filtré par préfixes d'action (pagination incluse). */
export async function lireJournalAudit(
  prefixesAction: readonly string[],
  limit: number,
  offset: number
): Promise<{ items: EntreeAudit[]; total: number }> {
  const where = {
    OR: prefixesAction.map((prefix) => ({
      action: { startsWith: prefix },
    })),
  };

  const [entrees, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    items: entrees.map((e) => ({
      id: e.id,
      action: e.action,
      userId: e.userId,
      userName: e.user?.name || null,
      targetId: e.targetId,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
    total,
  };
}

/** Écrit une entrée d'audit (best-effort — jamais bloquant). */
export async function tracerAudit(
  action: string,
  userId: string,
  targetId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        userId,
        targetId,
        metadata: metadata as never,
      },
    });
  } catch (e) {
    console.warn("[staff-space/audit] AuditLog impossible :", e);
  }
}

/** Préfixes d'action du journal de l'espace SECRÉTARIAT. */
export const PREFIXES_AUDIT_SECRETARIAT = [
  "DEMANDE_",
  "ANNONCE_",
  "SECRETARIAT_",
  "STAFF_",
] as const;

/** Préfixes d'action du journal de l'espace TRÉSORERIE. */
export const PREFIXES_AUDIT_TRESORERIE = [
  "TRESORERIE_",
] as const;
