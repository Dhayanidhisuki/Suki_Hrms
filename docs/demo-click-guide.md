# Demo click guide — Tool create → Calib → Issue → Receive

**For:** Live demo / practice of the modules you have ready  
**Scope:** Item/Asset Master, Calibration (Due → Issue → Results), Tool Issue, Tool Receive  
**Out of scope for this script:** Supplier, GRN/PO, Reports, Settings  

---

## Gaps in the flow (status)

| # | Gap | Fix shipped | Demo notes |
|---|-----|-------------|------------|
| 1 | Calibration Receive create | **Receive** button on open DCs → post lab return | Then go to **Results Update** for certificate |
| 2 | Due List → Issue handoff | Per-row **Issue now** → opens Issue with tool pre-selected | Works for tools outside the Issue 30-day filter too |
| 3 | New tool no stock | Create defaults **Tot Qty = 1**; create validation if Stock Req = Yes | Still use `OTH_J-0001` if skipping create |
| 4 | Shopfloor ≠ Calib tool | Keep as **two masters** (HC No vs Yes). New HC=Yes + freq tools now appear on Due List as “Initial — never calibrated” | History Card hub still requires HC = Yes |
| 5 | Many ERP tools Qty 0 | Issue search shows zero-stock matches as **disabled** + shortcut to `OTH_J-0001` | Prefer exact in-stock codes |

### Recommended live examples (if you skip create)

| Purpose | Example | Notes |
|---------|---------|--------|
| Tool Issue / Receive | `OTH_J-0001` | Has stock (check Qty In first) |
| Open issue DC to receive | `DC-2026-001` | Holder: Test User, status OPEN |
| Pending calib results | `MP2-2DH-01` or `MPA 00031` | Already issued for calibration |
| History Card view | `MP-QRG-174` | History Card = Yes + 1 unit |

---

## Demo path overview (two tracks)

```
TRACK A — Shopfloor movement
  Create tool (History Card = No, qty > 0)
    → Tool Issue
    → Tool Receive

TRACK B — Calibration lifecycle
  Create tool (History Card = Yes + freq + unit)
    → Due List → Issue now
    → Calibration Issue (pre-selected)
    → Calibration Receive (Receive on open DC)
    → Results Update
```

Do **Track A** then **Track B**, or use live examples to save time.

---

# TRACK A — Create tool → Issue → Receive

### Login
1. Open `/login`
2. Enter username / password → **Sign In** (or Login)
3. Land on Dashboard

---

### A1. Create a shopfloor tool

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **MASTERS** → **Item/Asset Master** |
| 2 | Top right → **Add Tool Record** |
| 3 | Tool Number → **Next #** (or type `TST-ISSUE-001`) |
| 4 | Fill **Tools Name**, **Tools Group**, Type if asked |
| 5 | **History Card?** → select **No** |
| 6 | Stock / Qty → **Tot Qty** = `5` (important for Issue) |
| 7 | UOM, Location if required |
| 8 | Bottom → **Save** (or Save Tool) |
| 9 | Confirm tool appears in list with Qty In > 0 |

**Write down:** Tool No = `________________`

**If Save fails / no time:** skip create → use `OTH_J-0001` for Issue.

---

### A2. Tool Issue

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **TOOL TRANSACTIONS** → **Tool Issue** |
| 2 | **New Issue** / **+** (opens create form) |
| 3 | **Receive Name** → e.g. `Demo Holder` |
| 4 | Leave Subcontractor / Employee empty (OK) |
| 5 | Confirm **Issue Date** and **Return Due Date** are filled (today) |
| 6 | Tool search box → type your tool no or `OTH_J-0001` |
| 7 | Click the tool row in the dropdown (must show in-stock) |
| 8 | Line appears staged → qty `1` |
| 9 | Bottom → **Submit Issue** |
| 10 | Note success banner DC no |

**Write down:** DC No = `________________`  
**Example success shape:** `DC-2026-00x`

**Verify (optional):** Sidebar → **Tools History Card** → **Current Holder** → search your DC / `Demo Holder`.

---

### A3. Tool Receive (return)

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **TOOL TRANSACTIONS** → **Tool Receive** |
| 2 | Search box → type your **DC No** (e.g. `DC-2026-001`) — do **not** scroll 18k rows |
| 3 | Row → **Receive** |
| 4 | Confirm **Receive Date** = today |
| 5 | **Qty Returning** = `1` (or full issued qty) |
| 6 | **Confirm Receive** |
| 7 | Success → DC closed / removed from pending |

**Verify:** Item/Asset Master → search tool → Qty In back up.

---

