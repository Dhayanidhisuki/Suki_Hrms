# Implementation Prompt — Close ERP Gaps

**Use this document as the agent/developer brief.**  
**Source of truth for gaps:** [`docs/erp-gap-analysis.md`](./erp-gap-analysis.md)  
**Product:** SUKI Tools Management (Next.js 16 / Prisma / SQL Server ERP DB)  
**Do not invent ERP columns** — only use fields already in `prisma/schema.prisma` unless a column is confirmed missing and signed off.

---

## Prompt (copy-paste for an agent)

```
You are implementing ERP parity gaps for SUKI Tools Management.

Read and follow:
1. docs/erp-gap-analysis.md — full gap inventory (§1–§18)
2. docs/erp-gap-implementation-prompt.md — this file (phases, rules, acceptance)
3. Existing UI patterns: OverlayModal, form.tsx, SearchSelect, RoleGate, appToast, DataTable/pager
4. Auth: JWT session + requirePermission from rolePermissions.ts
5. AGENTS.md / Next.js docs in node_modules/next/dist/docs/ before new APIs

Rules:
- Preserve ERP table structures. Prefer Prisma models as mapped today.
- Match existing visual language (theme tokens, form-label/form-control, OverlayModal URL sync).
- No drive-by refactors. Touch only files needed for the current phase task.
- For each closed gap: update the matching section in docs/erp-gap-analysis.md (mark ✅ / remove ❌).
- Do NOT implement Phase X (scope-out) items unless the user explicitly overrides.
- Prefer small PRs / commits per phase task when asked to commit.
- After each phase task: run lint on touched files; smoke the route manually if possible.

Work phases in order. Complete Phase 0 decisions first if any item is still ambiguous.
```

---

## Hard constraints

| Rule | Detail |
|------|--------|
| Schema | No destructive ERP DDL. New app-only tables only with explicit user approval. |
| Auth | All APIs: `requireSession` + `requirePermission` where masters/transactions require it. |
| Audit | Writes must set `creatUserIdCd` / `lstUpdtUserIdCd` via ERP-safe user id (`erpActor` / `erpUserCode`). |
| UX | List stays mounted; create/edit in `OverlayModal` + `?action=` where that pattern already exists. |
| Exports | Reuse existing Excel/PDF helpers (`xlsx`, `jspdf`, `serverReportExport`) — don’t invent a new stack. |
| Out of scope by default | Full Purchasing PO create/approve/mail; Finance GRN ledger posting / TDS / short-close (§12–§13 Phase X). |

---

## Phase 0 — Scope decisions (ask user once, then lock)

Answer these before coding Phase 3+ finance/customer items:

1. **PO (§12):** Keep read-only list + GRN deep-link, or build create/approve in Tools app?  
   → Default: **keep out of scope** (PendingFeature / read-only).  
2. **ERP GRN finance (§13):** Tools-only GRN forever, or add posting later?  
   → Default: **tools-only**; improve tools GRN filters/validation only.  
3. **Customer Material Overview (§11):** Build real customer GIR receive, or rename UI to “Customer Issues” and stop?  
   → Default: **build minimal customer receive** if tables exist; else rename + document.  
4. **Calib Results finance posting (§16):** In scope?  
   → Default: **out of scope**; ship observed-spec grid + filters without ledger.  
5. **Issue Type enums:** Align to demo ERP (`For Employee`, `For Department`) and drop `For Trial`, or keep both sets?  
   → Default: **union both** for compatibility: Regular/Asset/Product/Employee/Department/Trial.

Record answers at the top of this file under “Locked decisions” when confirmed.

### Locked decisions

| # | Decision | Answer | Date |
|---|----------|--------|------|
| 1 | PO create in Tools app | **OUT** — read-only / PendingFeature | 2026-08-06 |
| 2 | Finance GRN posting | **OUT** — tools-only GRN | 2026-08-06 |
| 3 | Customer GIR receive | **MINIMAL if tables exist, else rename** | 2026-08-06 |
| 4 | Calib finance posting | **OUT** — results UI without ledger | 2026-08-06 |
| 5 | Issue Type enum set | **UNION** — Regular/Asset/Product/Employee/Department/Trial | 2026-08-06 |

---

## Phase 1 — Quick wins (masters parity)

**Goal:** Close low-risk field/UX gaps on existing CRUD screens.

