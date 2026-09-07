/**
 * In-process scheduler for the biometric device sync — started once per
 * Node server instance from src/instrumentation.ts. No external cron is
 * needed on the on-prem Windows server: as long as the HRMS process is up,
 * the sync runs every BIOMETRIC_SYNC_INTERVAL_HOURS (default 8), first
 * ~1 minute after boot, each time covering the last
 * BIOMETRIC_SYNC_LOOKBACK_DAYS days.
 *
 * Guarded on globalThis so dev HMR / duplicate register() calls never
 * start a second timer, and a run that is still in progress is never
 * overlapped by the next tick.
 */

import { biometricApiConfigured } from './biometricApi';
import { defaultSyncRange, runBiometricSync } from './biometricSync';

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  intervalMs: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  nextRunAt: Date | null;
}

const g = globalThis as unknown as { __biometricScheduler?: SchedulerState };

export function getSchedulerState(): SchedulerState | null {
  return g.__biometricScheduler ?? null;
}

async function tick(state: SchedulerState) {
  if (state.running) return; // previous run still going — skip this tick, next one will catch up via the lookback window
  state.running = true;
  state.lastStartedAt = new Date();
  try {
    const { rangeStart, rangeEnd } = defaultSyncRange();
    const outcome = await runBiometricSync({
      companyId: Number(process.env.BIOMETRIC_COMPANY_ID ?? 1),
      rangeStart,
      rangeEnd,
      trigger: 'scheduled',
    });
    console.log(
      `[biometric-sync] scheduled run #${outcome.runId} ${outcome.status}: fetched ${outcome.rowsFetched}, created ${outcome.daysCreated}, updated ${outcome.daysUpdated}, unchanged ${outcome.daysUnchanged}, frozen-skipped ${outcome.skippedFrozen}, unmatched ${outcome.unmatched.length}`
    );
  } catch (err) {
    console.error('[biometric-sync] scheduled run crashed', err);
  } finally {
    state.running = false;
    state.lastFinishedAt = new Date();
    state.nextRunAt = new Date(Date.now() + state.intervalMs);
  }
}

export function startBiometricScheduler(): void {
  if (g.__biometricScheduler) return;
  if (process.env.BIOMETRIC_SYNC_ENABLED === 'false') {
    console.log('[biometric-sync] scheduler disabled by BIOMETRIC_SYNC_ENABLED=false');
    return;
  }
  if (!biometricApiConfigured()) {
    console.log('[biometric-sync] scheduler not started: BIOMETRIC_API_URL / BIOMETRIC_API_KEY missing');
    return;
  }

  const hours = Number(process.env.BIOMETRIC_SYNC_INTERVAL_HOURS ?? 8);
  const intervalMs = Math.max(5 * 60 * 1000, (Number.isFinite(hours) && hours > 0 ? hours : 8) * 60 * 60 * 1000);
  const initialDelayMs = Number(process.env.BIOMETRIC_SYNC_INITIAL_DELAY_MS ?? 60 * 1000);

  const state: SchedulerState = {
    timer: null,
    running: false,
    intervalMs,
    lastStartedAt: null,
    lastFinishedAt: null,
    nextRunAt: new Date(Date.now() + initialDelayMs),
  };
  g.__biometricScheduler = state;

  const first = setTimeout(() => {
    void tick(state);
    state.timer = setInterval(() => void tick(state), intervalMs);
    state.timer.unref?.();
  }, initialDelayMs);
  first.unref?.();

  console.log(`[biometric-sync] scheduler started: every ${intervalMs / 3600000}h, first run in ${Math.round(initialDelayMs / 1000)}s`);
}