# TRACK B — Create calib tool → Issue → Results

### B1. Create a calibration tool

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **MASTERS** → **Item/Asset Master** |
| 2 | **Add Tool Record** |
| 3 | Tool No → **Next #** or `TST-CAL-001` |
| 4 | Name, Group, Type |
| 5 | **History Card?** → **Yes** |
| 6 | Open **Calibration** tab → **Calibration Frequency (months)** = `12` (must be > 0) |
| 7 | **Save** |
| 8 | After save, in detail → **Add Physical Unit** (if shown) → Make / status → save unit |
| 9 | Confirm unit row appears |

**Write down:** Calib Tool No = `________________`

**Fast path:** skip create; for Results use pending `MP2-2DH-01`; for Due List browse any due tool.

---

### B2. Due List (see the tool)

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **CALIBRATION** → **Due List** |
| 2 | Filter chips: **All** / **Overdue** / **7 days** / **30 days** |
| 3 | Search / find your calib tool |
| 4 | Row → **Issue now** (opens Calibration Issue with tool pre-selected) |

---

### B3. Calibration Issue

| Step | Where to click / type |
|------|------------------------|
| 1 | Land from **Issue now**, or Sidebar → **CALIBRATION** → **Calibration Issue** |
| 2 | Confirm your tool is checked (pre-selected from Due List) |
| 3 | Fill header: **Receive Name** (e.g. `Calib Lab`) |
| 4 | **Issue For** → required (e.g. `External` / vendor name) |
| 5 | **Issue Date** = today |
| 6 | Right summary shows selected count |
| 7 | **Issue Calibration DC** |
| 8 | Note calib DC number |

**Write down:** Calib DC = `________________`

---

### B4. Calibration Receive

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **CALIBRATION** → **Calibration Receive** |
| 2 | Open DCs table → your DC → **Receive** |
| 3 | Confirm **Receive Date** = today |
| 4 | Keep tool lines checked (qty/price optional) |
| 5 | **Post Calibration Receive** |
| 6 | Confirm receive appears in history below |

---

### B5. Results Update

| Step | Where to click / type |
|------|------------------------|
| 1 | Sidebar → **CALIBRATION** → **Results Update** |
| 2 | Find your tool (or live `MP2-2DH-01` / `MPA 00031`) |
| 3 | Row → **Update Result** |
| 4 | Result → **PASSED** (or FAILED / RECALIBRATED) |
| 5 | Set / confirm **Next calibration date** |
| 6 | **Save Calibration Result** |
| 7 | Row leaves pending / status updates |

**Verify (optional):** Due List refresh; History Card → **Calibration Results**.

---

# 10-minute demo script (say this while clicking)

Use live data only — no create.

1. **Login** → Dashboard  
2. **Masters → Item/Asset Master** → search `OTH_J-0001` → show Qty In  
3. **Tool Transactions → Tool Issue** → New → Receive Name `Demo Holder` → search `OTH_J-0001` → stage → **Submit Issue** → copy DC  
4. **Tool Receive** → search that DC → **Receive** → **Confirm Receive**  
5. **Calibration → Due List** → **Issue now** on a due tool → fill party → **Issue Calibration DC**  
6. **Calibration Receive** → **Receive** on that DC → **Post Calibration Receive**  
7. **Results Update** → **Update Result** → PASSED → **Save** (or use pending `MP2-2DH-01`)  
8. (Optional) **Tools History Card** → search `MP-QRG-174` → **View History Card**  

---

# Full demo with create (≈ 25–35 min)

1. Create shopfloor tool (History Card **No**, Tot Qty defaults to 1 — raise to 5) → Issue → Receive  
2. Create calib tool (History Card **Yes**, freq 12, add unit) → Due List → **Issue now** → Calib Issue → Receive → Results Update  
3. History Card hub → open calib tool card  

---

# Button cheat sheet

| Screen | Primary buttons |
|--------|-----------------|
| Item/Asset Master | **Add Tool Record** → **Next #** → **Save** → **Add Physical Unit** |
| Tool Issue | **New Issue** → pick tool → **Submit Issue** |
| Tool Receive | Search DC → **Receive** → **Confirm Receive** |
| Due List | Filter chips + **Issue now** |
| Calibration Issue | Tick tools → **Issue Calibration DC** |
| Calibration Receive | Open DC → **Receive** → **Post Calibration Receive** |
| Results Update | **Update Result** → **Save Calibration Result** · **Download Excel/PDF** |

---

# Flow completeness

```
Calib flow:      Due → Issue now → Issue → Receive → Results   ✅
Shopfloor flow:  Create/Stock → Issue → Receive               ✅
```
