# Suki HRMS — Full Manual Test Flow

> **Prerequisite:** SQL Server at `192.168.1.160:1433` must be running, and the Next.js dev server (`npm run dev`) must be up on `http://localhost:3000`. Log in once with an admin/HR account before starting — the cookie `hrms-token` is required for every page.

**Test data already in the system (from earlier sessions):**
- 12 active employees: RC027–RC037 + RC114 (76 others deactivated)
- Shifts: GENERAL, MORNING, EVENING, NIGHT (and rotational variants)
- July 2026 biometric attendance already imported for the 12 employees
- Payroll run ID 31 (July 2026) — currently in `POSTED` status
- 172 OT rows approved, 102 LOM entries approved
- LOM Config: basis=GROSS, grace=15m, cap=240m, source=SHIFT_MASTER
- Department weekly off configured for IT and MANAGEMENT REPRESENTATIVE (Sun+Sat)

---

## Phase 1 — Masters Setup (verify configuration)

### 1.1 Shift Master
- **Page:** `/masters/shift-masters`
- **Verify:**
  - 4+ shifts listed (GENERAL, MORNING, EVENING, NIGHT)
  - Each has start/end time, grace minutes, night-allowed flag
  - GENERAL = 09:00–17:30, NIGHT = 22:00–06:00
- **Test:** Click Edit on GENERAL → change grace to 10 → Save → verify it persists

### 1.2 Departments
- **Page:** `/masters/departments`
- **Verify:** IT, MANAGEMENT REPRESENTATIVE, and others listed
- **Test:** Note which departments exist — you'll need them for weekly-off config

### 1.3 Holiday Master → 3 tabs

#### Tab A: Declared Holidays
- **Page:** `/masters/holidays` (tab 1)
- **Verify:** List of holidays with date, name, type (Company/Festival/Government)
- **Test:**
  1. Click **+ Add Holiday**
  2. Fill: Company=your company, Date=2026-08-15, Name=Independence Day, Type=Government
  3. Save → verify it appears in the list with the correct date tile and type badge
  4. Edit it → change type to Festival → Save → verify badge colour changes
  5. Delete it → confirm → verify it disappears

#### Tab B: Department Weekly Off
- **Page:** `/masters/holidays` (tab 2)
- **Verify:**
  - KPI strip shows total departments, configured count, default (Sunday) count
  - Each department shows a Mon–Sun chip row
  - IT and MGMT REP have Sun+Sat highlighted (frozen)
- **Test:**
  1. Find a department with no config (shows "Default · Sunday")
  2. Click **Saturday** chip → it turns amber (frozen)
  3. Verify "Effective weekly off" column now shows Sunday + Saturday badges
  4. Click Saturday again → it unfreezes → back to "Default · Sunday"
  5. Use the filter box to search a department by name → verify list narrows

#### Tab C: Yearly Leave Calendar
- **Page:** `/masters/holidays` (tab 3)
- **Verify:**
  - Calendar shows the current month with colour-coded days
  - Leave Types panel on the right shows types with colour swatches and day counts
  - Month list below shows entries for the visible month
- **Test:**
  1. Navigate to August 2026 using ‹ › buttons
  2. Click on August 15 → modal opens
  3. Pick "National Holiday" leave type, enter "Independence Day"
  4. Save → verify Aug 15 now has a coloured cell on the calendar
  5. Verify the Leave Types panel count incremented
  6. Click Aug 15 again → click "Remove" → verify it's cleared
  7. Click **+ Leave Type** → create a new type "Company Off" with blue colour → verify it appears in the legend

### 1.4 LOM Config
- **Page:** `/masters/lom-config`
- **Verify:**
  - Calculation Basis = GROSS
  - Multiplier = 1
  - Shift Duration Source = SHIFT_MASTER
  - Grace Minutes Exempt = 15
  - Daily LOM Cap = 240
