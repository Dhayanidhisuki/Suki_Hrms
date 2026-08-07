# Tool Pricing Master — Design, UI & How to View Data

**Route:** `/dashboard/masters/pricing`  
**Sidebar:** Masters → Tool Pricing Master  
**Mode:** Read-only list (no create / edit / delete on this page)  
**Source today:** ESSKAY `TOOLS_PRICE_MASTER` JSON export (not live Manpro DB)

---

## 1. Purpose

Tool Pricing Master shows **supplier rates per tool** — each row is a tool + supplier + rate (and revision/approval metadata).

It is used to:

- Look up what a supplier charges for a tool
- Filter by tool group or supplier
- Cross-check rates during purchase / GRN workflows

Related write path: when a **GRN** is posted (`/api/po/grn`), a new row can be written into Manpro `TOOLS_PRICE_MASTER` via Prisma. That live Manpro table is currently **empty / not what this page reads**.

---

## 2. How it is designed (architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  UI  /dashboard/masters/pricing/page.tsx                    │
│  • Client-side filters, grouping, columns, pagination       │
│  • Loads once via GET /api/pricing                          │
└────────────────────────────┬────────────────────────────────┘
                             │ apiGet("/api/pricing")
┌────────────────────────────▼────────────────────────────────┐
│  API  /api/pricing/route.ts                                 │
│  • Session required                                         │
│  • Returns { source, exportedAt, total, items[] }           │
└────────────────────────────┬────────────────────────────────┘
                             │ loadEsskayPricing()
┌────────────────────────────▼────────────────────────────────┐
│  Lib  src/lib/esskayPricing.ts                              │
│  • Reads data/esskay-tools-price-master.json (cached)       │
│  • Temporary because ERPDb_Manpro.TOOLS_PRICE_MASTER        │
│    is empty and ERPDb_ESSKAY is not on this server          │
└─────────────────────────────────────────────────────────────┘
```

### Why JSON instead of Prisma?

| Layer | Status |
|-------|--------|
| Prisma model `ToolsPriceMaster` → `TOOLS_PRICE_MASTER` | Exists (Manpro) |
| Manpro table rows | Empty (or not useful for this UI) |
| ESSKAY export | **2,009** rates in `data/esskay-tools-price-master.json` |
| This page | Serves that export read-only |

When Manpro is populated (or ESSKAY is connected), the API can switch from `loadEsskayPricing()` to `prisma.toolsPriceMaster.findMany(...)`.

### Key files

| File | Role |
|------|------|
| `src/app/dashboard/masters/pricing/page.tsx` | UI |
| `src/app/api/pricing/route.ts` | GET API |
| `src/lib/esskayPricing.ts` | JSON loader + types + in-memory cache |
| `data/esskay-tools-price-master.json` | Exported rates (`source: ERPDb_ESSKAY`) |
| `prisma/schema.prisma` → `ToolsPriceMaster` | Live DB model (used by GRN write, not by this list yet) |

---

## 3. UI layout & behaviour

Shell: `SimpleMasterShell` with title **Tool Pricing Master** and subtitle showing export count, e.g.  
`TOOLS_PRICE_MASTER from ERPDb_ESSKAY export — 2,009 supplier rates`.

Uses the same CSS tokens as the rest of the dashboard (`--bg-card`, `--bg-subtle`, `--bg-surface-elevated`, `--border-main`, `rounded-[12px]`, `border-[0.5px]`) so light/dark mode tracks the global theme toggle.

### 3.1 Filter toolbar

One row, shared control height (`h-9`), padding, and `rounded-[12px]` / `border-[0.5px]`:

| Control | Behaviour |
|---------|-----------|
| **Search** | Matches **Tool No**, **Tool Name**, or **Supplier** (client-side) |
| **All Groups** | Filter by `grouping` (e.g. CAPITAL GOODS, SERVICES) |
| **All Suppliers** | Filter by `supCode` (e.g. SUP-000140) |
| **Columns** | Toggle which columns are visible (at least one must stay on) |
| **Clear** | Appears when search/group/supplier is active |
| **Match count** | Right-aligned in the same toolbar row: `N matches · M visible` |

### 3.2 Default vs optional columns

**Default (disambiguates multi-rate tools):**

| Column | Field | Notes |
|--------|--------|--------|
| Tool No | `toolOrGaugeNo` | Sticky left; duplicate tools show `SUP · Rev N` under the number |
| Supplier | `supCode` | |
| Price / Rate | `rate` | Always `en-IN` with **2 decimal places** |
| Rev | `revNo` | |
| Rev Date | `revDate` | |
| Approval | `approvalStatus` | `StatusBadge` |

**Optional (Columns menu):** Tool Name, Ref, Currency, Row ID, Vendor Type, Sub Code, Rev Status, Approval Date, Remarks, Map Ref, audit fields, Company.

Tool Name is optional by default — most ESSKAY rows have no name, so a default column of dashes was removed.

### 3.3 Grouped table

- Rows sorted by **group** → **tool number** → newest **rev date** → supplier
- Group header uses elevated surface (`--bg-surface-elevated`) as a section divider; chevron, name, and count share one baseline
- Click header to **collapse**; chips above the table re-expand
- Blank / ERP placeholder grouping (`""`, `-SELECT-`, `N/A`, …) → **Ungrouped**
- Duplicate Tool Nos: secondary line under Tool No + tooltip; Rev / Rev Date / Approval columns explain why rates differ
- Sticky header + sticky Tool No; striped rows; max height ~65vh

### 3.4 Pagination

- **50 rows per page** (`PAGE_SIZE`)
- Uses shared `TablePager` (“Showing 1–50 out of …”)
- Changing search / filters / collapse resets to page 1
- Pagination counts **visible** rows only (collapsed groups are excluded)

### 3.5 Empty states

| Situation | Message |
|-----------|---------|
| No rows after filters | “No pricing rows match your filters.” |
| No data at all | “No records found.” |
| All matching groups collapsed | “All matching groups are collapsed — expand a group above to view rows.” |

---

## 4. How to see the data

### In the app (primary)

1. Log in to the dashboard.
2. Open **Masters → Tool Pricing Master**  
   or go to: `http://localhost:3000/dashboard/masters/pricing`
