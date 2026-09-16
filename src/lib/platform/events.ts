/**
 * In-process platform event bus.
 *
 * Modules and the workflow/document services *emit* events here and never
 * import the notification service, so there is no compile-time coupling
 * between services and each one can be built and shipped independently.
 * The notification service is the subscriber: it is loaded lazily on the
 * first emit, so an emit before that service exists is logged, not fatal.
 */

import type { PlatformEventContext } from './contracts';

export type PlatformEventHandler = (
  companyId: number,
  eventCode: string,
  ctx: PlatformEventContext,
) => Promise<void> | void;

const handlers = new Set<PlatformEventHandler>();
let subscriberLoaded = false;

export function onPlatformEvent(handler: PlatformEventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

async function ensureSubscribers(): Promise<void> {
  if (subscriberLoaded) return;
  subscriberLoaded = true;
  try {
    // Registers the notification service's handler via onPlatformEvent.
    // The literal path is required so the bundler includes the module.
    await import('./notification/subscriber');
  } catch (err) {
    console.warn('[platform/events] notification subscriber not available:', (err as Error).message);
  }
}

/**
 * Emit an event. Never throws: a failing handler is logged so the business
 * transaction that raised the event is not rolled back by a notification
 * problem. Await it when the caller needs the in-app row to exist before
 * responding; otherwise fire and forget.
 */
export async function emitPlatformEvent(
  companyId: number,
  eventCode: string,
  ctx: PlatformEventContext = {},
): Promise<void> {
  await ensureSubscribers();
  const results = await Promise.allSettled([...handlers].map((h) => h(companyId, eventCode, ctx)));
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error(`[platform/events] handler failed for ${eventCode}:`, r.reason);
    }
  }
}
