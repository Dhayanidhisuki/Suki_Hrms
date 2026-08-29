/**
 * Covers the only-one-primary-contact business rule, verified by hand during
 * Phase 2 (two emergency contacts both marked primary via direct API calls —
 * confirmed only the second ended up isPrimary: true). This automates that
 * check for both create and update paths.
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

describe('emergency contacts — only one primary at a time', () => {
  it('unsets the previous primary when a new contact is created as primary', async () => {
    const { POST } = await import('@/app/api/employees/[id]/emergency-contacts/route');

    const first = await POST(
      makeRequest(`http://localhost/api/employees/${employeeId}/emergency-contacts`, {
        method: 'POST',
        auth,
        body: { contactName: 'Contact One', relationship: 'Spouse', isPrimary: true },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(first.status).toBe(201);

    const second = await POST(
      makeRequest(`http://localhost/api/employees/${employeeId}/emergency-contacts`, {
        method: 'POST',
        auth,
        body: { contactName: 'Contact Two', relationship: 'Parent', isPrimary: true },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(second.status).toBe(201);

    const contacts = await prisma.employeeEmergencyContact.findMany({ where: { employeeId } });
    const primaries = contacts.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].contactName).toBe('Contact Two');
  });

  it('unsets the sibling primary when an existing contact is edited to become primary', async () => {
    const contacts = await prisma.employeeEmergencyContact.findMany({ where: { employeeId }, orderBy: { id: 'asc' } });
    const contactOne = contacts.find((c) => c.contactName === 'Contact One')!;

    const { PUT } = await import('@/app/api/employees/[id]/emergency-contacts/[recordId]/route');
    const res = await PUT(
      makeRequest(`http://localhost/api/employees/${employeeId}/emergency-contacts/${contactOne.id}`, {
        method: 'PUT',
        auth,
        body: { contactName: 'Contact One', relationship: 'Spouse', isPrimary: true },
      }),
      { params: Promise.resolve({ id: String(employeeId), recordId: String(contactOne.id) }) }
    );
    expect(res.status).toBe(200);

    const after = await prisma.employeeEmergencyContact.findMany({ where: { employeeId } });
    const primaries = after.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].contactName).toBe('Contact One');
  });
});
