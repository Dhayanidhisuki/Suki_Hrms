# ERP ↔ SUKI Tools Management — Gap Analysis

**Product:** SUKI Tools Management  
**ERP demo:** `https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/`  
**Compared against:** codebase as of Aug 2026  
**Method:** Live ERP UI inspection + our routes / Prisma / APIs  

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Parity — feature present and usable |
| ⚠️ | Partial — present but incomplete / different |
| ❌ | Gap — in ERP, missing or weak in our app |
| ➕ | Our enhancement — we have it, ERP list/form weaker or absent |
| 👁 | Read-only in our app |
| 🚧 | Partial workflow (e.g. create+list, no edit) |

### Status at a glance

| # | ERP page | Our route | Our status | Gap severity |
|---|----------|-----------|------------|--------------|
| 1 | `itemgroup.xhtml` | `/dashboard/masters/tools-group` | ✅ CRUD + Excel | Low |
| 2 | `itemtypeforgroup.xhtml` | `/dashboard/masters/tools-subgroup` | ✅ CRUD + Excel | Low |
| 3 | `toolsmanage.xhtml` / `toolsmanagecreation.xhtml` | `/dashboard/masters/tools` | ✅ CRUD + filters/details | Med (docs/satellites optional) |
| 4 | `toolsmapping.xhtml` / `newToolMapping.xhtml` | `/dashboard/masters/tool-mapping` | ✅ Create+Delete + vendor type | Low–Med |
| 5 | `toolspriceoverview.xhtml` | `/dashboard/masters/pricing` | 👁 DB/JSON + RO banner | Med |
| 6 | `gaugetypemaster.xhtml` | `/dashboard/masters/gauge-types` | ✅ CRUD + Excel | Low |
| 7 | `toolstypemaster.xhtml` | `/dashboard/masters/tool-types` | ✅ CRUD + Excel | Low |
| 8 | `toolsgaugeandotheritemissue.xhtml` | `/dashboard/transactions/issue` | ✅ Create+edit+cancel | Low–Med |
| 9 | `ToolsReceiveOverview.xhtml` | `/dashboard/transactions/receive` | ✅ Create+list + ERP statuses | Low–Med |
| 10 | `toolsgaugecalibrationissue.xhtml` | `/dashboard/calibration/issue` | ✅ Create+edit+filters | Low–Med |
| 11 | `toolscustomermaterialoverview.xhtml` | `/dashboard/transactions/customer-receive` | 👁 Path B rename | Low (scoped) |
| 12 | `purchaseorder.xhtml` | `/dashboard/po-linked/purchase-order` | 👁 / 🚧 PendingFeature | High (by design) |
| 13 | `grn.xhtml` | `/dashboard/po-linked/receive` | ✅ Tools GRN only | High (scope) |
| 14 | `supplierdetails.xhtml` | `/dashboard/masters/suppliers` | ✅ CRUD + bank + BLOCKED + Excel | Low–Med (ERP-only cols absent) |
| 15 | `subcontractordetails.xhtml` | `/dashboard/masters/subcontractors` | ✅ CRUD + add2/approved + pager + Excel | Low–Med (ERP-only cols absent) |
| 16 | `updatecalibrationresults.xhtml` | `/dashboard/calibration/results-update` | ✅ Filters+obs grid | Med (finance OUT) |
| 17 | `updatePreventiveMNTresults.xhtml` | `/dashboard/calibration/preventive-results` | ✅ Due queue + complete | Med |
| 18 | `calibrationprevmntcal.xhtml` | `/dashboard/calibration/calendar` | ✅ Year Plan/Actual + Excel | Low–Med |

---

## 1. Item / Asset Group

