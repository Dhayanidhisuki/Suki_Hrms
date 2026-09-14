const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign({
      userId: 5,
      isSuperAdmin: false,
      roleId: 6,
      roleCode: 'company-admin',
      companyId: 1,
    }, secret, { expiresIn: '24h' });
    console.log(token);
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();
