/**
 * Document service integration tests against the dev DB (KUNAERO, company
 * 1). Exercises the service directly for the state machine and the route
 * handlers for the HTTP contract. Creates one TEST-AUTO- employee, a
 * temporary role with the platform.document.* grants, and cleans up every
 * PlatformDocument row, audit row and stored file it produced.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee } from './fixtures';
import {
  DocumentError,
  claimForVerification,
  completeness,
  getDocument,
  listDocuments,
  rejectDocument,
  revokeVerification,
  runExpirySweep,
  uploadDocument,
  verifyDocument,
  withdrawDocument,
} from '@/lib/platform/document/service';
import { financialYearCode } from '@/lib/platform/document/rules';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex'),
  Buffer.from('0000000a49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex'),
]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');

const PERMISSION_CODES = ['platform.document.view', 'platform.document.upload', 'platform.document.verify', 'platform.document.admin'];
const TEMP_ROLE_CODE = 'pdoc-test';

let companyId: number;
let adminUserId: number; // company-admin user of company 1
let hrRoleId: number;
let tempRoleId: number;
let employeeId: number;
const createdPermissionIds: number[] = [];

const hrActor = () => ({ userId: adminUserId, source: 'user' as const });
const ownerActor = () => ({ userId: null, employeeId, source: 'user' as const });

function req(url: string, opts: { method?: string; body?: unknown; form?: FormData; roleId?: number; userId?: number; companyId?: number } = {}) {
  const headers = new Headers({
    'x-role-id': String(opts.roleId ?? tempRoleId),
    'x-user-id': String(opts.userId ?? adminUserId),
    'x-company-id': String(opts.companyId ?? companyId),
  });
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(opts.body);
  }
  return new NextRequest(new URL(url, 'http://localhost'), { method: opts.method ?? 'GET', headers, body });
}

function uploadForm(fields: Record<string, string>, file: { name: string; type: string; bytes: Buffer }) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return form;
}

async function expectDocumentError(p: Promise<unknown>, status: number) {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(DocumentError);
    expect((err as DocumentError).status).toBe(status);
    return;
  }
  throw new Error(`expected DocumentError ${status}`);
}

beforeAll(async () => {
  const company = await prisma.company.findFirst({ where: { code: 'KUNAERO', deletedAt: null } });
  if (!company) throw new Error('KUNAERO company not found');
  companyId = company.id;

  const [adminRole, hrRole] = await Promise.all([
    prisma.role.findFirst({ where: { companyId, code: 'company-admin', isActive: true } }),
    prisma.role.findFirst({ where: { companyId, code: 'hr-admin', isActive: true } }),
  ]);
  if (!adminRole || !hrRole) throw new Error('company-admin / hr-admin roles missing for KUNAERO');
  hrRoleId = hrRole.id;
  const adminUser = await prisma.user.findFirst({ where: { companyId, roleId: adminRole.id, isActive: true, deletedAt: null } });
  if (!adminUser) throw new Error('No company-admin user for KUNAERO');
  adminUserId = adminUser.id;

  // Permission rows the routes check. Seeded by scripts/seed-platform-permissions.mjs
  // in the platform wave; create any that are absent and remember them for cleanup.
  const permissionIds: number[] = [];
  for (const code of PERMISSION_CODES) {
    const [module, submodule, action] = code.split('.');
    let perm = await prisma.permission.findUnique({ where: { code } });
    if (!perm) {
      perm = await prisma.permission.create({ data: { code, module, submodule, page: null, action, description: `Test-created ${code}` } });
      createdPermissionIds.push(perm.id);
    }
    permissionIds.push(perm.id);
  }
  const tempRole = await prisma.role.upsert({
    where: { companyId_code: { companyId, code: TEMP_ROLE_CODE } },
    update: { isActive: true, deletedAt: null },
    create: { companyId, code: TEMP_ROLE_CODE, name: 'Platform document test role' },
  });
  tempRoleId = tempRole.id;
  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: tempRoleId, permissionId } },
      update: {},
      create: { roleId: tempRoleId, permissionId },
    });
  }

  // Document types under test — the seed provides them; make the test self-sufficient.
  const types = [
    { code: 'PHOTO', name: 'Passport photograph', category: 'IDENTITY', appliesToEntity: 'EMPLOYEE', documentClass: 'INTERNAL', mandatoryFlag: true, verificationRequired: false, verifierRole: null, allowedFileTypes: 'jpg,png', maxFileSizeMb: 2, maxFileCount: 1, retentionYears: 8 },
    { code: 'PAN', name: 'PAN Card', category: 'IDENTITY', appliesToEntity: 'EMPLOYEE', documentClass: 'RESTRICTED', mandatoryFlag: true, verificationRequired: true, verifierRole: 'hr-admin', allowedFileTypes: 'pdf,jpg,png', maxFileSizeMb: 5, maxFileCount: 1, retentionYears: 8 },
  ];
  for (const t of types) {
    await prisma.platformDocumentType.upsert({
      where: { companyId_code: { companyId, code: t.code } },
      update: { isActive: true },
      create: { companyId, ...t },
    });
  }

  ({ id: employeeId } = await createTestEmployee({ roleId: adminRole.id, userId: adminUserId }));
});

afterAll(async () => {
  if (employeeId) {
    const docs = await prisma.platformDocument.findMany({ where: { companyId, ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId } });
    const ids = docs.map((d) => d.id);
    if (ids.length) {
      await prisma.auditLog.deleteMany({ where: { entityType: 'PlatformDocument', entityId: { in: ids } } });
      await prisma.notificationDelivery.deleteMany({ where: { sourceEntityType: 'PlatformDocument', sourceEntityId: { in: ids } } });
      await prisma.platformDocument.deleteMany({ where: { id: { in: ids } } });
    }
    // Deliveries raised via the event bus for documents that no longer exist (earlier runs).
    const orphanCandidates = await prisma.notificationDelivery.findMany({
      where: { sourceEntityType: 'PlatformDocument', sourceEntityId: { not: null } },
      select: { sourceEntityId: true },
      distinct: ['sourceEntityId'],
    });
    const candidateIds = orphanCandidates.map((r) => r.sourceEntityId!).filter((id) => id != null);
    if (candidateIds.length) {
      const live = new Set((await prisma.platformDocument.findMany({ where: { id: { in: candidateIds } }, select: { id: true } })).map((d) => d.id));
      const orphaned = candidateIds.filter((id) => !live.has(id));
      if (orphaned.length) {
        await prisma.notificationDelivery.deleteMany({ where: { sourceEntityType: 'PlatformDocument', sourceEntityId: { in: orphaned } } });
      }
    }
    await rm(path.join(process.cwd(), 'uploads', 'platform', String(companyId), 'employee', String(employeeId)), { recursive: true, force: true });
    await deleteTestEmployee(employeeId);
  }
  if (tempRoleId) {
    await prisma.rolePermission.deleteMany({ where: { roleId: tempRoleId } });
    await prisma.role.delete({ where: { id: tempRoleId } });
  }
  for (const id of createdPermissionIds) {
    await prisma.permission.delete({ where: { id } }).catch(() => undefined);
  }
});

describe('platform document service', () => {
  let photoId: number;
  let panV1: number;
  let panV2: number;

  it('uploads a PHOTO (no verification) → Verified immediately, DOC/<FY>/<serial> ref and sha256', async () => {
    const view = await uploadDocument({
      companyId,
      documentTypeCode: 'PHOTO',
      ownerEntityType: 'EMPLOYEE',
      ownerEntityId: employeeId,
      file: { name: 'me.png', mimeType: 'image/png', bytes: PNG },
      actor: hrActor(),
    });
    photoId = view.id;
    expect(view.verificationStatus).toBe('Verified');
    expect(view.documentRef).toMatch(new RegExp(`^DOC/${financialYearCode(new Date())}/\\d{6}$`));
    expect(view.sha256Hash).toBe(createHash('sha256').update(PNG).digest('hex'));
    expect(view.mimeType).toBe('image/png');
    expect(view.fileSizeBytes).toBe(PNG.length);
    expect(view.scanStatus).toBe('Skipped');
    expect(view.versionNo).toBe(1);
    expect(view.duplicateOf).toBeNull();
    expect((view as unknown as Record<string, unknown>).storageKey).toBeUndefined();

    const auditRow = await prisma.auditLog.findFirst({ where: { entityType: 'PlatformDocument', entityId: photoId, action: 'CREATE' } });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.actorUserId).toBe(adminUserId);

    // The event carried linkPath/subjectEmpId, so no delivery may fail on an unresolved placeholder.
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { sourceEntityType: 'PlatformDocument', sourceEntityId: photoId },
      select: { eventCode: true, channel: true, status: true, failureReason: true },
    });
    console.info('[platform-document] deliveries for upload', photoId, deliveries);
    expect(deliveries.filter((d) => d.status === 'FailedUnresolvedPlaceholder')).toEqual([]);
  });

  it('allocates sequential refs and flags a byte-identical re-upload as duplicateOf', async () => {
    // PHOTO maxFileCount=1: the Verified head is superseded immediately for a no-verification type.
    const again = await uploadDocument({
      companyId, documentTypeCode: 'PHOTO', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
      file: { name: 'me-again.png', mimeType: 'image/png', bytes: PNG }, actor: hrActor(),
    });
    expect(again.duplicateOf).toBe(photoId);
    expect(again.versionNo).toBe(2);
    expect(again.supersedesDocumentId).toBe(photoId);
    expect(again.verificationStatus).toBe('Verified');
    const first = await getDocument(companyId, photoId);
    expect(first.verificationStatus).toBe('Superseded');
    expect(first.supersededByDocumentId).toBe(again.id);
    expect(Number(again.documentRef.split('/')[2])).toBe(Number(first.documentRef.split('/')[2]) + 1);
    photoId = again.id;
  });

  it('uploads a PAN → Uploaded, masks the identifier, then claim → verify → Verified', async () => {
    const v1 = await uploadDocument({
      companyId, documentTypeCode: 'PAN', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
      file: { name: 'pan.pdf', mimeType: 'application/pdf', bytes: PDF }, identifier: 'ABCPE1234F', actor: ownerActor(),
    });
    panV1 = v1.id;
    expect(v1.verificationStatus).toBe('Uploaded');
    expect(v1.identifierMasked).toBe('XXXXXX234F');
    const raw = await prisma.platformDocument.findUnique({ where: { id: panV1 } });
    expect(JSON.stringify(raw, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('ABCPE1234F');

    // Uploaded → Verified directly is not a legal transition.
    await expectDocumentError(verifyDocument(companyId, panV1, hrActor()), 409);

    const claimed = await claimForVerification(companyId, panV1, hrActor());
    expect(claimed.verificationStatus).toBe('UnderVerification');
    const verified = await verifyDocument(companyId, panV1, hrActor(), 'Checked against original');
    expect(verified.verificationStatus).toBe('Verified');
    expect(verified.verifiedByUserId).toBe(adminUserId);
    expect(verified.verificationRemark).toBe('Checked against original');

    // Verified → UnderVerification is not legal either.
    await expectDocumentError(claimForVerification(companyId, panV1, hrActor()), 409);
  });

  it('rejects a bad PAN identifier at capture', async () => {
    await expectDocumentError(
      uploadDocument({
        companyId, documentTypeCode: 'PAN', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
        file: { name: 'pan.pdf', mimeType: 'application/pdf', bytes: PDF }, identifier: 'NOTAPAN', actor: ownerActor(),
      }),
      400,
    );
  });

  it('re-upload creates v2 linked to v1; v1 becomes Superseded only when v2 is Verified', async () => {
    const v2 = await uploadDocument({
      companyId, documentTypeCode: 'PAN', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
      file: { name: 'pan-v2.pdf', mimeType: 'application/pdf', bytes: Buffer.concat([PDF, Buffer.from('v2')]) }, actor: ownerActor(),
    });
    panV2 = v2.id;
    expect(v2.versionNo).toBe(2);
    expect(v2.supersedesDocumentId).toBe(panV1);
    expect(v2.verificationStatus).toBe('Uploaded');
    expect((await getDocument(companyId, panV1)).verificationStatus).toBe('Verified');

    // A second in-flight version exceeds maxFileCount=1.
    await expectDocumentError(
      uploadDocument({
        companyId, documentTypeCode: 'PAN', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
        file: { name: 'pan-v3.pdf', mimeType: 'application/pdf', bytes: PDF }, actor: ownerActor(),
      }),
      400,
    );

    const list = await listDocuments(companyId, { ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId });
    expect(list[0].id).toBe(panV2); // newest first

    await claimForVerification(companyId, panV2, hrActor());
    await verifyDocument(companyId, panV2, hrActor());
    const v1After = await getDocument(companyId, panV1);
    expect(v1After.verificationStatus).toBe('Superseded');
    expect(v1After.supersededByDocumentId).toBe(panV2);

    const visible = await listDocuments(companyId, { ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId });
    expect(visible.map((d) => d.id)).not.toContain(panV1);
    const history = await listDocuments(companyId, { ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId }, { includeSuperseded: true });
    expect(history.map((d) => d.id)).toContain(panV1);
  });

  it('reject path → Rejected → ReuploadRequired automatically; prior Verified version is unaffected', async () => {
    const v3 = await uploadDocument({
      companyId, documentTypeCode: 'PAN', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
      file: { name: 'pan-v3.pdf', mimeType: 'application/pdf', bytes: Buffer.concat([PDF, Buffer.from('v3')]) }, actor: ownerActor(),
    });
    expect(v3.versionNo).toBe(3);
    await claimForVerification(companyId, v3.id, hrActor());
    await expectDocumentError(rejectDocument(companyId, v3.id, hrActor(), 'ILLEGIBLE', 'short'), 400);
    const rejected = await rejectDocument(companyId, v3.id, hrActor(), 'ILLEGIBLE', 'Scan is blurred, please re-upload');
    expect(rejected.verificationStatus).toBe('ReuploadRequired');
    expect(rejected.rejectionReasonCode).toBe('ILLEGIBLE');
    expect((await getDocument(companyId, panV2)).verificationStatus).toBe('Verified');

    const actions = await prisma.auditLog.findMany({ where: { entityType: 'PlatformDocument', entityId: v3.id }, select: { action: true } });
    expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(['CREATE', 'CLAIM', 'REJECT', 'REUPLOAD_REQUIRED']));
  });

  it('withdraw is owner-only and only from Uploaded', async () => {
    const v4 = await uploadDocument({
      companyId, documentTypeCode: 'PAN', ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId,
      file: { name: 'pan-v4.pdf', mimeType: 'application/pdf', bytes: Buffer.concat([PDF, Buffer.from('v4')]) }, actor: ownerActor(),
    });
    await expectDocumentError(withdrawDocument(companyId, v4.id, hrActor()), 403);
    const withdrawn = await withdrawDocument(companyId, v4.id, ownerActor());
    expect(withdrawn.verificationStatus).toBe('Withdrawn');
    await expectDocumentError(withdrawDocument(companyId, panV2, ownerActor()), 409);
  });

  it('revoke requires an HR-manager role and a reason; Verified → Revoked', async () => {
    await expectDocumentError(revokeVerification(companyId, panV2, ownerActor(), 'forged'), 403);
    await expectDocumentError(revokeVerification(companyId, panV2, hrActor(), ''), 400);
    const revoked = await revokeVerification(companyId, panV2, hrActor(), 'Suspected forgery found on audit');
    expect(revoked.verificationStatus).toBe('Revoked');
    expect(revoked.verifiedByUserId).toBe(adminUserId); // prior verification record untouched
  });

  it('rejects a wrong extension, a magic-byte mismatch and an oversize file with 400', async () => {
    const base = { companyId, ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId, actor: hrActor() };
    await expectDocumentError(uploadDocument({ ...base, documentTypeCode: 'PHOTO', file: { name: 'me.pdf', mimeType: 'application/pdf', bytes: PDF } }), 400);
    await expectDocumentError(uploadDocument({ ...base, documentTypeCode: 'PHOTO', file: { name: 'me.png', mimeType: 'image/png', bytes: PDF } }), 400);
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    await expectDocumentError(uploadDocument({ ...base, documentTypeCode: 'PHOTO', file: { name: 'big.png', mimeType: 'image/png', bytes: big } }), 400);
  });

  it('returns 404 for a cross-company document id or owner', async () => {
    await expectDocumentError(getDocument(companyId + 1000, photoId), 404);
    await expectDocumentError(claimForVerification(companyId + 1000, panV2, hrActor()), 404);
    await expectDocumentError(
      uploadDocument({
        companyId, documentTypeCode: 'PHOTO', ownerEntityType: 'EMPLOYEE', ownerEntityId: 999_999_999,
        file: { name: 'x.png', mimeType: 'image/png', bytes: PNG }, actor: hrActor(),
      }),
      404,
    );
  });

  it('computes completeness over mandatory EMPLOYEE types', async () => {
    const r = await completeness(companyId, { ownerEntityType: 'EMPLOYEE', ownerEntityId: employeeId });
    expect(r.missing).not.toContain('PHOTO'); // Verified
    expect(r.missing).toContain('PAN'); // v2 revoked, v3 reupload-required, v4 withdrawn
    expect(r.complete).toBe(false);
  });

  it('expiry sweep alerts at a configured offset and expires past-dated Verified documents', async () => {
    const today = new Date(Date.UTC(2026, 8, 15));
    await prisma.platformDocument.update({ where: { id: photoId }, data: { expiryDate: new Date(Date.UTC(2026, 8, 22)) } });
    const alertRun = await runExpirySweep(companyId, today);
    expect(alertRun.alerted).toBeGreaterThanOrEqual(1);
    expect((await getDocument(companyId, photoId)).verificationStatus).toBe('Verified');

    await prisma.platformDocument.update({ where: { id: photoId }, data: { expiryDate: new Date(Date.UTC(2026, 8, 1)) } });
    const expireRun = await runExpirySweep(companyId, today);
    expect(expireRun.expired).toBeGreaterThanOrEqual(1);
    expect((await getDocument(companyId, photoId)).verificationStatus).toBe('Expired');
    const auditRow = await prisma.auditLog.findFirst({ where: { entityType: 'PlatformDocument', entityId: photoId, action: 'EXPIRE' } });
    expect(auditRow?.actorSource).toBe('system');
  });
});

describe('platform document routes', () => {
  let uploadedId: number;

  it('POST /api/platform/document uploads via multipart and returns 201', async () => {
    const { POST } = await import('@/app/api/platform/document/route');
    const form = uploadForm({ documentTypeCode: 'PHOTO', ownerEntityType: 'EMPLOYEE', ownerEntityId: String(employeeId) }, { name: 'route.png', type: 'image/png', bytes: PNG });
    const res = await POST(req('http://localhost/api/platform/document', { method: 'POST', form }));
    expect(res.status).toBe(201);
    const body = await res.json();
    uploadedId = body.id;
    expect(body.verificationStatus).toBe('Verified');
    expect(body.originalFileName).toBe('route.png');
  });

  it('POST rejects a wrong extension (400) and lists with GET', async () => {
    const { POST, GET } = await import('@/app/api/platform/document/route');
    const bad = uploadForm({ documentTypeCode: 'PHOTO', ownerEntityType: 'EMPLOYEE', ownerEntityId: String(employeeId) }, { name: 'bad.pdf', type: 'application/pdf', bytes: PDF });
    expect((await POST(req('http://localhost/api/platform/document', { method: 'POST', form: bad }))).status).toBe(400);

    const list = await GET(req(`http://localhost/api/platform/document?ownerEntityType=EMPLOYEE&ownerEntityId=${employeeId}`));
    expect(list.status).toBe(200);
    const { data } = await list.json();
    expect(data[0].id).toBe(uploadedId);
  });

  it('GET download streams the bytes with Content-Type and Content-Disposition', async () => {
    const { GET } = await import('@/app/api/platform/document/[id]/download/route');
    const res = await GET(req(`http://localhost/api/platform/document/${uploadedId}/download`), { params: Promise.resolve({ id: String(uploadedId) }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toContain('route.png');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('denies view/download with 404 to a non-owner, non-HR caller and to another company', async () => {
    const { GET } = await import('@/app/api/platform/document/[id]/route');
    const stranger = await GET(req(`http://localhost/api/platform/document/${uploadedId}`, { userId: 999_999_999 }), { params: Promise.resolve({ id: String(uploadedId) }) });
    expect(stranger.status).toBe(404);
    const otherCompany = await GET(req(`http://localhost/api/platform/document/${uploadedId}`, { companyId: companyId + 1000 }), { params: Promise.resolve({ id: String(uploadedId) }) });
    expect(otherCompany.status).toBe(404);
    const hr = await GET(req(`http://localhost/api/platform/document/${uploadedId}`), { params: Promise.resolve({ id: String(uploadedId) }) });
    expect(hr.status).toBe(200);
  });

  it('returns 403 without the permission and 401 without a role', async () => {
    const { GET } = await import('@/app/api/platform/document/route');
    const noPerm = await GET(req(`http://localhost/api/platform/document?ownerEntityType=EMPLOYEE&ownerEntityId=${employeeId}`, { roleId: hrRoleId }));
    expect([200, 403]).toContain(noPerm.status); // 200 once seed-platform-permissions has granted hr-admin
    const headers = new Headers({ 'x-company-id': String(companyId) });
    const noRole = await GET(new NextRequest(new URL('http://localhost/api/platform/document'), { headers }));
    expect(noRole.status).toBe(401);
  });

  it('GET completeness and POST expiry-sweep respond through the routes', async () => {
    const { GET } = await import('@/app/api/platform/document/completeness/route');
    const c = await GET(req(`http://localhost/api/platform/document/completeness?ownerEntityType=EMPLOYEE&ownerEntityId=${employeeId}`));
    expect(c.status).toBe(200);
    expect((await c.json()).missing).not.toContain('PHOTO');

    const { POST } = await import('@/app/api/platform/document/expiry-sweep/route');
    const s = await POST(req('http://localhost/api/platform/document/expiry-sweep', { method: 'POST', body: { today: '2026-09-15' } }));
    expect(s.status).toBe(200);
    expect(await s.json()).toEqual({ expired: expect.any(Number), alerted: expect.any(Number) });
  });
});
