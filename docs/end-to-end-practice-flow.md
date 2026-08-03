# SUKI Tools — Complete End-to-End Practice Flow

**Audience:** You (tester) learning every module from scratch  
**Date:** 1 Aug 2026  
**Goal:** One continuous story: **setup → buy → stock → issue/return → calibrate → verify in history/reports**

Use a notepad. Write down every code you create (Supplier, Tool, DC, GRN). You will reuse them in later steps.

---

## Before you start

| Item | Value |
|------|--------|
| Login | `/login` — seed admin (`admin` + password from `.env` / what you last set) |
| Rule | Prefer **create new test data** with a prefix like `TST-` so you can find it later |
| Skip forever | Purchase Order create screen, Users/Roles, Tool Mapping, Requisition (placeholders) |
| PO truth | **PO is created in ERP Purchasing.** This app only does **GRN** against a PO number |

### Live samples you can reuse if create fails

| Need | Live example |
|------|----------------|
| Stock tool (issue/return) | `OTH_J-0001` (qty may be 1 — check Item/Asset Master) |
| History card tool | `MP-QRG-174`, `MP-DMIC-18` |
| Existing supplier | `SUP-000001` BHARAT AEROSPACE METALS |
| Existing GRN PO ref | `PO/GC-J0212` (already has GRNs — fine to browse; for new GRN invent `PO/TST-xxxx`) |

---

## Big picture (memorize this)

```
0 Auth
  → 1 Dashboard (smoke)
  → 2 Masters setup
        Tool Group → Subgroup → Tool
        Supplier + Subcontractor
  → 3 Purchase path
        Supplier ready → GRN (PO no from ERP or test PO string) → stock ↑
  → 4 Shopfloor path
        Tool Issue → Current Holder → Tool Receive → stock back
  → 5 Calibration path
        Due List → Calib Issue → Results Update
        (Receive UI is list-only today)
  → 6 History Card + Reports (prove everything stuck)
```

**Estimated time if done carefully:** ~1.5–2 days first pass.

---

## Day A — Auth, shell, dashboard (~30 min)

### A1. Auth
1. Log out if logged in.
2. Open `/dashboard` → should bounce to `/login?redirect=…`
3. Empty login → client validation.
4. Wrong password → generic error.
5. Valid login → `/dashboard`.
6. TopBar → Sign Out → `/dashboard` blocked again.
7. Login again.

**Pass when:** cookie session works; theme/sidebar load.

### A2. Dashboard hubs
Open each once; click one card link each:

| Screen | Route |
|--------|-------|
| Tool Overview | `/dashboard` |
| Transaction Overview | `/dashboard/overview/transactions` |
| Calibration Overview | `/dashboard/overview/calibration` |
| Purchase Overview | `/dashboard/overview/purchase` |

**Pass when:** KPIs load; links land on Issue / GRN / Supplier / Calib as labeled.

---

## Day B — Masters setup (foundation) (~half day)

Do this in order. Later modules depend on it.

### B1. Tool Group
`/dashboard/masters/tools-group`

- [ ] Create group e.g. `TST GROUP` (or use existing group you know)
- Note prefixes if shown (tools / PO / GRN)

### B2. Tool Subgroup / Type
`/dashboard/masters/tools-subgroup`

- [ ] Create type under your group
- Note type prefix

### B3. Lookups (optional but useful)
`/dashboard/masters/lookups`

- [ ] Confirm Gauge Types / Calib Frequency / Tool Types list
- [ ] Edit one small value or leave as view-only if data is shared ERP

### B4. Supplier Master ⭐ (purchase path starts here)
`/dashboard/masters/suppliers`

- [ ] List loads; search works
- [ ] Create supplier:
  - Code: `TST-S001` (or accept auto if any)
  - Name: `TST PRACTICE SUPPLIER`
  - Status: Active
  - Approved: Yes if field exists
- [ ] Edit → change phone/city → save
- [ ] Filter Active / Approved
- **Write down:** `SUP_CODE = ________`

Also open report later: `/dashboard/reports/suppliers` — your supplier should appear after create.

### B5. Subcontractor Master ⭐ (calibration path)
`/dashboard/masters/subcontractors`

- [ ] List loads
- [ ] Create or open existing (e.g. browse first 3)
- [ ] Note `SUB_CON_ID` for calib issue “issue for / vendor”
- **Write down:** `SUB_CON_ID = ________`

Report: `/dashboard/reports/subcontractors`

### B6. Item/Asset Master ⭐
`/dashboard/masters/tools`

**Create Tool A — shopfloor / stock tool (History Card = No)**

- [ ] New tool
- [ ] Next # or set `TST-ISSUE-001`
- [ ] Group / Type / Name / UOM / Location
- [ ] History Card = **No**
- [ ] Tot Qty = 5 (or enough to issue)
- [ ] Save
- Confirm list shows qty in

