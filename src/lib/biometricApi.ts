/**
 * Client for the biometric controller's HTTP API (the on-premise device
 * server, e.g. http://192.168.1.162:8080). Read-only: it fetches the daily
 * first-in / last-out rollup for a date range.
 *
 *   GET {BIOMETRIC_API_URL}/api/v1/attendance
 *       ?startDate=dd/MM/yyyy HH:mm:ss&endDate=dd/MM/yyyy HH:mm:ss
 *       &includeEvents=false&includeDaily=true
 *   header X-API-Key: {BIOMETRIC_API_KEY}
 *
 * Response: { "daily-attendance": [ { date, userid, username, firstIn, lastOut?, eventCount } ] }
 *   - date / firstIn / lastOut are dd/MM/yyyy[ HH:mm:ss] strings (never
 *     parse these with `new Date(str)` — that reads 04/09 as 9 April).
 *   - lastOut is absent when the person punched only once that day.
 *   - userid is the device enrolment ID as a string ("105", "099", "E062"),
 *     not our employee code — see resolveDeviceUser in biometricSync.ts.
 *
 * Configuration comes from env only; the key never reaches the browser.
 */

export interface DeviceDailyRow {
  date: string; // dd/MM/yyyy
  userid: string;
  username: string;
  firstIn?: string; // dd/MM/yyyy HH:mm:ss
  lastOut?: string;
  eventCount?: number;
}

export interface DevicePunch {
  /** Calendar date of the punch (UTC midnight of that day). */
  date: Date;
  /** Wall-clock punch stored via setUTCHours — same convention as DailyAttendance.inTime. */
  at: Date;
}

export interface ParsedDeviceDay {
  userid: string;
  username: string;
  date: Date; // UTC midnight of the attendance date
  firstIn: DevicePunch | null;
  lastOut: DevicePunch | null;
  eventCount: number;
}

export function biometricApiConfigured(): boolean {
  return Boolean(process.env.BIOMETRIC_API_URL && process.env.BIOMETRIC_API_KEY);
}

/** "dd/MM/yyyy[ HH:mm[:ss]]" -> punch, or null when it doesn't parse. */
export function parseDeviceDateTime(s: string | undefined | null): DevicePunch | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = '0', mi = '0'] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const at = new Date(Date.UTC(year, month - 1, day, Number(hh), Number(mi), 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return { date, at };
}

function formatDeviceDateTime(d: Date, endOfDay: boolean): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy} ${endOfDay ? '23:59:59' : '00:00:00'}`;
}

/**
 * Fetches and parses the daily rollup for [rangeStart, rangeEnd] (both UTC
 * midnight dates, inclusive). Throws on network / HTTP / shape errors so the
 * caller can record a failed run.
 */
export async function fetchDeviceDailyAttendance(rangeStart: Date, rangeEnd: Date): Promise<ParsedDeviceDay[]> {
  const base = process.env.BIOMETRIC_API_URL;
  const key = process.env.BIOMETRIC_API_KEY;
  if (!base || !key) throw new Error('BIOMETRIC_API_URL / BIOMETRIC_API_KEY are not configured');

  const url = new URL('/api/v1/attendance', base);
  url.searchParams.set('startDate', formatDeviceDateTime(rangeStart, false));
  url.searchParams.set('endDate', formatDeviceDateTime(rangeEnd, true));
  url.searchParams.set('includeEvents', 'false');
  url.searchParams.set('includeDaily', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.BIOMETRIC_API_TIMEOUT_MS ?? 30000));
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-API-Key': key, Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Device API responded ${res.status} ${res.statusText}`);

  const body = (await res.json()) as { 'daily-attendance'?: DeviceDailyRow[] };
  const rows = body['daily-attendance'];
  if (!Array.isArray(rows)) throw new Error('Device API response has no "daily-attendance" array');

  const parsed: ParsedDeviceDay[] = [];
  for (const r of rows) {
    const day = parseDeviceDateTime(r.date);
    if (!day || !r.userid) continue; // unparseable row — skipped, counted by the caller via rowsFetched vs parsed
    parsed.push({
      userid: String(r.userid).trim(),
      username: String(r.username ?? '').trim(),
      date: day.date,
      firstIn: parseDeviceDateTime(r.firstIn),
      lastOut: parseDeviceDateTime(r.lastOut),
      eventCount: Number(r.eventCount ?? 0) || 0,
    });
  }
  return parsed;
}
