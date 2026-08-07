# SUKI Tools Management — Module-Wise Testing Guide

**Product:** SUKI Tools Management  
**Date:** 4 Aug 2026 (Modules 4–8 reconciled against codebase; Module 0 auth = standalone JWT)  
**Purpose:** Reference guide for what each module does, build status, business flows, and what to test.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full workflow — create / edit / delete or transaction write |
| 👁 | Read-only — list / view only |
| 🚧 | Placeholder — “Coming soon” / not owned by this app |
| 🔗 | Hub / link page — navigation only |
| ⚠️ | Built but incomplete (API exists, UI missing, or not in menu) |

---

## Application map (sidebar sections)

| # | Module | Sidebar section | Priority for current work |
|---|--------|-----------------|---------------------------|
| 0 | Auth & shell | Login / TopBar / Sidebar | Must |
| 1 | Dashboard | Dashboard | Smoke |
| 2 | Masters | Masters | **Must (main focus)** |
| 3 | Tool Transactions | Tool Transactions | Should |
| 4 | Calibration | Calibration | **Must (main focus)** |
| 5 | Purchase | Purchase | Should |
| 6 | Tools History Card | Tools History Card | Should |
| 7 | Reports & Analytics | Reports & Analytics | Should |
| 8 | Settings | Settings | Smoke |

```
Login
  → Dashboard overviews
  → Masters (setup)
       → Tool Transactions (issue / return)
       → Calibration (issue / receive / results)
       → Purchase GRN (against ERP PO)
  → History Card + Reports (verify after transactions)
  → Settings (read-only / placeholders)
```

---

## Module 0 — Auth & shell

**Auth model (standalone, as of Aug 2026):** Tools Management uses its **own** user store (`TOOLS_APP_USER`), **bcrypt** passwords, and an **httpOnly JWT cookie** (`suki_tools_token`). Login is **not** ERP credential verification. Accounts are created by admin / seed only (no self-signup).

| Screen | Route | Status | What to check |
|--------|-------|--------|---------------|
| Login | `/login` | ✅ | Username + password against app `User` table; Zod client validation; inline errors; loading spinner |
| Session guard | all `/dashboard/*` + APIs | ✅ | Missing cookie → `/login?redirect=…`; invalid/expired JWT → `/auth/session-expired` |
| Session expired | `/auth/session-expired` | ✅ | Message + link back to login |
| Logout | TopBar → Sign Out | ✅ | Clears JWT cookie; `/dashboard` blocked again |
| Sidebar / TopBar / Theme | all pages | ✅ | Navigation, search, theme switch |

**Optional field:** `erpUserCode` on `TOOLS_APP_USER` is nullable and reserved for future traceability to ERP `USER_ID`. It is **not** populated by login or seed today (always `null` unless set manually) and is **not** used for authentication.

**API defense in depth:** Route handlers use `getSession()` + `requireSession()` against the same JWT cookie (not iron-session / not ERP_USER). `requirePermission()` enforces the role matrix in `src/lib/rolePermissions.ts`.

**Seed admin (dev):** set `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` in `.env`, then `npm run db:seed`. Default username when unset: `admin`.

**Suggested test time:** ~15 minutes

### Checklist

- [ ] Login with a valid **Tools Management** username/password (seed or admin-created)
- [ ] Empty fields show client validation (Username / Password required)
- [ ] Wrong password shows generic “Invalid username or password” (no username-vs-password leak)
- [ ] After login, land on `/dashboard` (or `?redirect=` target if present)
- [ ] Direct hit to `/dashboard` while logged out → redirect to `/login?redirect=/dashboard`
- [ ] Invalid/expired JWT → `/auth/session-expired`
- [ ] Logout clears session; `/dashboard` redirects to login again
- [ ] Theme / TopBar / Sidebar still work when authenticated

---

## Module 1 — Dashboard (overview hubs)

