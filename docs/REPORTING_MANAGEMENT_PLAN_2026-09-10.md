# Reporting Management — Complete Implementation Plan

**Date:** 2026-09-10
**Scope:** Two-level reporting management — schema, helpers, APIs, UI pages,
and wiring manager approval stages into all workflows.
**Prerequisites:** Phase 1 (middleware) + Phase 2 (company scoping) from the
main implementation plan must be done first.

---

## Current State

| Feature | Status |
|---------|--------|
| `reportingManagerId` on Employee (Level 1) | Implemented |
| `reportingManagerId` in create/edit/bulk forms | Implemented |
| Manager name shown in list/detail/export | Implemented |
| Cycle detection (`wouldCreateCycle`) | Implemented |
| Mispunch: Manager → HR (2-stage) | Working |
| OT: Manager → HR (2-stage) | Working |
| PMS: Manager submits | Working |
| `secondReportingManagerId` (Level 2) | **NOT in schema** |
| Reporting Structure page | **Placeholder only** |
| Org Chart page | **Placeholder only** |
| Leave: Manager stage | **Missing** |
| Permission: Manager stage | **Missing** |
| Salary Revision: Manager stage | **Missing** |
| Confirmation: Manager stage | **Missing** |
| Manager dashboard (my team) | **Not built** |
| ESS team view | **Not built** |
| Bulk reassign manager | **Not built** |

---

## Phase R1 — Schema & Helpers (Foundation)

> **Goal:** Add second-level manager to schema, build all hierarchy helper
> functions. No UI changes yet — just the data layer.

### Step R1.1 — Add `secondReportingManagerId` to Employee model

**Files:**
- Edit: `prisma/schema.prisma`

**Schema change:**
```prisma
// In Employee model, after reportingManagerId:
reportingManagerId       Int?  // Level 1: direct manager
secondReportingManagerId Int?  // Level 2: skip-level / second manager

// Relations:
reportingManager       Employee?  @relation("EmployeeToManager", fields: [reportingManagerId], references: [id], onDelete: NoAction, onUpdate: NoAction)
secondReportingManager  Employee?  @relation("EmployeeToSecondManager", fields: [secondReportingManagerId], references: [id], onDelete: NoAction, onUpdate: NoAction)
directReports           Employee[] @relation("EmployeeToManager")
secondLevelReports      Employee[] @relation("EmployeeToSecondManager")

// Index:
@@index([secondReportingManagerId])
```

**Migration:**
```bash
npx prisma migrate dev --name add_second_reporting_manager
npx prisma generate
```

### Step R1.2 — Extend validation schemas

**Files:**
- Edit: `src/lib/validations/employee.ts`

```ts
// In employeeCreateSchema:
secondReportingManagerId: z.number().int().positive().optional().nullable(),

// In employeeBasicUpdateSchema:
secondReportingManagerId: z.number().int().positive().optional().nullable(),
```

### Step R1.3 — Build hierarchy helper functions

**Files:**
- Edit: `src/lib/reportingManager.ts`

**New functions:**

