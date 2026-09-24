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
import { appSyncEnabled } from './appAttendanceDb';
import { runAppSync } from './appAttendanceSync';

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
    const companyId = Number(process.env.BIOMETRIC_COMPANY_ID ?? 1);

    if (biometricApiConfigured() && process.env.BIOMETRIC_SYNC_ENABLED !== 'false') {
      const outcome = await runBiometricSync({
        companyId,
        rangeStart,
        rangeEnd,
        trigger: 'scheduled',
      });
      console.log(
        `[biometric-sync] scheduled run #${outcome.runId} ${outcome.status}: fetched ${outcome.rowsFetched}, created ${outcome.daysCreated}, updated ${outcome.daysUpdated}, unchanged ${outcome.daysUnchanged}, frozen-skipped ${outcome.skippedFrozen}, unmatched ${outcome.unmatched.length}`
      );
    }

    // App-database sync runs on the same tick AFTER biometric, inside the
    // same `running` guard, so scheduled runs of the two feeds can never
    // overlap in this process. A failed app run is logged, never fatal to
    // the biometric side (which has already completed above).
    if (appSyncEnabled()) {
      try {
        const outcome = await runAppSync({
          companyId,
          rangeStart,
          rangeEnd,
          trigger: 'scheduled',
        });
        console.log(
          `[app-sync] scheduled run #${outcome.runId} ${outcome.status}: fetched ${outcome.rowsFetched}, created ${outcome.daysCreated}, updated ${outcome.daysUpdated}, unchanged ${outcome.daysUnchanged}, frozen-skipped ${outcome.skippedFrozen}, needs-review ${outcome.needsReview}, unmatched ${outcome.unmatched.length}`
        );
      } catch (err) {
        console.error('[app-sync] scheduled run crashed', err);
      }
    }
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
  if (process.env.BIOMETRIC_SYNC_ENABLED === 'false' && !appSyncEnabled()) {
    console.log('[biometric-sync] scheduler disabled by BIOMETRIC_SYNC_ENABLED=false');
    return;
  }
  if (!biometricApiConfigured() && !appSyncEnabled()) {
    console.log('[biometric-sync] scheduler not started: no attendance source configured (BIOMETRIC_API_* / ESSL_DB_*)');
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
