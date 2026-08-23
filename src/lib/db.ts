import { PrismaClient } from '@prisma/client'

/**
 * Prisma singleton — adapté pour Vercel serverless.
 *
 * En serverless, chaque fonction peut instancier un nouveau PrismaClient,
 * ce qui épuise les connexions PostgreSQL. On réutilise l'instance
 * globale en dev et en production (warm instances).
 */

// Debug : vérifier que DATABASE_URL est bien disponible
if (!process.env.DATABASE_URL) {
  console.warn('[db] ⚠ DATABASE_URL is not set in environment')
} else {
  console.log('[db] ✓ DATABASE_URL is set (length:', process.env.DATABASE_URL.length, ')')
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
