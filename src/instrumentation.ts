/**
 * Next.js server-start hook (runs once per server instance, before it
 * serves requests). Starts the in-process schedulers — Node runtime only;
 * these modules pull in Prisma, so they must never be evaluated in the edge
 * runtime. Each start function is guarded on globalThis so dev HMR never
 * starts a second timer.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startBiometricScheduler } = await import('./lib/biometricScheduler');
  startBiometricScheduler();

  const { startNotificationDispatcher } = await import('./lib/platform/notification/dispatcher');
  startNotificationDispatcher();

  const { startDocumentExpiryScheduler } = await import('./lib/platform/document/expiry');
  startDocumentExpiryScheduler();

  const { startEscalationScheduler } = await import('./lib/platform/workflow/escalation');
  startEscalationScheduler();

  const { startLearningScheduler } = await import('./lib/learning/scheduler');
  startLearningScheduler();
}
