// One-off connectivity + shape probe for the app attendance DB.
// Run: node --env-file=.env scripts/test-appdb.mjs  (or with env vars set)
import sql from 'mssql';

const config = {
  server: process.env.ESSL_DB_SERVER,
  port: Number(process.env.ESSL_DB_PORT ?? 1433),
  database: process.env.ESSL_DB_NAME,
  user: process.env.ESSL_DB_USER,
  password: process.env.ESSL_DB_PASSWORD,
  options: {
    encrypt: process.env.ESSL_DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.ESSL_DB_TRUST_CERT === 'true',
    useUTC: true,
  },
  connectionTimeout: 10000,
};

const pool = await new sql.ConnectionPool(config).connect();
console.log('connected');

// Same rollup the reader performs
const r = await pool.request().query(`
  SELECT p.ROW_ID AS rowId, p.EMP_ID AS empId, e.OLDEMP_CD AS oldEmpCd,
         p.ATT_DT AS attDate, p.ATT_IN_TIME AS inTime, p.ATT_OUT_TIME AS outTime,
         p.LAT_LONG_IN AS inLatLong, p.LAT_LONG_OUT AS outLatLong
  FROM dbo.OD_ATTENDANCE_ENTRY p
  LEFT JOIN dbo.EMPLOYEE e ON e.EMP_CD = p.EMP_ID
  WHERE p.ATT_DT >= '2026-09-23' AND p.ATT_DT < '2026-09-25'
  ORDER BY p.EMP_ID, p.ATT_DT, p.ROW_ID
`);
console.log('rows:', r.recordset.length);
for (const row of r.recordset.slice(0, 8)) {
  console.log(
    `${row.empId} (${row.oldEmpCd ?? '?'}) ${row.attDate?.toISOString().slice(0, 10)}`,
    `in=${row.inTime?.toISOString() ?? '-'} out=${row.outTime?.toISOString() ?? '-'}`,
    `gps=${row.inLatLong ?? '-'}`
  );
}

// Unmapped check: app EMP_IDs with no EMPLOYEE row
const unm = await pool.request().query(`
  SELECT DISTINCT p.EMP_ID FROM dbo.OD_ATTENDANCE_ENTRY p
  LEFT JOIN dbo.EMPLOYEE e ON e.EMP_CD = p.EMP_ID
  WHERE e.EMP_CD IS NULL
`);
console.log('EMP_IDs with no EMPLOYEE row:', unm.recordset.map((x) => x.EMP_ID));

await pool.close();
process.exit(0);