```ts
/**
 * Level 2 check: is `managerId` the second-level (skip-level) manager
 * of `employeeId`? Checks Employee.secondReportingManagerId directly.
 */
export async function isSecondLevelManagerOf(
  managerId: number,
  employeeId: number
): Promise<boolean> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { secondReportingManagerId: true },
  });
  return employee?.secondReportingManagerId === managerId;
}

/**
 * Is `managerId` either the Level-1 or Level-2 manager of `employeeId`?
 * Convenience for approval workflows that accept either level.
 */
export async function isManagerOfAnyLevel(
  managerId: number,
  employeeId: number
): Promise<boolean> {
  const [l1, l2] = await Promise.all([
    isReportingManagerOf(managerId, employeeId),
    isSecondLevelManagerOf(managerId, employeeId),
  ]);
  return l1 || l2;
}

/**
 * Get the full reporting chain for an employee, from their direct manager
 * up to the top. Stops at null manager or depth 50 (cycle guard).
 * Returns array of { id, employeeCode, firstName, lastName, level }.
 */
export async function getReportingChain(
  employeeId: number
): Promise<Array<{ id: number; employeeCode: string; firstName: string; lastName: string; level: number }>> {
  const chain: Array<{ id: number; employeeCode: string; firstName: string; lastName: string; level: number }> = [];
  let currentId: number | null = employeeId;
  let level = 0;

  for (let depth = 0; depth < 50 && currentId !== null; depth++) {
    const emp = await prisma.employee.findFirst({
      where: { id: currentId, deletedAt: null },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true },
    });
    if (!emp || !emp.reportingManagerId) break;
    level++;
    chain.push({
      id: emp.reportingManagerId,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      level,
    });
    currentId = emp.reportingManagerId;
  }
  return chain;
}

/**
 * List all direct (Level 1) reports of a manager.
 * (Already exists — kept for reference.)
 */
export async function listDirectReports(managerId: number) { ... }

/**
 * List all Level-2 reports: employees whose secondReportingManagerId
 * is `managerId`.
 */
export async function listSecondLevelReports(managerId: number) {
  return prisma.employee.findMany({
    where: { secondReportingManagerId: managerId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}

/**
 * List ALL reports recursively (Level 1 + Level 2 + their reports, etc.).
 * Used for org chart, headcount, and "my org" views.
 */
export async function listAllReports(managerId: number): Promise<Employee[]> {
  const all: Employee[] = [];
  const visited = new Set<number>();
  await collectReports(managerId, all, visited, 0);
  return all;
}

async function collectReports(
  managerId: number,
  results: Employee[],
  visited: Set<number>,
  depth: number
) {
  if (depth > 20 || visited.has(managerId)) return; // cycle/depth guard
  visited.add(managerId);

  const direct = await prisma.employee.findMany({
    where: { reportingManagerId: managerId, deletedAt: null, isActive: true },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true, secondReportingManagerId: true },
  });

  for (const emp of direct) {
    results.push(emp);
    await collectReports(emp.id, results, visited, depth + 1);
  }
}

/**
 * Bulk reassign: when a manager leaves, move all their direct reports
 * to a new manager. Also clears secondReportingManagerId if it points
 * to the departing manager.
 */
export async function reassignAllReports(
  oldManagerId: number,
  newManagerId: number | null
): Promise<{ reassigned: number }> {
  const result = await prisma.employee.updateMany({
    where: { reportingManagerId: oldManagerId, deletedAt: null },
    data: { reportingManagerId: newManagerId },
  });

  // Also clear second-level if it pointed to old manager
  await prisma.employee.updateMany({
    where: { secondReportingManagerId: oldManagerId, deletedAt: null },
    data: { secondReportingManagerId: newManagerId },
  });

  return { reassigned: result.count };
}

/**
 * Cycle detection for secondReportingManagerId — same pattern as
 * wouldCreateCycle but checks the second-level field too.
 */
export async function wouldCreateSecondLevelCycle(
  employeeId: number,
  candidateManagerId: number
): Promise<boolean> {
  if (candidateManagerId === employeeId) return true;
  let currentId: number | null = candidateManagerId;
  for (let depth = 0; depth < 50 && currentId !== null; depth++) {
    const manager = await prisma.employee.findFirst({
      where: { id: currentId, deletedAt: null },
      select: { reportingManagerId: true, secondReportingManagerId: true },
    });
    if (!manager) break;
    if (manager.reportingManagerId === employeeId) return true;
    if (manager.secondReportingManagerId === employeeId) return true;
    currentId = manager.reportingManagerId ?? manager.secondReportingManagerId;
  }
  return false;
}
```

**Verify:**
1. Set up employee A → manager B → manager C
2. Call `getReportingChain(A)` → returns [B (level 1), C (level 2)]
3. Call `listAllReports(C)` → returns [B, A]
4. Try to set A as B's manager → `wouldCreateCycle` returns true

---

## Phase R2 — Employee Form Updates

> **Goal:** Add second-level manager field to all employee forms.

### Step R2.1 — Add to employee form fields config

**Files:**
- Edit: `src/lib/employee-form-fields.ts`

```ts
// Add after reportingManagerId field (around line 143):
{
  name: 'secondReportingManagerId',
  label: 'Second Reporting Manager',
  type: 'select',
  options: toReportingManagerOptions(opts.reportingManagers),
  required: false,
  placeholder: 'Select skip-level manager (optional)',
},
```

### Step R2.2 — Add to create wizard

**Files:**
- Edit: `src/app/employees/new/page.tsx`

