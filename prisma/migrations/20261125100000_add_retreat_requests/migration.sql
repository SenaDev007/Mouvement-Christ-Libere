-- ⭐ V4.43 — Retraite spirituelle : demandes de séjour au lieu aménagé.
-- Formulaire public (site + mobile) → traitement par la secrétaire dans
-- l'espace Secrétariat (/secretariat/retraites).

CREATE TABLE IF NOT EXISTS "RetreatRequest" (
    "id"               TEXT NOT NULL,
    "trackingCode"     TEXT NOT NULL,
    "firstName"        TEXT NOT NULL,
    "lastName"         TEXT NOT NULL,
    "gender"           TEXT NOT NULL DEFAULT 'NON_PRECISE',
    "email"            TEXT,
    "phone"            TEXT NOT NULL,
    "country"          TEXT NOT NULL,
    "city"             TEXT NOT NULL,
    "address"          TEXT,
    "profession"       TEXT,
    "maritalStatus"    TEXT,
    "emergencyContact" TEXT,
    "arrivalDate"      TIMESTAMPTZ(3),
    "numberOfDays"     INTEGER NOT NULL,
    "expectations"     TEXT,
    "hasBeenBefore"    BOOLEAN NOT NULL DEFAULT false,
    "idDocumentUrl"    TEXT NOT NULL,
    "paymentProofUrl"  TEXT NOT NULL,
    "paymentAmount"    INTEGER NOT NULL DEFAULT 15000,
    "paymentMethod"    TEXT,
    "status"           TEXT NOT NULL DEFAULT 'SOUMISE',
    "decisionReason"   TEXT,
    "secretaryNote"    TEXT,
    "processedAt"      TIMESTAMPTZ(3),
    "handledById"      TEXT,
    "source"           TEXT NOT NULL DEFAULT 'SITE',
    "createdAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RetreatRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RetreatRequest_trackingCode_key" ON "RetreatRequest"("trackingCode");
CREATE INDEX IF NOT EXISTS "RetreatRequest_status_idx" ON "RetreatRequest"("status");
CREATE INDEX IF NOT EXISTS "RetreatRequest_createdAt_idx" ON "RetreatRequest"("createdAt");
