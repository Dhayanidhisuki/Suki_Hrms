# Codebase audit — Modules 4–8 + ambiguities + menu

**Product:** SUKI Tools Management  
**Date:** 4 Aug 2026  
**Mode:** Read-only discovery (no code/DB changes)  
**Source of truth:** `src/app/dashboard/**/page.tsx`, `src/app/api/**`, `Sidebar.tsx`, `src/lib/auth*`  
**Compared against:** `docs/module-wise-testing-guide.md` (already has Module 4–8 tables; several entries are **stale vs code** — called out below)

### Legend (same as testing guide)

| Symbol | Meaning |
|--------|---------|
| ✅ | Full workflow — create / edit / delete or transaction write |
| 👁 | Read-only — list / view only |
| 🚧 | Placeholder — `PendingFeature` / not owned by this app |
| 🔗 | Hub / link page — navigation only |
| ⚠️ | Built but incomplete (API exists, UI missing, or not in menu) |

---

## Task 1 — Modules 4–8 screen inventory

### Module 4 — Calibration

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Calibration Issue | `/dashboard/calibration/issue` | ✅ | `TOOLS_ISSUE_FOR_CALIBRATION`, `TOOLS_TRANS_ISSUE_FOR_CALIBRATION`; updates `GAUGEANDTOOLS`; docs → `TOOLS_APP_DOCUMENT` | Create DC; stage due tools; lab/subcontractor; PDF; detail + attachment upload. Permission `canManageCalibration`. |
| Calibration Receive | `/dashboard/calibration/receive` | ✅ | `TOOLS_RECEIVE_FOR_CALIBRATION`, `TOOLS_TRANS_RECEIVE_FOR_CALIBRATION`; open calib issue headers/lines; `GAUGEANDTOOLS`; docs | **Create form exists** (select open DC → line checkboxes → POST). Partial then full receive; history list + certificate upload. |
| Results Update | `/dashboard/calibration/results-update` | ✅ | R/W `TOOLS_TRANS_ISSUE_FOR_CALIBRATION`; W `GAUGE_CONTROL_CARD_TRANS`, `GAUGEANDTOOLS`; R `LOCATION_MASTER` | After receive, enter PASSED / FAILED / RECALIBRATED + next date; export Excel/PDF of pending set. |
| Due List | `/dashboard/calibration/due-list` | 👁 | Primarily calib due from issue-line / control-card / tool master via `/api/tools/calibration-due` | Filters All / Overdue / 7d / 30d; “Issue now” deep-links to Issue with `?tool=`. |

**Flow (testable today):**

```
HISTORY_CARD_REQ = Yes tool
  → Due List
  → Calibration Issue (DC OPEN)
  → Calibration Receive (partial / full)   ← UI create is present
  → Results Update
  → Due List / Overview counts refresh
```

**Doc drift:** Existing guide marks Calibration Receive as `👁 ⚠️` (“list only; POST API exists; no create form”). **Code today has a full create form + `apiPost`.** Treat the guide as outdated on this row.

---

### Module 5 — Purchase (`po-linked`)

| Screen | Route | In sidebar? | Status | ERP / source | What to check |
|--------|-------|-------------|--------|--------------|---------------|
| Goods Receipt Note (GRN) | `/dashboard/po-linked/receive` | Yes | ✅ | W `TOOLS_PO_RECEIVE`, `TOOLS_PO_RECEIVE_TRANS`, `TOOLS_PRICE_MASTER`, `GAUGEANDTOOLS` qty; R `SUPPLIER`, `GAUGEANDTOOLS` | Create GRN (PO no free-text + supplier + lines); list/expand. **Ambiguity:** UI computes `isApproved` but dropdown appears to show all suppliers; PO is not live-linked to ERP PO rows. |
| Purchase Order | `/dashboard/po-linked/purchase-order` | Yes | 🚧 | None (mentions `COMMON_PURCHASE_ORDER` out of scope) | `PendingFeature` `kind="unavailable"` — skip create. |
| PO Schedule | `/dashboard/po-linked/schedule` | **No** | ✅ ⚠️ | W `TOOLS_PO_SCH_MASTER`, `TOOLS_PO_SCH_TRANS`; R `GAUGEANDTOOLS`, `SUPPLIER` | Create + list work. Hidden from sidebar. GET/PATCH `[id]` API exists; page does not edit. Supplier select disabled in form. Guide claims GRN auto-updates milestones — **not verified from UI alone; flag for API confirmation.** |
| Purchase Overview | `/dashboard/overview/purchase` | Via Dashboard | 🔗 | — | Link hub to GRN / Supplier / Subcontractor / PO. |

---

