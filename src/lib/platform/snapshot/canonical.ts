/**
 * Canonical JSON for the Configuration Snapshot service (BRD §19.5).
 *
 * Pure — no Prisma import — so the hash rules can be unit-tested and reused
 * by any module that wants to pre-compute a hash before calling the service.
 *
 * Rules:
 *   - object keys sorted (recursively), no whitespace;
 *   - Date       → ISO-8601 string;
 *   - Decimal    → its exact string form (never a float);
 *   - BigInt     → decimal string;
 *   - undefined / function / symbol properties are dropped (like JSON.stringify);
 *   - arrays keep their order (order is meaningful).
 */

import { createHash } from 'node:crypto';

type DecimalLike = { toFixed(): string; isFinite?: () => boolean; d?: unknown; e?: unknown; s?: unknown };

function isDecimalLike(v: unknown): v is DecimalLike {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  // decimal.js instances (Prisma.Decimal) carry d/e/s internals and toFixed.
  return typeof o.toFixed === 'function' && 'd' in o && 'e' in o && 's' in o;
}

function canonicalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (isDecimalLike(value)) return value.toFixed();
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : canonicalise(v)));
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>;
    if (typeof (src as { toJSON?: unknown }).toJSON === 'function') {
      return canonicalise((src as { toJSON: () => unknown }).toJSON());
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      const v = src[key];
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
      out[key] = canonicalise(v);
    }
    return out;
  }
  return null;
}

/** Stable key order, no whitespace; used for the SHA-256 hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

/** Hex SHA-256 over the canonical JSON of `value` (or of a pre-canonicalised string). */
export function sha256Hash(value: unknown): string {
  const text = typeof value === 'string' ? value : canonicalJson(value);
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
