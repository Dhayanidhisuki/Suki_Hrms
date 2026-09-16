/**
 * Registers the notification service on the platform event bus. Loaded
 * lazily by src/lib/platform/events.ts on the first emitPlatformEvent();
 * this is the only coupling between the bus and this service.
 */

import { onPlatformEvent } from '../events';
import { notify } from './service';

const g = globalThis as unknown as { __notificationSubscribed?: boolean };

if (!g.__notificationSubscribed) {
  g.__notificationSubscribed = true;
  onPlatformEvent(async (companyId, eventCode, ctx) => {
    await notify(companyId, eventCode, ctx);
  });
}

export {};
