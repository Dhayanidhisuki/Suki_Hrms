(async () => {
  try {
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kunaero.suki.hrms', password: 'admin123' }),
    });
    const text = await loginRes.text();
    console.log('Status:', loginRes.status);
    console.log('Body:', text.slice(0, 500));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