### Module 6 — Tools History Card

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| History Card hub | `/dashboard/tools-history-card` | ✅ / 👁+write | R `GAUGEANDTOOLS` (history-card tools), `GAUGE_SERIAL_NO`; W PM complete + docs `TOOLS_APP_DOCUMENT` | Search tool; open unit history; Complete Preventive MNT; documents. Mostly view + PM write. |
| Current Status | `/dashboard/tools-history-card/status` | 👁 | R `GAUGEANDTOOLS` (pageSize 100) | Status snapshot / KPIs vs table; note 100-row cap. |
| Current Holder | `/dashboard/tools-history-card/holder` | 👁 | R open `GAUGE_TOOLS_ISSUE` / lines via `/api/issue` | After shop-floor issue, holder appears; after receive, clears. |
| Issue History | `/dashboard/tools-history-card/issue` | 👁 | R `GAUGE_TOOLS_ISSUE` / `TOOLS_TRANS_ISSUE` | Recent DCs match Tool Issue module. |
| Receive History | `/dashboard/tools-history-card/receive` | 👁 ⚠️ | Calls `/api/receive` — **open/pending returns**, not closed receive vouchers | Subtitle in code: “Open / pending returns awaiting Tool Receive”. Do **not** expect posted `TOOLS_ISSUE_RECEIVED` archive here. Product-intent ambiguity. |
| Calibration Records | `/dashboard/tools-history-card/calibration` | 👁 | R `TOOLS_ISSUE_FOR_CALIBRATION` (+ lines) | Matches Calibration Issue history. |
| Calibration Results | `/dashboard/tools-history-card/calibration-results` | 👁 ⚠️ | Same pending source as Results Update (`loadCalibResultsPending` → `TOOLS_TRANS_ISSUE_FOR_CALIBRATION`) | Title implies archive; API is **pending/open** queue. Completed results may disappear after save. |
| GRN History | `/dashboard/tools-history-card/grn` | 👁 | R `TOOLS_PO_RECEIVE` / `TOOLS_PO_RECEIVE_TRANS` | Matches GRN posts (client-sliced). |
| Purchase Orders | `/dashboard/tools-history-card/purchase-orders` | 🔗 / 🚧 | None | Scope panel + links to GRN History / PO-linked Receive — no PO table load. |

---

### Module 7 — Reports & Analytics

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Reports hub | `/dashboard/reports` | 🔗 (+ live KPIs) | R via KPI / calib-due / `SUPPLIER` / `SUBCONTRACTOR` / `GAUGE_TOOLS_ISSUE` | Category cards navigate; KPIs load. **Not in sidebar** (sub-reports are). |
| All Tool Reports | `/dashboard/reports/tools` | 👁 (+ export) | R `GAUGEANDTOOLS`; export `/api/reports/tools` | Preview ≤100; Download All Excel/PDF. |
| Calibration Reports | `/dashboard/reports/calibration` | 👁 (+ export) | Calib-due + calib issue + pending results; export `calibration` | Export; deep-links to Due List / Results / History. |
| Supplier Report | `/dashboard/reports/suppliers` | 👁 (+ export) | R `SUPPLIER` | Counts vs Suppliers master; export. |
| Subcontractor Report | `/dashboard/reports/subcontractors` | 👁 (+ export) | R `SUBCONTRACTOR` | Counts vs master; export. |
| Tools History Report | `/dashboard/reports/tools-history` | 👁 (+ export) | Issue / receive / calib cross-cut; export `tools-history` | Export; “receives” KPI depends on `/api/receive` default mode. |
| Purchase Order Report | `/dashboard/reports/purchase-orders` | 🚧 | None | `PendingFeature` unavailable. **No** `purchase-orders` category in `/api/reports/[category]`. |

Export categories that exist: `tools`, `calibration`, `suppliers`, `subcontractors`, `tools-history`.

---

### Module 8 — Settings

