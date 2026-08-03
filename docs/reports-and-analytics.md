# Reports & Analytics — Module Guide

**Product:** SUKI Tools Management  
**Date:** 31 Jul 2026  
**Scope:** How the Reports & Analytics module and its submodules are viewed, how they work, end-to-end flows, and how they are built.

---

## 1. Purpose

Reports & Analytics gives operators a **read-oriented** view of Tools Management data:

- Live KPI summaries (counts from ERP tables)
- Navigation into related masters / transaction screens
- A **preview table** (sample of live rows)
- **Full-category download** as Excel (`.xlsx`) or PDF (`.pdf`) — not just the preview

It does **not** create or edit master/transaction records (except by linking the user to those screens). Purchase Order Report is intentionally pending (Part B).

---

## 2. Where it appears in the UI

### Sidebar

Section: **Reports & Analytics**

| Menu label | Route |
|---|---|
| All Tool Reports | `/dashboard/reports/tools` |
| Calibration Reports | `/dashboard/reports/calibration` |
| Supplier Report | `/dashboard/reports/suppliers` |
| Subcontractor Report | `/dashboard/reports/subcontractors` |
| Tools History Report | `/dashboard/reports/tools-history` |
| Purchase Order Report | `/dashboard/reports/purchase-orders` |

Hub page (optional entry): `/dashboard/reports`

### Screen layout (how it is viewed)

Every active report page uses the shared **`ReportHub`** shell:

```
┌─────────────────────────────────────────────────────────────┐
│  Title + subtitle                    [Download All Excel]   │
│                                      [Download All PDF]     │
├─────────────────────────────────────────────────────────────┤
│  KPI cards (4 metrics)                                      │
├─────────────────────────────────────────────────────────────┤
│  Link cards (icon + description + metric + View)            │
│  → jump to masters / calibration / history screens          │
├─────────────────────────────────────────────────────────────┤
│  Live preview table (limited rows for browsing)             │
│  Note: preview ≠ full export                                │
└─────────────────────────────────────────────────────────────┘
```

- **KPI row** — `ModuleKpiRow` (same pattern as masters)
- **Link cards** — entry points into operational screens
- **Preview table** — first N live rows for quick scan
- **Download buttons** — full category export via API

Purchase Order Report uses `PendingFeature` instead of `ReportHub` (no data export yet).

---

## 3. Architecture (how it is built)

```
┌──────────────┐     apiGet / fetch      ┌──────────────────────────┐
│ Report pages │ ───────────────────────▶│ Existing list APIs       │
│ (client)     │   KPIs + preview        │ /api/tools, suppliers…   │
│              │                         └──────────────────────────┘
│ ReportHub    │     GET blob download   ┌──────────────────────────┐
│              │ ───────────────────────▶│ /api/reports/[category]  │
└──────────────┘   ?format=xlsx|pdf      │  + serverReportExport    │
                                         │  + Prisma (full dataset) │
                                         └──────────────────────────┘
                                                      │
                                                      ▼
                                         SQL Server ERP tables
                                         (read via Prisma)
```

### Key building blocks

| Layer | File | Role |
|---|---|---|
| Shared UI | `src/components/ReportHub.tsx` | Layout, KPIs, links, preview, download UX |
| Page shell | `src/components/SimpleMasterShell.tsx` | Sidebar + TopBar + title area |
| KPI UI | `src/app/dashboard/components/ModuleKpiRow.tsx` | Metric cards |
| Hub page | `src/app/dashboard/reports/page.tsx` | Category index |
| Submodule pages | `src/app/dashboard/reports/*/page.tsx` | Per-category data + links |
| Export API | `src/app/api/reports/[category]/route.ts` | Load **all** rows + file response |
| Export builders | `src/lib/serverReportExport.ts` | Excel (`xlsx`) + PDF (`jspdf` / `jspdf-autotable`) |
| Auth | session cookie + `requireSession` | All report APIs require login |
| Nav | `src/app/dashboard/components/Sidebar.tsx` | Menu entries |

### Design rules

