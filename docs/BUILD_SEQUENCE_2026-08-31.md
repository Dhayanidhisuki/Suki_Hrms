# KUN / Suki HRMS — Build Sequence and Priority Guide

**Date:** 31 August 2026
**Inputs analysed:** `KUN HRMS PT BRD.docx`, `KUN HRMS Bonus & Gratuity BRD.docx`, `KUN HRMS Increment & Arrear BRD.docx`, `KUN HRMS Loan BRD.docx`, `Suki Kun Payroll.docx`, `suki kun Time office.docx`, `Professional Tax_2025-2026_II Half.xlsx` (live client data)
**Reads with:** `REQUIREMENTS_DECISIONS.md` (open questions), `BUILD_ESTIMATE_2026-08-25.md` (effort), `MASTERS_PLAN_2026-08-25.md` (masters), `TIME_OFFICE_ANALYSIS_2026-08-25.md` (attendance/leave/OT)

**Purpose.** The five payroll-side BRDs arrived as separate documents describing separate screens. They are not five independent modules — they are five consumers of the same three or four engines. This document sets the order in which things must be built, what each step depends on, and what is still missing before each step can start. No effort estimates here; those stay in `BUILD_ESTIMATE_2026-08-25.md`.

**Build state as of today:** Masters (19 tables) and Employee Master (15 tabs) are complete on `integration/hrms-complete`. 25 of ~209 sidebar routes are live. Nothing in the pay layer exists yet beyond stub models.

---

## 1. What the new documents change

| Document | What it settles | What it opens |
|---|---|---|
| **Payroll BRD** | The end-to-end run: attendance inputs → earnings → gross → statutory → deductions → round-off → net. Payroll status machine `DRAFT → CALCULATED → VALIDATED → SUBMITTED → APPROVED → POSTED → LOCKED`. 12 mandatory pre-save validations. Bulk processing with a valid/invalid split before commit. Employee-level statuses COMPLETED / HOLD / PENDING. | **OT basis is given four mutually exclusive ways** (§ OT Examples 1–4). LOP vs LOM are two different deductions with two different divisors. Both need a ruling. |
| **PT BRD + PT workbook** | PT is state-scoped, slab-driven, effective-dated, half-yearly. The workbook is live KUN Aerospace data and confirms the **Tamil Nadu** slab set and that PT is being paid half-yearly on gross. | Client wants **two half-year conventions** — Financial (Apr–Sep / Oct–Mar) *and* Non-Financial (Mar–Aug / Sep–Feb). The workbook's `ER.GROSS` is identical in all six months, so we do not know whether PT reads a fixed gross or the earned gross. |
| **Loan BRD** | Full cycle: master → eligibility → application → approval → issue → schedule → payroll recovery → closure. Statuses OPEN / CLOSED / SHORTCLOSED / HOLD / CANCELLED. 20 numbered business rules, including "payroll reversal must reverse the loan recovery". | Deduction **priority** when net salary would go negative. Interest method (none / flat) for each loan type. |
| **Increment & Arrear BRD** | The single most important architectural statement in the whole set: **never overwrite current salary — write a new effective-dated version and let payroll read the version valid for the period** (§35). Month-wise arrear rows, not totals. Arrear PF/ESI computed on the component difference, not the gross difference. Entity list: `SalaryRevisionCycle / SalaryRevision / SalaryRevisionComponent / SalaryRevisionApproval / SalaryArrear / SalaryArrearMonth / ArrearPF / ArrearESI`. | Revision cycle definition and eligibility rule. Whether reopening a frozen period produces arrears or a payroll reversal (also open as T15 in the Time Office analysis). |
| **Bonus & Gratuity BRD** | Bonus: statutory shape (₹21,000 wage ceiling, 30 days minimum service, 8.33% floor, 20% cap), lifecycle `Pending → Eligible → Calculated → Approved → Processed`. Gratuity: configurable policy, dynamic service calculation from dates, `Last drawn eligible salary × 15/26 × completed years` as *a* formula not *the* formula, effective-dated ceiling, death/disability rules, gross-vs-payable retained for audit. | The document says outright: **"The exact formula must be provided by the business before development is finalized."** Bonus % determination is genuinely unspecified. |