```ts
// In step 4 fieldNames array (line 51), add:
fieldNames: ['productionLine', 'additionalRole', 'teamGroup', 'reportingManagerId', 'secondReportingManagerId'],
```

### Step R2.3 — Add to basic PUT route (edit)

**Files:**
- Edit: `src/app/api/employees/[id]/basic/route.ts`

```ts
// After the reportingManagerId cycle check (line 115-116), add:
if (data.secondReportingManagerId) {
  if (await wouldCreateSecondLevelCycle(employeeId, data.secondReportingManagerId)) {
    return NextResponse.json(
      { error: 'Second reporting manager cannot create a reporting cycle' },
      { status: 400 }
    );
  }
}

// In the JobInfo/Employee update data (line 144), add:
secondReportingManagerId: data.secondReportingManagerId,
```

### Step R2.4 — Add to POST create route

**Files:**
- Edit: `src/app/api/employees/route.ts`

```ts
// After reportingManagerId validation (line 155), add:
if (data.secondReportingManagerId) {
  const secondMgr = await prisma.employee.findFirst({
    where: { id: data.secondReportingManagerId, deletedAt: null },
    select: { id: true },
  });
  if (!secondMgr) {
    return NextResponse.json({ error: 'Second reporting manager not found' }, { status: 400 });
  }
}

// In create data (line 177), add:
secondReportingManagerId: data.secondReportingManagerId,
```

### Step R2.5 — Add to bulk upload

**Files:**
- Edit: `src/lib/employee-bulk-import.ts`

```ts
// In the template columns, add:
{ header: 'Second Reporting Manager Code', key: 'secondReportingManagerCode' },

// In the row parsing (after line 239), add:
secondReportingManagerId: secondMgrCode
  ? masters.reportingManagers.find((e) => e.oldEmployeeCode === secondMgrCode || e.employeeCode === secondMgrCode)?.id
  : undefined,
```

### Step R2.6 — Add to employee list and detail display

**Files:**
- Edit: `src/app/api/employees/route.ts` (list API — add to select)
- Edit: `src/app/api/employees/[id]/route.ts` (detail API — add to select)
- Edit: `src/app/employees/page.tsx` (list UI — add column)
- Edit: `src/app/employees/[id]/page.tsx` (detail UI — add to header)

```ts
// In list API select:
secondReportingManager: {
  select: { id: true, firstName: true, lastName: true, employeeCode: true },
},
```

**Verify:**
1. Create employee with both Level 1 and Level 2 managers
2. Edit employee — change Level 2 manager
3. List page — both manager columns visible
4. Detail page — both managers shown in header

---

## Phase R3 — Manager Approval Stages

> **Goal:** Add manager approval stage to Leave, Permission, Salary Revision,
> and Confirmation workflows (Mispunch and OT already have it).

### Step R3.1 — Add manager stage to Leave approval

**Why:** Leave currently goes straight to HR. BRD requires
Manager → HR two-stage.

**Files:**
- Edit: `prisma/schema.prisma` (LeaveApplication model)
- Edit: `src/app/api/workforce/leave/applications/route.ts` (list — add manager queue)
- Edit: `src/app/api/workforce/leave/applications/[id]/approve/route.ts` (add manager stage)
- New: `src/app/api/workforce/leave/applications/[id]/reject/route.ts` (if not exists)

**Schema change:**
```prisma
// In LeaveApplication model, replace the status comment:
// pending | approved | rejected | cancelled
// With:
// pending_manager | pending_hr | approved | rejected | cancelled

// Add:
managerActionByUserId Int?
managerActionAt       DateTime?
managerRejectionReason String? @db.NVarChar(500)
```

**API change (approve route):**
```ts
import { resolveOwnEmployeeId, isReportingManagerOf, isSecondLevelManagerOf } from '@/lib/reportingManager';

export async function POST(request: NextRequest, { params }) {
  const userId = Number(request.headers.get('x-user-id'));
  const record = await prisma.leaveApplication.findUnique({ where: { id: applicationId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Stage 1: Manager approval
  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the reporting manager can approve this stage" },
        { status: 403 }
      );
    }
    // Advance to HR stage
    await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: 'pending_hr',
        managerActionByUserId: userId,
        managerActionAt: new Date(),
      },
    });
    return NextResponse.json({ message: 'Approved by manager, forwarded to HR' });
  }

  // Stage 2: HR approval (existing logic — balance deduction + attendance update)
  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
    if (permErr) return permErr;
    // ... existing approve logic (balance deduction, attendance update, etc.)
    await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: 'approved',
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });
    return NextResponse.json({ message: 'Leave approved' });
  }

  return NextResponse.json({ error: `Leave is already ${record.status}` }, { status: 409 });
}
```