| Screen | Route | Status | ERP / source | What to check |
|--------|-------|--------|--------------|---------------|
| Settings hub | `/dashboard/settings` | 🔗 | None | Link grid to all 12 settings screens. **Not in sidebar** (children are). |
| Company Settings | `/dashboard/settings/company` | 👁 | R `COMPANY_DETAILS` | Profile fields render; no save. |
| Branch Settings | `/dashboard/settings/branches` | 👁 | R `LOCATION_MASTER` (Item/Asset), distinct `GAUGEANDTOOLS.COMPANY_ID`, `GAUGE_TOOLS_ISSUE.FROM_UNIT` | Locations / company IDs load. |
| Tool Numbering | `/dashboard/settings/tool-numbering` | 👁 | R `OTHER_TOOLS_TYPE` via `/api/lookups/groups` | Prefix columns; no edit. |
| Transaction Numbering | `/dashboard/settings/transaction-numbering` | 👁 | Same groups API, different columns | PO/GRN/Indent prefixes view. |
| Email Notifications | `/dashboard/settings/notifications/email` | 🚧 | None | `PendingFeature` unavailable. |
| System Notifications | `/dashboard/settings/notifications/system` | 🚧 | None | `PendingFeature` unavailable. |
| Users | `/dashboard/settings/users` | 🚧 | None on page | `PendingFeature` `kind="scope"`. **Ambiguity:** copy says app does not maintain users, but `TOOLS_APP_USER` + JWT login exist (see Task 2 flag). |
| Roles | `/dashboard/settings/roles` | 🚧 | None on page | Same stale scope copy as Users. Role matrix lives in `src/lib/rolePermissions.ts`, not this UI. |
| Permissions | `/dashboard/settings/permissions` | 🚧 | None on page | Same as Roles. |
| Approval Workflow | `/dashboard/settings/approval-workflow` | 🚧 | None (mentions `PURCHASE_APPROVAL` in copy only) | Scope placeholder. |
| Audit Trail | `/dashboard/settings/audit-trail` | 👁 | Pseudo-audit from creat/update metadata on `GAUGEANDTOOLS`, `GAUGE_TOOLS_ISSUE`, `OTHER_TOOLS_TYPE` | Rows load; **not** field-level diffs. |
| Activity Logs | `/dashboard/settings/activity-logs` | 🚧 | None (explicitly needs new table) | Points testers to Audit Trail. |

---

## Task 2 — Ambiguity reconciliation

### a) `/dashboard/masters/tool-mapping`

**Implemented — not a placeholder.**

- Page: list + search + pager + **Add Mapping** drawer (`apiPost`) + delete (`apiDelete`).
- APIs: `GET/POST /api/tools-mapping`, `DELETE /api/tools-mapping/[id]` → Prisma `toolsMapping` / `TOOLS_MAPPING`.
- No edit/update of existing rows (create + delete + list only).
- In sidebar under Masters → Tool Masters.
- **Doc drift:** Module 2 table already says ✅; “Quick is it built?” matrix and Known gaps still say Tool Mapping ❌ / placeholder — **those sections are wrong.**

### b) `/dashboard/transactions/requisition-pending`

**Placeholder / scope-pending — not a working transaction screen.**

- Renders only `PendingFeature` (`kind="scope"`) explaining two possible ERP data sources; no requisition API under `src/app/api/`.
- In sidebar under Tool Requisition.
- Wording is “scope is still being finalized”, not literal “coming soon”.

### c) `/dashboard/transactions/consumption`

**Working API + UI; genuinely absent from sidebar.**

- UI: list + create form (DC → tool → worksheet → qty → supervisor verify); `apiGet`/`apiPost` `/api/consumption`; open issues from `/api/receive`; `RoleGate` `canLogConsumption`.
- API: `src/app/api/consumption/route.ts` (GET + POST on consumption issue-trans model).
- **Not** in `Sidebar.tsx` `navSections`.
- No other in-app `href` to `/dashboard/transactions/consumption` found under `src/` (direct URL / docs only).
- Existing guide correctly labels it “Consumption (hidden)”.

### d) `/dashboard/transactions/customer-receive`

**Read-only by design; no partially-built create flow on this page.**

- Only `apiGet("/api/issue?customerOnly=1&pageSize=50")`.
- Subtitle: filtered `GAUGE_TOOLS_ISSUE` where `CUST_CODE` present — not a separate table.
- Link to full Tool Issue for creates; no `apiPost`, no create modal.
- Customer filter implemented in issue API (`customerOnly=1`).

### e) “Unsaved changes” on navigation-away

**Single location — not a shared component.**

