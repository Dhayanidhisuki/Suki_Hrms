/**
 * Covers the KYC encryption/masking/reveal contract: GET never returns real
 * PAN/Aadhaar (only masked previews), PUT encrypts before storage, and only
 * the dedicated reveal endpoint (its own permission code) returns plaintext.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee, getAdminAuth, makeRequest } from './fixtures';

let auth: Awaited<ReturnType<typeof getAdminAuth>>;
let employeeId: number;

beforeAll(async () => {
  auth = await getAdminAuth();
  ({ id: employeeId } = await createTestEmployee(auth));
});

afterAll(async () => {
  await deleteTestEmployee(employeeId);
});

describe('KYC encryption + masking + reveal', () => {
  it('stores PAN/Aadhaar encrypted, never returning plaintext from GET', async () => {
    const { PUT } = await import('@/app/api/employees/[id]/kyc/route');
    const putRes = await PUT(
      makeRequest(`http://localhost/api/employees/${employeeId}/kyc`, {
        method: 'PUT',
        auth,
        body: { panNumber: 'ABCDE1234F', aadhaarNumber: '123456789012' },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(putRes.status).toBe(200);

    const stored = await prisma.employeeKyc.findUnique({ where: { employeeId } });
    expect(stored!.panNumberEnc).not.toBeNull();
    expect(stored!.panNumberEnc).not.toContain('ABCDE1234F');
    expect(stored!.aadhaarNumberEnc).not.toContain('123456789012');

    const { GET } = await import('@/app/api/employees/[id]/kyc/route');
    const getRes = await GET(makeRequest(`http://localhost/api/employees/${employeeId}/kyc`, { auth }), {
      params: Promise.resolve({ id: String(employeeId) }),
    });
    const body = await getRes.json();
    expect(body.panNumberMasked).toBe('XXXXXX234F');
    expect(body.aadhaarNumberMasked).toBe('XXXXXXXX9012');
    expect(JSON.stringify(body)).not.toContain('ABCDE1234F');
    expect(JSON.stringify(body)).not.toContain('123456789012');
  });

  it('leaves the stored value unchanged when panNumber/aadhaarNumber are submitted empty', async () => {
    const before = await prisma.employeeKyc.findUnique({ where: { employeeId } });

    const { PUT } = await import('@/app/api/employees/[id]/kyc/route');
    await PUT(
      makeRequest(`http://localhost/api/employees/${employeeId}/kyc`, {
        method: 'PUT',
        auth,
        body: { panNumber: '', aadhaarNumber: '', pfNumber: 'PF999' },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );

    const after = await prisma.employeeKyc.findUnique({ where: { employeeId } });
    expect(after!.panNumberEnc).toBe(before!.panNumberEnc);
    expect(after!.aadhaarNumberEnc).toBe(before!.aadhaarNumberEnc);
    expect(after!.pfNumber).toBe('PF999');
  });

  it('reveal returns the real plaintext and logs an audit entry without leaking the values into it', async () => {
    const { POST } = await import('@/app/api/employees/[id]/kyc/reveal/route');
    const res = await POST(makeRequest(`http://localhost/api/employees/${employeeId}/kyc/reveal`, { method: 'POST', auth }), {
      params: Promise.resolve({ id: String(employeeId) }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.panNumber).toBe('ABCDE1234F');
    expect(body.aadhaarNumber).toBe('123456789012');

    const activity = await prisma.employeeActivity.findFirst({
      where: { employeeId, activityType: 'kyc_revealed' },
      orderBy: { id: 'desc' },
    });
    expect(activity).not.toBeNull();
    expect(activity!.newValue ?? '').not.toContain('ABCDE1234F');
    expect(activity!.remarks ?? '').not.toContain('ABCDE1234F');
  });
});
