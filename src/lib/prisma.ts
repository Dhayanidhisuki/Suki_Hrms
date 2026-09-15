import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  return new PrismaClient({
    log: ['error', 'warn'],
  });
}

/**
 * Reuse one PrismaClient in dev (hot reload), but drop a stale singleton
 * that was created before `prisma generate` added new models. Otherwise
 * `prisma.jobDescription.findMany` throws "Cannot read properties of
 * undefined (reading 'findMany')".
 */
function resolveClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && typeof existing.jobDescription?.findMany === 'function') {
    return existing;
  }
  return createClient();
}

export const prisma = resolveClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
