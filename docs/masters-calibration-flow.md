# Masters + Calibration — Flow from Scratch

**Audience:** Practice / demo clarity  
**Focus:** every Masters module that feeds tools, every Calibration screen, History Card verification  
**Live examples** below are real codes already in ERP (verify Qty In / status before demo).

---

## Big picture (two tracks, one master)

```
                    ┌─────────────────────────────┐
                    │   Item/Asset Master         │
                    │   (GAUGEANDTOOLS)           │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
     History Card = No                       History Card = Yes
     Tot Qty ≥ 1                             + Calib freq (months)
              │                                       │
              ▼                                       ▼
     TRACK A — Shopfloor                     TRACK B — Calibration
     Tool Issue → Tool Receive               Due → Issue → Receive → Results
              │                                       │
              └───────────────┬───────────────────────┘
                              ▼
                    Tools History Card
                    (only HC = Yes tools in hub)
```

**Rule of thumb**
- Shopfloor movement needs **stock** (`Qty In > 0`).
- Calibration lifecycle needs **History Card = Yes** + **frequency**.
- You usually create **two different tools** if you want both demos (or reuse live codes).

---

## Live examples (use these anytime)

| Purpose | Tool / DC | What to check first |
|---------|-----------|---------------------|
| Shopfloor stock issue | `OTH_J-0001` | Item/Asset Master → Qty In > 0 |
| Open shopfloor DC | `DC-2026-001` | Tool Receive search |
| History Card unit view | `MP-QRG-174` | History Card hub |
| Pending calib results | `MP2-2DH-01` or `MPA 00031` | Results Update list |
| New practice shopfloor | create `TST-ISSUE-…` | Tot Qty ≥ 1, HC = No |
| New practice calib | create `TST-CAL-…` | HC = Yes, freq > 0, add unit |

---

# PART 1 — Masters (setup order)

Do these **top → bottom**. Early masters feed dropdowns on Item/Asset Master.

## 1.1 Tool Group  
**Sidebar:** Masters → Tool Masters → **Tool Group**  
**Table:** `OTHER_TOOLS_TYPE`

| What it is | Why it matters |
|------------|----------------|
| Top-level family (e.g. Measuring, Cutting) | Required on every tool (`GROUPING`) |
| Can store numbering prefixes | Used by **Next #** on Item/Asset Master |

**Internal flow:** List → Add/Edit group name (+ prefix if used) → Save → appears in Item/Asset **Tools Group** dropdown.

**Realtime practice**
1. Open Tool Group → note an existing group name (e.g. whatever your plant uses).
2. Do **not** invent a new group unless needed — pick an existing one for create.

---

## 1.2 Tool Subgroup  
**Sidebar:** Masters → Tool Masters → **Tool Subgroup**  
**Table:** `QMS_OTHER_TOOLS_TYPE`

| What it is | Why it matters |
|------------|----------------|
| Child of a Tool Group | Narrower classification / numbering rules |
| Linked to parent group | Item Name / type pages may filter by it |

**Internal flow:** Pick parent group → Add subgroup → Save.

**Demo tip:** Optional for a fast calib demo. Required only if your numbering / Item Name setup needs it.

---

## 1.3 Tools Name for Type (Item Name for Type)  
**Sidebar:** Masters → Tool Masters → **Tools Name for Type**  
**Route:** `/dashboard/masters/tool-types` (legacy `/masters/item-name` redirects here)  
**Table:** `TOOLS_TYPE`

| What it is | Why it matters |
|------------|----------------|
| Allowed “Tools Type / Name” values under a group | Item/Asset **Type** dropdown |

**Internal flow:** Group (+ subgroup) → type name → Save → available on Item/Asset Master.

**Realtime:** On Item/Asset Master, pick a group that already has types so Type dropdown is not empty.

---

## 1.4 Calibration Masters (reference)

### Gauge Type Master  
**Route:** `/dashboard/masters/gauge-types` · **Table:** `GAUGE_TYPE`  
Read-only classification list (gauge kinds). Soft reference for calib tooling.

