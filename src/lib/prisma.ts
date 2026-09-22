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
function isCurrentClient(client: PrismaClient): boolean {
  return (
    typeof client.jobDescription?.findMany === 'function' &&
    typeof client.bankFileTemplate?.findMany === 'function' &&
    typeof client.kra?.findMany === 'function' &&
    typeof client.employeeGoalSet?.findMany === 'function' &&
    typeof client.recruitmentApplicant?.findMany === 'function' &&
    typeof client.generatedHrLetter?.findMany === 'function' &&
    typeof client.fnFSettlementLine?.findMany === 'function' &&
    typeof client.exitClearanceCheck?.findMany === 'function'
  );
}

function resolveClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && isCurrentClient(existing)) {
    return existing;
  }
  return createClient();
}

export const prisma = resolveClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
