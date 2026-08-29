import { PrismaClient } from '@prisma/client'

/**
 * Prisma singleton — adapté pour Vercel serverless.
 *
 * Lazy initialization : le PrismaClient n'est créé qu'au premier accès,
 * pas au moment de l'import. Cela évite que le module crash si Prisma
 * n'est pas correctement généré.
 *
 * Timeout : 10s par défaut pour éviter les requêtes qui restent bloquées
 * indéfiniment (cold start Neon, pool épuisé, etc.).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Transaction timeout : 10s (évite les blocages de 8 minutes)
      transactionOptions: {
        timeout: 10_000,
        maxWait: 5_000,
      },
    })
  } catch (error) {
    console.error('[db] Erreur création PrismaClient:', error)
    throw error
  }
}

// Proxy lazy — ne crée le client qu'au premier accès
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    const value = (globalForPrisma.prisma as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(globalForPrisma.prisma) : value
  },
})
