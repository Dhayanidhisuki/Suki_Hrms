/**
 * Basic failed-login logging + simple in-memory rate limit.
 * Not a distributed limiter — adequate for Phase 2 internal tool use.
 */

type AttemptBucket = { count: number; resetAt: number };

const failedByKey = new Map<string, AttemptBucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function clientKey(ip: string | null, username: string): string {
  return `${ip ?? "unknown"}:${username.toLowerCase()}`;
}

export function isLoginRateLimited(ip: string | null, username: string): boolean {
  const key = clientKey(ip, username);
  const now = Date.now();
  const bucket = failedByKey.get(key);
  if (!bucket) return false;
  if (now >= bucket.resetAt) {
    failedByKey.delete(key);
    return false;
  }
  return bucket.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(ip: string | null, username: string): void {
  const key = clientKey(ip, username);
  const now = Date.now();
  const bucket = failedByKey.get(key);
  if (!bucket || now >= bucket.resetAt) {
    failedByKey.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    bucket.count += 1;
  }

  const count = failedByKey.get(key)?.count ?? 1;
  console.warn(
    `[auth] failed login attempt username="${username}" ip="${ip ?? "unknown"}" count=${count}`
  );
}

export function clearFailedLogins(ip: string | null, username: string): void {
  failedByKey.delete(clientKey(ip, username));
}