| | |
|--|--|
| **ERP** | [`itemgroup.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/itemgroup.xhtml) |
| **Ours** | `/dashboard/masters/tools-group` |
| **Table** | `OTHER_TOOLS_TYPE` |

### ERP UI

**List columns:** Item/Asset Group · Created Date · PO Prefix · Indent Prefix · GRN Prefix · Item No.Prefix · Gate Entry Prefix · Item No. Prefix modification · Update By  

**New dialog:** QMS Item & Others Type* · PO · Indent · GRN · Item No.Prefix · ItemNo Prefix Modification  

**Actions:** Search By (ALL / Item Type / Issue Type) · Excel · pagination · Manager-only update note  

### Field map

| ERP | Ours | Status |
|-----|------|--------|
| Item/Asset Group (`OTHER_TYPE`) | Item/Asset Group * | ✅ |
| Item No.Prefix | Item No.Prefix (`PREFIX_TOOLS_NO`) | ✅ Redundant “Group Code” removed from form/list |
| PO / Indent / GRN Prefix | Same | ✅ |
| Item No. Prefix modification | Same | ✅ |
| Gate Entry Prefix | In our form + list | ⚠️ In ERP **list**; not in ERP New dialog |
| Created Date / Update By | Shown | ✅ |
| `SERIAL_NO_GEN_REQ` / `ISSUE_TYPE` (DB) | PUT API only | ❌ Not on either UI (New dialog) |

### Gaps (ours)

1. ✅ Excel export (filtered list)  
2. ❌ Search By dropdown (`ALL` / `Item Type` / `Issue Type`)  
3. ❌ Column sort + multi-select  
4. ✅ Clarify / drop redundant Group Code vs Prefix Tools No  
5. ⚠️ Pagination (we load all)  

### We have / better

- Full delete + view detail  
- Gate Entry on create form  
- KPI strip  
- Excel export of filtered list  

---

## 2. Item Type for Group (Tool Subgroup)

| | |
|--|--|
| **ERP** | [`itemtypeforgroup.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/itemtypeforgroup.xhtml) |
| **Ours** | `/dashboard/masters/tools-subgroup` |
| **Table** | `QMS_OTHER_TOOLS_TYPE` |

### ERP UI

**List (~176 rows):** Item/Asset Group · Item/Asset Type · Item No.Prefix · Created By · Created Date · Ref No  

**New dialog:** Select Group · Sub Type/QMS Type · Asset Category · Group Prefix (RO) · Type Prefix* · Is Auto Generate Code? (default Yes) · Prefix Based* (`Group` / `Type`)  

**Actions:** Excel · Search By (`Qms Group` / `Item Type`) · Manager update note · pagination  

### Field map

| ERP | Ours | Status |
|-----|------|--------|
| Select Group | Parent Group * | ✅ |
| Sub Type/QMS Type | Subgroup Name * | ✅ |
| Asset Category | — | ❌ Intentionally excluded (legacy `-Select-` junk in DB); ERP still shows |
| Group Prefix | Hint under parent | ✅ |
| Type Prefix * | Type Prefix * | ✅ Required |
| Is Auto Generate Code? (default Yes) | Same (default **Yes**) | ✅ |
| Prefix Based * (dropdown) | Required `Group` / `Type` select | ✅ |
| Ref No | List + detail (`rowId`) | ✅ |

### Gaps (ours)

1. ❌ Asset Category UI (product decision — skip unless unlocked)  
2. ✅ Prefix Based → required dropdown  
3. ✅ Type Prefix required + Auto-gen default Yes  
4. ✅ Excel + filter by parent group  
5. ✅ List: show Ref No, Auto-gen, Prefix Based  

---

## 3. Tools Manage / Creation (Item/Asset Master)

| | |
|--|--|
| **ERP** | [`toolsmanage.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolsmanage.xhtml) · [`toolsmanagecreation.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolsmanagecreation.xhtml) |
| **Ours** | `/dashboard/masters/tools` |
| **Table** | `GAUGEANDTOOLS` (+ serials, specs, details, …) |

> Demo note: both URLs open the same list + form workspace (“QMS Tools and Standard Room Creation”), ~55k rows.

### 3.1 List & filters

| ERP | Ours | Status |
|-----|------|--------|
| Only Active Item | Status rollup | ⚠️ No dedicated Active filter |
| Group → Item Type → Item Name cascade | Group only | ❌ |
| Search field picker (tool no, desc, Part No, group, oldItemNo, size, goSize, noGoSize, location, isCustomerGiven, calPlannedWho) | Free text name/no/desc | ❌ |
| Critical Item, Department | — | ❌ |
| Excel + PDF | Excel/PDF + **Import** | ✅ / ➕ Import |
| Columns: Old Item No, Group, Type, Type Name, UOM | Missing on list | ⚠️ |
| Shared cols (Tool No, Desc, Qty, Avail, Loc, Ret?, Sl.No?, Issue Type, Critical, PS Min/Max, Ref, Machine, Least Count, Buffer, Status) | Mostly present | ✅ |

### 3.2 Main form — matched

Group, Type, Name, Description, Item No, Issue Type, Old Item No, UOM, Location/Area/Rack, Price, Total Qty, ROL, flags (Customer / PO / Stock / Critical / Returnable / Asset / Active / Saleable / NOC / Machine SW / ITC), Company, Least Count, HSN, Drawing/Rev, Stiffness, Self Life, Department, Packing, Detailed Spec, Serial Gen, History Card, Calib Planned To (Internal/External/N/A), Calib freq, Preventive planned/method/freq, Gauge/Wear/Product specs.

### 3.3 Form gaps

