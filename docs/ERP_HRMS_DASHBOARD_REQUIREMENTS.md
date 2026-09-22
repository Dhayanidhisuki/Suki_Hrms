# Legacy ERP — HRMS dashboards, requirements

Host: `https://aceelectrical.sukierp.com:8853/SukiERPWebApp/`
Captured: 2026-09-22 · SUKI ERP v3.5, build 0449/22-09-2026 (PrimeFaces / JSF)

Screens covered:

| § | Screen | Path |
|---|---|---|
| 1–6 | HRMS Dashboard | `pages/dashboard/hrmsdashboard.xhtml` |
| 7 | Attendance Dashboard (ESSL) | `pages/hrms/attendancedashboardforessl.xhtml` |

Captured without a logged-in session, so the page returned `Please check the User Id....`
and `java.lang.NullPointerException` and every grid showed **No records found.** The
layout, filters and grid definitions below are what the page renders; only the *data*
was missing. Re-capture signed in if you need real row shapes or the FY dropdown values.

---

---

# Part A — HRMS Dashboard

## 1. Page layout

One column, top to bottom:

1. Title: **HRMS Dashboard**
2. Filter bar (see §2)
3. Seven month-wise grids stacked vertically (see §3)

There are **no KPI tiles, no charts and no export buttons** on this page — it is seven
cross-tab tables and nothing else.

## 2. Filter bar

| Control | Widget | Notes |
|---|---|---|
| Current Financial Year | dropdown (`issuesfrm:currentyear`) | Options come from the session; empty when signed out |
| From Month | dropdown (`issuesfrm:frommonth`) | Default `Any` |
| To Month | dropdown (`issuesfrm:tomonth`) | Default `Any` |
| — | **Search** button | Submits the form; all seven grids reload together |

All seven grids share this one filter set. There is no per-grid filter and no auto-refresh
— nothing loads until Search is pressed.

## 3. The seven grids

Every grid has the same shape: one label column, then **12 month columns Apr → Mar**
(Indian financial year). All are PrimeFaces scrollable datatables with a frozen header
(`_head` clone) and a fixed label column. None has a paginator, a totals row/column,
sorting, or an export control. Empty state text is `No records found.`

| # | Component id | Title as rendered | Row grouped by | Measure per month |
|---|---|---|---|---|
| 1 | `issuesfrm:datatable`  | Month Wise Total Salary By Department | **Unit Name** | Total salary |
| 2 | `issuesfrm:datatable1` | Month Wise No.of Employees by Department | Department | Employee headcount |
| 3 | `issuesfrm:datatable2` | Month Wise OverTimeAmt by Department | Department | Overtime amount |
| 4 | `issuesfrm:datatable3` | Month Wise No.of Leave by Department | Department | Leave count |
| 5 | `issuesfrm:datatable4` | Month Wise Employee PF values by Department | Department | Employee PF |
| 6 | `issuesfrm:datatable5` | Month Wise Employee ESI values by Department | Department | Employee ESI |
| 7 | `issuesfrm:datatable6` | Month Wise Salary Vs Employee by Department | Department | Salary ÷ headcount (avg cost per employee) |

### Quirks worth deciding on before copying

- **Grid 1 is mislabelled.** Its title says "By Department" but its row column is
  **Unit Name** — it groups by unit, not department. Either the title or the grouping is
  wrong in the legacy app. Confirm which the business actually wants.
- **PF and ESI are employee-share only.** Both titles say "Employee PF/ESI values".
  The employer share is not on this dashboard. Confirm whether the new dashboard should
  show employee-only, employer-only, or both.
- **"Salary Vs Employee"** is not defined on screen. Read as average salary per employee
  (grid 1 ÷ grid 2), but confirm — it could also mean a side-by-side comparison.
- **Leave is a count, not days.** "No.of Leave" — confirm whether that is leave
  *applications*, leave *days*, or LOP days.
- **No totals anywhere.** No row total, column total or grand total. Worth adding in the
  new build; flagged because the legacy screen deliberately has none.
- **From/To Month vs the 12 fixed columns.** The grids always render all 12 FY months.
  Confirm whether From/To blanks out the excluded months or filters the underlying rows.

## 4. Data each grid needs

Per grid, the query is `GROUP BY <unit|department>, month` across the selected financial
year, pivoted to 12 columns:

- Salary total → payroll run gross per employee, rolled up by unit
- Headcount → active employees per department per month (decide: month-end snapshot vs
  average vs anyone-active-during-month)
- Overtime amount → OT earnings component per department per month
- Leave count → approved leave per department per month
- Employee PF → PF employee contribution per department per month
- Employee ESI → ESI employee contribution per department per month
- Salary vs employee → derived from the first two

## 5. Mapping to the current HRMS build

Our sidebar already lists screens covering most of this:

| Legacy grid | Existing HRMS screen | Status |
|---|---|---|
| Total Salary by Unit | Dashboard › Payroll › Salary Cost | Not built |
| No. of Employees by Dept | Dashboard › HR › Headcount (Department-wise) | Not built |
| Overtime amount | — | No screen yet |
| No. of Leave by Dept | Dashboard › HR › Leave Summary | Not built |
| Employee PF | Dashboard › Payroll › Statutory Summary | Not built |
| Employee ESI | Dashboard › Payroll › Statutory Summary | Not built |
| Salary vs Employee | — | No screen yet |