### 1.1 Tool Group (`/dashboard/masters/tools-group`) — gap §1

- [x] Remove or relabel redundant “Group Code”; primary name = ERP “QMS Item & Others Type”; prefix = “Item No.Prefix”.
- [x] Add Excel export of current filtered list.
- [ ] Optional: client column sort; Search By dropdown if cheap.
- [x] Keep Gate Entry on create (already better than ERP New dialog).

**Accept:** Labels match ERP mental model; export downloads `.xlsx`.

### 1.2 Tool Subgroup (`/dashboard/masters/tools-subgroup`) — gap §2

- [x] `Prefix Based` → required select: `Group` | `Type` (not free text).
- [x] `Type Prefix` (`prefixToolsNo`) required on create/edit.
- [x] Default `isAutoGenCd` to `Yes`.
- [x] List columns: Ref No (`rowId`), Auto-gen, Prefix Based.
- [x] Filter by parent group + Excel export.
- [x] Asset Category: skip unless Phase 0 says include (validators historically excluded junk).

**Accept:** Cannot save without Type Prefix + Prefix Based; defaults match ERP.

### 1.3 Tools Name for Type (`/dashboard/masters/tool-types`) — gap §7

- [x] Excel export.
- [ ] Optional pager if list grows large.

**Accept:** Export works; CRUD unchanged.

### 1.4 Gauge Type (`/dashboard/masters/gauge-types`) — gap §6

- [x] Wire dedicated page to full CRUD using existing `/api/lookups/gauge-types` (+ `[id]`).
- [x] Form field: `typeOfGauge` only (fix Lookups body alias bug).
- [x] Show Created By / Created Dt on list.
- [x] Excel export.
- [x] Remove hardcoded fallback list when DB has rows.

**Accept:** Add/Edit/Delete on `/dashboard/masters/gauge-types` against live `GAUGE_TYPE`.

### 1.5 Shared master polish

- [x] Excel export helper shared where practical (Group, Subgroup, Gauge, Tool Types, Mapping).
- [x] RoleGate unchanged (`canEditMaster` / `canDeleteMaster`).

---

## Phase 2 — Item/Asset Master + Mapping + Pricing

### 2.1 Tools Manage (`/dashboard/masters/tools`) — gap §3

- [x] **Issue Type** options = locked Phase 0 set (update `ERP_ISSUE_TYPES` + UI selects + validators).
- [x] List filters: Only Active; Group → Type → Name cascade; Critical; Department.
- [x] List columns add: Old Item No, Group, Type, Type Name, UOM (where missing).
- [x] Search field picker (tool no / description / oldItemNo / location / …) — implement subset that maps cleanly to Prisma.
- [x] Editable **Stock Item** (stop hardcoding `"Y"`).
- [x] Display **Location Output Name** (read-only OK if derived).
- [x] Wire **Tools Details** satellite UI to `/api/tools/[id]/details` (cavity, life, hardness…).
- [ ] Optional P2: Mandatory Documents checklist; Product Mapping; Check List — only if APIs/tables exist.

**Accept:** Filters match ERP toolbar intent; Issue Types include Employee/Department; Tools Details openable from edit/view.

### 2.2 Tool Mapping — gap §4

- [x] Vendor Type: `Supplier` | `SubContractor`.
- [x] Persist subcontractor mappings if schema allows (`supCode` reuse or confirm column); if schema is supplier-only, document limitation and store with clear prefix/convention **only if already used in ERP data**.
- [x] Filter: pick vendor → Get Details (load mappings).
- [x] List: last updated if available; Excel export.

**Accept:** Can map tool ↔ supplier (and subcon if data model allows); filter-by-vendor works.

### 2.3 Pricing — gap §5

- [x] Switch `GET /api/pricing` to `prisma.toolsPriceMaster` when Manpro has rows; keep JSON fallback behind env flag `PRICING_SOURCE=json|db`.
- [x] Add create/edit UI (rate, rev, approval status) **or** explicit read-only banner + “rates written via GRN” if Phase 0 says no CRUD.
- [ ] Filters: Vendor Type, Group, Rev.Status, date range, search by Item No / Vendor. *(partial — existing client filters retained)*
- [ ] PDF + Excel export parity.

**Accept:** Live DB path works in staging; UI matches chosen scope (CRUD or documented RO).

---

## Phase 3 — Transactions (Issue / Receive / Customer)

