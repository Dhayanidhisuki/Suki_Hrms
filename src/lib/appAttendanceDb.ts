/**
 * Read-only client for the mobile app's attendance database (a separate
 * SQL Server, NOT the HRMS database — a dedicated `mssql` pool, never the
 * Prisma client, and never any write or DDL against it).
 *
 * Confirmed against the ERPDB_SUKISOFT schema script: the app punches live
 * in one table —
 *
 *   dbo.OD_ATTENDANCE_ENTRY  app punches (APPROVAL_STATUS, DUTY_MODE and
 *                            KM readings exist but are ignored here)
 *
 * Columns read:
 *   ROW_ID            unique record id (kept as sourceRowId for traceability)
 *   EMP_ID            numeric ERP employee key — resolved through
 *                     dbo.EMPLOYEE (EMP_ID = EMPLOYEE.EMP_CD) to OLDEMP_CD,
 *                     which is matched to Employee.oldEmployeeCode with the
 *                     same normalisation the biometric feed uses
 *                     ('E049' → '49' matches oldEmployeeCode '049')
 *   ATT_DT            working date the punch is assigned to
 *   ATT_IN_TIME /     real datetime punches — read with useUTC so the stored
 *   ATT_OUT_TIME      wall-clock lands in the UTC getters, matching the
 *                     DailyAttendance wall-clock convention. ATT_OUT_TIME may
 *                     legitimately fall on the next calendar day (overnight).
 *   LAT_LONG_IN /     combined "lat,long" strings captured with each punch;
 *   LAT_LONG_OUT      split and range-validated — bad GPS never kills a punch
 *
 * Multiple rows can exist for one employee/day (e.g. several OD trips) —
 * they are rolled up here to earliest IN / latest OUT, which is exactly
 * what the merge service expects as the "app" contribution. There is no
 * update timestamp on these tables: corrections update the row in place,
 * so re-reading the current state is always correct.
 *
 * NOTE: dbo.ESSL_ATTENDANCE_LOG is deliberately NOT read — its
 * ATTENDANCE_TYPE holds day-status codes (P/A/WO/CL/H/SP/C_OFF) and it is
 * the ERP's processed rollup, not a punch source.
 *
 * Env (all server-side only):
 *   ESSL_DB_SERVER, ESSL_DB_PORT (default 1433), ESSL_DB_NAME,
 *   ESSL_DB_USER, ESSL_DB_PASSWORD        — read-only login
 *   ESSL_DB_ENCRYPT (default true), ESSL_DB_TRUST_CERT (default false)
 *   ESSL_SYNC_ENABLED=true turns the whole integration on (default off)
 */

import sql from 'mssql';

export function appDbConfigured(): boolean {
  return Boolean(
    process.env.ESSL_DB_SERVER && process.env.ESSL_DB_NAME && process.env.ESSL_DB_USER && process.env.ESSL_DB_PASSWORD
  );
}

export function appSyncEnabled(): boolean {
  return process.env.ESSL_SYNC_ENABLED === 'true' && appDbConfigured();
}

/** The app punch table — confirmed against the ERPDB_SUKISOFT script. */
const TABLES = [{ tag: 'OD', name: 'dbo.OD_ATTENDANCE_ENTRY' }] as const;

const g = globalThis as unknown as { __esslPool?: sql.ConnectionPool; __esslPoolPromise?: Promise<sql.ConnectionPool> };

async function getPool(): Promise<sql.ConnectionPool> {
  if (g.__esslPool?.connected) return g.__esslPool;
  if (g.__esslPoolPromise) return g.__esslPoolPromise;

  const config: sql.config = {
    server: process.env.ESSL_DB_SERVER!,
    port: Number(process.env.ESSL_DB_PORT ?? 1433),
    database: process.env.ESSL_DB_NAME!,
    user: process.env.ESSL_DB_USER!,
    password: process.env.ESSL_DB_PASSWORD!,
    options: {
      encrypt: process.env.ESSL_DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.ESSL_DB_TRUST_CERT === 'true',
      // Stored datetimes are workplace wall-clock; reading them as UTC keeps
      // the wall-clock components in the UTC getters — the convention
      // DailyAttendance already uses.
      useUTC: true,
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 60000 },
    connectionTimeout: Number(process.env.ESSL_DB_TIMEOUT_MS ?? 15000),
    requestTimeout: Number(process.env.ESSL_DB_QUERY_TIMEOUT_MS ?? 60000),
  };

  g.__esslPoolPromise = new sql.ConnectionPool(config)
    .connect()
    .then((pool) => {
      g.__esslPool = pool;
      g.__esslPoolPromise = undefined;
      return pool;
    })
    .catch((err) => {
      g.__esslPoolPromise = undefined;
      throw err;
    });
  return g.__esslPoolPromise;
}

export interface AppDayRow {
  /** Source EMP_ID as reported — matched to an employee by the caller. */
  empCd: string;
  /** Working date (ATT_DT) at UTC midnight — DailyAttendance.date convention. */
  date: Date;
  inTime: Date | null;
  outTime: Date | null;
  inLatitude: number | null;
  inLongitude: number | null;
  outLatitude: number | null;
  outLongitude: number | null;
  /** ROW_ID(s) that supplied the winning punches, comma-joined. */
  rowId: string | null;
  /** Which app table(s) contributed: 'REG', 'OD', or 'REG+OD'. */
  attendanceType: string | null;
  refreshDate: Date | null; // always null — punch tables have no update ts
}

/** GPS coordinate must be finite and in range; anything else is dropped, never fatal. */
function parseCoord(raw: unknown, kind: 'lat' | 'lon'): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  const limit = kind === 'lat' ? 90 : 180;
  return Math.abs(v) <= limit ? v : null;
}