- **Test:** Change grace to 20 → Save → verify it persists → change back to 15

### 1.5 Payroll Workflow Config
- **Page:** `/masters/payroll-workflow-config`
- **Verify:** Which optional stages are enabled (VALIDATED / SUBMITTED / POSTED)
- **Test:** Toggle "Enable VALIDATED Stage" on → Save → this affects the pipeline stepper on Salary Processing

### 1.6 OT Plans
- **Page:** `/masters/ot-plans`
- **Verify:** OT plan exists with multiplier, applicable days, settlement options

### 1.7 Comp-Off Policy
- **Page:** `/masters/comp-off-policy`
- **Verify:** Comp-off credit rules, expiry policy, encashment rules

### 1.8 Approval Chain Config
- **Page:** `/masters/approval-chain`
- **Verify:** Shift change approval chain stages (Manager → HR, etc.)

---

## Phase 2 — Employee & Salary Structure

### 2.1 Employee Master
- **Page:** `/employees` (or `/masters/employees`)
- **Verify:**
  - 12 active employees visible (RC027–RC037, RC114)
  - 76 deactivated employees not shown (or shown as inactive)
  - Each has department, designation, reporting manager, oldEmployeeCode (matches biometric ID)
- **Test:**
  1. Open RC027 → verify `oldEmployeeCode` matches their biometric device ID
  2. Verify reporting manager is set (needed for OT/shift-change approval chain)
  3. Verify salary structure is assigned

### 2.2 Salary Structure / Salary Details
- **Page:** `/masters/salary-structures` and `/payroll/processing/salary` (per employee)
- **Verify:**
  - Salary components are dynamic (whatever was added in Salary Components page)
  - Each active employee has a salary structure with basic, HRA, allowances, PF, ESI etc.
- **Test:** Open an employee's salary details → verify gross, PF rate, ESI rate are set

---

## Phase 3 — Biometric & Attendance

### 3.1 Biometric Integration
- **Page:** `/workforce/attendance/biometric`
- **Verify:**
  - Device controller connection status (on-premise controller)
  - Last sync run timestamp and result
  - Device users listed
- **Test:**
  1. Click **Fetch Attendance** (or Sync)
  2. Select a date range (e.g. 2026-07-01 to 2026-07-31)
  3. Wait for sync to complete
  4. Verify: fetched > 0, created/updated > 0, unmatched = 0
  5. Verify employee matching worked (oldEmployeeCode → device user ID)

### 3.2 Daily Attendance
- **Page:** `/workforce/attendance/daily`
- **Verify:**
  - 12 employees × 31 days = ~372 records for July 2026
  - Each record shows: inTime, outTime, shift, status (Present/Absent/WeeklyOff/Holiday)
  - `isWeeklyOffWorked` and `isHolidayWorked` flags are set automatically for Sun/holiday work
  - `earlyOutMinutes` is calculated when checkout is before shift end
- **Test:**
  1. Filter by date 2026-07-26 (Sunday) → verify employees who worked show `isWeeklyOffWorked=true`
  2. Filter by a weekday → verify `isWeeklyOffWorked=false`
  3. Look for any record with `earlyOutMinutes > 0` → verify it's queued for LOM approval

### 3.3 Monthly Attendance
- **Page:** `/workforce/attendance/monthly`
- **Verify:** Monthly grid for July 2026 with per-day status colours
- **Test:** Click **Finalize** → verify summary is generated without DB errors

### 3.4 Attendance Overview
- **Page:** `/workforce/attendance/overview`
- **Verify:** Department-wise summary, present/absent/late counts

### 3.5 Time Office Final
- **Page:** `/workforce/attendance/time-office-final`
- **Verify:** Consolidated time-office view with OT, LOM, weekly-off, holiday work columns

---

## Phase 4 — Approvals