| ERP field | Ours | Status |
|-----------|------|--------|
| Asset.Category | Read-only from Tool Type (`ASSET_CATEGORY`) on create/edit/view | ✅ |
| Depreic.Per | — | ❌ Not in `GAUGEANDTOOLS` |
| Location Output Name | Auto-built server-side | ⚠️ Not editable |
| Stock Item | Editable Y/N on form | ✅ |
| Preventive MNT Done At / Ref Details / Addil.Remarks | Mapped (`PREVENTIVE_FRQ_OTHERS` / `REF_DETAILS` / `REMARKS`) | ✅ |
| Size / Range / Shape | On our form | ➕ |
| **Issue Type values** | See below | ⚠️ |

**Issue Type — demo ERP:** `For Regular` · `For Asset` · `For Product` · `For Employee` · `For Department`  

**Ours (`src/lib/toolCreate.ts`):** `For Asset` · `For Product` · `For Regular` · `For Trial`  

→ Missing **For Employee / For Department**; we have **For Trial** (confirm vs target company).

### 3.4 Satellite dialogs

| ERP | Ours | Status |
|-----|------|--------|
| Assign Machine | Machine mapping modal | ✅ |
| Tools Specification | Segregated parameter cards (Range / Wear / Product Spec) → `TOOLS_SPECIFICATION` — not one wide ERP table | ✅ |
| Tools Details (cavity, life, hardness…) | Section + footer jump (ERP toolbar) | ✅ |
| Mandatory Documents / Upload File | Footer → `ToolDocumentsPanel` satellites | ✅ |
| Print / Clear / Back / Delete / Save | ERP-style footer action bar on Add/Edit | ✅ |
| Product Mapping For Tool | Link → Tool Mapping (`?tool=`) | ✅ |
| Check List Map | — | ❌ |
| Update Price Details | Price field + price-history API | ⚠️ No inline dialog |
| Photo upload | — | ❌ |

### 3.5 We have / better

- Overlay create/edit + unsaved-changes + URL deep-links  
- Next # auto numbering  
- Bulk import (basic/full/price)  
- Serial units as segregated cards (ERP columns: Purchase / Calib / PreMNT Done / Issue·DC) + Complete PM  

- Status as serial rollup  
- List KPIs  

---

## 4. Tool Mapping

| | |
|--|--|
| **ERP** | [`toolsmapping.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolsmapping.xhtml) · [`newToolMapping.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/newToolMapping.xhtml) |
| **Ours** | `/dashboard/masters/tool-mapping` |
| **Table** | `TOOLS_MAPPING` |

### ERP UI

**Filters:** Vendor Type (`Supplier` / `SubContractor`) · Vendor picker · Search By (Item No / Description / Name) · Get Details / Get Mapping Details  

**List columns:** Item No · Item Description · Item Name · Supplier/Vendor Name · Created By · Created Date · Lst.uptd By · Lst.uptd Date  

**Create dialog (newToolMapping):** Vendor Type · Supplier · Tools or Gauge No · Item picker with filters  

### Ours

Create + Delete only · Tool search + Supplier search · List: Tool No, Name, Group, Supplier Code/Name/City/GSTIN, Approved?, Mapped On  

### Gaps (ours)

1. ❌ **SubContractor** as vendor type (ERP maps both; we only `supCode`)  
2. ❌ Last-updated audit columns on list  
3. ❌ Get Details-style filter by vendor then load mappings  
4. ⚠️ No Edit (acceptable if pair is immutable; ERP may allow replace)  
5. ⚠️ Excel export  

### We have / better

- Richer supplier display (City, GSTIN, Approved)  
- Delete with RoleGate  

---

## 5. Tools Price Overview

| | |
|--|--|
| **ERP** | [`toolspriceoverview.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolspriceoverview.xhtml) |
| **Ours** | `/dashboard/masters/pricing` |
| **Table** | `TOOLS_PRICE_MASTER` |

### ERP UI

**Filters:** Vendor Type (Supplier / SubContractor) · Group · From/To dates · Consider Date? · Rev.Status (ALL / WIP / ACTIVE / IN ACTIVE) · Search by (Item No / Vendor Name / Revision Status / Approve Status)  

**Actions:** Get Details · Pdf · Excel · **Add**  

**List columns:** Supplier Name · Item No · Item Name · UOM · Rate · Price.Rev.No · Price.Rev.Dt · Rev.Status · Approve Status · Created By · Created.Dt  

### Ours

- **👁 Read-only** list from ESSKAY **JSON export** (`data/esskay-tools-price-master.json`), not live Prisma  
- Filters: search, group, supplier, column picker  
- Writes happen via GRN / other paths into Manpro (often empty)  

### Gaps (ours)

1. ❌ **No Add / Edit / Approve** UI (ERP has Add)  
2. ❌ Not reading live `prisma.toolsPriceMaster`  
3. ❌ Vendor Type SubContractor filter  
4. ❌ Date range + Rev.Status workflow filters  
5. ❌ PDF export (we have column-rich list only)  
6. ⚠️ UOM on price row (ERP shows; may be joined from tool)  

### Related doc

See [`docs/tool-pricing-master.md`](./tool-pricing-master.md).

---

## 6. Gauge Type Master

| | |
|--|--|
| **ERP** | [`gaugetypemaster.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/gaugetypemaster.xhtml) |
| **Ours** | `/dashboard/masters/gauge-types` (+ Lookups tab) |
| **Table** | `GAUGE_TYPE` |