1. **Preview APIs** reuse existing list endpoints (paginated / capped for UI speed).
2. **Export APIs** load the **full category** from Prisma (no pageSize cap), then build the file on the server.
3. Client never builds Excel/PDF for bulk data — avoids browser memory issues and keeps one export path.
4. No new ERP tables were created for reports.

---

## 4. End-to-end user flows

### 4.1 Browse a report

```
User opens Sidebar → Reports & Analytics → e.g. Supplier Report
        │
        ▼
Page mounts (client component)
        │
        ├─▶ apiGet list APIs in parallel (KPI + preview source)
        │
        ▼
ReportHub renders KPIs, link cards, preview table
        │
        ▼
User clicks a link card → navigates to master / transaction screen
```

### 4.2 Download full category (Excel or PDF)

```
User clicks "Download All Excel" or "Download All PDF"
        │
        ▼
ReportHub.fetch(`/api/reports/{category}?format=xlsx|pdf`, credentials)
        │
        ▼
API: requireSession → loadCategory(category) via Prisma
        │
        ▼
serverReportExport: buildExcelBuffer | buildPdfBuffer
        │
        ▼
HTTP 200 + Content-Disposition attachment + X-Export-Count
        │
        ▼
Browser saves blob as .xlsx / .pdf
UI shows success banner with record count + filename
```

**Important:** Download exports **all** matching records for that category, not only the preview rows.

---

## 5. Submodules (detail)

### 5.1 Reports & Analytics hub

| Item | Value |
|---|---|
| Route | `/dashboard/reports` |
| Page | `src/app/dashboard/reports/page.tsx` |
| Export | None (index only) |

**View**

- KPI: Tools register, Calib due, Suppliers, Subcontractors
- Six link cards to each report submodule

**Data sources (preview/KPI only)**

| Metric | API |
|---|---|
| Tools | `/api/dashboard/kpi` → `totalTools` |
| Calib due | `/api/tools/calibration-due` |
| Suppliers | `/api/suppliers` |
| Subcontractors | `/api/subcontractors` |
| Recent issues (history card metric) | `/api/issue` |

---

### 5.2 All Tool Reports

| Item | Value |
|---|---|
| Route | `/dashboard/reports/tools` |
| Page | `src/app/dashboard/reports/tools/page.tsx` |
| Export category | `tools` |

**How it is viewed**

- KPIs: Total tools, Currently issued, Under cal/repair, Tool groups
- Links:
  - Item/Asset Master → `/dashboard/masters/tools`
  - Reorder Level Report → `/dashboard/masters/reorder-level`
  - Tools History Card → `/dashboard/tools-history-card`
- Preview: recent tools (`/api/tools?pageSize=100`)

**Full export (`tools`)**

- Table: `GAUGEANDTOOLS`
- Columns include: Tool No, Name, Description, Group, Type, Status, Location, Area, Rack, qty fields, calib frequency, Created
- Approx. volume: entire register (~13k+ rows in production ERP)

---

### 5.3 Calibration Reports

| Item | Value |
|---|---|
| Route | `/dashboard/reports/calibration` |
| Page | `src/app/dashboard/reports/calibration/page.tsx` |
| Export category | `calibration` |

**How it is viewed**

- KPIs: Due in window, Overdue, Calib issues, Pending results
- Links:
  - Calibration Due List → `/dashboard/calibration/due-list`
  - Results Update → `/dashboard/calibration/results-update`
  - Calibration Records → `/dashboard/tools-history-card/calibration`
- Preview: due tools from `/api/tools/calibration-due`

**Data logic (shared with Due List)**

Primary source is **calibration issue lines**, not empty control-card tables:

- `TOOLS_TRANS_ISSUE_FOR_CALIBRATION`
- Dates: `NXT_CALIB_DATE` → else `CALIB_DUE_DATE` → else `DUE_DATE`
- Alert window: `CALIBRATION_ALERT_DAYS` (default **90**)

**Full export (`calibration`)**