### 4.1 OT Approval (Manager → HR)
- **Page:** `/approvals/workforce/overtime`
- **Verify:**
  - KPI strip: "Awaiting Manager", "Awaiting HR", "Total Pending OT"
  - Two sections: "Pending My Approval (Reporting Manager)" and "Pending HR Approval"
  - Each row shows employee, date (with Weekly-Off/Holiday tag), OT worked
- **Test (single approve):**
  1. In the Manager section, click **Approve** on a row
  2. Confirm → row moves to HR section
  3. In the HR section, click **Approve** on that row
  4. If it's a Sunday/holiday → settlement picker appears (Paid OT vs Comp-Off)
  5. Pick "Comp-Off" → verify it's approved
- **Test (bulk approve):**
  1. Select 5+ rows via checkboxes
  2. Pick settlement type (for HR scope)
  3. Click **Approve selected** → confirm
  4. Verify success message: "Approved X of Y (Z skipped)"
  5. Verify selected rows disappear from the queue
- **Test (reject):**
  1. Click **Reject** on a row → enter reason → submit
  2. Verify row disappears

### 4.2 LOM Approval
- **Page:** `/approvals/workforce/lom`
- **Verify:**
  - KPI strip: Pending entries, Pending Late, Pending Early Out, Approved for Deduction
  - Tabs: Pending / Approved / Rejected with counts
  - Each row shows late minutes (amber chip), early-out minutes (red chip), total
- **Test:**
  1. On the **Pending** tab, select a few rows
  2. Click **Approve selected** → confirm
  3. Switch to **Approved** tab → verify the rows appear with "Approved (after grace)" column
  4. Switch to **Rejected** tab → verify rejected rows appear
  5. Click **Reject** on a pending row → enter reason → verify it moves to Rejected tab

### 4.3 Mispunch Approval
- **Page:** `/approvals/workforce/mispunch`
- **Verify:** Pending mispunch requests with approve/reject actions

### 4.4 Leave Approval
- **Page:** `/approvals/workforce/leave`
- **Verify:** Pending leave applications with approve/reject

### 4.5 Permission Approval
- **Page:** `/approvals/workforce/permission`
- **Verify:** Pending permission requests (short-duration leave)

---

## Phase 5 — Shift Management

### 5.1 Shift Plan
- **Page:** `/workforce/shift-plan`
- **Verify:**
  - KPI strip: Employees Scheduled, Manual Overrides, Night Shift Days
  - Week/Month toggle works
  - Grid with sticky employee column, date columns
  - Today column highlighted
  - Weekend columns shaded
  - Each cell shows shift code + time range, colour-coded
  - Override cells have orange outline
  - Legend chips at top
- **Test (single override):**
  1. Click on any cell → modal opens
  2. Pick a different shift from the tile picker
  3. Enter reason "Testing override"
  4. Click **Save Override**
  5. Verify the cell now has an orange outline and shows the new shift
  6. Hover the cell → ✕ button appears → click it → override removed
- **Test (navigation):**
  1. Click **Prev** / **Next** / **Today** → verify week/month changes
  2. Switch to Month view → verify full month grid renders
  3. Use the employee filter → verify list narrows

### 5.2 Shift Change Request
- **Page:** `/workforce/shift-change-request`
- **Verify:**
  - KPI strip: My Requests, Awaiting Approval, Approved, Pending My Action
  - Two sections: "Pending My Approval" and "My Requests"
  - Each row shows from → to shift chips, status badge with stage
- **Test (create + approve):**
  1. Click **+ New Request**
  2. Pick a date, select a target shift, enter reason
  3. Submit → verify it appears in "My Requests" with status "pending · stage 1"
  4. Switch to "Pending My Approval" section → click **Approve**
  5. If multi-stage chain → approve through each stage
  6. Verify final status = "approved" and a shift override was created

### 5.3 Shift Notifications
- **Page:** `/workforce/shift-notifications`
- **Verify:**
  - KPI strip: Unread, Upcoming Changes, Total
  - Unread/All filter tabs
  - Notifications grouped by shift date
  - Each shows from → to shift chips, reason, relative time
  - Unread notifications have blue background + "New" badge