**API change (list route — add manager queue):**
```ts
// In GET, add a "queue" query param:
//   queue=manager → show pending_manager for this manager's reports
//   queue=hr      → show pending_hr for HR users
const queue = searchParams.get('queue');
let where = { companyId: scope.companyId, ... };

if (queue === 'manager') {
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  where = {
    ...where,
    status: 'pending_manager',
    employee: { reportingManagerId: ownEmployeeId },
  };
} else if (queue === 'hr') {
  where = { ...where, status: 'pending_hr' };
}
```

**Verify:**
1. Employee applies for leave → status = `pending_manager`
2. Manager sees it in their queue → approves → status = `pending_hr`
3. HR sees it in their queue → approves → status = `approved`
4. Balance deducted, attendance marked as Leave

### Step R3.2 — Add manager stage to Permission approval

**Why:** Permission currently goes straight to HR. BRD requires
Manager → HR.

**Files:**
- Edit: `prisma/schema.prisma` (PermissionRequest model)
- Edit: `src/app/api/workforce/permission/route.ts` (list — add manager queue)
- Edit: `src/app/api/workforce/permission/[id]/approve/route.ts` (add manager stage)
- Edit: `src/app/api/workforce/permission/[id]/reject/route.ts` (add manager stage)

**Schema change:**
```prisma
// In PermissionRequest model:
// pending | approved | rejected → pending_manager | pending_hr | approved | rejected
// Add:
managerActionByUserId  Int?
managerActionAt        DateTime?
managerRejectionReason String? @db.NVarChar(500)
```

**Same two-stage pattern as Leave (Step R3.1).**

### Step R3.3 — Add manager stage to Salary Revision

**Why:** Salary revision goes straight to HR. BRD requires
Manager → HR.

**Files:**
- Edit: `prisma/schema.prisma` (SalaryRevisionRequest model)
- Edit: `src/app/api/payroll/revisions/route.ts` (list — add manager queue)
- Edit: `src/app/api/payroll/revisions/[id]/submit/route.ts` (change to manager stage)
- Edit: `src/app/api/payroll/revisions/[id]/approve/route.ts` (add manager stage)

**Schema change:**
```prisma
// In SalaryRevisionRequest model:
// DRAFT | SUBMITTED | APPROVED | REJECTED | HOLD | CANCELLED
// → DRAFT | SUBMITTED | PENDING_MANAGER | PENDING_HR | APPROVED | REJECTED | HOLD | CANCELLED
// Add:
managerActionByUserId  Int?
managerActionAt        DateTime?
managerRejectionReason String? @db.NVarChar(500)
```

**Flow:**
1. Draft → Submit → `PENDING_MANAGER`
2. Manager approves → `PENDING_HR`
3. HR approves → `APPROVED` (existing logic applies revision)

### Step R3.4 — Add manager stage to Confirmation

**Why:** Confirmation goes straight to HR. Manager should recommend first.

**Files:**
- Edit: `prisma/schema.prisma` (add fields to Employee or Confirmation model)
- Edit: `src/app/api/employees/[id]/confirmation/approve/route.ts`
- Edit: `src/app/api/employees/[id]/confirmation/reject/route.ts`

**Schema change:**
```prisma
// Add to Employee model or a new ConfirmationReview model:
managerRecommendation    String? @db.NVarChar(20) // recommend | extend | reject
managerRecommendationAt  DateTime?
managerRecommendationByUserId Int?
managerRemarks           String? @db.NVarChar(500)
```

**Flow:**
1. Probation ends → status = `pending_manager_recommendation`
2. Manager recommends (approve/extend/reject) → `pending_hr`
3. HR acts on recommendation → confirmed/extended/rejected

---

## Phase R4 — Reporting Structure Page

> **Goal:** Build the `/masters/reporting-structure` page — a dedicated UI
> for viewing and editing the reporting hierarchy.