**Effect on `REQUIREMENTS_DECISIONS.md`:** Topic 6 (Payroll) moves PENDING → PARTIAL. Topic 7 (Statutory) moves PENDING → PARTIAL for PT only; PF, ESI, TDS and LWF remain PENDING. Topic 12 (Loan, previously untracked) becomes PARTIAL. The BRDs describe *structure* well and *values* badly — nearly every remaining blocker is a number, not a design.

---

## 2. The four shared engines

This is the core of the guidance. Five documents each describe their own screens, their own approvals and their own configuration. Built literally, that produces five copies of the same machinery and a system that cannot reconcile itself. Four things must be built **once**, **before** the modules that consume them.

### Engine 1 — Salary component definition

Every one of the five BRDs says the same thing in different words: *do not hard-code the components*. The Payroll BRD lists ~20 earnings and ~20 deductions; the Gratuity BRD wants an `Include in Gratuity` flag per component; the Arrear BRD wants PF arrears computed on PF-applicable components only; the OT section wants a configurable OT base (Basic, or Gross, or Basic+DA+HRA+Other).

All four requirements land on one table. A component must carry: code, name, type (earning / deduction / employer contribution), calculation type (fixed / percentage / formula / attendance-derived), the base it computes from, sequence, rounding, effective dating, and the applicability flags — **PF base, ESI base, PT base, gratuity base, bonus base, OT base, LOP applicable, taxable**.

Today's `SalaryComponent` model has code, name, type, isActive and nothing else. Extending it is the first task of the pay layer, and every subsequent engine reads it.

### Engine 2 — Effective-dated salary version

The Increment BRD § 35 is explicit and correct: `Employee.CurrentSalary = RevisedSalary` is forbidden. Payroll must resolve the salary version valid for the payroll period, so that a June re-run of April uses April's salary.

Consequences that must be accepted up front, not retrofitted:

- Arrears exist only because versions exist. There is no arrear engine without versioning.
- Gratuity's "last drawn eligible salary" is a lookup against the version table.
- Bonus needs annual wage history, which is a sum over versions.
- A payroll re-run is a re-resolution, not an edit.

### Engine 3 — Period and freeze state machine

Four separate period concepts appear across the documents: the Time Office freeze (F1–F6), the payroll status chain ending in LOCKED, the PT half-year, and the loan "deduction linked to the relevant payroll period". These are one concept with different views. Build a single `PayrollPeriod` with a state machine and a `frozen` check on every write path in attendance, leave, OT, permission, comp-off, loan recovery, arrear and payroll.

The Time Office analysis already flagged this as cheaper to build in than to retrofit. The new BRDs make it unavoidable: the Loan BRD's rule 17 ("a payroll rollback must reverse the corresponding loan recovery") cannot be implemented without it.

### Engine 4 — Approval engine

Five BRDs, five approval chains: loan approval, salary revision approval (HR verification → management approval), bonus approval, gratuity approval (HR → payroll validation → HR approval → finance approval → settlement), payroll approval (manager/HR → finance). All want hold, reject, return-for-correction, and a timestamped audit trail.

That is one generic engine with a polymorphic request reference, which the ERP analysis already showed the client's legacy system uses. Building it inside the first module that needs it — and copying it four times — is the most likely single source of rework in this project.

---

## 3. The build hierarchy

Each layer's gate must hold before the next begins. Layers 0–2 exist today.