- Dedupes by tool number (earliest next due kept)
- Columns: Tool No, Name, Group, Type, Frequency, Last Calibrated, Next Due, Status, DC No, Remarks

---

### 5.4 Supplier Report

| Item | Value |
|---|---|
| Route | `/dashboard/reports/suppliers` |
| Page | `src/app/dashboard/reports/suppliers/page.tsx` |
| Export category | `suppliers` |

**How it is viewed**

- KPIs: Total, Active, Approved, Inactive/Other
- Links:
  - Supplier Master → `/dashboard/masters/suppliers`
  - Tool Pricing Master → `/dashboard/masters/pricing`
- Preview: live `/api/suppliers` rows

**Full export (`suppliers`)**

- Table: `SUPPLIER`
- Columns: Code, Name, Address, City, State, GSTIN, Phone, Email, Approved, Status, Created

---

### 5.5 Subcontractor Report

| Item | Value |
|---|---|
| Route | `/dashboard/reports/subcontractors` |
| Page | `src/app/dashboard/reports/subcontractors/page.tsx` |
| Export category | `subcontractors` |

**How it is viewed**

- KPIs: Total, Active, In-House, Store vendors
- Links:
  - Subcontractor Master → `/dashboard/masters/subcontractors`
  - Calibration Issue → `/dashboard/calibration/issue`
- Preview: live `/api/subcontractors` (UI-mapped Yes/No → flags, ACTIVE → Active)

**Full export (`subcontractors`)**

- Table: `SUBCONTRACTOR`
- Maps ERP Yes/No flags and status for readable Excel/PDF columns
- Columns: Code, Name, Nature of Work, GSTIN, Address, In-House, Store Vendor, DC Issue, Status, Created

---

### 5.6 Tools History Report

| Item | Value |
|---|---|
| Route | `/dashboard/reports/tools-history` |
| Page | `src/app/dashboard/reports/tools-history/page.tsx` |
| Export category | `tools-history` |

**How it is viewed**

- KPIs: Tool issues, Tool receives, Calib issues, Calib due
- Links:
  - History Card Hub → `/dashboard/tools-history-card`
  - Issue History → `/dashboard/tools-history-card/issue`
  - Receive History → `/dashboard/tools-history-card/receive`
- Preview: recent issue headers from `/api/issue`

**Full export (`tools-history`)**

- Tables: `GAUGE_TOOLS_ISSUE` + `TOOLS_TRANS_ISSUE` (one export row per line; headers without lines still emit one row)
- Columns: DC No, Party/Holder, Sub Code, Emp Id, Issue/Due dates, Header Status, Customer, Purpose, Tool No, Tool Name, Qty, Line Status
- Can be large (tens of thousands of line rows)

---

### 5.7 Purchase Order Report (pending)

| Item | Value |
|---|---|
| Route | `/dashboard/reports/purchase-orders` |
| Page | `src/app/dashboard/reports/purchase-orders/page.tsx` |
| Kind | Part B — `PendingFeature` (`unavailable`) |

**Why**

Purchase Orders are owned by a shared Purchasing module (`COMMON_PURCHASE_ORDER`), not Tools Management. No Tools-owned PO table; no export category.

**View**

In-page message that the feature is not yet available, with reason and “no DB changes without approval.”

---

## 6. Export API reference

### Endpoint

```
GET /api/reports/{category}?format=xlsx|pdf
```

### Categories

| `category` | Dataset |
|---|---|
| `tools` | Full tools register |
| `calibration` | Full calib due/overdue set |
| `suppliers` | Full supplier master |
| `subcontractors` | Full subcontractor master |
| `tools-history` | Full issue headers + lines |

### Response

| Header / body | Meaning |
|---|---|
| `200` + binary body | File download |
| `Content-Type` | Excel or PDF MIME |
| `Content-Disposition` | `attachment; filename="…"` |
| `X-Export-Count` | Number of exported rows |
| `401/403` | Not authenticated / session |
| `400` | Unknown category or bad format |
| `404` | No rows to export |
| `500` | Query / build failure |

### File naming