### Step R4.1 — Build reporting structure API

**Files:**
- New: `src/app/api/masters/reporting-structure/route.ts`

```ts
// GET — returns the full reporting tree for the company
export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  // Fetch all active employees with their manager IDs
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      reportingManagerId: true,
      secondReportingManagerId: true,
      jobInfo: { select: { designation: { select: { name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { firstName: 'asc' },
  });

  // Build tree: find root nodes (no manager), attach children recursively
  const tree = buildReportingTree(employees);
  return NextResponse.json({ data: tree });
}

function buildReportingTree(employees) {
  const byManager = new Map<number | null, typeof employees>();
  for (const emp of employees) {
    const mgrId = emp.reportingManagerId ?? null;
    if (!byManager.has(mgrId)) byManager.set(mgrId, []);
    byManager.get(mgrId)!.push(emp);
  }

  function buildNode(managerId: number | null): TreeNode[] {
    const children = byManager.get(managerId) ?? [];
    return children.map(emp => ({
      ...emp,
      directReports: buildNode(emp.id),
    }));
  }

  return buildNode(null); // roots = employees with no manager
}

// PUT — bulk update reporting structure
export async function PUT(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const body = await request.json();
  // body: { updates: [{ employeeId, reportingManagerId?, secondReportingManagerId? }] }
  for (const update of body.updates) {
    if (update.reportingManagerId) {
      if (await wouldCreateCycle(update.employeeId, update.reportingManagerId)) {
        return NextResponse.json({ error: 'Cycle detected' }, { status: 400 });
      }
    }
    await prisma.employee.update({
      where: { id: update.employeeId },
      data: {
        ...(update.reportingManagerId !== undefined ? { reportingManagerId: update.reportingManagerId } : {}),
        ...(update.secondReportingManagerId !== undefined ? { secondReportingManagerId: update.secondReportingManagerId } : {}),
      },
    });
  }
  return NextResponse.json({ message: 'Reporting structure updated' });
}
```

### Step R4.2 — Build reporting structure page

**Files:**
- New: `src/app/masters/reporting-structure/page.tsx`

**Features:**
- Indented tree view of the entire company hierarchy
- Drag-and-drop or click-to-reassign manager
- Search by employee name/code
- Expand/collapse nodes
- Show designation + department per node
- "Bulk Reassign" button (select a manager, choose replacement, reassign all reports)

```tsx
'use client';
import { useState, useEffect } from 'react';

export default function ReportingStructurePage() {
  const [tree, setTree] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/masters/reporting-structure')
      .then(r => r.json())
      .then(d => setTree(d.data));
  }, []);

  return (
    <div>
      <h1>Reporting Structure</h1>
      <input placeholder="Search employee..." value={search} onChange={...} />
      <ReportingTree nodes={tree} search={search} />
      <BulkReassignDialog />
    </div>
  );
}

function ReportingTree({ nodes, search, depth = 0 }) {
  // Recursive tree renderer with indentation, expand/collapse,
  // employee name + code + designation + department
  // Click node → edit manager dropdown
}
```

### Step R4.3 — Update navigation to mark ready

**Files:**
- Edit: `src/components/layout/navigation.ts`

```ts
// Change:
{ label: "Reporting Structure", short: "Reporting", href: "/masters/reporting-structure" },
// To:
{ label: "Reporting Structure", short: "Reporting", href: "/masters/reporting-structure", ready: true },
```

**Verify:**
1. Open `/masters/reporting-structure`
2. See full company hierarchy as indented tree
3. Search for an employee → tree highlights/filters
4. Click an employee → change their manager → tree updates
5. Try to create a cycle → error message

---

## Phase R5 — Organization Chart Page

> **Goal:** Build the `/admin/organization-chart` page — a visual
> organizational chart.

### Step R5.1 — Build org chart API

**Files:**
- New: `src/app/api/admin/organization-chart/route.ts`

```ts
// GET — returns org chart data (same tree as reporting structure,
// but with additional info: headcount per node, total salary cost, etc.)
export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: {
      id: true, employeeCode: true, firstName: true, lastName: true,
      reportingManagerId: true,
      jobInfo: {
        select: {
          designation: { select: { name: true } },
          department: { select: { name: true } },
          currentSalaryRevision: { select: { grossSalary: true } },
        },
      },
    },
  });

  // Build tree with aggregate stats per node:
  // - headcount (direct + indirect reports)
  // - total salary cost (sum of grossSalary for all reports)
  const tree = buildOrgChartTree(employees);
  return NextResponse.json({ data: tree });
}
```