| Screen | Route | Status | What to check |
|--------|-------|--------|---------------|
| Tool Overview | `/dashboard` | ✅ | KPI cards, charts, recent calibration, quick actions load |
| Transaction Overview | `/dashboard/overview/transactions` | 🔗 | Links open Issue / Receive / Customer Receive |
| Calibration Overview | `/dashboard/overview/calibration` | 🔗 | Counts roughly match calibration screens |
| Purchase Overview | `/dashboard/overview/purchase` | 🔗 | Links to GRN, Supplier, Subcontractor, PO |

**Suggested test time:** ~20 minutes (smoke only)

### Checklist

- [ ] Dashboard KPIs load without error
- [ ] Charts / tables render
- [ ] Overview link cards navigate to correct screens

---

## Module 2 — Masters

### 2A — Tool masters (setup chain)

**Dependency order:**

```
Tool Group → Tool Subgroup → Item/Asset Master
```

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Tool Group | `/dashboard/masters/tools-group` | ✅ | Group master / prefixes | CRUD; tools / PO / GRN prefixes |
| Tool Subgroup | `/dashboard/masters/tools-subgroup` | ✅ | Type under group | CRUD; linked to group; type prefix |
| **Item/Asset Master** | `/dashboard/masters/tools` | ✅ | `GAUGEANDTOOLS` | **Deep test** — create / edit / view, tabs, units, import / export, unsaved-changes dialog |
| Tools Name for Type | `/dashboard/masters/tool-types` | ✅ | `TOOLS_TYPE` | CRUD names linked to Group + Type; used on tool create |
| Tool Pricing Master | `/dashboard/masters/pricing` | 👁 | `TOOLS_PRICE_MASTER` | Tool + supplier rate list |
| Reorder Level | `/dashboard/masters/reorder-level` | 👁 | `MIN_ORDER_LEVEL` | Tools at / below ROL |
| Tool Mapping | `/dashboard/masters/tool-mapping` | ✅ | `TOOLS_MAPPING` | Create / list / delete tool ↔ supplier maps (no edit of existing row); ERP-style pager |
| Consolidated Lookups | `/dashboard/masters/lookups` | ✅ ⚠️ | Multiple lookup tables | CRUD on gauge types, calib frequency, groups, subgroups, tool types — **not in sidebar** (direct URL) |
| Item Name (legacy redirect) | `/dashboard/masters/item-name` | → | redirects to tool-types | Keep bookmarks working |

### Item/Asset Master — detailed checklist

**List**

- [ ] Search by tool number / name
- [ ] Filter by group and status
- [ ] KPI row counts match filtered list
- [ ] Row click opens View mode

**Create**

- [ ] Required: Tool No, Name, Group; Type when group has types
- [ ] **Next #** suggests number from group / type prefix
- [ ] Dropdowns: Issue Type, UOM, Location, Department, Company
- [ ] Calibration: `History Card = Yes` requires frequency > 0
- [ ] Save creates record; appears in list

**Edit / View**

- [ ] Edit from list and from view
- [ ] Tabs save: General, Stock, Calibration, Preventive, Specs
- [ ] `HISTORY_CARD_REQ = No` hides calibration unit columns / add-unit form
- [ ] `HISTORY_CARD_REQ = Yes` shows serial units + calib dates
- [ ] Add physical unit after save
- [ ] Unsaved changes popup on Back / Cancel: Save / Don't save / Stay

**Import / Export**

- [ ] Export filtered list → Excel
- [ ] Export selected rows
- [ ] Download Basic / Full / Price templates
- [ ] Import Full template → preview → confirm
- [ ] Rejected rows show validation reasons

**Delete**

- [ ] Delete with confirmation (use safe test data only)

### 2B — Calibration masters

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Gauge Type Master | `/dashboard/masters/gauge-types` | 👁 | `GAUGE_TYPE` | List loads |
| Calibration Frequency | `/dashboard/masters/calib-frequency` | 👁 | `CALIBRATION_FREQUENCY_MASTER` | Tolerance → frequency rows |
| Same data via Lookups | `/dashboard/masters/lookups` | ✅ | Same | Add / edit / delete here |