| Layer | Contents | Gate to the next layer |
|---|---|---|
| **L0 — Platform** *(done)* | Auth, RBAC, app shell, shared CRUD kit, Prisma + migration pattern | — |
| **L1 — Organization masters** *(done, gaps)* | 19 masters, Company, Unit | `Level.rank` still missing; no Branch/Site distinct from Unit; no Holiday master, no Weekly-off config |
| **L2 — Employee master** *(done)* | List, quick-create, 15 profile tabs, documents, activity, confirmation flow | Salary and CTC tabs currently write to two competing models — see § 5 |
| **L3 — Cross-cutting engines** | Approval engine · Period & freeze · Audit log · PDF/template service · Component definition (Engine 1) · Salary versioning (Engine 2) | **Nothing above L3 should start until the approval engine and the period model exist.** This is the highest-leverage layer in the project and the one most likely to be skipped under delivery pressure. |
| **L4 — Policy masters** | Attendance policy, OT policy + incentive slabs, leave policy, comp-off, permission, holiday, weekly off, LWF, gratuity policy, bonus policy, loan master (full), PT slabs per state, PF/ESI config | Policy masters must precede their engines, not follow them. An OT engine written before the OT policy master hard-codes the policy. |
| **L5 — Transaction capture** | Biometric sync → attendance → leave → OT → comp-off → permission → **period freeze** | Payroll cannot be built against imagined inputs. Attendance must produce a frozen, signed-off monthly result before the payroll engine is meaningful. |
| **L6 — Pay** | Salary structure → payroll run → statutory → recoveries → arrears → annual benefits → outputs | See § 4 for internal order |
| **L7 — Output & compliance** | Payslips, bank file, PT/PF/ESI returns, Form 25/15/25B/25C/21/22, reports, dashboards, ESS | Every item here is a projection of L5 and L6 data. Building any of it earlier means building it twice. |

**The one ordering rule worth memorising:** *configuration before engine, engine before transaction, transaction before report.* Every sequencing mistake available in this project is a violation of that line.

---

## 4. Order inside the pay layer

The five new BRDs all live in L6. Their internal order is forced by data dependency — each step needs the previous step's output to exist.

| # | Step | Needs | Produces | Cannot start before |
|---:|---|---|---|---|
| P1 | **Component definition** (Engine 1) | — | The vocabulary every later step calculates in | — |
| P2 | **Employee salary structure + versioning** (Engine 2) | P1 | Effective-dated salary per employee | P1 |
| P3 | **Statutory configuration** | P1 | PF / ESI / PT / LWF rules, effective-dated, per state | P1 |
| P4 | **Payroll run engine** | P2, P3, frozen attendance (L5) | Payroll run + per-employee payroll lines + LOCKED period | L5 freeze exists |
| P5 | **Loan management** | P1 (deduction code), approval engine, P4 | Recovery rows consumed by the run | Master and approval can be built in parallel with P4; **recovery integration cannot** |
| P6 | **Salary revision (increment)** | P2, approval engine | New salary versions | P2 |
| P7 | **Arrears** | P6 + **at least one processed payroll run** | Month-wise arrear rows, arrear PF/ESI | P4 and P6 both complete — arrears are the difference between a version and what was actually paid, so both sides must exist |
| P8 | **Bonus** | P4 history (annual wage), bonus policy | Annual bonus per employee | A full year of payroll history, or migrated history |
| P9 | **Gratuity** | P2 (last drawn), separation module, gratuity policy | Settlement amount | Separation flow must exist; estimation-only view can ship earlier |
| P10 | **Payroll outputs** | P4 + everything above | Payslip, bank file, reconciliation | Last, by definition |
| P11 | **PT / PF / ESI returns and reports** | 6 months of P4 output for a PT half-year | Statutory filings | Needs history — this is the strongest single argument for migrating payroll history rather than starting empty |

**Two traps in this ordering.**

*The arrear trap.* Arrears look like part of the increment screen and are frequently built there. They are not. An arrear is `revised salary − salary actually paid`, so it needs the payroll run's stored output, not the salary master. Building arrears alongside increments produces a calculation that cannot be reconciled against a payslip.

*The report trap.* The PT BRD describes a single consolidated PT page as its deliverable, which reads as a quick win. It is not: the page's four summary cards, half-yearly table and employee grid are all projections of six months of payroll runs. Until P4 has run six times, the page can only be built against migrated data.

---

## 5. Schema reconciliation needed before P1

These are conflicts in the current schema, not new requirements. They must be settled before the pay layer starts, because everything above inherits them.