3. Wait for the table to load (~2,009 rates).
4. Use:
   - Search for a tool number / name  
   - Group dropdown (e.g. CAPITAL GOODS)  
   - Supplier dropdown (e.g. SUP-000088)  
   - **Columns** to show Rate currency, approval, revision, etc.

### Via API

Requires a logged-in session cookie.

```http
GET /api/pricing
```

Example response shape:

```json
{
  "source": "ERPDb_ESSKAY",
  "exportedAt": "2026-08-03T13:47:15+05:30",
  "total": 2009,
  "items": [
    {
      "id": 2129,
      "rowId": 2129,
      "supCode": "SUP-000042",
      "toolRefNo": 334,
      "toolOrGaugeNo": "Transport00001",
      "toolName": null,
      "grouping": "SERVICES",
      "rate": 16198,
      "currency": "INR",
      "revStatus": "ACTIVE",
      "approvalStatus": "APPROVED",
      "vendorType": "Supplier"
    }
  ]
}
```

### On disk (source file)

```bash
# From repo root
node -e "
const j = require('./data/esskay-tools-price-master.json');
console.log(j.source, j.count, j.exportedAt);
console.log(j.items[0]);
"
```

File: `data/esskay-tools-price-master.json`  
Fields: `source`, `exportedAt`, `count`, `items[]`.

---

## 5. Data fields (row model)

From `EsskayPricingRow` in `src/lib/esskayPricing.ts`:

| Field | Meaning |
|-------|---------|
| `toolOrGaugeNo` | Tool / gauge number |
| `toolName` | Display name (may be null in export) |
| `toolRefNo` | Link to tool master ref |
| `supCode` | Supplier code |
| `grouping` | Tool group (drives UI sections) |
| `rate` | Price / rate |
| `currency` | e.g. INR |
| `revNo` / `revDate` / `revStatus` | Rate revision |
| `approvalStatus` / `approvalDate` | Approval |
| `vendorType` / `subCode` | Vendor classification |
| `remarks` | Notes |
| Audit | `creatUserIdCd`, `creatDt`, `lstUpdtUserIdCd`, `lstUpdtTs`, `companyId` |

---

## 6. What this page does *not* do

- No add / edit / delete of rates
- No live query of Manpro `TOOLS_PRICE_MASTER` (JSON export only for now)
- No server-side search/pagination (all filtering is in the browser after one full load)
- GRN-created Manpro price rows will **not** appear here until the API is switched to Prisma / live DB

---

## 7. Quick test checklist

- [ ] Open `/dashboard/masters/pricing` while logged in (dark mode matches Dashboard / History Card)  
- [ ] Subtitle shows ~2,009 supplier rates  
- [ ] No group header shows `-SELECT-` (should be **Ungrouped**)  
- [ ] Duplicate tool (e.g. Accurate 00001) shows Rev / supplier context, not identical bare rows  
- [ ] Rates all use two decimal places (e.g. `24,25,000.00`)  
- [ ] Tool Name is off by default; can enable via Columns  
- [ ] Toolbar controls share one height; match count sits on the right of that row  
- [ ] Collapse a group → chip appears; expand again  
- [ ] Unauthenticated `GET /api/pricing` → 401  

---

## 8. Future switch to live DB (when ready)

1. Confirm Manpro `TOOLS_PRICE_MASTER` has rows (or connect ESSKAY).  
2. Update `GET /api/pricing` to use `prisma.toolsPriceMaster` (join tool name/group from `GAUGEANDTOOLS` if needed).  
3. Keep the same UI contract: `{ total, items[] }` with the field names above so the page needs little change.  
4. Optionally remove or keep the JSON file as a fallback/seed.