**Create Tool B — calibration tool (History Card = Yes)** — only if you will test calib create

- [ ] `TST-CAL-001`
- [ ] History Card = **Yes**
- [ ] Calibration frequency months > 0 (required)
- [ ] Save → open detail → Add 1 physical unit if form shown
- Note serial / unit appears

**Also practise**

- [ ] Search your tools
- [ ] View → Edit → unsaved change → Back → dialog Save / Don’t / Stay
- [ ] Export filtered (optional)

**Write down:**

| Role | Tool No | History Card | Starting Qty In |
|------|---------|--------------|-----------------|
| Issue/Receive | | No | |
| Calib | | Yes | |

**If create is blocked:** use live `OTH_J-0001` for issue and `MP-QRG-174` for history card view only.

### B7. Supporting masters (smoke)

| Screen | Route | Do |
|--------|-------|-----|
| Pricing | `/dashboard/masters/pricing` | Open; see tool+supplier rates |
| Reorder Level | `/dashboard/masters/reorder-level` | Open list |
| Gauge Types | `/dashboard/masters/gauge-types` | Open list |
| Calib Frequency | `/dashboard/masters/calib-frequency` | Open list |
| Tool Mapping | `/dashboard/masters/tool-mapping` | Placeholder — skip |

---

## Day C — Purchase & supplier module (~2–3 hours)

This is the **buy → stock** path.

### C1. Purchase Overview
`/dashboard/overview/purchase`

- [ ] Cards/links to GRN, Supplier, Subcontractor, PO
- [ ] PO link may be placeholder — expected

### C2. Supplier again in purchase context
`/dashboard/masters/suppliers`

- [ ] Find `TST PRACTICE SUPPLIER` (or `SUP-000001`)
- [ ] Confirm Active + usable on GRN dropdown

### C3. Goods Receipt Note (GRN) ⭐ main purchase screen
`/dashboard/po-linked/receive`

**Browse first**

- [ ] List of existing GRNs loads (e.g. around GIR 4037+)
- [ ] Expand one → lines show item/qty/price

**Create a practice GRN**

1. New GRN
2. **PO Order No:** `PO/TST-FLOW-001`  
   (Fake is OK in this app — PO is not validated against COMMON_PURCHASE_ORDER)
3. **Supplier:** your `TST-S001` / `SUP-000001`
4. **Date:** today
5. **Lines:** add Tool A (`TST-ISSUE-001` or `OTH_J-0001`)  
   - Inv qty / Rec qty = 2  
   - Price = any e.g. 100
6. Save

**Verify**

- [ ] GRN appears in list
- [ ] Item/Asset Master → Tool A **Qty In increased** by received qty
- [ ] History Card → GRN History → search PO or tool
- [ ] Reports → optional tools / history export

**Write down:** `GIR_NO / PO = ________`

### C4. What you cannot test here

| Action | Why |
|--------|-----|
| Create real Purchase Order | Owned by ERP Purchasing — screen is 🚧 |
| PO Report | 🚧 |
| History Card → Purchase Orders | Scope note only |

### C5. PO Schedule (optional, hidden)
`/dashboard/po-linked/schedule`

- [ ] List loads
- [ ] Create schedule against `PO/TST-FLOW-001` + tool line (if you want)

### C6. Pricing cross-check
`/dashboard/masters/pricing`

- [ ] If rates exist for your tool+supplier, note them; else smoke only

**Day C pass:** Supplier exists → GRN posted → tool stock up → GRN visible in history.

---

## Day D — Tool transactions (~2–3 hours)

Depends on stock from Day C (or live `OTH_J-0001`).

### D1. Tool Issue
`/dashboard/transactions/issue`

1. New Issue
2. Receive Name: `TST Holder`
3. Return Due Date: today or tomorrow (must be filled)
4. Employee ID: leave blank (saves as 0) or a real EMP if you have one
5. Search tool with stock (`TST-ISSUE-001` / `OTH_J-0001`) — use **available-only** search
6. Stage qty 1
7. Confirm

**Verify**

- [ ] Success DC number — write `DC = ________`
- [ ] Tool Qty In −1, Qty Out +1
- [ ] History Card → Current Holder → filter your DC / holder
- [ ] History Card → Issue History → same DC

### D2. Tool Receive
`/dashboard/transactions/receive`

1. Search your DC (not the whole 18k — use search)
2. Open receive form
3. Receive date today
4. Qty returning = 1 (or partial)
5. Confirm

**Verify**

- [ ] DC Closed (full) or PARTIAL
- [ ] Stock restored for returned qty
- [ ] Holder list no longer shows that line (or qty reduced)

### D3. Customer Receive / Requisition
- Customer Receive: list-only smoke
- Requisition: skip placeholder

**Day D pass:** Issue → Holder shows → Receive → stock back.