### Calibration Frequency  
**Route:** `/dashboard/masters/calib-frequency` · **Table:** `CALIBRATION_FREQUENCY_MASTER`  
Read-only frequency bands (tolerance → months).  
**On create you still type months on the tool** (`CALIBRATION_FRQ_MONTHS`) — this master is the plant reference, not auto-filled into every tool.

---

## 1.5 Purchase Masters (optional for calib demo)

| Page | Use when |
|------|----------|
| **Supplier Master** | GRN / purchase track |
| **Subcontractor Master** | Lab/vendor party names (you can still type free text on Calib Issue) |

Not required for Track B if you type `Calib Lab` as Receive Name.

---

## 1.6 Supporting Tool Masters (optional)

| Page | Mode | Role |
|------|------|------|
| Tool Pricing Master | Read-only | Rates by tool (`TOOLS_PRICE_MASTER`) |
| Reorder Level | Read-only | Tools near/below min stock |
| Tool Mapping | Placeholder | Visual group map — not on critical path |

---

## 1.7 Item/Asset Master — the hub  
**Sidebar:** Masters → Tool Masters → **Item/Asset Master**  
**Route:** `/dashboard/masters/tools`  
**Tables:** `GAUGEANDTOOLS` (+ `GAUGE_SERIAL_NO`, `TOOLS_SPECIFICATION`)

### Internal tabs / fields that matter

```
GENERAL          STOCK                 CALIBRATION
─────────        ─────                 ───────────
Tool Number      Tot Qty (default 1)   History Card?  Yes / No
Tools Name       → becomes Qty In      Calib freq (months)  ← required if Yes
Tools Group      Stock Req = Yes       Units / serials
Type             UOM, location         Specs (optional)
```

### Create — Track A (shopfloor)

| Step | Field | Example |
|------|-------|---------|
| 1 | Tool Number → **Next #** or type | `TST-ISSUE-001` |
| 2 | Tools Name | `Demo Shopfloor Bit` |
| 3 | Tools Group | existing group |
| 4 | History Card? | **No** |
| 5 | Tot Qty | `5` (default is 1 — raise it) |
| 6 | **Save** | Qty In should = Tot Qty |

**Then use:** Tool Transactions → Tool Issue → search this code.

### Create — Track B (calibration)

| Step | Field | Example |
|------|-------|---------|
| 1 | Tool Number → **Next #** | `TST-CAL-001` |
| 2 | Tools Name | `Demo Dial Gauge` |
| 3 | Tools Group / Type | existing |
| 4 | History Card? | **Yes** |
| 5 | Calibration Frequency (months) | `12` |
| 6 | Tot Qty | `1` (fine) |
| 7 | **Save** | |
| 8 | Open tool → **Add Physical Unit** (if serial/unit tracking) | 1 unit |

**Then use:** Calibration → Due List (tool appears as initial due if never calibrated).

### What each flag unlocks

| Setting | Unlocks |
|---------|---------|
| History Card = No + Qty In > 0 | Tool Issue / Tool Receive |
| History Card = Yes + freq > 0 | Due List, Calib Issue, History Card hub |
| Generate serials / Add unit | Unit rows on History Card detail |

---

# PART 2 — Calibration module (full lifecycle)

Same due data feeds Due List and Calib Issue picker (Issue UI keeps ≤ 30 days unless you used **Issue now**).

```
Due List ──Issue now──► Calibration Issue ──POST──► Open Calib DC
                                                      │
                                                      ▼
                                            Calibration Receive
                                                      │
                                                      ▼
                                              Results Update
                                                      │
                                                      ▼
                                         Next due date on Due List
                                         + History Card results
```

## 2.1 Due List  
**Sidebar:** Calibration → **Due List**  
**API:** `GET /api/tools/calibration-due`

**Where rows come from (priority)**
1. Past calib issue lines (`NXT_CALIB_DATE` / due dates)
2. Control-card history (if present)
3. New HC=Yes tools with freq and **never calibrated** → due “today” (initial)

**Internal UI**
- Filters: All / Overdue / 7 days / 30 days
- Row action: **Issue now** → `/dashboard/calibration/issue?tool=CODE`