### ERP UI

**List:** Type of Gauge · Created By · Created Dt · Lst.Updated By · Lst.Updated Dt  

**Form (dialog):** Type of Gauge  

**Actions:** Add · Edit · Delete · Excel · Search · Rows/page  

### Ours

- Dedicated page: **✅ full CRUD** (`typeOfGauge` only) · Created By / Created Dt · Excel · no empty-DB fallback list  
- API accepts `typeOfGauge` / `name` aliases on create & update  

### Gaps (ours)

1. ✅ Full CRUD on dedicated page  
2. ✅ Show Created By / Created Dt (Prisma has no `lstUpdt*` on `GaugeType`)  
3. ✅ Excel export  
4. ✅ Fix create/update body → `typeOfGauge` (aliases accepted)  
5. ⚠️ Prisma has no `lstUpdt*` on `GaugeType` — ERP shows them (schema drift or unused UI)  

---

## 7. Tools Type Master (Tools Name for Type)

| | |
|--|--|
| **ERP** | [`toolstypemaster.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolstypemaster.xhtml) |
| **Ours** | `/dashboard/masters/tool-types` |
| **Table** | `TOOLS_TYPE` |

### ERP UI

**List:** Type of Tools · Item Group Id · Item Type Id · Created By · Created Dt · Lst.Updated By · Lst.Updated Dt  

**Form labels:** Type of Tools · Item Group Id · Item Type Id  

**Actions:** Add · Edit · Delete · Excel · Search  

### Ours

**✅ Full CRUD** — Tools Group*, Tools Type* (subgroup), Tools Name*, Is Auto Gen, Item Prefix · delete blocked if name used on tools  

### Gaps (ours)

1. ✅ Excel export  
2. ⚠️ List shows names; ERP shows raw Group/Type **IDs** — we are clearer (keep names)  
3. ⚠️ ERP list shows Lst.Updated; our model/`ToolsType` has no `lstUpdt*` columns in Prisma  
4. Low: server pagination  

### We have / better

- Auto Gen + Prefix fields in UI (ERP list doesn’t show them)  
- Guard delete when name in use on `GAUGEANDTOOLS`  
- Excel export of filtered list  

---

## 8. Tools / Gauge and Other Item Issue

| | |
|--|--|
| **ERP** | [`toolsgaugeandotheritemissue.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolsgaugeandotheritemissue.xhtml) |
| **Ours** | `/dashboard/transactions/issue` |
| **Tables** | `GAUGE_TOOLS_ISSUE` + `TOOLS_TRANS_ISSUE` |

### ERP list / filters

**Filters:** Material Requisition · DC Contains · Party type (`SubContractor` / `Supplier` / `Customer` / `All Party`) · Returnable? · Party picker · From/To Date · Consider Data? · Tools/Gauge No Contains  

**Actions:** Get Details · Excel · Delete · Req Add · Edit · Add  

**Header columns:** DC No · DC Date · Issue To · Rec.Name · Rec.Name 2 · Type of Issue · Status · CGST%/Val · SGST%/Val · IGST%/Val · Returnable · Created By · Created Date · Requested By  

**Expand lines:** Name · Description · Tool/Gauge No · Part No · Process · Machine · Qty · Rec.Status · DC.Status  

### Ours (create + list)

**Header form:** DC Date · Search By (`issueOption`) · Party (sub/sup) · Ref No · Returnable · Due Date* · Receiver 1* · Receiver 2 · LOB* · Transporter · Vehicle · PO · Emp ID · Comments  

**Lines:** Tool · Qty · Price · Amount · Machine · Part No · Process · Ret? · Sl.No  

**List:** Card per DC + status tabs (All/Open/Closed/Overdue)  

### Gaps (ours)