### 2C — Purchase masters

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Supplier Master | `/dashboard/masters/suppliers` | ✅ | `SUPPLIER` | CRUD; Active / Inactive; Approved filter |
| Subcontractor Master | `/dashboard/masters/subcontractors` | ✅ | `SUBCONTRACTOR` | CRUD; used on calibration issue |

**Suggested test time:** 1–2 days (Item/Asset Master is the bulk)

---

## Module 3 — Tool transactions

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Tool Issue | `/dashboard/transactions/issue` | ✅ | `GAUGE_TOOLS_ISSUE` | Create DC; pick tools with stock; issue to holder; history |
| Tool Receive | `/dashboard/transactions/receive` | ✅ | Receive against open DC | Search open DC; return qty; close / partial |
| Receive From Customer | `/dashboard/transactions/customer-receive` | 👁 | Issue filtered by `CUST_CODE` | List only — not a separate create table |
| Requisition Pending | `/dashboard/transactions/requisition-pending` | 🚧 | — | Skip |
| Consumption (hidden) | `/dashboard/transactions/consumption` | ✅ | Consumption API | Not in sidebar — test only if lead asks |

### Flow

```
Tool in stock
  → Tool Issue (DC created; Qty Out ↑)
  → Tool Receive (return qty; Qty In ↑ / DC closed or partial)
```

### Checklist

- [ ] Issue only tools with available qty
- [ ] After issue, stock / qty on tool reflects change
- [ ] Partial receive → DC PARTIAL (or equivalent ERP status)
- [ ] Full receive → DC CLOSED
- [ ] History Card → Issue History / Current Holder show same DCs

**Suggested test time:** ~half day

---

## Module 4 — Calibration

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Calibration Issue | `/dashboard/calibration/issue` | ✅ | `TOOLS_ISSUE_FOR_CALIBRATION`, `TOOLS_TRANS_ISSUE_FOR_CALIBRATION`; updates `GAUGEANDTOOLS` | Create DC; stage due tools; lab / subcontractor; PDF; detail + attachment |
| Calibration Receive | `/dashboard/calibration/receive` | ✅ | `TOOLS_RECEIVE_FOR_CALIBRATION`, `TOOLS_TRANS_RECEIVE_FOR_CALIBRATION` | **Create form** — pick open DC, select lines, partial/full receive; history + certificate upload |
| Results Update | `/dashboard/calibration/results-update` | ✅ | `TOOLS_TRANS_ISSUE_FOR_CALIBRATION` + `GAUGE_CONTROL_CARD_TRANS` / `GAUGEANDTOOLS` | PASSED / FAILED / RECALIBRATED + next date; Excel / PDF export of pending set |
| Due List | `/dashboard/calibration/due-list` | 👁 | Calib due via `/api/tools/calibration-due` | Filters: All / Overdue / 7 days / 30 days; “Issue now” → Issue with `?tool=` |

### Flow

```
Tool with HISTORY_CARD_REQ = Yes
  → Due List
  → Calibration Issue (DC OPEN)
  → Calibration Receive (partial / full)
  → Results Update (Pass/Fail + next due)
  → Due List refreshes
```

### Checklist

- [ ] Only calib-flagged tools appear on Due List
- [ ] Issue creates DC; status OPEN / Under Calibration
- [ ] Partial receive leaves remaining lines awaiting receive
- [ ] Full receive then Results Update changes next calib date / tool status
- [ ] Due List / Overview counts stay consistent
- [ ] Certificate / document upload on receive (if used)

**Suggested test time:** ~half day

---

## Module 5 — Purchase

Purchase in this app is **not** full ERP purchasing. PO creation is owned by the shared Purchasing module.