| # | Issue | Detail | Resolution |
|---:|---|---|---|
| S1 | **Two competing salary models** | `SalaryStructure` has hard-coded columns (basic, hra, conveyance, medical, special, other) and its own `monthlyCtc`. `EmployeeSalaryRevision` + `EmployeeSalaryComponent` is the flexible, versioned model. The Employee profile's Salary tab and CTC tab currently write to both shapes. | Keep the versioned model, retire `SalaryStructure` to a migration-only legacy table. Every new BRD assumes configurable components; the fixed-column model cannot express them. |
| S2 | **`SalaryComponent` is a stub** | code / name / type / isActive only. No calculation type, no base, no sequence, no rounding, no effective dating, no PF/ESI/PT/gratuity/bonus/OT applicability flags. | Extend per Engine 1. This is the first pay-layer migration. |
| S3 | **`LoanType` is a stub** | code / name / description only. | Extend to the Loan BRD's master: category, min/max amount, max tenure, interest applicable/type/rate, deduction frequency, payroll deduction code, deduction priority, multiple-active-loan flag, eligibility criteria. |
| S4 | **`ProfessionalTaxSlab` is not state-scoped** | Has `monthlyAmount` and effective dating, but no state/jurisdiction, no half-yearly amount, no half-year convention. The BRD requires state-specific rules and *two* half-year conventions. | Add state, half-yearly amount, and a period-convention field. |
| S5 | **No per-employee PF override** | `PfRate` is a global rate table. The legacy ERP holds per-employee PF treatment (statutory / fixed / custom percentage). | Add PF/ESI treatment fields on the employee's statutory record. |
| S6 | **Models that do not exist at all** | Payroll period, payroll run, payroll line, payslip, LWF, gratuity policy and settlement, bonus policy and record, loan transaction and schedule and recovery, arrear and arrear-month, approval request. | Introduced by their own phases — listed here so they are not mistaken for existing scaffolding. |

---

## 6. Blockers, in the order they will bite

Grouped by the phase they block, so they can be asked in batches rather than all at once.

### Blocks L3/L4 — ask now