1. ❌ **Edit / Delete** existing DC from list (ERP has Edit, Delete)  
2. ❌ **Customer** party picker (option exists in model `custCode`; UI incomplete)  
3. ❌ **GST columns** (CGST/SGST/IGST) — not on our issue UI/schema usage  
4. ❌ Date-range filter + Material Requisition / Req Add  
5. ❌ Excel export of issue list  
6. ❌ Requested By column  
7. ⚠️ Header fields unused: `itemType`, `issuePurpose`, `fromUnit`, `matType`  
8. ⚠️ Line: `remarks`, explicit `issueToItemNo`  
9. ⚠️ No cancel/close DC from this screen  

### We have / better

- Overlay create with sectioned form  
- Overdue tab  
- Due date required on create  

---

## Priority backlog (cross-cutting)

| Priority | Item | Screens |
|----------|------|---------|
| P0 | Align Issue Type enums with live ERP | Tools Manage |
| P0 | Pricing: live DB + Add/approve path (or document out-of-scope) | Price Overview |
| P0 | Tool Issue: Edit/Delete + Customer party | Issue |
| P0 | Dedicated **Preventive MNT Results** page | §17 |
| P0 | Customer material receive write path (not just issue filter) | §11 |
| P1 | Tools Manage list filters (Active, Group→Type→Name, Department, Critical) | Tools Manage |
| P1 | Tools Details UI on Item Master | Tools Manage |
| P1 | ~~Gauge Type dedicated CRUD~~ ✅ | Gauge Type |
| P1 | Tool Mapping: SubContractor vendor type | Mapping |
| P1 | Calib Results: observed-spec grid + finance posting (or scope out) | §16 |
| P1 | Year calendar Plan/Actual for Calib + PM | §18 |
| P1 | Supplier/Subcon: bank, PAN, MSME, contact, ASN fields (subset) | §14–15 |
| P2 | ~~Prefix Based dropdown + Type Prefix required~~ ✅ | Subgroup |
| P2 | Excel export parity on masters | Mapping, Issue (Group/Subgroup/Gauge/Tools Type ✅) |
| P2 | Mandatory Documents / Product Mapping / Check List | Tools Manage |
| P2 | Receive: GE.Dt, invoice, status filter (WORN OUT / MISSING…) | §9 |
| P2 | Calib Issue: Edit + date-range filters | §10 |
| P3 | ~~Clarify Group Code naming~~ ✅ | Group |
| P3 | Stock Item editable + Location Output display | Tools Manage |
| P3 | Full ERP PO / finance GRN — confirm out-of-scope vs tools-only | §12–13 |

---

## 9. Tools Receive Overview

| | |
|--|--|
| **ERP** | [`ToolsReceiveOverview.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/ToolsReceiveOverview.xhtml) |
| **Ours** | `/dashboard/transactions/receive` |
| **Tables** | `TOOLS_ISSUE_RECEIVED` / `_TRANS` |

### ERP UI

**Filters:** GRN Contains · From/To Date · Party type (SubContractor / Supplier / Customer / All Party) · Party · Status (ALL / WORN OUT / MISSING / BROKEN / AVAILABLE FOR USE / REJECTED) · Group · Gauge/Tool No  

**Actions:** Get Details · Excel · receive dialog **Items/Asset Receive**  

**List columns:** GRN No · GRN.Date · DC.No · Received From · Party DC · Received By · expand (Group, Type, Gauge/Tool No, S.NO, Description, Qty, Status)  

**Receive dialog:** GRN No · Rec.Date · GE.No · GE.Dt · From/To · Consider Date · Select party · Filter by Dc.No/Description · Our DC No · DC Date · Party Name · Party DC No · From Whom · Our PO No · Location · line Qty/Status/Comments  

### Gaps (ours)

1. ❌ Line status set: WORN OUT / MISSING / BROKEN / REJECTED (we use Received/Damaged/Missing)  
2. ❌ GE.Dt / invoice fields underused (`geDate`, `invoiceNo` in schema)  
3. ⚠️ Party picker still subcontractor-heavy despite Supplier/Customer filter  
4. ❌ Excel export  
5. ⚠️ No edit/void of posted receive  

### We have / better

- Overlay create + history list with similar core columns  
- Partial/full return against open DC  

---

## 10. Tools / Gauge Calibration Issue

| | |
|--|--|
| **ERP** | [`toolsgaugecalibrationissue.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolsgaugecalibrationissue.xhtml) |
| **Ours** | `/dashboard/calibration/issue` |
| **Tables** | `TOOLS_ISSUE_FOR_CALIBRATION` / `TOOLS_TRANS_ISSUE_FOR_CALIBRATION` |

### ERP UI