### Step R5.2 — Build org chart page

**Files:**
- New: `src/app/admin/organization-chart/page.tsx`

**Features:**
- Visual box-and-line org chart (use a library like `react-organigram` or
  build with CSS grid + SVG connectors)
- Each box: name, designation, department, headcount
- Click a box → drill down to that manager's subtree
- Zoom in/out, pan
- Export as PNG/PDF
- Filter by department

### Step R5.3 — Update navigation

```ts
{ label: "Organization Chart", short: "Org Chart", href: "/admin/organization-chart", ready: true },
```

---

## Phase R6 — Manager Dashboard & Team View

> **Goal:** Give managers a dashboard to see their team's attendance, leave,
> and pending approvals.

### Step R6.1 — Build manager dashboard API

**Files:**
- New: `src/app/api/manager/dashboard/route.ts`

```ts
// GET /api/manager/dashboard
// Returns: my team's summary (headcount, present today, on leave, pending
// approvals, attendance %, OT hours this month)
export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) return NextResponse.json({ error: 'No employee record' }, { status: 403 });

  // Get all direct + indirect reports
  const allReports = await listAllReports(ownEmployeeId);
  const reportIds = allReports.map(e => e.id);

  // Today's attendance
  const today = new Date();
  const todayAttendance = await prisma.dailyAttendance.findMany({
    where: { employeeId: { in: reportIds }, date: today },
    select: { status: true, employeeId: true },
  });

  // Pending approvals (mispunch, OT, leave, permission)
  const pendingMispunch = await prisma.mispunchCorrection.count({
    where: { status: 'pending_manager', employeeId: { in: reportIds } },
  });
  const pendingOT = await prisma.dailyAttendance.count({
    where: { otApprovalStatus: 'pending_manager', employeeId: { in: reportIds } },
  });
  const pendingLeave = await prisma.leaveApplication.count({
    where: { status: 'pending_manager', employeeId: { in: reportIds } },
  });

  return NextResponse.json({
    teamSize: reportIds.length,
    presentToday: todayAttendance.filter(a => a.status === 'Present').length,
    absentToday: todayAttendance.filter(a => a.status === 'Absent').length,
    onLeaveToday: todayAttendance.filter(a => a.status === 'Leave').length,
    pendingApprovals: { mispunch: pendingMispunch, ot: pendingOT, leave: pendingLeave },
  });
}
```

### Step R6.2 — Build manager dashboard page

**Files:**
- New: `src/app/manager/dashboard/page.tsx`

