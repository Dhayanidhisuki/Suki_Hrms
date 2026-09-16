/**
 * Daily document expiry sweep (§17.1), scheduled at 08:00 IST. Started once
 * per Node server instance (wired from src/instrumentation.ts); guarded on
 * globalThis so dev HMR never starts a second timer, and a run still in
 * progress is never overlapped.
 */

import { runExpirySweep } from './service';
import { msUntilNextIstHour } from './rules';

const SWEEP_HOUR_IST = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  nextRunAt: Date | null;
}

const g = globalThis as unknown as { __documentExpiryScheduler?: SchedulerState };

export function getDocumentExpirySchedulerState(): SchedulerState | null {
  return g.__documentExpiryScheduler ?? null;
}

async function tick(state: SchedulerState) {
  if (state.running) return;
  state.running = true;
  state.lastStartedAt = new Date();
  try {
    const outcome = await runExpirySweep();
    console.log(`[document-expiry] sweep done: expired ${outcome.expired}, alerted ${outcome.alerted}`);
  } catch (err) {
    console.error('[document-expiry] sweep crashed', err);
  } finally {
    state.running = false;
    state.lastFinishedAt = new Date();
    state.nextRunAt = new Date(Date.now() + msUntilNextIstHour(SWEEP_HOUR_IST));
  }
}

export function startDocumentExpiryScheduler(): void {
  if (g.__documentExpiryScheduler) return;
  if (process.env.DOCUMENT_EXPIRY_SWEEP_ENABLED === 'false') {
    console.log('[document-expiry] scheduler disabled by DOCUMENT_EXPIRY_SWEEP_ENABLED=false');
    return;
  }

  const initialDelayMs = msUntilNextIstHour(SWEEP_HOUR_IST);
  const state: SchedulerState = {
    timer: null,
    running: false,
    lastStartedAt: null,
    lastFinishedAt: null,
    nextRunAt: new Date(Date.now() + initialDelayMs),
  };
  g.__documentExpiryScheduler = state;

  const first = setTimeout(() => {
    void tick(state);
    state.timer = setInterval(() => void tick(state), DAY_MS);
    state.timer.unref?.();
  }, initialDelayMs);
  first.unref?.();

  console.log(`[document-expiry] scheduler started: daily at 0${SWEEP_HOUR_IST}:00 IST, first run in ${Math.round(initialDelayMs / 60000)} min`);
}