| Screen | Route | In sidebar? | Status | ERP / source | What to check |
|--------|-------|-------------|--------|--------------|---------------|
| Purchase Order | `/dashboard/po-linked/purchase-order` | Yes | 🚧 | `COMMON_PURCHASE_ORDER` (out of scope) | `PendingFeature` — not owned by Tools Management |
| Goods Receipt Note (GRN) | `/dashboard/po-linked/receive` | Yes | ✅ | `TOOLS_PO_RECEIVE`, `TOOLS_PO_RECEIVE_TRANS`; updates `GAUGEANDTOOLS` qty | **Main purchase screen to test** — PO no is free-text (not live-linked to ERP PO rows) |
| PO Schedule | `/dashboard/po-linked/schedule` | No (hidden) | ✅ ⚠️ | `TOOLS_PO_SCH_MASTER`, `TOOLS_PO_SCH_TRANS` | Create + list; not in menu. Supplier select disabled in form. |
| Purchase Overview | `/dashboard/overview/purchase` | Via Dashboard | 🔗 | — | Link hub |

### What you can / cannot do

| Action | In this app? |
|--------|--------------|
| Create / edit Purchase Order | ❌ — ERP Purchasing module |
| Create GRN against an existing PO number | ✅ (PO number entered as text) |
| Maintain Supplier / Subcontractor | ✅ (Masters) |
| View Tool Pricing | 👁 |
| PO Schedule | ✅ (hidden route) |
| Purchase Order Report | 🚧 |

### Purchase flow (testable today)

```
PO created in ERP (external)
  → GRN in Tools app (PO no + supplier + tool lines)
  → Tool stock / qty updated
  → GRN History / Reports
```

### GRN checklist (`/dashboard/po-linked/receive`)

- [ ] Existing GRN list loads
- [ ] Expand GRN → lines show tool, qty, price
- [ ] Create GRN: PO order no, supplier, date, tool lines
- [ ] Validation: PO no, supplier, at least one line
- [ ] After save, GRN appears in list
- [ ] Cross-check tool stock on Item/Asset Master
- [ ] History Card → GRN History shows same records

### PO Schedule checklist (optional — `/dashboard/po-linked/schedule`)

- [ ] List loads
- [ ] Create schedule: PO no + tool lines + qty
- [ ] Record appears in history

### Skip

- [ ] Purchase Order screen (placeholder)
- [ ] Purchase Order Report (placeholder)

**Suggested test time:** ~2–3 hours (GRN deep test)

---

## Module 6 — Tools History Card

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| History Card hub | `/dashboard/tools-history-card` | ✅ | `GAUGEANDTOOLS`, `GAUGE_SERIAL_NO`; PM write + docs | Search tool; unit history; Complete Preventive MNT; documents |
| Current Status | `/dashboard/tools-history-card/status` | 👁 | `GAUGEANDTOOLS` (pageSize 100) | Status snapshot; note 100-row cap vs ERP total |
| Current Holder | `/dashboard/tools-history-card/holder` | 👁 | Open `GAUGE_TOOLS_ISSUE` | Open issue DCs after shop-floor issue |
| Issue History | `/dashboard/tools-history-card/issue` | 👁 | `GAUGE_TOOLS_ISSUE` / lines | Recent issue DCs match Tool Issue |
| Receive History | `/dashboard/tools-history-card/receive` | 👁 ⚠️ | `/api/receive` — **open / pending returns** | Not a closed-receive archive; subtitle = awaiting Tool Receive |
| Calibration Records | `/dashboard/tools-history-card/calibration` | 👁 | `TOOLS_ISSUE_FOR_CALIBRATION` | Calib issue DCs |
| Calibration Results | `/dashboard/tools-history-card/calibration-results` | 👁 ⚠️ | Same pending queue as Results Update | Pending/open lines — completed results may leave the list after save |
| GRN History | `/dashboard/tools-history-card/grn` | 👁 | `TOOLS_PO_RECEIVE` / lines | PO receive history |
| Purchase Orders | `/dashboard/tools-history-card/purchase-orders` | 🔗 / 🚧 | None | Scope panel + links to GRN History / PO-linked Receive — no PO table |

**Purpose:** Mostly read-only lifecycle views used to **cross-check** after Issue / Receive / Calibration / GRN (hub also writes Preventive MNT complete).

**Suggested test time:** ~1 hour

### Checklist

