/**
 * Channel gateways. There is no SMTP / SMS / push provider configured for
 * this deployment (no such keys in .env), so every external channel uses
 * ConsoleTransport, which logs the message and reports success. A real
 * gateway plugs in with setTransport('EMAIL', myTransport) at boot.
 */

import type { NotificationDelivery } from '@prisma/client';

export type DeliveryRow = NotificationDelivery;

export type TransportResult =
  | { ok: true; gatewayMessageId?: string }
  | { ok: false; permanent: boolean; code?: string; text?: string };

export interface NotificationTransport {
  send(d: DeliveryRow): Promise<TransportResult>;
}

export type ExternalChannel = 'EMAIL' | 'SMS' | 'PUSH';

export class ConsoleTransport implements NotificationTransport {
  constructor(private readonly channel: string) {}

  async send(d: DeliveryRow): Promise<TransportResult> {
    const id = `console-${this.channel.toLowerCase()}-${d.id}-${Date.now().toString(36)}`;
    console.log(
      `[notification/${this.channel}] → ${d.recipientAddressMasked ?? d.recipientAddress ?? '(no address)'} | ${d.eventCode} | ${d.renderedSubject ?? ''}`,
    );
    return { ok: true, gatewayMessageId: id };
  }
}

const transports = new Map<string, NotificationTransport>();

export function setTransport(channel: ExternalChannel | string, transport: NotificationTransport | null): void {
  if (transport) transports.set(channel, transport);
  else transports.delete(channel);
}

export function getTransport(channel: string): NotificationTransport {
  let t = transports.get(channel);
  if (!t) {
    t = new ConsoleTransport(channel);
    transports.set(channel, t);
  }
  return t;
}