**Realtime**
1. Open Due List → filter **All**.
2. Find `MP-QRG-174` or your `TST-CAL-…`.
3. Click **Issue now**.

---

## 2.2 Calibration Issue  
**Sidebar:** Calibration → **Calibration Issue**  
**APIs:** due list GET + `POST /api/calibration/issue`  
**Writes:**
- `TOOLS_ISSUE_FOR_CALIBRATION` (header / DC)
- `TOOLS_TRANS_ISSUE_FOR_CALIBRATION` (lines, status Issued, calib Pending)
- `GAUGEANDTOOLS.STATUS = Under Calibration`

**Internal form**
1. Header: Receive Name*, Issue For*, Issue Date (today), Sub Code (optional)
2. Line picker: checkboxes from due list (≤ 30d, or preselected tool)
3. Submit → **Issue Calibration DC** → note DC number

**Realtime example**
| Field | Value |
|-------|--------|
| Receive Name | `Calib Lab` |
| Issue For | `External` |
| Tool | preselected from Due List |
| Result | Calib DC e.g. `####` |

---

## 2.3 Calibration Receive  
**Sidebar:** Calibration → **Calibration Receive**  
**APIs:** open issues GET + `POST /api/calibration/receive`  
**Writes:**
- `TOOLS_RECEIVE_FOR_CALIBRATION` + line table
- Issue lines → `STATUS=Received` (certificate still pending)
- Tool status → `Available`

**Internal form**
1. Open DC table → **Receive**
2. Confirm receive date + lines (qty/price)
3. **Post Calibration Receive**
4. History block below updates

**Realtime:** Use the DC you just created in 2.2.

---

## 2.4 Results Update  
**Sidebar:** Calibration → **Results Update**  
**APIs:** `GET/POST /api/calibration/results-update` (+ Excel/PDF export)  
**Writes:**
- Issue line: result, calibrated by/date, next due, comments
- `GAUGE_CONTROL_CARD` + `_TRANS` history
- Tool status Available / Out of Service

**Internal form**
1. Find tool in pending list (or live `MP2-2DH-01`)
2. **Update Result** → PASSED / FAILED / RECALIBRATED
3. Set next calibration date
4. Optional: upload certificate files (Tool Documents)
5. **Save**
6. Optional: **Download Excel / PDF** of pending set

**Realtime:** After your own Issue+Receive, update that tool; or jump straight to `MP2-2DH-01` for a short demo.

---

# PART 3 — Verify on History Card

**Sidebar:** Tools History Card (only tools with **History Card = Yes**)

| Page | What you verify | Live example |
|------|-----------------|--------------|
| History Card hub | Tool + units | `MP-QRG-174` |
| Current Status | Unit status rollup | same |
| Calibration Records | Calib DCs / lines | after Issue |
| Calibration Results | Result / next due | after Results Update |
| Issue / Receive History | **Shopfloor** DCs (Track A), not calib tables | after Tool Issue |

**Internal detail view:** open tool → unit history + Tool Documents (certificates).

---

# PART 4 — Shopfloor track (uses same master, different module)

Only needed if you also demo stock movement.

```
Item/Asset (HC=No, Qty In>0)
  → Tool Transactions → Tool Issue   (GAUGE_TOOLS_ISSUE)
  → Tool Transactions → Tool Receive (return + restore Qty In)
```

**Realtime:** `OTH_J-0001` → Issue to `Demo Holder` → Receive that DC.

Calib Issue does **not** use Qty In the same way — do not confuse the two DCs.

---

# PART 5 — Click path from zero (full create)

### Session setup (~5 min)
1. Login  
2. Masters → Tool Group → pick existing group name  
3. Masters → Tool Type / Item Name → confirm types exist for that group  

### Track B — Calibration (~15 min)
1. **Item/Asset Master** → Add → HC **Yes**, freq `12`, Tot Qty `1` → Save → Add unit  
2. **Due List** → find tool → **Issue now**  
3. **Calibration Issue** → Receive Name `Calib Lab`, Issue For `External` → submit → copy DC  
4. **Calibration Receive** → **Receive** on that DC → Post  
5. **Results Update** → Update Result → PASSED → next date → Save  
6. **History Card** → search tool → Calibration Results  

