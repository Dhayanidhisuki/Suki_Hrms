(async () => {
  try {
    // Login
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kunaero.suki.hrms', password: 'admin123' }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token;
    if (!token) { console.error('No token from login'); process.exit(1); }

    // Fetch daily attendance for 2026-07-16
    const res = await fetch('http://localhost:3000/api/workforce/attendance/daily?date=2026-07-16', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    console.log(`Records: ${json.data?.length ?? 0}`);
    console.log(`OT Plan: ${JSON.stringify(json.otPlan)}`);
    console.log(`LOM Config: ${JSON.stringify(json.lomConfig)}`);
    console.log('');
    for (const d of (json.data ?? [])) {
      console.log(`${d.employee.employeeCode} shift=${d.shiftMaster?.code ?? '—'} late=${d.lateMinutes} early=${d.earlyOutMinutes} lom=${d.lomMinutes} otRaw=${d.otMinutesCalculated} otPay=${d.otPayableMinutes}`);
    }

    // Fetch time-office-final
    console.log('\n=== Time Office Final ===');
    const res2 = await fetch('http://localhost:3000/api/workforce/attendance/time-office-final?year=2026&month=7', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json2 = await res2.json();
    for (const r of (json2.data ?? [])) {
      console.log(`${r.employeeCode} otHrs=${r.otHours} otPayHrs=${r.otPayableHours} lomMin=${r.lomMinutes} late=${r.lateMinutes} early=${r.earlyOutMinutes}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