### 3.1 Tool Issue — gap §8

- [x] Edit open DC (header + lines) with permission.
- [x] Delete/cancel open DC (soft status if ERP uses status, else delete with confirm).
- [x] Customer party picker → `custCode` when `issueOption` = Customer.
- [x] Date-range filters; Excel export of list.
- [x] Optional: `issuePurpose`, `fromUnit`, `matType`, line `remarks`.
- [x] GST columns: **skip** unless columns exist on issue tables (don’t fake).

**Accept:** Can create, edit, cancel open DC; Customer issues populate `custCode`.

### 3.2 Tool Receive — gap §9

- [x] Align line statuses with ERP set where schema allows: Received / Damaged / Missing / WORN OUT / BROKEN / REJECTED / AVAILABLE FOR USE (map carefully to stored values).
- [x] Expose `geDate`, `invoiceNo` on form if columns exist.
- [x] Party type filter + working Supplier/Customer pickers.
- [x] Excel export.

**Accept:** Receive form fields + status vocabulary match ERP for tools domain.

### 3.3 Customer Material Overview — gap §11

- [x] Per Phase 0: either  
  - **A)** Implement customer GIR list + create against real tables, or  
  - **B)** Rename page to “Customer Tool Issues”, keep filter, link to Issue.  
- [x] If A: GIR No, invoice, WIP/CLOSED, Excel reports. *(N/A — Path B chosen; no GIR tables in app Prisma)*

**Accept:** UI no longer misleads; chosen path documented in gap analysis.

---

## Phase 4 — Calibration & Preventive

### 4.1 Calibration Issue — gap §10

- [x] Edit open calib DC.
- [x] History filters: Issued For, Party, From/To date.
- [x] Keep Issue For = Calibration | Preventive MNT.

**Accept:** Edit + filters work; PDF/attachments unchanged.

### 4.2 Calibration Results — gap §16

- [x] Filters: Update/Review (if meaningful), due date range, Open/Closed, search by Tool/DC/Issued To.
- [x] Align result status options with ERP where possible (AVAILABLE FOR USE, WORN OUT, BROKEN, REJECTED, NOT IN USE) **plus** keep PASSED/FAILED if already written in data — map explicitly in code comments.
- [x] Observed-spec grid (parameter / obs min-max / remarks) if `TOOLS_SPECIFICATION` or related storage exists; otherwise store structured JSON only with approval.
- [x] **Do not** build Finance Posting unless Phase 0 overrides.

**Accept:** Richer results entry + filters; no ledger unless approved.

### 4.3 Preventive MNT Results — gap §17 (**new page**)

- [x] New route e.g. `/dashboard/calibration/preventive-results` (or `/dashboard/preventive/results`).
- [x] Sidebar entry under Calibration.
- [x] List open PM DCs / due units: DC, Issue date, Tool, SI.No, Group, Type, Pre.Due, Status, Issued To.
- [x] Form: Pre.MNT Dt, Nxt Pre.MNT Dt, Result Status, Comments, Doc upload.
- [x] Wire to existing `preventive-complete` / extend API as needed.
- [x] Consume `GET /api/tools/preventive-due` for due queue.

**Accept:** End-to-end: Issue For=PM → Results page updates next PM date.

### 4.4 Calib / PM Calendar — gap §18 (**new page**)

- [x] New route e.g. `/dashboard/calibration/calendar`.
- [x] Filters: Year, From/To month, Issued For (ALL/Calibration/Preventive), Group, Type.
- [x] Grid: Item No × months with Plan / Actual markers.
- [x] Excel export.
- [x] Data from next calib / next PM dates + completed results history.

**Accept:** Year view renders; export works; Due List remains for short-horizon ops.

### 4.5 Due List polish — gap §6 related

- [x] Optional export; deep-link already exists — keep.
- [x] Link to calendar page.

---

## Phase 5 — Supplier / Subcontractor field expansion

### 5.1 Suppliers — gap §14

Add to form/list **only fields present on Prisma `Supplier`** first:

- [x] Bank Name, Account Number, IFSC (already in schema).
- [x] Then evaluate ERP-only columns (Vendor Code, Short Name, ASN, Contact, Mobile, ISO, MSME, Udyog Aadhaar, PAN, Weighment):  
  - If missing from Prisma → `prisma db pull` check; **do not invent**.  
  - If present but unmapped → map + UI.  
  - **Result:** not present on app Prisma `Supplier` — left out; noted in UI copy.