**Filters:** Issued For (ALL / Calibration / Preventive MNT) · Party Name · From/To Date  

**Actions:** Get Details · Edit · Issue  

**List columns:** DC No · DC Date · Issue To · Issue For · Receiver Name  

### Gaps (ours)

1. ✅ Edit open/partial calib DC header  
2. ✅ History filters: Issued For · Party · From/To (+ client search)  
3. ⚠️ TOOLS PO stub (“Any”) — not live PO pick  
4. ✅ Issue For = Preventive MNT + dedicated PM Results page (§17)  

### We have / better

- Stage tools from due list · PDF · attachments · detail view · edit header

---

## 11. Tools Customer Material Overview

| | |
|--|--|
| **ERP** | [`toolscustomermaterialoverview.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/toolscustomermaterialoverview.xhtml) |
| **Ours** | `/dashboard/transactions/customer-receive` |
| **ERP intent** | Customer-side GIR / material receive overview (not shop-floor issue list) |

### ERP UI

**Filters:** Customer · From/To · Status (ALL / WIP / CLOSED) · GRN Contains  

**Actions:** Get Details · Search · Detailed / Summary Excel  

**List columns:** Cust Name · GIR No · GIR Date · Pur.No · Description/Qty/UOM/Value · Inv No · Inv AMt · PDF · Status  

**Expand:** Material Name · Receive Qty · Price  

### Ours

👁 **Path B (locked 2026-08-06):** renamed to **Customer Tool Issues** — filtered `GAUGE_TOOLS_ISSUE` where `CUST_CODE` is set. No customer GIR tables in app Prisma. Create via Tool Issue (Search By = Customer).

### Gaps (ours)

1. ❌ Entire customer GIR/receive create workflow — **out of scope** (no mapped GIR tables)  
2. ❌ Invoice / PDF / WIP–CLOSED status (GIR)  
3. ❌ Excel detailed/summary GIR reports  
4. ✅ Screen renamed; copy clarifies issue-filter behavior  

---

## 12. Purchase Order

| | |
|--|--|
| **ERP** | [`purchaseorder.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/purchaseorder.xhtml) |
| **Ours** | `/dashboard/po-linked/purchase-order` |
| **Tables** | `COMMON_PURCHASE_ORDER` (+ lines) |

### ERP UI (full purchasing)

**Filters:** Po Contains · Department · Vendor Type (Supplier/SubContractor) · Status (WIP / PENDING APPROVAL / REJECTED / APPROVED / CLOSED / CANCELLED / SHORT_CLOSED) · Supplier · Type of Goods · From/To · Consider Date  

**Actions:** Search · Get Details · Detailed Excel · Update PO Status · Tools PO Mail · payments grid  

**List columns:** Type Of Goods · PO No/Date · Type · Supplier · Quot No · Department · Status · Payment(S) · Item Details · Packing/Freight/Others · Value · CGST/SGST/IGST · Tot.Val · Created · Ageing · Last updated  

### Ours

👁 / `PendingFeature` — list or unavailable; create stays in ERP Purchasing. Some builds list `COMMON_PURCHASE_ORDER` read-only with link to GRN.

### Gaps (ours)

1. ❌ Create / amend / approve / cancel / short-close PO  
2. ❌ GST / packing / freight / payment / mail  
3. **Scope note:** Tools app intentionally does not own full PO — confirm with stakeholders whether read-only list is enough  

---

## 13. GRN (Capital Goods / Tools / Others)

| | |
|--|--|
| **ERP** | [`grn.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/grn.xhtml) |
| **Ours** | `/dashboard/po-linked/receive` (Tools PO Receive) |
| **Tables (ours)** | `TOOLS_PO_RECEIVE` / `_TRANS` |

### ERP UI (finance + stores GRN)

**Filters:** Search By (Gir No / PO No / Invoice No) · Gir Based (ALL / With PO / Without PO) · Supplier · Department · From/To · Status · Posting Status · Cons.Date?  

**Actions:** Search · Get Details · Detailed / Summary / Billwise Excel · **Posting Ledger** · Short Close · TDS / freight / packing ledgers  

**List columns:** Supplier · GIR No/Date · Pur.No · Dept · Type/Desc/Qty/UOM/Value · Inv No/Date/Amt · PDF · Status · Posting Status/No/Date/By · Created Date  

### Ours

✅ Create tools GRN: PO no (free text) · Supplier · lines (tool, qty, price) → stock update. No finance posting.

### Gaps (ours)

1. ❌ Finance posting / ledger / TDS / short-close  
2. ❌ Without-PO GRN path · Department · Invoice PDF  
3. ❌ Billwise Excel / posting status filters  
4. ⚠️ PO not enforced against open ERP PO qty  
5. **Scope note:** ERP GRN is company-wide purchasing; ours is tools-domain GRN only  

---

## 14. Supplier Details

| | |
|--|--|
| **ERP** | [`supplierdetails.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/supplierdetails.xhtml) |
| **Ours** | `/dashboard/masters/suppliers` |
| **Table** | `SUPPLIER` |

