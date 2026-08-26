import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton — backend Express.
 *
 * Lazy initialization: PrismaClient is only created on first access,
 * which avoids crashing the module if Prisma is not generated yet.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  try {
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });
  } catch (error) {
    console.error("[db] Erreur création PrismaClient:", error);
    throw error;
  }
}

// Lazy proxy — creates the client only on first access
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    const value = (globalForPrisma.prisma as unknown as Record<
      string | symbol,
      unknown
    >)[prop];
    return typeof value === "function"
      ? value.bind(globalForPrisma.prisma)
      : value;
  },
});