- [ ] Search finds a known tool
- [ ] After a Tool Issue, Issue History / Current Holder update
- [ ] After Calibration Issue / Receive / Results, calib sub-pages update (results page = pending queue)
- [ ] After GRN, GRN History updates
- [ ] Receive History shows pending open returns (not posted archive)

---

## Module 7 — Reports & Analytics

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Reports hub | `/dashboard/reports` | 🔗 | Live KPIs from tools / due / suppliers / issues | Category cards + counts — **hub not in sidebar** (children are) |
| All Tool Reports | `/dashboard/reports/tools` | 👁 (+ export) | `GAUGEANDTOOLS`; `/api/reports/tools` | KPIs, preview (≤100), Excel / PDF full export |
| Calibration Reports | `/dashboard/reports/calibration` | 👁 (+ export) | Calib due + issue + pending; `/api/reports/calibration` | Due / overdue, export |
| Supplier Report | `/dashboard/reports/suppliers` | 👁 (+ export) | `SUPPLIER` | List + export |
| Subcontractor Report | `/dashboard/reports/subcontractors` | 👁 (+ export) | `SUBCONTRACTOR` | List + export |
| Tools History Report | `/dashboard/reports/tools-history` | 👁 (+ export) | Issue / receive / calib cross-cut | History export |
| Purchase Order Report | `/dashboard/reports/purchase-orders` | 🚧 | None — no export category | Skip |

Export categories that exist: `tools`, `calibration`, `suppliers`, `subcontractors`, `tools-history`.

### Checklist (per active report)

- [ ] KPI numbers load
- [ ] Preview table shows rows
- [ ] Download All Excel works
- [ ] Download All PDF works
- [ ] Export row count ≥ preview row count

**Suggested test time:** ~2 hours

---

## Module 8 — Settings

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Settings hub | `/dashboard/settings` | 🔗 | — | Link grid — **hub not in sidebar** (children are) |
| Company Settings | `/dashboard/settings/company` | 👁 | `COMPANY_DETAILS` | Company profile from ERP; no save |
| Branch Settings | `/dashboard/settings/branches` | 👁 | `LOCATION_MASTER`, distinct company / from-unit | Locations, company IDs |
| Tool Numbering | `/dashboard/settings/tool-numbering` | 👁 | Group prefixes (`OTHER_TOOLS_TYPE`) | Group prefix reference; no edit |
| Transaction Numbering | `/dashboard/settings/transaction-numbering` | 👁 | Same groups API | PO / GRN / Indent prefixes view |
| Audit Trail | `/dashboard/settings/audit-trail` | 👁 | Creat/update metadata on tools / issues / groups | Who last touched — **not** field-level diffs |
| Users | `/dashboard/settings/users` | 🚧 | — | Skip UI. Note: app auth already uses `TOOLS_APP_USER` (page copy may still say ERP-only — stale) |
| Roles | `/dashboard/settings/roles` | 🚧 | — | Skip UI; runtime roles via `rolePermissions.ts` |
| Permissions | `/dashboard/settings/permissions` | 🚧 | — | Skip |
| Approval Workflow | `/dashboard/settings/approval-workflow` | 🚧 | — | Skip |
| Email Notifications | `/dashboard/settings/notifications/email` | 🚧 | — | Skip |
| System Notifications | `/dashboard/settings/notifications/system` | 🚧 | — | Skip |
| Activity Logs | `/dashboard/settings/activity-logs` | 🚧 | — | Skip — needs new table; use Audit Trail for who-touched |

**Suggested test time:** ~30 minutes smoke test

---

## Recommended testing plan

