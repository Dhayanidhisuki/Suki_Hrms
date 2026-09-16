/**
 * Escalation scheduler — runs runEscalationSweep() hourly in-process.
 *
 * Same shape as src/lib/biometricScheduler.ts: guarded on globalThis so dev
 * HMR never starts a second timer, an in-progress sweep is never overlapped,
 * and the timer is unref'd so it never keeps the process alive. Started
 * from src/instrumentation.ts (Node runtime only) by whoever wires it.
 *
 * Env: PLATFORM_ESCALATION_ENABLED=false disables; PLATFORM_ESCALATION_INTERVAL_MINUTES
 * (default 60, minimum 5); PLATFORM_ESCALATION_INITIAL_DELAY_MS (default 120000).
 */

import { runEscalationSweep } from './engine';

export { runEscalationSweep };

interface EscalationSchedulerState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  intervalMs: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastResult: { escalated: number; exhausted: number } | null;
  nextRunAt: Date | null;
}

const g = globalThis as unknown as { __platformEscalationScheduler?: EscalationSchedulerState };

export function getEscalationSchedulerState(): EscalationSchedulerState | null {
  return g.__platformEscalationScheduler ?? null;
}

async function tick(state: EscalationSchedulerState) {
  if (state.running) return;
  state.running = true;
  state.lastStartedAt = new Date();
  try {
    const result = await runEscalationSweep();
    state.lastResult = result;
    if (result.escalated || result.exhausted) {
      console.log(`[platform/escalation] sweep: escalated ${result.escalated}, exhausted ${result.exhausted}`);
    }
  } catch (err) {
    console.error('[platform/escalation] sweep crashed', err);
  } finally {
    state.running = false;
    state.lastFinishedAt = new Date();
    state.nextRunAt = new Date(Date.now() + state.intervalMs);
  }
}

export function startEscalationScheduler(): void {
  if (g.__platformEscalationScheduler) return;
  if (process.env.PLATFORM_ESCALATION_ENABLED === 'false') {
    console.log('[platform/escalation] scheduler disabled by PLATFORM_ESCALATION_ENABLED=false');
    return;
  }
  const minutes = Number(process.env.PLATFORM_ESCALATION_INTERVAL_MINUTES ?? 60);
  const intervalMs = Math.max(5, Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60 * 1000;
  const initialDelayMs = Number(process.env.PLATFORM_ESCALATION_INITIAL_DELAY_MS ?? 120_000);

  const state: EscalationSchedulerState = {
    timer: null,
    running: false,
    intervalMs,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastResult: null,
    nextRunAt: new Date(Date.now() + initialDelayMs),
  };
  g.__platformEscalationScheduler = state;

  const first = setTimeout(() => {
    void tick(state);
    state.timer = setInterval(() => void tick(state), intervalMs);
    state.timer.unref?.();
  }, initialDelayMs);
  first.unref?.();

  console.log(`[platform/escalation] scheduler started: every ${intervalMs / 60000}m, first run in ${Math.round(initialDelayMs / 1000)}s`);
}
