/**
 * Next.js server-start hook (runs once per server instance, before it
 * serves requests). Only job today: start the biometric device sync
 * scheduler — Node runtime only; the module pulls in Prisma, so it must
 * never be evaluated in the edge runtime.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startBiometricScheduler } = await import('./lib/biometricScheduler');
  startBiometricScheduler();
}
