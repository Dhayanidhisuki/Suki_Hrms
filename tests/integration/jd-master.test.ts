import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getAdminAuth, makeRequest, requiredMasterIds } from './fixtures';

let auth: Awaited<ReturnType<typeof getAdminAuth>>;
let masters: Awaited<ReturnType<typeof requiredMasterIds>>;
const createdIds: number[] = [];
const postingIds: number[] = [];

beforeAll(async () => {
  auth = await getAdminAuth();
  masters = await requiredMasterIds();
});

afterAll(async () => {
  // A failed create pushes `undefined` (json.id of an error body), and Prisma
  // rejects undefined inside an `in` array. That threw here, aborted the whole
  // teardown, and left every JD this suite created behind — which then made
  // the next run fail the duplicate check, which left more rows behind again.
  // Filtering is what stops that feedback loop.
  const ids = createdIds.filter((id): id is number => typeof id === 'number');
  const postings = postingIds.filter((id): id is number => typeof id === 'number');
  if (postings.length) await prisma.jobPosting.deleteMany({ where: { id: { in: postings } } });
  if (ids.length) {
    await prisma.jobDescriptionVersion.deleteMany({ where: { jobDescriptionId: { in: ids } } });
    await prisma.jobDescriptionTag.deleteMany({ where: { jobDescriptionId: { in: ids } } });
    await prisma.jobDescription.deleteMany({ where: { id: { in: ids } } });
  }
});