**Features:**
- KPI cards: Team Size, Present Today, On Leave, Pending Approvals
- Team attendance table (today's status for each report)
- Pending approvals quick links (mispunch, OT, leave)
- This month's OT summary
- This month's attendance %

### Step R6.3 — Build ESS "My Team" view

**Files:**
- New: `src/app/ess/team/page.tsx`

**Features:**
- List of direct reports with their today's status
- Quick links to approve pending items
- View each report's attendance/leave history

### Step R6.4 — Add to navigation

```ts
// In ESS module, add:
{ label: "My Team", href: "/ess/team", ready: true },

// Or in Dashboard module:
{ label: "Manager Dashboard", short: "My Team", href: "/manager/dashboard", ready: true },
```

---

## Phase R7 — Bulk Reassign Manager

> **Goal:** When a manager leaves or is reassigned, allow bulk reassignment
> of all their reports to a new manager.

### Step R7.1 — Build bulk reassign API

**Files:**
- New: `src/app/api/masters/reporting-structure/reassign/route.ts`

```ts
// POST /api/masters/reporting-structure/reassign
// Body: { oldManagerId, newManagerId }
export async function POST(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { oldManagerId, newManagerId } = await request.json();

  // Verify both belong to same company
  const [oldMgr, newMgr] = await Promise.all([
    prisma.employee.findFirst({ where: { id: oldManagerId, companyId: scope.companyId, deletedAt: null } }),
    prisma.employee.findFirst({ where: { id: newManagerId, companyId: scope.companyId, deletedAt: null } }),
  ]);
  if (!oldMgr || !newMgr) return NextResponse.json({ error: 'Manager not found' }, { status: 404 });

  const result = await reassignAllReports(oldManagerId, newManagerId);
  return NextResponse.json({ message: `Reassigned ${result.reassigned} reports to ${newMgr.firstName} ${newMgr.lastName}` });
}
```

### Step R7.2 — Add bulk reassign dialog to reporting structure page

**Files:**
- Edit: `src/app/masters/reporting-structure/page.tsx`

```tsx
// Add a "Bulk Reassign" button that opens a dialog:
// 1. Select departing manager (dropdown of all managers)
// 2. Select new manager (dropdown of all active employees)
// 3. Preview: "X reports will be reassigned"
// 4. Confirm → call reassign API
```

**Verify:**
1. Manager with 5 reports leaves
2. Open reporting structure → Bulk Reassign
3. Select old manager → select new manager → confirm
4. All 5 reports now show new manager
5. Second-level manager also reassigned if applicable

---

## Phase R8 — Wire into Separation Workflow

> **Goal:** When an employee is separated, automatically handle their
> reporting relationships.

### Step R8.1 — Auto-reassign on separation

**Files:**
- Edit: `src/app/api/employees/[id]/exit/route.ts`

```ts
// After setting isActive: false, check if this employee is a manager:
const directReports = await prisma.employee.findMany({
  where: { reportingManagerId: params.id, deletedAt: null, isActive: true },
});

if (directReports.length > 0) {
  // Option 1: Reassign to the departing manager's own manager
  const departingManager = await prisma.employee.findUnique({
    where: { id: params.id },
    select: { reportingManagerId: true },
  });

  if (departingManager?.reportingManagerId) {
    await reassignAllReports(params.id, departingManager.reportingManagerId);
  }
  // Option 2: Leave unassigned and warn HR
}

// Also clear secondReportingManagerId for reports pointing to this employee:
await prisma.employee.updateMany({
  where: { secondReportingManagerId: params.id, deletedAt: null },
  data: { secondReportingManagerId: null },
});
```

**Verify:**
1. Separate a manager who has 3 direct reports
2. Reports are automatically reassigned to the departing manager's own manager
3. Second-level references cleared

---

## Migration Checklist

```bash
# After Phase R1 (schema):
npx prisma migrate dev --name add_second_reporting_manager
npx prisma generate
rm -rf .next
npm run dev

# After Phase R3 (approval stages):
npx prisma migrate dev --name add_manager_approval_stages
npx prisma generate

# After all phases:
npm run build
npm test
```

---

## Effort Estimates

| Phase | Description | Est. Effort |
|-------|-------------|-------------|
| R1 | Schema + helpers | 3-4 hours |
| R2 | Employee form updates | 2-3 hours |
| R3 | Manager approval stages (4 workflows) | 8-10 hours |
| R4 | Reporting Structure page | 6-8 hours |
| R5 | Org Chart page | 6-8 hours |
| R6 | Manager dashboard + team view | 4-6 hours |
| R7 | Bulk reassign | 2-3 hours |
| R8 | Separation auto-reassign | 1-2 hours |
| **Total** | | **32-44 hours** |

---

## Dependency Graph

```
Phase R1 (Schema + Helpers)
  ├── Phase R2 (Forms)
  │     └── Phase R3 (Approval Stages)
  ├── Phase R4 (Reporting Structure Page)
  │     ├── Phase R7 (Bulk Reassign)
  │     └── Phase R8 (Separation Auto-Reassign)
  ├── Phase R5 (Org Chart Page)
  └── Phase R6 (Manager Dashboard)
```

**Critical path:** R1 → R2 → R3 (manager approval stages in all workflows)

---

## Priority Order

1. **R1** — Schema + helpers (everything depends on this)
2. **R3** — Manager approval stages (highest business value — fixes Leave/Permission/Revision/Confirmation)
3. **R4** — Reporting Structure page (visual management of hierarchy)
4. **R2** — Form updates (add second-level manager field)
5. **R6** — Manager dashboard (team visibility)
6. **R5** — Org Chart (nice-to-have visual)
7. **R7** — Bulk reassign (operational convenience)
8. **R8** — Separation auto-reassign (edge case handling)
