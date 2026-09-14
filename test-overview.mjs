(async () => {
  try {
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kunaero.suki.hrms', password: 'admin123' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const token = setCookie.split(';')[0];

    const res = await fetch('http://localhost:3000/api/workforce/attendance/overview?employeeId=373&year=2026&month=7', {
      headers: { Cookie: token },
    });
    const json = await res.json();
    console.log('Employee:', json.employee?.employeeCode);
    console.log('Day fields:', Object.keys(json.days?.[0] ?? {}));
    console.log('\nSample rows:');
    for (const d of (json.days ?? []).filter(d => d.status === 'Present' || d.status === 'HalfDay').slice(0, 5)) {
      console.log(`${d.date} ${d.status} in=${d.inTime?.slice(11,16)??'—'} out=${d.outTime?.slice(11,16)??'—'} work=${d.workingMinutes} late=${d.lateMinutes} early=${d.earlyOutMinutes} otRaw=${d.otMinutesCalculated} otPay=${d.otPayableMinutes} lom=${d.lomMinutes} shift=${d.shiftName}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