| Location | Behavior |
|----------|----------|
| `src/app/dashboard/masters/tools/page.tsx` only | `isFormDirty`, in-app leave dialog (Stay / Don't save / Save), `beforeunload` |

Grep for `unsaved`, `isFormDirty`, `beforeunload`, `Don't save`, `Stay on page` hits **only** this file. No reusable `UnsavedChangesDialog` (or equivalent) elsewhere.

### f) Loading spinner / loading-state components

**One shared spinner family + shared table skeleton + unused skeleton variants + text-only “Saving…”.**

| Component | Path | Role |
|-----------|------|------|
| `LogoSpinner` | `src/components/LogoSpinner.tsx` | Animated logo SVG (`.logo-spin`) |
| `PageLoader` | `src/components/PageLoader.tsx` | Full-screen overlay → `LogoSpinner` |
| `NavigationLoader` | `src/components/NavigationLoader.tsx` | Brief `PageLoader` on pathname change; mounted in root layout |
| Root / dashboard `loading.tsx` | `src/app/loading.tsx`, `src/app/dashboard/loading.tsx` | Both → `PageLoader` |
| `TableSkeleton` | `src/app/dashboard/components/LoadingSkeleton.tsx` | Pulse rows — widely used |
| `CardSkeleton` / `FormSkeleton` | same file | **Defined, unused** in pages found |

Also: login uses `LogoSpinner` directly; many Suspense fallbacks use `PageLoader`; buttons use plain “Saving…” / “Loading…” text (no separate CSS `animate-spin` circle components found).

**Verdict:** One shared spinner (`LogoSpinner` → `PageLoader` / `NavigationLoader`); list loading is mostly `TableSkeleton`; not several unrelated spinner libraries.

### g) JWT verification (jose) for edge middleware

**Yes — already present, separate from the login route.**

| File | Role |
|------|------|
| `src/lib/authTokenEdge.ts` | `jwtVerify` from **jose**; `verifyAuthTokenEdge()` |
| `src/middleware.ts` | Calls `verifyAuthTokenEdge` on non-public routes |
| `src/lib/authToken.ts` | Node **jsonwebtoken** `signAuthToken` / `verifyAuthToken` |
| `src/app/api/auth/login/route.ts` | Signs via Node `signAuthToken` (not jose) |
| `src/lib/session.ts` / `api/auth/me` | Node verify for route handlers |

Edge jose verify is **not** inside the login page/route; it is a dedicated Edge utility used by middleware.

---

### Extra flags (product / doc ambiguity — do not assume)

1. **Settings Users/Roles/Permissions copy is stale relative to Aug 2026 auth.** Pages still say “Tools Management does not maintain its own user or role records — access is read directly from ERP,” but the app has `TOOLS_APP_USER`, bcrypt login, JWT cookie, and `rolePermissions.ts`. UI remains placeholder; reason text is wrong.
2. **History Card “Receive History”** = pending open returns, not closed receive history.
3. **History Card “Calibration Results”** = pending results queue (`loadCalibResultsPending`), not completed archive.
4. **PO Schedule ↔ GRN auto-milestone update** claimed in some UI/guide text — confirm in GRN API before documenting as fact.
5. **GRN supplier “approved” filter** may be computed but not applied in the create dropdown.

---

## Task 3 — Sidebar / menu audit

**Menu source:** `navSections` in `src/app/dashboard/components/Sidebar.tsx` (sole sidebar config). No extra dashboard leaf hrefs in `TopNav.tsx`.

### Working pages with **no** sidebar menu entry

| Route | Notes |
|-------|--------|
| `/dashboard/transactions/consumption` | Full UI + API (hidden by design / docs) |
| `/dashboard/masters/lookups` | Full consolidated lookups CRUD |
| `/dashboard/masters/item-name` | Redirect-only → `/dashboard/masters/tool-types` |
| `/dashboard/po-linked/schedule` | Full schedule create/list UI + API |
| `/dashboard/settings` | Settings index hub (children are in menu) |
| `/dashboard/reports` | Reports index hub (children are in menu) |

### Sidebar menu entries with **no** matching page

**None.** Every `href` in `navSections` resolves to a `page.tsx`.

### Auth routes (outside dashboard menu — expected)

| Route | Page? | Notes |
|-------|-------|--------|
| `/login` | Yes | Public in middleware |
| `/auth/session-expired` | Yes | Public; invalid/expired JWT redirect target |

### Menu entries that **are** placeholders (page exists, feature does not)

These are not “broken links,” but menu → `PendingFeature` only:

- `/dashboard/transactions/requisition-pending`
- `/dashboard/po-linked/purchase-order`
- `/dashboard/reports/purchase-orders`
- Settings: email/system notifications, users, roles, permissions, approval-workflow, activity-logs
- History Card purchase-orders is a scope/link panel (not `PendingFeature`, but no data)

---

## Suggested doc corrections (for when you update the testing guide)

Do **not** treat this file as an automatic patch — for human merge:

1. Calibration Receive → ✅ (create UI present); remove “biggest calibration gap” / “Receive create cannot be tested from UI.”
2. Tool Mapping → ✅ create/list/delete; remove from Skip / “not built” matrix.
3. Consumption → keep as ✅ hidden (accurate).
4. History Card Receive / Calibration Results → note pending-queue semantics.
5. Settings Users/Roles reason text → reconcile with `TOOLS_APP_USER` auth model.
6. Recommended plan “Skip … Tool Mapping” → outdated.

---

*End of audit report. No code, migrations, or DB changes were made.*