| # | Question |
|---:|---|
| B1 | **Approval chains.** Fixed (Manager → HR) for everything, or per-request-type? Derived from the reporting structure or configured per department? What happens when an approver is unavailable — escalate, delegate, or stall? *(Topic 2, still PENDING; now blocking five modules instead of one.)* |
| B2 | **Reporting manager.** Named per employee, or derived from level + department? The legacy ERP holds four manager roles (HOME, BUSINESS, HR, VR); the schema holds one. |
| B3 | **Period reopen semantics.** When a frozen attendance or payroll period is reopened, does the system generate arrears, or reverse and re-run the payroll? *(T15 — this now decides the arrear engine's design, not just attendance.)* |
| B4 | **Salary component list, as the client actually uses it.** The Payroll BRD lists ~40 candidates including duplicates ("Food Allowance" twice). We need the real active list with, for each: calculation basis, PF-applicable, ESI-applicable, gratuity-applicable, LOP-applicable, taxable. |

### Blocks P3/P4 — payroll engine

| # | Question |
|---:|---|
| B5 | **OT calculation basis.** The BRD gives four incompatible examples: Basic ÷ 26 ÷ 8 × 2.0; Gross ÷ actual days ÷ 8 × 1.0; a fixed hourly rate; and (Basic+DA+HRA+Other) ÷ actual days ÷ 8. Which is live? Is the divisor fixed at 26 or the calendar days of the month? Does the multiplier vary by weekday / weekly-off / holiday? |
| B6 | **LOP vs LOM.** LOP is `daily salary × LOP days`; LOM is `salary ÷ days ÷ 8 ÷ 60 × minutes`. Confirm both are live, and confirm the base for each (gross or basic) — BRD § 11 example 2 uses Basic but then prints example 1's answer, so the document contradicts itself. |
| B7 | **Salary calculation basis.** Fixed 30 days, calendar days, or working days? This changes every per-day figure in the system. |
| B8 | **PF specifics.** The BRD states employer 13% — the statutory split is 12% (8.33 EPS + 3.67 EPF) plus ~1% admin/EDLI. Confirm which, whether the ₹15,000 ceiling is applied or actual wages are used, and whether treatment varies per employee. |
| B9 | **Rounding.** Per component, or only on net? Which rule (nearest 1 / 5 / 10)? |
| B10 | **Payroll cut-off** relative to the attendance cut-off and the pay date. |

### Blocks P3 — Professional Tax

| # | Question |
|---:|---|
| B11 | **Slab table discrepancy.** The workbook's Break-up sheet has six slabs (0 / 135 / 315 / 690 / 1025 / 1250 per half). The BRD's monthly table has four (0 / 115 / 171 / 208) and omits the ₹3,501–5,000 and ₹5,001–7,500 bands. Which is authoritative? |
| B12 | **PT wage basis.** The workbook's `ER.GROSS` is identical for all six months per employee, which suggests a fixed gross rather than earned gross. Confirm whether PT reads contracted gross or actual earned gross (they differ whenever there is LOP). |
| B13 | **Half-year convention.** The BRD asks for both Financial (Apr–Sep) and Non-Financial (Mar–Aug). Are both live simultaneously — different units, or different reporting purposes? |
| B14 | **Illustrative vs real figures.** The BRD's summary cards show 2 taxable employees out of 470; the live workbook shows 346 employees all in the top slab. Confirm the BRD figures are illustrative only. |

### Blocks P5–P9 — recoveries and annual benefits

| # | Question |
|---:|---|
| B15 | **Deduction priority.** When gross cannot absorb all deductions, what is the order, and what happens to the shortfall — carry forward, partial recovery, or block the run? The BRD says net must not go negative "without authorization", which needs a defined authorization path. |
| B16 | **Loan interest.** Which loan types carry interest, and flat or reducing balance? |
| B17 | **Bonus percentage rule.** The BRD explicitly defers this. Needed: the bonus base (basic / statutory wage of ₹7,000 / average basic), the percentage rule (fixed 8.33%, allocable-surplus-driven, or management-declared), and the eligibility date. |
| B18 | **Gratuity policy values.** Eligibility service (4y240d or 5y), working days in month (26?), the ceiling amount, whether service breaks exist, and which components form the gratuity base. |
| B19 | **Salary revision cycle.** Annual on a fixed date, on employment anniversary, or ad-hoc? And the eligibility rule that populates the revision screen. |
| B20 | **LWF.** Tamil Nadu rates, deduction frequency (annual in December for TN), and the employee/employer split. |

---

## 7. New entries for the contradiction log

To be appended to `REQUIREMENTS_DECISIONS.md`:

| Topic | Conflict |
|---|---|
| Payroll — OT | Four incompatible OT formulas in one document (§ OT Examples 1–4), differing in base, divisor and multiplier. |
| Payroll — LOM | § 11 example 2 computes from Basic ₹15,000 but reports example 1's answer (₹29,791.67, derived from ₹30,000). Arithmetic error in the source document. |
| Payroll — PF | BRD states employer PF 13%; statutory is 12% + admin/EDLI charges. |
| PT | BRD monthly slab table (4 bands) versus live workbook (6 bands). |
| PT | BRD summary example (2 taxable of 470) versus live workbook (346 taxable). |
| Salary model | Repository has two salary representations (`SalaryStructure` fixed-column vs `EmployeeSalaryRevision` + components). All five BRDs assume the configurable one. |
| Arrear vs freeze | Increment BRD assumes retroactive revisions generate arrears; Time Office BRD's reopen flow implies reversal and re-run. Both cannot be the default. |

---

## 8. Recommended next three steps

1. **Send the B1–B4 batch to the client now.** They block the engines, and the engines block everything else. B4 in particular — the real component list with its applicability flags — is a spreadsheet the payroll team already has.
2. **Settle S1 and build the extended `SalaryComponent` model.** It is a schema decision the client does not need to be involved in, it unblocks nothing else until it is done, and it is the direct dependency of five modules.
3. **Build the approval engine and the period/freeze model before any pay screen.** They are invisible in every BRD and required by all of them. Built now they cost once; built later they cost five times plus the migration of whatever was written in the meantime.

Everything else waits on attendance being real. Payroll built against imagined attendance inputs is payroll built twice.