| Phase | Modules | Approx. time | Priority |
|-------|---------|--------------|----------|
| 1 | Auth + Tool Group / Subgroup + Item/Asset Master | 1–2 days | **Must** |
| 2 | Calibration (Issue, **Receive**, Results, Due List) + Calib masters | 1 day | **Must** |
| 3 | Supplier / Subcontractor + Lookups + Tool Mapping | 0.5 day | **Must** |
| 4 | GRN (Purchase receive) | 0.5 day | **Should** |
| 5 | Tool Issue + Tool Receive | 0.5 day | **Should** |
| 6 | History Card + Reports | 0.5 day | **Should** |
| 7 | Dashboard overviews + Settings read-only | 0.25 day | Nice |
| — | PO create, Requisition, Users/Roles UI, Notifications, PO Report | — | **Skip (not built / out of scope)** |

**Hidden routes (optional):** Consumption (`/dashboard/transactions/consumption`), PO Schedule, Lookups, Settings/Reports hubs.

---

## Quick “is it built?” matrix

| Feature | Built? |
|---------|--------|
| Create Tool Master | ✅ |
| Bulk import / export tools | ✅ |
| Unsaved-changes guard on tool edit | ✅ (Item/Asset Master only — not a shared component) |
| Create Calibration Issue | ✅ |
| Create Calibration Receive (UI) | ✅ |
| Update Calibration Results | ✅ |
| Create Tool Issue DC | ✅ |
| Return tools (Tool Receive) | ✅ |
| Create GRN against PO | ✅ |
| Create Purchase Order | ❌ (ERP Purchasing module) |
| PO Schedule | ✅ (hidden URL; not in menu) |
| Tool Mapping | ✅ (create / list / delete; no edit) |
| User / Role management UI | ❌ (auth users exist in `TOOLS_APP_USER`; Settings pages are placeholders) |
| Purchase Order Report | ❌ |
| jose JWT edge verify | ✅ (`src/lib/authTokenEdge.ts` + middleware) |

---

## Known gaps while testing

1. **Purchase Order / PO Report** — intentionally unavailable; create POs in ERP Purchasing.
2. **Requisition / Users–Roles UI / Notifications / Activity Logs** — placeholders (`PendingFeature`).
3. **Settings Users/Roles page copy** may still claim “ERP-only users” — outdated vs standalone `TOOLS_APP_USER` login.
4. **History Card “Receive History”** shows **pending** open returns, not closed receive vouchers.
5. **History Card “Calibration Results”** uses the **pending** results queue (same as Results Update), not a completed archive.
6. Several dedicated master screens are **view-only**; edits may live on **Lookups** or Group / Subgroup pages. Lookups itself is **not in the sidebar**.
7. Export status filter on tools may not fully match list rollup status.
8. Rack / Area dropdowns may be empty if ERP `LOCATION_MASTER` has null area/rack.
9. Tool Master list / view / edit is still largely in-page state (browser Back / URL deep-link limited).
10. GRN supplier dropdown may list all suppliers (approved filter computed but not clearly applied).

---

## One-page print summary

| Area | Screens |
|------|---------|
| **Masters** | Group ✅ · Subgroup ✅ · Tool ✅ · Lookups ✅ (no menu) · Supplier ✅ · Subcontractor ✅ · Gauge/Calib freq 👁 · Mapping ✅ |
| **Calibration** | Due List 👁 · Issue ✅ · Receive ✅ · Results ✅ |
| **Purchase** | PO 🚧 · GRN ✅ · Schedule ✅ (hidden) |
| **Transactions** | Issue ✅ · Receive ✅ · Customer 👁 · Requisition 🚧 · Consumption ✅ (hidden) |
| **History** | Hub ✅ · most sub-pages 👁 · Receive/Results 👁⚠️ (pending queues) · PO history 🔗/🚧 |
| **Reports** | Hub 🔗 · Tools / Calib / Supplier / Subcon / History 👁+export · PO Report 🚧 |
| **Settings** | Hub 🔗 · Company / Branch / Numbering / Audit 👁 · Users / Roles / Notifications 🚧 |

---

## Related docs

- Reports module detail: [`docs/reports-and-analytics.md`](./reports-and-analytics.md)
- Codebase audit (4 Aug 2026): [`docs/modules-4-8-codebase-audit-2026-08-04.md`](./modules-4-8-codebase-audit-2026-08-04.md)

---

*End of module-wise testing guide.*