- **Test:**
  1. After approving a shift change request (Phase 5.2), come here
  2. Verify a new notification appeared for the employee
  3. Click on it → it marks as read (background turns normal)
  4. Click **Mark all as read** → verify all unread badges clear

### 5.4 Bulk Shift Upload
- **Page:** `/workforce/bulk-shift-upload`
- **Verify:**
  - 3-step stepper: Prepare file → Upload → Review results
  - File format table showing required columns
  - Drag-and-drop zone
- **Test:**
  1. Click **Download CSV template** → verify file downloads
  2. Edit the CSV:
     ```
     employeeCode,date,shiftCode
     RC027,2026-07-28,GENERAL
     RC028,2026-07-28,GENERAL
     INVALID,2026-07-28,GENERAL
     RC029,2026-07-28,WRONGSHIFT
     ```
  3. Drag the file into the upload zone (or browse)
  4. Verify file name + size shown
  5. Click **Upload & apply**
  6. Verify result KPIs: 2 created, 2 errors
  7. Switch to "All rows" tab → verify all 4 rows shown with status
  8. Verify the 2 successful overrides appear on the Shift Plan page for 2026-07-28
  9. Verify 2 notifications were created for RC027 and RC028

---

## Phase 6 — Comp-Off

### 6.1 Comp-Off Request
- **Page:** `/workforce/comp-off-request`
- **Verify:**
  - KPI strip: Total, Pending, Approved, Rejected
  - All/Pending/Approved/Rejected filter tabs
  - Each request card shows "Worked on → Comp-off on" date tiles
- **Test (employee request):**
  1. Click **+ Request Comp-off**
  2. Worked date = 2026-07-26 (Sunday, must have approved OT)
  3. Comp-off date = 2026-08-10
  4. Submit → verify it appears with status "pending"
- **Test (duplicate prevention):**
  1. Try creating another request for the same worked date (2026-07-26)
  2. Verify it's rejected with "A comp-off request for this worked date already exists"
- **Test (HR approve):**
  1. Switch to HR view (if logged in as HR/admin)
  2. Click **Approve** on the pending request
  3. Verify status changes to "approved"
  4. Verify comp-off balance was credited (check comp-off transactions)
- **Test (reject):**
  1. Create another request for a different worked date
  2. Click **Reject** → enter reason → submit
  3. Verify status = "rejected" and reason shown

---

## Phase 7 — Payroll Processing

### 7.1 Salary Processing (full pipeline)
- **Page:** `/payroll/processing/salary`
- **Verify:**
  - PageHeader with period picker (month + year)
  - Status badge showing current run status
  - Pipeline stepper showing stages reached
  - KPI strip: Employees, Total Gross, Total Deductions, Total Net
  - Employee grid with INR formatting, HOLD badges, payslip links
  - Action toolbar changes based on run status
- **Test (full pipeline on a fresh run):**
  1. Pick a month with no run yet (e.g. August 2026)
  2. Click **Create Run**
  3. Verify status = DRAFT, stepper shows "Draft" as active
  4. Click **Calculate** → verify 12 employees calculated
  5. Verify KPIs populate (gross, OT, deductions, net)
  6. Verify grid shows each employee with payable days, gross, net
  7. Click **Approve** → status = APPROVED, stepper advances
  8. Click **Lock** → status = LOCKED
  9. (If POSTED stage enabled) Click **Post** → status = POSTED
  10. Verify action toolbar shows "This run is locked — no further changes"
- **Test (existing run 31 — July 2026):**
  1. Navigate to July 2026
  2. Verify status = POSTED (from earlier testing)
  3. Verify all 12 employees have net salary values
  4. Click **View** payslip on any row → verify payslip page opens