describe('JD Master', () => {
  it('creates a JD with a generated jdCode and lowercase tags', async () => {
    const { POST } = await import('@/app/api/jd-master/route');
    const res = await POST(
      makeRequest('http://localhost/api/jd-master', {
        method: 'POST',
        auth,
        body: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          title: 'Test Auto JD',
          description: 'Role description for automated test.',
          status: 'Draft',
          tags: [' React ', 'NODE'],
          // This test is about jdCode generation and tag normalisation, not
          // the duplicate rule (that is the next test). requiredMasterIds()
          // returns whichever department/designation is first in the database,
          // shared with real data, so an Active JD may already exist on that
          // pair and 409 the create. Acknowledging up front decouples them.
          acknowledgeDuplicate: true,
        },
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    createdIds.push(json.id);
    expect(json.jdCode).toMatch(/^JD\d{4,}$/);
    expect(json.tags).toEqual(expect.arrayContaining(['react', 'node']));
    expect(json.usageCount).toBe(0);
  });

  it('returns a non-blocking duplicate warning for a second Active JD on the same pair', async () => {
    const { POST } = await import('@/app/api/jd-master/route');
    const first = await POST(
      makeRequest('http://localhost/api/jd-master', {
        method: 'POST',
        auth,
        body: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          title: 'Active JD A',
          description: 'First active.',
          status: 'Active',
          acknowledgeDuplicate: true,
        },
      })
    );
    const a = await first.json();
    createdIds.push(a.id);

    const blocked = await POST(
      makeRequest('http://localhost/api/jd-master', {
        method: 'POST',
        auth,
        body: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          title: 'Active JD B',
          description: 'Second active.',
          status: 'Active',
        },
      })
    );
    expect(blocked.status).toBe(409);
    const warn = await blocked.json();
    expect(warn.duplicateWarning).toBe(true);

    const allowed = await POST(
      makeRequest('http://localhost/api/jd-master', {
        method: 'POST',
        auth,
        body: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          title: 'Active JD B',
          description: 'Second active.',
          status: 'Active',
          acknowledgeDuplicate: true,
        },
      })
    );
    expect(allowed.status).toBe(201);
    const b = await allowed.json();
    createdIds.push(b.id);
    expect(b.duplicateWarning).toBe(true);
  });

  it('snapshots the previous state on PATCH', async () => {
    const { POST } = await import('@/app/api/jd-master/route');
    const created = await POST(
      makeRequest('http://localhost/api/jd-master', {
        method: 'POST',
        auth,
        body: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          title: 'Before edit',
          description: 'Original text',
          status: 'Draft',
          acknowledgeDuplicate: true, // see the jdCode test — same decoupling
        },
      })
    );
    const row = await created.json();
    createdIds.push(row.id);

    const { PATCH, GET } = await import('@/app/api/jd-master/[id]/route');
    const patched = await PATCH(
      makeRequest(`http://localhost/api/jd-master/${row.id}`, {
        method: 'PATCH',
        auth,
        body: { title: 'After edit', description: 'New text' },
      }),
      { params: Promise.resolve({ id: String(row.id) }) }
    );
    expect(patched.status).toBe(200);

    const detail = await GET(
      makeRequest(`http://localhost/api/jd-master/${row.id}`, { auth }),
      { params: Promise.resolve({ id: String(row.id) }) }
    );
    const json = await detail.json();
    expect(json.title).toBe('After edit');
    expect(json.versions?.[0]?.title).toBe('Before edit');
  });

  it('blocks delete when a job posting references the JD, but still allows archive', async () => {
    const { POST } = await import('@/app/api/jd-master/route');
    const created = await POST(
      makeRequest('http://localhost/api/jd-master', {
        method: 'POST',
        auth,
        body: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          title: 'Linked JD',
          description: 'Has a posting',
          status: 'Active',
          acknowledgeDuplicate: true,
        },
      })
    );
    const jd = await created.json();
    createdIds.push(jd.id);

    const { POST: POST_POSTING } = await import('@/app/api/recruitment/job-postings/route');
    const postingRes = await POST_POSTING(
      makeRequest('http://localhost/api/recruitment/job-postings', {
        method: 'POST',
        auth,
        body: { title: 'Engineer opening', jdId: jd.id },
      })
    );
    expect(postingRes.status).toBe(201);
    const posting = await postingRes.json();
    postingIds.push(posting.id);

    const { GET, DELETE } = await import('@/app/api/jd-master/[id]/route');
    const detail = await GET(
      makeRequest(`http://localhost/api/jd-master/${jd.id}`, { auth }),
      { params: Promise.resolve({ id: String(jd.id) }) }
    );
    const detailJson = await detail.json();
    expect(detailJson.usageCount).toBeGreaterThanOrEqual(1);
    expect(detailJson.jobPostings?.length).toBeGreaterThanOrEqual(1);

    const del = await DELETE(
      makeRequest(`http://localhost/api/jd-master/${jd.id}`, { method: 'DELETE', auth }),
      { params: Promise.resolve({ id: String(jd.id) }) }
    );
    expect(del.status).toBe(409);

    const { PATCH } = await import('@/app/api/jd-master/[id]/status/route');
    const archived = await PATCH(
      makeRequest(`http://localhost/api/jd-master/${jd.id}/status`, {
        method: 'PATCH',
        auth,
        body: { status: 'Archived' },
      }),
      { params: Promise.resolve({ id: String(jd.id) }) }
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).status).toBe('Archived');
  });

  it('bulk-uploads valid rows and reports unknown masters', async () => {
    const dept = await prisma.department.findFirst({ where: { id: masters.departmentId } });
    const desig = await prisma.designation.findFirst({ where: { id: masters.designationId } });
    const { POST } = await import('@/app/api/jd-master/bulk-upload/route');
    const res = await POST(
      makeRequest('http://localhost/api/jd-master/bulk-upload', {
        method: 'POST',
        auth,
        body: {
          rows: [
            {
              department: dept!.code,
              designation: desig!.name,
              title: 'Bulk JD',
              description: 'From bulk',
              tags: 'sql, Excel',
            },
            {
              department: 'NO-SUCH-DEPT',
              designation: desig!.name,
              title: 'Bad',
              description: 'Missing dept',
            },
          ],
        },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.successCount).toBe(1);
    expect(json.failedRows).toHaveLength(1);
    const created = await prisma.jobDescription.findFirst({
      where: { title: 'Bulk JD', deletedAt: null },
      orderBy: { id: 'desc' }, // the one this test just made, not an older namesake
      include: { tags: true },
    });
    expect(created).toBeTruthy();
    createdIds.push(created!.id);
    expect(created!.tags.map((t) => t.tag).sort()).toEqual(['excel', 'sql']);
  });
});