### Track A — Shopfloor (~10 min)
1. **Item/Asset Master** → Add → HC **No**, Tot Qty `5` → Save  
2. **Tool Issue** → search tool → Submit Issue → copy DC  
3. **Tool Receive** → Receive that DC  

### Fast path (no create, ~8 min)
1. Item/Asset → show `OTH_J-0001` stock  
2. Tool Issue / Receive on that code (or open `DC-2026-001`)  
3. Due List → Issue now (any due) **or** Results Update on `MP2-2DH-01`  
4. History Card → `MP-QRG-174`  

---

# PART 6 — Module cheat sheet

| Module | Create? | Feeds | Demo button |
|--------|---------|-------|-------------|
| Tool Group | Yes | Item/Asset Group | Save |
| Tool Subgroup | Yes | Types / numbering | Save |
| Tool Type / Item Name | Yes* | Item/Asset Type | Save |
| Gauge Type | Read | Reference | — |
| Calib Frequency | Read | Reference | — |
| Item/Asset Master | Yes | Everything | Save / Add Unit |
| Due List | Read + handoff | Issue picker | **Issue now** |
| Calibration Issue | Yes | Open calib DC | **Issue Calibration DC** |
| Calibration Receive | Yes | Closed receive | **Receive** → Post |
| Results Update | Yes | Next due + card | **Update Result** / Download |
| History Card | Read | Audit trail | View History Card |
| Tool Issue/Receive | Yes | Shopfloor stock | Submit / Confirm Receive |

\*Tools Name for Type supports full Add / Edit / Delete from the sidebar master.

---

# PART 7 — Same list? Due vs Issue lines

| | Due List | Calibration Issue checkboxes |
|-|----------|------------------------------|
| API | Same `/api/tools/calibration-due` | Same |
| Window | ~90-day alert window + filters | Default **≤ 30 days** |
| Exception | — | **Issue now** keeps that tool even if > 30 days |

So: **same data source**, Issue shows a tighter “issue soon” slice.

---

# One-page mental model

```
MASTERS SETUP
  Group → (Subgroup) → Type → Item/Asset Master
                              │
              ┌───────────────┴───────────────┐
              │ HC=No + stock                 │ HC=Yes + freq
              ▼                               ▼
         Tool Issue/Receive              Due List
                                              │ Issue now
                                              ▼
                                       Calib Issue (DC)
                                              ▼
                                       Calib Receive
                                              ▼
                                       Results Update
                                              ▼
                                       History Card / Due List (next cycle)
```

Keep `docs/demo-click-guide.md` for button-by-button clicks; use **this file** for module meaning + order + live codes.

---

# Appendix — Preventive MNT (no new module screens)

Preventive lives on the **tool/unit** (ERP master fields) — not a Calib-style Issue/Receive sidebar.

## Setup (Item/Asset Master)

1. Set **Is Asset = Yes**
2. Set **Preventive Frequency (months)** > 0
3. Save — units missing `NXT_PRE_DATE` get seeded (`today + freq`)
4. Add a physical unit — `NXT_PRE_DATE` seeds when asset + freq are set

## Complete the cycle

| Where | Action |
|-------|--------|
| Item/Asset Master → view/edit unit grid | **Complete PM** |
| Tools History Card → units table | **Complete PM** |

**Complete PM** → `POST /api/tools/preventive-complete` → advances `GAUGE_SERIAL_NO.NXT_PRE_DATE` by tool frequency (best-effort stamp on calib-line PM columns if present).

## Due lookup (API only)

`GET /api/tools/preventive-due?days=30` — Overdue / Due Soon for assets with frequency. Act from History Card or Item/Asset Master (no dedicated page).

## Mental model

```
Is Asset=Yes + Pre freq
        │
        ▼
  Unit NXT_PRE_DATE seeded
        │
        ▼
  Complete PM (master / history card)
        │
        ▼
  NXT_PRE_DATE = today + freq  →  next cycle
```

**Not included:** Preventive Issue / Receive module screens (by design).