/** "lat,long" combined string → validated pair. */
function parseLatLong(raw: unknown): { lat: number | null; lon: number | null } {
  if (typeof raw !== 'string' || !raw.trim()) return { lat: null, lon: null };
  const parts = raw.split(',');
  return {
    lat: parseCoord(parts[0]?.trim(), 'lat'),
    lon: parseCoord(parts[1]?.trim(), 'lon'),
  };
}

/**
 * Punch datetime → Date truncated to whole minutes. With useUTC the stored
 * wall-clock already sits in the UTC components, so the Date is used as-is;
 * ATT_OUT_TIME may be on the following day for overnight duty.
 */
function parsePunch(raw: unknown): Date | null {
  if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) return null;
  const d = new Date(raw);
  d.setUTCSeconds(0, 0);
  return d;
}

/**
 * Fetches app punches for [rangeStart, rangeEnd] (UTC midnights, inclusive)
 * from both app tables and rolls them up to one row per (EMP_ID, ATT_DT):
 * earliest IN, latest OUT, GPS and ROW_ID from the row that supplied each
 * winning punch. Throws on connection/query failure: the caller must treat
 * that as "source unavailable", never as "no attendance".
 */
export async function fetchAppAttendance(rangeStart: Date, rangeEnd: Date): Promise<AppDayRow[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input('from', sql.Date, rangeStart);
  // rangeEnd is inclusive in the sync contract — the query bound is exclusive.
  const to = new Date(rangeEnd);
  to.setUTCDate(to.getUTCDate() + 1);
  request.input('to', sql.Date, to);

  const union = TABLES.map(
    (t) => `
    SELECT '${t.tag}' AS src, p.ROW_ID AS rowId, p.EMP_ID AS empId,
           e.OLDEMP_CD AS oldEmpCd, p.ATT_DT AS attDate,
           p.ATT_IN_TIME AS inTime, p.ATT_OUT_TIME AS outTime,
           p.LAT_LONG_IN AS inLatLong, p.LAT_LONG_OUT AS outLatLong
    FROM ${t.name} p
    LEFT JOIN dbo.EMPLOYEE e ON e.EMP_CD = p.EMP_ID
    WHERE p.ATT_DT >= @from AND p.ATT_DT < @to`
  ).join('\n    UNION ALL\n');

  const result = await request.query(`${union}\n    ORDER BY empId, attDate, rowId`);

  interface DayAcc extends AppDayRow {
    srcs: Set<string>;
    rowIds: string[];
  }
  const byDay = new Map<string, DayAcc>();
  for (const r of result.recordset as Array<Record<string, unknown>>) {
    const rawDate = r.attDate;
    if (!(rawDate instanceof Date)) continue;
    const date = new Date(Date.UTC(rawDate.getUTCFullYear(), rawDate.getUTCMonth(), rawDate.getUTCDate()));
    // Prefer the ERP's OLDEMP_CD ('E049' → '49' after normalisation, matching
    // HRMS oldEmployeeCode); fall back to the raw EMP_ID when unmapped.
    const oldCd = typeof r.oldEmpCd === 'string' ? r.oldEmpCd.trim() : '';
    const empCd = oldCd || (r.empId === null || r.empId === undefined ? '' : String(r.empId).trim());
    if (!empCd) continue;
    const key = `${empCd}|${date.toISOString().slice(0, 10)}`;

    const acc =
      byDay.get(key) ??
      ({
        empCd,
        date,
        inTime: null,
        outTime: null,
        inLatitude: null,
        inLongitude: null,
        outLatitude: null,
        outLongitude: null,
        rowId: null,
        attendanceType: null,
        refreshDate: null,
        srcs: new Set<string>(),
        rowIds: [],
      } satisfies DayAcc);
    byDay.set(key, acc);

    const inTime = parsePunch(r.inTime);
    const outTime = parsePunch(r.outTime);
    const inLL = parseLatLong(r.inLatLong);
    const outLL = parseLatLong(r.outLatLong);

    // Earliest IN wins; its GPS belongs to that exact punch.
    if (inTime && (!acc.inTime || inTime < acc.inTime)) {
      acc.inTime = inTime;
      acc.inLatitude = inLL.lat;
      acc.inLongitude = inLL.lon;
    }
    // Latest OUT wins — may cross midnight, the full datetime is compared.
    if (outTime && (!acc.outTime || outTime > acc.outTime)) {
      acc.outTime = outTime;
      acc.outLatitude = outLL.lat;
      acc.outLongitude = outLL.lon;
    }

    acc.srcs.add(String(r.src ?? 'REG'));
    if (r.rowId !== null && r.rowId !== undefined) acc.rowIds.push(String(r.rowId));
  }

  for (const acc of byDay.values()) {
    acc.rowId = acc.rowIds.join(',');
    acc.attendanceType = Array.from(acc.srcs).sort().join('+');
    delete (acc as { srcs?: Set<string> }).srcs;
    delete (acc as { rowIds?: string[] }).rowIds;
  }
  return Array.from(byDay.values());
}

/** One round-trip connectivity probe for the "test" endpoint — no writes. */
export async function testAppDbConnection(): Promise<{ ok: boolean; ms: number; rows?: number; error?: string }> {
  if (!appDbConfigured()) {
    return { ok: false, ms: 0, error: 'ESSL_DB_* connection settings are not configured' };
  }
  const started = Date.now();
  try {
    const pool = await getPool();
    const counts = await Promise.all(
      TABLES.map(async (t) => {
        const r = await pool.request().query(`SELECT COUNT(1) AS n FROM ${t.name}`);
        return Number(r.recordset?.[0]?.n ?? 0);
      })
    );
    return { ok: true, ms: Date.now() - started, rows: counts.reduce((a, b) => a + b, 0) };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}