Pattern: `{base}_{YYYYMMDD_HHMM}.xlsx|pdf`  
Examples: `all_tools_report_20260729_1136.xlsx`

### Libraries (server only)

- **Excel:** `xlsx` (SheetJS)
- **PDF:** `jspdf` + `jspdf-autotable`  
  Large PDFs (full tools register) can be tens of MB; Excel is preferred for bulk analysis.

---

## 7. How a submodule page is assembled (build recipe)

Each active report page follows the same pattern:

1. **`"use client"` page** under `src/app/dashboard/reports/<name>/page.tsx`
2. On mount, **`apiGet`** one or more list/KPI APIs
3. Compute KPI numbers in the page (filters/counts)
4. Pass props into **`<ReportHub />`**:
   - `title` / `subtitle`
   - `kpis` — `ModuleKpiItem[]`
   - `links` — deep links to operational screens
   - `previewColumns` / `previewRows` / `previewLoading`
   - `exportCategory` — enables Download All buttons
5. Sidebar entry points at the same route
6. Full dump logic lives only in **`loadCategory()`** inside  
   `src/app/api/reports/[category]/route.ts`

To add a new report category later:

1. Add sidebar + page using `ReportHub`
2. Add a `case` in `loadCategory`
3. Extend `ReportExportCategory` union in `ReportHub.tsx`
4. Wire `exportCategory="…"` on the page

---

## 8. Auth & security

- Report pages sit under `/dashboard/*` (middleware session gate).
- Preview calls use `apiGet` with `credentials: "include"`.
- Export calls use `fetch(..., { credentials: "include" })`.
- Export route calls `requireSession` — unauthenticated users cannot download.
- Exports are **read-only**; they do not write ERP tables.

---

## 9. Preview vs full download (mental model)

| | Preview table | Download All |
|---|---|---|
| Purpose | Fast on-screen browse | Complete offline file |
| Row count | Capped (e.g. 100) | Entire category |
| Source | Existing list APIs | Dedicated `/api/reports/[category]` |
| Format | HTML table | `.xlsx` / `.pdf` |
| Selection | None required | Always all rows |

---

## 10. Related operational screens (linked from reports)

Reports intentionally deep-link into day-to-day modules:

| From report | Typical destination |
|---|---|
| Tools | Item/Asset Master, Reorder Level, History Card |
| Calibration | Due List, Results Update, Calib history |
| Suppliers | Supplier Master, Pricing Master |
| Subcontractors | Subcontractor Master, Calibration Issue |
| Tools History | History hub / Issue / Receive history |

Editing data happens on those screens; reports remain analytics + export.

---

## 11. Known limits & notes

1. **PO Report** — placeholder until Purchasing integration is scoped.
2. **Calibration due export** — driven by issue-line dates; control-card tables may be empty in ERP.
3. **Large files** — Tools PDF and Tools History Excel can be very large; prefer Excel for analysis.
4. **After Prisma schema changes** — restart `next dev` so the server Prisma client picks up maps (HMR alone can keep a stale client).
5. **ChunkLoadError `/_next/undefined`** — usually stale `.next` cache after dependency/HMR churn; clear `.next` and restart.

---

## 12. Quick file map

```
src/app/dashboard/reports/
  page.tsx                 # Hub
  tools/page.tsx
  calibration/page.tsx
  suppliers/page.tsx
  subcontractors/page.tsx
  tools-history/page.tsx
  purchase-orders/page.tsx # PendingFeature

src/components/ReportHub.tsx
src/components/SimpleMasterShell.tsx
src/components/PendingFeature.tsx

src/app/api/reports/[category]/route.ts
src/lib/serverReportExport.ts

src/app/dashboard/components/Sidebar.tsx   # Nav entries
```

---

## 13. Summary

Reports & Analytics is a **hub + five live category pages + one pending PO page**, built on a shared `ReportHub` UI. Each live page shows KPIs, navigation cards, and a preview table from existing APIs, and can download the **complete category dataset** as Excel or PDF through `/api/reports/[category]`, which queries ERP via Prisma and builds files on the server.