- [x] Status: support BLOCKED if column values used in DB.
- [x] Excel export.
- [x] Sync-to-Customer/Subcontractor: **out of scope** unless requested.

### 5.2 Subcontractors — gap §15

- [x] Same approach as suppliers against `Subcontractor` model.
- [x] Surface `approvedSubcontractor`, `add2` if unused.
- [x] Pager + Excel.
- [x] Sync dialog: out of scope by default.

**Accept:** Forms expose all mapped Prisma fields; extras only after schema confirm.

---

## Phase X — Explicitly out of scope (do not implement unless unlocked)

| Item | Gap § | Reason |
|------|-------|--------|
| Full PO create/approve/mail/payments | 12 | Owned by ERP Purchasing |
| Finance GRN ledger / TDS / short-close | 13 | Finance module |
| Calib results Finance Posting / Remove Posting | 16 | Finance |
| Supplier↔Customer sync-up | 14–15 | Cross-master ERP utility |
| Depreciation % / Asset.Category on tool if no column | 3 | Schema absence |

When implementing related screens, leave clear `PendingFeature` or help text pointing to ERP.

---

## Suggested implementation order (sprints)

| Sprint | Phases | Focus |
|--------|--------|-------|
| S1 | 0 + 1 | Decisions + masters quick wins |
| S2 | 2.1–2.2 | Tools Manage + Mapping |
| S3 | 2.3 + 3 | Pricing + Issue/Receive/Customer |
| S4 | 4.1–4.3 | Calib issue/results + **PM Results page** |
| S5 | 4.4–4.5 | Calendar + due list links |
| S6 | 5 | Supplier/Subcontractor field fill |

---

## Per-task checklist (agent must complete)

For every task:

1. Read the matching § in `erp-gap-analysis.md`.  
2. Confirm Prisma fields exist.  
3. Implement API then UI (or UI-only if API exists).  
4. Match RoleGate permissions.  
5. Lint touched files.  
6. Update gap doc status for that §.  
7. Short note in response: files changed + how to test.

---

## File map (start here)

| Area | Primary paths |
|------|----------------|
| Groups / Subgroups | `src/app/dashboard/masters/tools-group`, `tools-subgroup`, `src/app/api/lookups/groups*`, `subgroups*` |
| Tools master | `src/app/dashboard/masters/tools/page.tsx`, `src/app/api/tools/**`, `src/lib/toolCreate.ts`, `validators.ts` |
| Mapping | `src/app/dashboard/masters/tool-mapping`, `src/app/api/tools-mapping/**` |
| Pricing | `src/app/dashboard/masters/pricing`, `src/app/api/pricing`, `src/lib/esskayPricing.ts` |
| Gauge / Tool types | `gauge-types`, `tool-types`, `api/lookups/**` |
| Issue / Receive | `transactions/issue`, `transactions/receive`, `api/issue`, `api/receive` |
| Calibration | `calibration/**`, `api/calibration/**` or tools calib routes |
| Preventive | `api/tools/preventive-*`, History Card, **new results page** |
| Suppliers / Subs | `masters/suppliers`, `subcontractors`, matching APIs |
| Shared UI | `components/ui/OverlayModal.tsx`, `form.tsx`, `SearchSelect.tsx`, `lib/appToast.ts` |

---

## Definition of done (whole program)

- [ ] All Phase 1–5 tasks done or explicitly deferred with note in gap analysis.  
- [ ] Phase X items labeled out-of-scope in UI where users might expect them.  
- [ ] `docs/erp-gap-analysis.md` glance table updated.  
- [ ] No new schema inventions without approval.  
- [ ] Masters + calib/PM happy paths smoke-tested.

---

## One-shot agent kickoff (single phase)

```
Implement Phase 1 from docs/erp-gap-implementation-prompt.md
(§1 Group, §2 Subgroup, §6 Gauge Type, §7 Tool Types Excel).
Follow Hard constraints. Update docs/erp-gap-analysis.md as you close items.
Do not start Phase 2+.
```

```
Implement Phase 4.3 only: Preventive MNT Results page
(docs/erp-gap-implementation-prompt.md + gap §17).
Add sidebar link. Reuse preventive-complete API; extend if needed.
```
