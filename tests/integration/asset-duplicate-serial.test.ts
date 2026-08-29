import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee, getAdminAuth, makeRequest } from './fixtures';

let auth: Awaited<ReturnType<typeof getAdminAuth>>;
let employeeA: number;
let employeeB: number;
let assetMasterId: number;

beforeAll(async () => {
  auth = await getAdminAuth();
  ({ id: employeeA } = await createTestEmployee(auth));
  ({ id: employeeB } = await createTestEmployee(auth));

  const asset = await prisma.assetMaster.upsert({
    where: { code: 'TEST-AUTO-LAPTOP' },
    update: {},
    create: { code: 'TEST-AUTO-LAPTOP', name: 'Test Laptop (automated fixture)' },
  });
  assetMasterId = asset.id;
});

afterAll(async () => {
  await deleteTestEmployee(employeeA);
  await deleteTestEmployee(employeeB);
  await prisma.assetMaster.delete({ where: { id: assetMasterId } });
});

describe('POST /api/employees/[id]/assets — duplicate serial guard', () => {
  it('allocates a serial number to the first employee', async () => {
    const { POST } = await import('@/app/api/employees/[id]/assets/route');
    const res = await POST(
      makeRequest(`http://localhost/api/employees/${employeeA}/assets`, {
        method: 'POST',
        auth,
        body: { assetMasterId, serialNumber: 'SN-DUP-TEST', allocatedDate: '2026-01-01' },
      }),
      { params: Promise.resolve({ id: String(employeeA) }) }
    );
    expect(res.status).toBe(201);
  });

  it('rejects allocating the same active serial number to a second employee', async () => {
    const { POST } = await import('@/app/api/employees/[id]/assets/route');
    const res = await POST(
      makeRequest(`http://localhost/api/employees/${employeeB}/assets`, {
        method: 'POST',
        auth,
        body: { assetMasterId, serialNumber: 'SN-DUP-TEST', allocatedDate: '2026-01-02' },
      }),
      { params: Promise.resolve({ id: String(employeeB) }) }
    );
    expect(res.status).toBe(409);
  });

  it('allows the serial number to be re-allocated once returned', async () => {
    const active = await prisma.employeeAssetAllocation.findFirst({
      where: { employeeId: employeeA, serialNumber: 'SN-DUP-TEST' },
    });
    const { PUT } = await import('@/app/api/employees/[id]/assets/[recordId]/route');
    const returnRes = await PUT(
      makeRequest(`http://localhost/api/employees/${employeeA}/assets/${active!.id}`, {
        method: 'PUT',
        auth,
        body: { assetMasterId, serialNumber: 'SN-DUP-TEST', allocatedDate: '2026-01-01', returnedDate: '2026-01-10' },
      }),
      { params: Promise.resolve({ id: String(employeeA), recordId: String(active!.id) }) }
    );
    expect(returnRes.status).toBe(200);

    const { POST } = await import('@/app/api/employees/[id]/assets/route');
    const res = await POST(
      makeRequest(`http://localhost/api/employees/${employeeB}/assets`, {
        method: 'POST',
        auth,
        body: { assetMasterId, serialNumber: 'SN-DUP-TEST', allocatedDate: '2026-01-11' },
      }),
      { params: Promise.resolve({ id: String(employeeB) }) }
    );
    expect(res.status).toBe(201);
  });
});