### ERP list columns (sample)

Supplier Code · Vendor Code · Short Name · Supplier Name · City · GSTIN · ASN Enable · Contact Person1 · Mobile · Phone · Email · CreatedBy/Dt · ISO EXP.Date · MSME/REG NO · UDHYOG Aadhaar · PAN · Weighment?  

**Filters:** Status ACTIVE/BLOCKED · Search By (Name, City, Country, State, ASN, weighment, TDS, Aadhaar, GSTIN…) · Excel · Sync to Customer/Subcontractor  

### Ours

✅ CRUD + approve: Code, Name, Address, City, State, Phone, Email, GSTIN, **Bank / Account / IFSC**, Status (**Active / Inactive / Blocked**), Approved · Excel · pager  

### Gaps (ours)

1. ❌ Vendor Code · Short Name · Contact · Mobile · ASN · ISO · MSME · Udyog Aadhaar · PAN · Weighment · TDS — **not on app Prisma `Supplier`** (do not invent)  
2. ✅ Bank / IFSC / Account on form + list + Excel  
3. ❌ Sync-up to Customer/Subcontractor — **Phase X OUT**  
4. ✅ Status BLOCKED supported as distinct UI value  

---

## 15. Subcontractor Details

| | |
|--|--|
| **ERP** | [`subcontractordetails.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/subcontractordetails.xhtml) |
| **Ours** | `/dashboard/masters/subcontractors` |
| **Table** | `SUBCONTRACTOR` |

### ERP list columns

Sub Code · Vendor Code · Short Name · Sub Name · GSTIN · ASN · Contact/Mobile/Phone/Email · City · Is Store Vendor · Inhouse? · Created · ISO Exp · Status · MSME · Udyog Aadhaar · PAN · Weighment?  

**Filters:** Name · ACTIVE / IN ACTIVE / BLOCKED · Search By … · Excel · Sync to Customer/Supplier  

### Ours

✅ CRUD: Code, Name, Nature of Work, GSTIN, **ADD1 / ADD2**, Store Vendor, In-House, Issue DC, **Approved**, Status (**Active / Inactive / Blocked**) · **Pager + Excel**  

### Gaps (ours)

1. ❌ Same extended identity fields as supplier (Vendor Code, contacts, ASN, ISO, MSME, PAN, Weighment) — **not on app Prisma**  
2. ✅ `APPROVED_SUBCONTRACTOR` + `ADD2` on form/list  
3. ❌ Sync-up dialog — **Phase X OUT**  
4. ✅ Pager + Excel  

---

## 16. Update Calibration Results

| | |
|--|--|
| **ERP** | [`updatecalibrationresults.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/updatecalibrationresults.xhtml) |
| **Ours** | `/dashboard/calibration/results-update` |
| **Tables** | Calib issue lines + `GAUGE_CONTROL_CARD(_TRANS)` / tool dates |

### ERP UI

**Filters:** For (Update / Review) · From/To Due Date · Calibration Status (ALL / Open / Closed) · Consider Date · Search By (Tool No / Description / DC No / Issued To)  

**Actions:** Get Details · Remove Posting · **Finance Posting** · Calibration Results  

**List columns:** DC.No · IssueDt · Gauge/Tool.No · SI.No · GRN No/Date · Party · Group · Type/Name · Description · Cal.Due.Dt · Cal.Dt · Next Calib.Dt · Status · GRN Status · Post Status · Issued To · Doc · PDF  

**Results form:** Location · Calib Freq · Part No · Gauge/Wear/Product specs · Calibrated Dt · Next Dt · Result Status (AVAILABLE FOR USE / WORN OUT / BROKEN / REJECTED / NOT IN USE) · Calibrated By · Comments  

**Spec grid:** Parameter · Actual Min/Max · Wear Limit · P.S Min/Max · Obs Min/Max · Gauge Status after Calib · Remarks  

**Also:** GRN receive header + GST totals + ledger posting for subcontractor bill  

### Gaps (ours)

1. ✅ Observed-value parameter grid from `TOOLS_SPECIFICATION` (packed into ERP text cols; OTHERS table not in Prisma)  
2. ❌ Finance posting / Remove Posting / GRN status / Post Status — **Phase X OUT**  
3. ✅ Result statuses include ERP set + legacy PASSED/FAILED  
4. ✅ Open/Closed + due-date range + search filters  
5. ⚠️ Extra result fields often folded into remarks  