The main HRMS dashboard (`/`) already ships Total Headcount, Present Today, Pending
Approvals, Monthly Salary Cost, Attrition and a Headcount-by-Department chart — none of
which the legacy screen has. The legacy screen's contribution is the **12-month
cross-tab** view, which we have nowhere.

## 6. Open questions for the client

1. Grid 1: group by unit or by department?
2. PF/ESI: employee share only, or employee + employer?
3. "Salary Vs Employee" — average cost per employee, or something else?
4. Leave: applications, days, or LOP days?
5. Should the new version add row/column totals and export (Excel/PDF)?
6. Keep the seven separate grids, or fold them into one grid with a measure switcher?
7. Do From/To Month filter the columns shown, or the rows aggregated?


---

# Part B — Attendance Dashboard (ESSL)

Path: `pages/hrms/attendancedashboardforessl.xhtml` · form id `mainfrm`
Menu location: Attendance & Salary Process › Attendance Dashboard (screen 1501)

A **single-day, live floor view** — the opposite of Part A's 12-month cross-tabs.
Same signed-out caveat: counts all read 0 and the dropdowns only offered their
default option. The controls, cards and drill-down grids below are real.

## 7. Filter bar

Nine filters plus a date and a submit button. All of them narrow every card at once.

| Filter | Default | Options seen |
|---|---|---|
| Unit | `ALL` | session-driven |
| Category | `All` | session-driven |
| EmpType | `-Select-` | session-driven |
| Department | `ALL` | session-driven |
| Designation | `ALL` | session-driven |
| ProductionLine | `ALL` | `ALL`, `N/A` |
| Shift | `ALL` | session-driven |
| Level | `ALL` | `ALL`, `L1`…`L7` (fixed list) |
| AttendanceDate | today (`22/09/2026`) | date picker, single day |

`Level` L1–L7 is a hard-coded seven-level hierarchy — we have no equivalent
concept in the new HRMS. Decide whether it maps to Grade, Level or something new.

## 8. KPI cards

Five cards across one row. Each card shows a count and a **View Details** button.
Present / Absent / Single Punch additionally carry a small 72×72 donut ring
(presumably share of Total Employee); Total Employee and Late Comers do not.

| Card | Ring | Meaning |
|---|---|---|
| Total Employee | — | Employees matching the filters |
| Present | yes | Marked present on the selected date |
| Absent | yes | No attendance on the selected date |
| Single Punch | yes | Punched in but never out (or vice versa) |
| Late Comers | — | In-time later than shift start |

There are no tables, charts or totals on the page body itself — everything below
the cards is reached through the drill-downs.

## 9. Drill-downs

**View Details** does not navigate; it opens a modal with a paginated,
exportable grid (PrimeFaces export: F / P / N / E / Export).

**"Total Employees" dialog** (`dlgTotEmpfrm:uplDts1`) — from the Total Employee card:

`SI.No · Emp Code · Emp Name · DOJ · Unit · Dept · Designation · Production Line`

**"Attendance Logs" dialog** (`dlgPreAbsEmpfrm:uplDts2`) — shared by Present,
Absent, Single Punch and Late Comers; the card decides which rows load:

`SI.No · Emp Code · Emp Name · Emp Type · Dept · Production Line · Site · In-Time · Out-Time · Remarks`

Both grids are paginated and have an Export control — note that Part A's grids
have neither.

## 10. What this needs from our data

- Punch pairs per employee per day (in-time, out-time) — the biometric feed
- Shift start per employee, to derive Late Comers
- A "single punch" rule: one punch recorded for the day
- Absent = active employee with no punch on that date, which needs an active-headcount
  snapshot for the date, not just today
- Site on the log row — the punch's location, not the employee's home unit

## 11. Mapping to the current HRMS build

| Legacy | Existing HRMS screen | Status |
|---|---|---|
| Attendance Dashboard (5 cards + drill-downs) | Dashboard › HR › Attendance Summary | Built |
| Total Employees list | Employees list | Built |
| Attendance Logs (punch in/out) | Workforce › Attendance | Built |
| Late Comers / Single Punch as first-class counts | — | Not surfaced as KPIs anywhere |

Our `/` dashboard already shows **Present Today** with a marked/leave/absent
breakdown. What the legacy screen adds is **Single Punch** and **Late Comers** as
headline counts, the nine-way filter bar, and one-click drill-down to the
underlying punch rows with export.

## 12. Open questions — Attendance Dashboard

1. `Level` L1–L7 — what does it map to in our schema?
2. Single Punch: does it mean exactly one punch, or an unpaired punch generally?
3. Late Comers: measured against shift start, with what grace period?
4. Absent: does it exclude approved leave and weekly-offs, or count them as absent?
5. `Site` on the attendance log — punch location or assigned site?
6. Should the drill-down be a modal (as legacy) or a filtered route in the new UI?
7. Do we need the export on drill-downs from day one?