### 7.2 Additions / Deductions
- **Page:** `/payroll/processing/additions-deductions?runId=X`
- **Verify:** Manual additions/deductions can be added per employee
- **Test:** Add a one-time bonus to RC027 → save → recalculate → verify net increased

### 7.3 Bulk Upload Benefits
- **Page:** `/payroll/processing/salary/bulk-adhoc?runId=X`
- **Verify:** CSV upload for canteen/petrol/other benefits

### 7.4 Payslip (Individual)
- **Page:** `/payroll/outputs/payslip?runId=31&lineId=X`
- **Verify:**
  - Payslip shows employee name, code, designation
  - Earnings: basic, HRA, allowances, OT, night allowance
  - Deductions: PF, ESI, PT, TDS, LOM, other
  - Gross, total deductions, net salary
  - Pay period, working days, payable days, LOP
- **Test:** Open payslip for RC027 → verify all sections render → verify net = gross − deductions

### 7.5 Payslip (Bulk)
- **Page:** `/payroll/outputs/payslip-bulk`
- **Verify:** Can generate payslips for all employees in a run

### 7.6 Bank Transfer File
- **Page:** `/payroll/outputs/bank-transfer`
- **Verify:**
  - Bank file can be generated from a locked/posted run
  - Shows employee bank account, net salary, IFSC
- **Test:** Generate bank file for run 31 → verify it downloads (CSV/Excel)

### 7.7 Payroll Summary
- **Page:** `/payroll/outputs/summary`
- **Verify:** Run-level summary with totals across all employees

### 7.8 Payroll Reconciliation
- **Page:** `/payroll/outputs/reconciliation`
- **Verify:** Reconciliation between attendance, OT, LOM, and payroll amounts

---

## Phase 8 — Dashboards

### 8.1 Payroll Status
- **Page:** `/dashboard/payroll-status`
- **Verify:** Current payroll run status, progress through pipeline

### 8.2 Payroll Processing Status
- **Page:** `/dashboard/payroll-processing-status`
- **Verify:** Detailed processing status with stage timestamps

### 8.3 Attendance Summary
- **Page:** `/dashboard/attendance-summary`
- **Verify:** Monthly attendance overview, present/absent/late trends

---

## Phase 9 — Edge Cases & Error Handling

### 9.1 Frozen Month Protection
- **Test:** Try editing attendance for a frozen/finalized month → verify it's blocked with an error message

### 9.2 Invalid Payroll Transitions
- **Test:**
  1. On a DRAFT run, try to Lock directly (skip Approve) → verify 409 error
  2. On a LOCKED run, try to Calculate again → verify 409 error

### 9.3 Permission Enforcement
- **Test:** Log in as an employee (not HR/admin) → verify:
  - OT Approval page shows only "Pending My Approval" (manager scope), not HR scope
  - Payroll pages are inaccessible (403)
  - Comp-off request shows only "My Requests", not all

### 9.4 Company Scoping
- **Test:** If multi-company, switch company → verify only that company's employees/runs appear

### 9.5 Empty States
- **Test:** Navigate to a month with no payroll run → verify friendly empty state with "Create Run" button

### 9.6 Early Check-in Snapping
- **Test:** (Requires new biometric import)
  1. Import attendance where an employee checks in 1 hour before shift start
  2. Verify `inTime` is snapped to shift start (not the actual early punch)
  3. Verify working minutes are not inflated

### 9.7 Auto Weekly-Off / Holiday Detection
- **Test:** (Requires new biometric import)
  1. Import attendance for a Sunday where an employee worked
  2. Verify `isWeeklyOffWorked = true` automatically
  3. Import attendance for a declared holiday → verify `isHolidayWorked = true`
  4. Import attendance for a regular weekday → verify both flags = false

### 9.8 Early Checkout LOM
- **Test:** (Requires new biometric import)
  1. Import attendance where employee checks out 30 min before shift end
  2. Verify `earlyOutMinutes = 30` on the daily attendance record
  3. Verify it appears in the LOM Approval queue
  4. Approve it → verify payroll deducts the minutes
  5. Reject another → verify no deduction