### We have / better

- Save result + cert upload + Excel/PDF of pending set  
- Writes control card / next due · observed-spec grid

---

## 17. Update Preventive MNT Results

| | |
|--|--|
| **ERP** | [`updatePreventiveMNTresults.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/updatePreventiveMNTresults.xhtml) |
| **Ours** | `/dashboard/calibration/preventive-results` |
| **Related** | Calib Issue can set Issue For = Preventive MNT; APIs `preventive-due` / `preventive-complete` |

### ERP UI

**Filters:** For (Update / Review) · From/To Due Date · Preventive MNT Status (ALL / Open / Closed) · Consider Date · Tool Gauge No  

**Actions:** Get Details · **Preventive MNT Results**  

**List columns:** DC.No · IssueDt · Gauge/Tool.No · SI.No · Group · Type/Name · Description · Pre.Due.Dt · Pre.Due Done · Present Status · Status · Issued To · Doc  

**Results form:** Pre.MNT Due · Current Status · Pre.MNT Dt · Nxt Pre.MNT Dt · Result Status · Comments  

### Gaps (ours)

1. ✅ Dedicated PM results page (due queue + open PM DCs)  
2. ✅ Complete PM advances `NXT_PRE_DATE` via `preventive-complete`  
3. ⚠️ Review / Open-Closed ERP filters not full parity  
4. ⚠️ Result status stored in remarks slice (no dedicated PM result columns in Prisma)  

---

## 18. Calibration / Preventive MNT Calendar

| | |
|--|--|
| **ERP** | [`calibrationprevmntcal.xhtml`](https://demo.sukierp.com:9493/SukiERPWebApp/pages/qmt/calibrationprevmntcal.xhtml) |
| **Ours** | `/dashboard/calibration/calendar` (+ Due List for short horizon) |

### ERP UI

**Filters:** From Month · To Month · Issued For (ALL / Calibration / Preventive MNT) · Item Group · Item Type · Year  

**Actions:** Get Details · Excel  

**Grid:** Item No · Sl No · **Plan/Actual** for each month Jan–Dec  

### Gaps (ours)

1. ✅ Yearly Plan vs Actual calendar matrix (`GET /api/calibration/calendar`)  
2. ✅ Combined Calibration + Preventive view  
3. ✅ Month-range / year filters · Excel  
4. ✅ Due List remains for overdue windows; links to calendar  

---

## ERP URL index (this document)

| ERP path | Section |
|----------|---------|
| `/pages/qmt/itemgroup.xhtml` | §1 |
| `/pages/qmt/itemtypeforgroup.xhtml` | §2 |
| `/pages/qmt/toolsmanage.xhtml` | §3 |
| `/pages/qmt/toolsmanagecreation.xhtml` | §3 |
| `/pages/qmt/toolsmapping.xhtml` | §4 |
| `/pages/qmt/newToolMapping.xhtml` | §4 |
| `/pages/qmt/toolspriceoverview.xhtml` | §5 |
| `/pages/qmt/gaugetypemaster.xhtml` | §6 |
| `/pages/qmt/toolstypemaster.xhtml` | §7 |
| `/pages/qmt/toolsgaugeandotheritemissue.xhtml` | §8 |
| `/pages/qmt/ToolsReceiveOverview.xhtml` | §9 |
| `/pages/qmt/toolsgaugecalibrationissue.xhtml` | §10 |
| `/pages/qmt/toolscustomermaterialoverview.xhtml` | §11 |
| `/pages/qmt/purchaseorder.xhtml` | §12 |
| `/pages/qmt/grn.xhtml` | §13 |
| `/pages/qmt/supplierdetails.xhtml` | §14 |
| `/pages/qmt/subcontractordetails.xhtml` | §15 |
| `/pages/qmt/updatecalibrationresults.xhtml` | §16 |
| `/pages/qmt/updatePreventiveMNTresults.xhtml` | §17 |
| `/pages/qmt/calibrationprevmntcal.xhtml` | §18 |

---

## How to extend

When more ERP links are provided, append a new numbered section using the same template:

1. ERP URL + our route + table  
2. ERP list / form / actions  
3. Field map table  
4. Gaps (❌/⚠️) and enhancements (➕)  
5. Update the status-at-a-glance table and ERP URL index  

**Related:** [`project-overview.md`](./project-overview.md) · [`module-wise-testing-guide.md`](./module-wise-testing-guide.md) · [`erp-gap-implementation-prompt.md`](./erp-gap-implementation-prompt.md) (phased build brief)