---

## Day E — Calibration (~2–3 hours)

### E1. Due List
`/dashboard/calibration/due-list`

- [ ] Filters: All / Overdue / 7d / 30d
- [ ] Pick a due tool (or your `TST-CAL-001` if due)

### E2. Calibration Issue
`/dashboard/calibration/issue`

- [ ] Create DC; select tool(s); issue for lab/subcontractor
- [ ] Save — note calib DC
- [ ] History Card → Calibration Records

### E3. Calibration Receive
`/dashboard/calibration/receive`

- [ ] List loads
- [ ] **No create form today** — mark as known gap; do not block practice

### E4. Results Update
`/dashboard/calibration/results-update`

- [ ] Find pending line (e.g. after your issue, or live pending)
- [ ] Set PASSED / FAILED / RECALIBRATED + next date
- [ ] Save
- [ ] Due List / History Card → Calibration Results refresh

**Day E pass:** Calib issue + results update work; receive UI gap noted.

---

## Day F — History Card module (~1 hour)

`/dashboard/tools-history-card`

### F1. Hub
- [ ] Only History Card = Yes tools
- [ ] Search `MP-QRG-174` (or your calib tool)
- [ ] Open card → units grid (serial, cali dates, holder)

### F2. Walk every tab (use module pills)

| Tab | What you prove with your practice data |
|-----|----------------------------------------|
| Current Status | Roll-up status for history-card tools |
| Current Holder | Your open issue DCs / holders |
| Issue History | Your Tool Issue DC |
| Receive History | Pending returns |
| Calibration Records | Your calib DC |
| Calibration Results | Pending/done results |
| GRN History | Your GRN / PO |
| Purchase Orders | Scope note only |

Sidebar tip: only **one** menu item should highlight (longest match).

---

## Day G — Reports (~1–2 hours)

| Report | Route | Check |
|--------|-------|-------|
| Hub | `/dashboard/reports` | Counts load |
| Tools | `/dashboard/reports/tools` | Preview + Excel/PDF |
| Calibration | `/dashboard/reports/calibration` | Due/overdue |
| Suppliers | `/dashboard/reports/suppliers` | Your TST supplier |
| Subcontractors | `/dashboard/reports/subcontractors` | List + export |
| Tools History | `/dashboard/reports/tools-history` | Issue movement export |
| Purchase Order Report | — | Skip 🚧 |

---

## Day H — Settings smoke (~20 min)

Open only:

- Company, Branches, Tool Numbering, Transaction Numbering, Audit Trail

Skip Users / Roles / Permissions / Notifications / Approval / Activity Logs (placeholders).

---

## One-page “happy path” checklist (minimum complete flow)

Do this if you only have **half a day** — still covers purchase + supplier + shopfloor + verify:

1. [ ] Login  
2. [ ] Create/open **Supplier** `TST-S001`  
3. [ ] Create/open **Tool** with stock (or use `OTH_J-0001`)  
4. [ ] **GRN** against `PO/TST-FLOW-001` + that supplier + tool → stock ↑  
5. [ ] **Tool Issue** qty 1 → note DC  
6. [ ] **Current Holder** shows DC  
7. [ ] **Tool Receive** full → stock back  
8. [ ] Open **History Card** for a Yes tool (`MP-QRG-174`)  
9. [ ] **Supplier Report** + **GRN History** show your purchase trail  
10. [ ] Logout / login again  

---

## Scorecard (fill after practice)

| Module | Practised? | Wrote data? | Blockers |
|--------|------------|-------------|----------|
| 0 Auth | | | |
| 1 Dashboard | | | |
| 2 Masters (tools) | | | |
| 2C Supplier / Subcon | | | |
| 5 Purchase GRN | | | |
| 3 Issue / Receive | | | |
| 4 Calibration | | | |
| 6 History Card | | | |
| 7 Reports | | | |
| 8 Settings smoke | | | |

---

## Known gaps (do not treat as your failure)

1. **PO create** — ERP Purchasing, not this app  
2. **Calibration Receive create** — API exists, UI list-only  
3. **Many ERP tools have Qty In = 0** — issue picker only finds stocked tools  
4. **History Card list** ignores `HISTORY_CARD_REQ = No` tools (by design)  
5. **~18k open issue DCs** — always **search** on Receive / Holder; don’t scroll all  

---

## Suggested calendar

| Day | Focus |
|-----|--------|
| Day 1 morning | A + B (Auth, Dashboard, Masters incl. Supplier/Subcon/Tool) |
| Day 1 afternoon | C (GRN / purchase path) |
| Day 2 morning | D (Issue / Receive) + F Holder/Issue history |
| Day 2 afternoon | E (Calibration) + F calib tabs + G Reports |

When stuck on a write error, note the **exact red banner** and the **screen + payload fields** — that is enough to debug next.