---

## Quick Reference — Page URLs

| Phase | Page | URL |
|-------|------|-----|
| Masters | Shift Master | `/masters/shift-masters` |
| Masters | Departments | `/masters/departments` |
| Masters | Holiday Master (3 tabs) | `/masters/holidays` |
| Masters | LOM Config | `/masters/lom-config` |
| Masters | Payroll Workflow Config | `/masters/payroll-workflow-config` |
| Masters | OT Plans | `/masters/ot-plans` |
| Masters | Comp-Off Policy | `/masters/comp-off-policy` |
| Masters | Approval Chain Config | `/masters/approval-chain` |
| Attendance | Biometric | `/workforce/attendance/biometric` |
| Attendance | Daily | `/workforce/attendance/daily` |
| Attendance | Monthly | `/workforce/attendance/monthly` |
| Attendance | Overview | `/workforce/attendance/overview` |
| Attendance | Time Office Final | `/workforce/attendance/time-office-final` |
| Approvals | OT | `/approvals/workforce/overtime` |
| Approvals | LOM | `/approvals/workforce/lom` |
| Approvals | Mispunch | `/approvals/workforce/mispunch` |
| Approvals | Leave | `/approvals/workforce/leave` |
| Approvals | Permission | `/approvals/workforce/permission` |
| Shift | Shift Plan | `/workforce/shift-plan` |
| Shift | Shift Change Request | `/workforce/shift-change-request` |
| Shift | Shift Notifications | `/workforce/shift-notifications` |
| Shift | Bulk Shift Upload | `/workforce/bulk-shift-upload` |
| Comp-Off | Comp-off Request | `/workforce/comp-off-request` |
| Payroll | Salary Processing | `/payroll/processing/salary` |
| Payroll | Payslip (Individual) | `/payroll/outputs/payslip` |
| Payroll | Payslip (Bulk) | `/payroll/outputs/payslip-bulk` |
| Payroll | Bank Transfer File | `/payroll/outputs/bank-transfer` |
| Payroll | Summary | `/payroll/outputs/summary` |
| Payroll | Reconciliation | `/payroll/outputs/reconciliation` |
| Dashboard | Payroll Status | `/dashboard/payroll-status` |
| Dashboard | Payroll Processing | `/dashboard/payroll-processing-status` |
| Dashboard | Attendance Summary | `/dashboard/attendance-summary` |

---

## Test Checklist Summary

| # | Phase | Key Test | Expected Result |
|---|-------|----------|-----------------|
| 1 | Masters | All master pages load | Data visible, editable |
| 2 | Holiday Master | 3 tabs work | Holidays, weekly-off, calendar all functional |
| 3 | Biometric | Fetch attendance | Records created, employees matched |
| 4 | Daily Attendance | Flags auto-set | isWeeklyOffWorked, isHolidayWorked, earlyOutMinutes |
| 5 | OT Approval | Manager → HR → settle | Approved as OT or Comp-Off |
| 6 | LOM Approval | Approve/reject | Only approved minutes deducted |
| 7 | Shift Plan | Override + remove | Override created and removed |
| 8 | Shift Change Request | Full approval chain | Override created, notification sent |
| 9 | Shift Notifications | Unread → read | Badge clears, background changes |
| 10 | Bulk Shift Upload | CSV with valid + invalid rows | Valid applied, invalid rejected |
| 11 | Comp-Off | Request → approve → balance | 1 day credited |
| 12 | Salary Processing | Full pipeline | DRAFT → CALCULATED → APPROVED → LOCKED → POSTED |
| 13 | Payslip | View individual | All earnings/deductions shown |
| 14 | Bank File | Generate | File downloads |
| 15 | Edge Cases | Frozen months, permissions | Blocked with clear errors |
