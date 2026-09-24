# Plan — Salary dashboard: comparison and two implementations

Written 2026-09-23. Source of truth for the target: Part E of
`ERP_HRMS_DASHBOARD_REQUIREMENTS.md` (the legacy Power BI "HRMS (Salary
Details) Dashboard"), read directly from that report's DOM.

---

## 0. Blocker to raise before any of this ships

The legacy salary report is published through Power BI **"Publish to web"**,
which is anonymous: employee names, IDs, individual gross, PF, ESI, PT, total
deductions and net pay are readable by anyone with the link, with no login.

That is not a reason to delay our build, but it **is** the highest-priority item
on this page and it belongs to whoever owns the Power BI workspace, not to us.

---

## 1. Comparison — legacy Salary BI vs what we have today

| Legacy visual | Where ours lives today | Verdict |
|---|---|---|
| Gross Salary by Dept Wise | Salary Cost → "Gross Cost by Department"; FY Summary (dept grouping) | **Have** |
| Gross Salary by Year | FY Summary, year granularity | **Have** |
| Per-employee gross | FY Summary, employee grouping | **Have** |
| Top 3 Dept by OT Allowance | FY Summary, `overtime` measure by dept | **Have** (not ranked/top-N) |
| Breakage (per-employee PF/ESI/PT/deductions/net) | Statutory Summary is **company-wide**, not per employee | **Partial** |
| Slicers: EXIT / EMP / DEPT / YEAR / MONTH / UNIT | FY Summary has FY, dept, unit, month range, employee — no EXIT | **Partial** |
| Top 10 Employees by Gross Salary | — | **Missing** |
| Gross Salary by Employee (salary bands) | — | **Missing** |
| Highest / Lowest Paid Department cards | — | **Missing** |
| Canteen total card | — | **Missing** |
| Performance Incentive by dept | — | **Missing** |
| Employee Class by Gross Salary | — | **Missing** (and broken in legacy: 100% in one unset bucket) |
| By Day table | — | **Missing** (legacy shows only `DEPT · JOIN_DATE`; purpose unclear, do not copy blind) |

**Conclusion: no new data source is needed.** Every missing item is an
aggregation over `PayrollLine` × `PayrollRun` × `JobInfo`, which
`/api/dashboard/fy-crosstab` already joins. Confirmed present in the schema:

- `PayrollLine.performanceIncentive` — a real column
- `PayrollLine.otAmount`, `otIncentiveAmount`
- `PayrollLineComponent` → `SalaryComponent.name` — so named components
  (e.g. "Canteen Allowance") are reachable per payroll line

---

## 2. Implementation A — close the gaps in the dashboards we already have

Small, low-risk, each one lands independently.

| # | Change | Where |
|---|---|---|
| A1 | Per-employee statutory breakdown table (`EMP_ID · NAME · GROSS · PF · ESI · PT · TOTAL DED · NET`) — the legacy "Breakage" | Statutory Summary |
| A2 | Rank the OT-by-department series and label the top 3 | FY Summary |
| A3 | `EXIT` / include-leavers toggle, matching the legacy slicer | FY Summary |
| A4 | Highest / Lowest paid department as KPI cards | Salary Cost |

A1 is the only one with real work in it; the rest are derived from data already
on the page.

---

## 3. Implementation B — a separate Salary Dashboard

New route `/dashboard/salary-bi`, nav entry under Dashboard › Payroll.

### B1. API — `GET /api/dashboard/salary-bi?year=&month=&exit=`

One payload, same pattern as `fy-crosstab`: raw grouped SQL, result sized by
(departments × bands), not by headcount.

Returns:
- `cards`: highest/lowest paid department, overtime total, performance total,
  canteen total
- `byDepartment`: gross, OT, performance incentive per department
- `bands`: headcount per salary band
- `topEmployees`: top N by gross
- `breakdown`: per-employee gross, PF, ESI, PT, total deductions, net
- `byYear`: gross per year

### B2. Page — built on the existing shared chart set

| Section | Component |
|---|---|
| 5 KPI cards | `ModuleKpiRow` |
| Gross by Department | `ReportBarChart` |
| Top 3 Dept by OT | `ReportDonutChart` |
| Salary bands | `ReportBarChart` (horizontal) |
| Performance Incentive by Dept | `ReportBarChart` |
| Gross by Year | `ReportBarChart` |
| Top 10 by Gross | table |
| Breakdown (Breakage) | table, paginated |

Slicers: Year · Month · Department · Unit · Employee · Include leavers.

### B3. Decisions to make before building

1. **Salary bands** — legacy uses Upto 20K / 20–40K / 40–60K / 60–80K / 80K–1L /
   1L–1.5L / 1.5L–2L. Adopt as-is, or make them configurable?
2. **What a band counts.** Legacy bands sum to 1,186 against 369 employees, so
   it counts *payslip rows across months*, not people. Ours should count
   **distinct employees in the selected period** — that is what the title
   claims. Flagging because it will not match the legacy figure.
3. **Canteen** is an *earning* in our `SalaryComponent` master but reads as a
   deduction on the legacy card. Confirm which it is before showing a total.
4. **Employee Class** — skip. The legacy visual puts 100% in one unset bucket
   and carries no information.
5. **By Day** — skip until someone explains what it is for.

### B4. Data-quality items worth raising with the client

- Legacy Top 10 repeats `EMP_ID` 100005 and 100016 with different names — a
  fanned join or a non-unique ID in their extract.
- Our `SalaryComponent` master has duplicate names ("Canteen Allowance",
  "Prod.Incentive" appear twice), consistent with masters not being tenanted.

---

## 4. Suggested order

1. Raise the Power BI exposure (not a code change; do it today)
2. **B1** — the API, since A1 and A4 can then read from it
3. **B2** — the new dashboard
4. **A1–A4** — fold the gaps into the existing pages
