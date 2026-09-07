# Employee Details Master — UI Field Map (ERP → New System)

**Source:** `Employee details master page brd old.docx` (40 screenshots of the live ERP screen `employeemaster.xthml` / `employeemaster1.xhtml`)
**Purpose:** field-map-first pass, per the agreed workflow (map fields → confirm → build model). **No schema or code changes made yet.**
**Screen inventory:** 1 list page, 1 core create/edit form, and 14 sub-tabs opened from the employee detail view: Personal, Contact, Job Profile, Salary, CTC, Education, Experience, Emergency Contact, Passport, Dependent, Assets, Skill Matrix, KYC, Activity.

Status codes used below: **OK** = matches an existing Prisma field closely enough to reuse · **GAP** = field missing from current schema, needs adding · **NEW TABLE** = the ERP treats this as a repeating grid but our schema currently has it as a flat/singular field, or has no table at all · **DUP** = this exact fact is already captured elsewhere on the ERP screen (duplicate entry point) · **FLAG** = needs a decision before building.

---

## 1. List page (`employeemaster1.xhtml`)

Filters: Unit Name, Left Company? (Yes/No), Category, Department, Designation, ESI, PF, Order By, Search By + free text.
Grid columns: Old Emp Cd, First Name, Last Name, Designation, Grade, Department, Class, Emp Code, Unit Name, Left Company, Home Manager, Business Manager, Emp Photo, Supplier Name, Created By, Created Date, Lst.Updtd.By, Lst.Updtd.Date.
Row actions: Delete, CreateLedger, Migrate (SAP), Appointment Letter, Artifacts, Map Manager, Map CheckList, Edit, Add.

Notes: "Home Manager" / "Business Manager" columns confirm the matrix-reporting structure already found in the ERP schema analysis (`HOME_MANAGER` / `BUSINESS_MANAGER` / `HR_MANAGER` / `VR_MANAGER`) — this is a live UI surface for Q1.7 (named vs derived reporting manager), now showing it's actually **two manager roles surfaced in the grid**, not one. "Supplier Name" appearing on an *employee* row is unexpected — likely contract-labour employees are supplier-linked here; matches the earlier "contract labour as separate payroll engine" finding. "Migrate (SAP)" and "CreateLedger" are integration actions, out of scope for now — flagging only so they aren't lost.

---

## 2. Core form (create/edit) — fields directly on Employee/JobInfo

| ERP field | Control | Proposed target | Status | Notes |
|---|---|---|---|---|
| Category & Sub Category | 2 cascading dropdowns | `Category` (+ new `SubCategory`?) | **FLAG** | Schema has one flat `Category` model. ERP has Category *and* Sub-Category as a cascading pair. Need to know what Sub Category means here (it's distinct from `SubDepartment`). |
| Level | dropdown: L1–L7 | `Level` | **FLAG — contradiction** | This directly conflicts with the already-agreed Organization Structure decision (Level = 5-tier org rank: Founder/C-suite/Dept-Head/Mid-level/Workforce). The ERP's "L1–L7" here reads as a pay/grade-band level, not org rank — likely the same conflict already logged as C1 (Level vs `HRMS_DESIG_LEVEL_MASTER`). Logging as a new contradiction row below. |
| Title | dropdown: Mr/Miss/Mrs/Mx | `PersonalDetails.salutation` | **GAP** | Not in current schema. |
| Emp Code | text, required | `Employee.employeeCode` | OK | |
| Old Emp.Cd | text, required | — | **GAP** | Legacy code carried forward from old ERP; needed for migration traceability even post-cutover. Suggest `Employee.legacyEmpCode`. |
| Date Of Joining | date | `JobInfo.joinDate` | OK | |
| Daily Sheet Required? | Yes/No | — | **GAP** | Ties to production daily-sheet/attendance workflow, not yet modeled. |
| Unit Name | dropdown | `JobInfo.unitId` | OK | |
| Petrol Allowance | dropdown: NA/BIKE/CAR | — | **GAP** | New lookup master needed (small, 3 values — candidate for `DropdownMaster`). |
| Team Group | free text | — | **GAP** | |
| Image Upload | file | — | **GAP** | Photo storage not yet modeled anywhere on Employee. |
| Type * | dropdown, required | `EmployeeType`? | **FLAG** | Name collision risk: is this the same "Type" as `EmployeeType` (permanent/contract/trainee), or a different classification? Screenshot doesn't show the option list. |
| Grade Code | dropdown | `JobInfo.gradeId` | OK | |
| First Name * | text | `Employee.firstName` | OK | |
| Guest? | Yes/No | — | **GAP** | |
| Confirm Date | date | — | **GAP** | Distinct from `JobInfo.confirmationDate`? Likely the same fact — reuse. |
| Shift Duration | number | — | **GAP** | Possibly redundant with `ShiftMaster` timing — check before adding a per-employee override field. |
| Probation Date | date | `JobInfo.probationEndDate` | OK (rename check) | |
| Additional Role | dropdown | — | **GAP** | |
| Induction Status | dropdown: PENDING/… | — | **GAP** | New small lookup. |
| Signature Upload | file | — | **GAP** | |
| Designation | dropdown | `JobInfo.designationId` | OK | |
| Department | dropdown | `JobInfo.departmentId` | OK | |
| Production Line | dropdown: N/A / ARMATURE LINE / OTHERS | — | **GAP** | Manufacturing-specific sub-classification under Department, separate from `SubDepartment`. Needs its own small master or a repurposed `SubDepartment`. |
| Last Name * | text | `Employee.lastName` | OK | |
| Class | dropdown | — | **FLAG** | This is the 5th classification dropdown alongside Category, Sub Category, Type and Grade. Matches `HRMS_EMP_CLASS` (already in the 25-table extraction list) but its business meaning vs Category/Type still needs a plain-English definition from you. |
| Exit Date | date | — | **GAP** | |
| Shift? | Yes/No | — | **GAP** | Whether the employee is shift-based at all — separate flag from the shift assignment itself. |
| Shift Name | dropdown: GENERAL/SHIFT1/2/3 | `JobInfo.shiftMasterId` | OK | |
| NDA (upload) | file | — | **GAP** | |
| Fitness Certificate (upload) | file | — | **GAP** | |
| Grace.Mins | number | — | **GAP** | Matches the ERP's per-employee `GRACE_MINS` already flagged in the Time Office contradiction log (grace-period ownership: per-employee override vs company policy). |

---

## 3. Personal Details tab

| ERP field | Status | Notes |
|---|---|---|
| Gender, Birth Date | OK | `PersonalDetails.gender`, `.dateOfBirth` |
| Marital Status, Marriage Date, No.Of Children | **GAP** (marriage date, children count) | `maritalStatus` exists; the other two don't |
| Email.Id | OK | maps to `personalEmail` |
| Nationality, Blood Group, Religion | OK | all three exist |
| Height(cms), Weight(kgs), Shirt/Pant/Shoe Size | **GAP** | none of these five exist — all new |
| Insurance No, ESIC.No, PF.No, Insurance Expiry on | **GAP** | statutory IDs currently not modeled on PersonalDetails at all |
| UAN.No, PAN.No, Aadhar No | **GAP / DUP** | these reappear again on the KYC tab (see §12) — one source of truth needed |
| Driving License No, License Expiry On | **GAP / DUP** | also reappears on KYC |
| Election Card No, Ration Card No | **GAP / DUP** | also reappears on KYC |
| Company Issued Mobile No, Mobile Deduction? | **GAP** | |
| Canteen Allowance? | **GAP** | dropdown, options not visible in screenshot |
| Loan Installment Month | **GAP** | |

---

## 4. Contact Details tab

Two parallel address blocks — Permanent (Address1/2, City, State, Pin Code, Phone, Mobile) and Communication (same fields), plus an "As Forward" checkbox that copies Permanent → Communication.

Current schema has single flat `presentAddress` / `permanentAddress` strings on `PersonalDetails` — no structured City/State/Pincode/Phone split, and no separate Communication-address concept. **GAP** across the board if we want the same structure; **FLAG**: decide whether we actually need two separate structured addresses or whether one structured address + a "same as permanent" flag is enough for a manufacturing workforce (likely yes — recommend simplifying rather than copying the ERP's duplication).

---

## 5. Job Profile tab

This tab is the largest single gap. Existing `JobInfo` has none of these; recommend they land on `JobInfo` (versioned, so bank/PF/ESI-eligibility changes over time are tracked correctly) rather than a new table.

Wages Type* (Monthly/Daily/Hourly), Payment Mode* (Cheque/Cash/Bank), Salary AC/No (Pay Bank), Personal AC/No, Bank Name, IFSC Code, Name of Bank Branch, Bank Micro Code — **DUP**: bank fields already exist on `EmployeeBankDetail`; Job Profile is re-entering the same facts. Office Email, Official Password — **FLAG (security)**: a plaintext "Official Password" field stored on the employee record is a real risk; recommend explicitly **not** carrying this into the new schema, and handling office-account credentials through whatever identity system issues them, not HRMS data. Provident Fund (Y/N), ESI Allowed (Y/N), Professional Tax (Y/N), Bonus (Y/N), Over Time Allowed (Y/N) + Over Time Factorial, Phy.Challenged (with sub-category: Locomotive/Visual/Hearing/Others — richer than the flat boolean currently on `PersonalDetails`), Loss Of Minutes Deduct (Y/N) + Loss Of Minutes(Allow), International Worker (Y/N), LTA Eligible (Y/N), PF Restriction To (PF wage ceiling amount), Company Contact 1/2, Over Time Rate Per Hour, No.Of Leave Allow, Asset Id1/2, IP Address1/2, Permission Request (Y/N) + Permission Hours.

All **GAP**. None currently exist on `JobInfo`.

---

## 6. Salary Details tab

Financial-year-scoped, ~35 individual pay components (SRA, QA, Snacks/Heat/Wash/Night Shift/Education/Health/CCA/Other/Lunch allowances, HRA%/HRA, DA%/DA, Additional HRA, Attendance Incentive, Canteen Allowance, Guest House Allowance, LTA, Dis.Location.Allow, Food Allow, Prod.Incentive, Performance Allowance/Incentive, Esi Allowance, LIC, PF, PF Type, Gross, NETT Salary, Attendance Bonus if 1/2 days leave, Canteen Deduction, Prof.tax Deduction, Employee PF Cont Customize, Effective From, Basic Salary (Monthly)).

Current `SalaryStructure` has 6 fixed allowance columns — nowhere near enough, and this is exactly the anti-pattern the schema header already warns against ("no giant flat salary table"). This confirms the plan already implied by including `HRMS_SALARY_COMPONENT` and `HRMS_SALARY_LOGIC` in the 25-table extraction list: **salary should be a component-based model** (one row per employee per component per effective period), not more flat columns. Recommend: `SalaryComponent` master (code, name, category: earning/deduction) + `EmployeeSalaryComponentValue` (employeeId, componentId, amount, effectiveFrom/To) replacing both `SalaryStructure`'s flat columns and this entire tab.

One genuinely useful business rule captured directly off the screenshot, worth preserving verbatim: **"PF Pay = BASIC + EDUCATION ALLOW + HEALTH ALLOW + LTA"** — this is the PF wage-base formula. Also "Attendance Bonus Also added in the Over all Total" is stated as a footnote rule on the same screen.

---

## 7. CTC Details tab

A second, separate breakdown (Basic, HRA, Wash/Conv/Special/Dis.Location/Canteen/Shift/Other Allowance, Attendance Bonus, Gross, ESI, PF, Medi Claim, LTA, Bonus, Gratuity, Non Monetary Benefits, Other Benefits, Employer ESI, Employer PF, CTC, CTC Per Year), keyed by Emp Code, all defaulting to 0.00 for this employee.

**FLAG**: this looks like the same concept as the offer-stage CTC found earlier in `HRMS_NA_SALARY_DETAILS` (keyed on `APPLICANT_ID`), but it also exists as a post-hire Employee tab here — so CTC is tracked twice in the ERP: once at offer stage (applicant), once nominally on the employee record (mostly unused/zero in this sample). Needs a decision: does the new system keep a versioned employee-level CTC snapshot separate from running Salary, or is CTC purely a pre-hire/offer-letter concept that gets superseded by Salary once someone joins? Recommend the latter (avoids a second parallel structure to keep in sync) unless you have a specific reason CTC must be tracked post-hire too.

---

## 8. Education Details tab (repeating grid)

Education (dropdown), Institution Name, Type, Year of Passing (dropdown, 1950+), Certificate No, %/Grade, Documents (upload).

`EmployeeEducation` already exists and covers qualification/institution/university/yearOfPassing/percentage. **GAP**: missing `type`, `certificateNo`, and a documents/upload link (could reuse `EmployeeDocument` with a docType tag instead of a new column).

---

## 9. Experience Details tab (repeating grid)

Company Name, Location, Exit Design(ation), Exit Dept, From Date, To Date, Total Experience(Months), Documents.

`EmployeeExperience` exists (companyName/designation/fromDate/toDate/reasonForLeaving/lastDrawnSalary). **GAP**: missing `location`, `exitDept`, a computed/stored `totalExperienceMonths`, and Documents. Note "Exit Design" = designation held at the previous company on leaving — our existing `designation` field is fine for this, just confirms naming.

---

## 10. Emergency Contact tab (repeating grid) — **NEW TABLE**

Contact Name, Relation, Address 1, Address 2, Mobile No, Home Phone No — shown as a grid, i.e. **multiple** emergency contacts per employee.

Current schema has this as flat singular fields on `PersonalDetails` (`emergencyContactName`, etc. — cut off in the read but implied singular). This is a structural gap, not just a missing-field one: needs a new `EmployeeEmergencyContact` child table (1:N), and the existing flat fields on `PersonalDetails` should be retired in favour of it.

---

## 11. Passport Details tab — **NEW TABLE**

Name As Per Passport, PassPort No, Citizenship, Issue Date, Expiry Date.

No dedicated passport model exists; closest is `EmployeeDocument` with `docType = "passport"`, which only captures a doc number and expiry, not "Name As Per Passport" or Citizenship. **FLAG**: given International Worker is a real field elsewhere on this employee record, passport/citizenship is probably worth a small dedicated table rather than overloading the generic document model.

---

## 12. Dependent Details tab (repeating grid)

Emp Name, Relation Name, Relation (dropdown), Gender, Marital Status, Aadhar Id, Contact No 1*, Contact No 2, Contact Address, Date of Birth*.

`EmployeeDependent` exists but only has `name`, `relationship`, `dateOfBirth`, `isDependent`. **GAP**: missing gender, marital status, Aadhar Id, both contact numbers, and contact address — a meaningfully richer table than what's modeled today.

---

## 13. Assets Details tab

Grid: Emp Name, Asset Id, Asset Name, Value, Issue Date, Comments. Add form: Asset Type (dropdown), Serial Number, Model, Expire Date, OS, Is Return?.

**FLAG**: our `EmployeeAssetAllocation` is a join table against a shared `AssetMaster` (allocatedDate/returnedDate/notes only) — the ERP screen instead lets Asset Name/Value/Serial/Model be typed freely per employee, which looks like assets aren't centrally mastered in the legacy system. Recommend keeping our master-driven design (cleaner, supports asset tracking/audit) rather than copying the free-text pattern, but confirm that's acceptable — it means whoever enters this screen picks from a real Asset master instead of typing a name each time.

---

## 14. Skill Matrix tab — confirms an anti-pattern

Skill 1–5, each a dropdown with its own Proficiency Level dropdown, plus a free-text Exp Detail.

This is a live example of the `SKILL1..SKILL5` fixed-column anti-pattern already flagged and explicitly rejected in the ERP schema analysis. Confirms the plan: build a proper 1:N `EmployeeSkill` table (skillId, proficiencyLevel, expDetail) instead of five fixed columns. One new master needed that wasn't in the original 25-table extraction list: a **Skill master** (the dropdown values "Machine Operator" etc.) — `PROFICIENCY_MASTER` was already scoped for extraction, but the skill-name list itself wasn't. Will check the ERP schema for a skill-name table and add it to the extraction list if one exists.

---

## 15. KYC Details tab — confirms a duplicate-entry problem

PF.No, UAN.No, PAN.No, Aadhar No, Driving License No + Expiry, Election Card No, Ration Card No, Personal AC/No, Bank Name, IFSC Code, Phy.Challenged + Category, International Worker, Passport No + Expiry Date — **every one of these already appears on Personal Details, Job Profile, and/or Passport tabs.** Plus a repeating document-attachment grid (Doc Name dropdown, DOC No, Attachment, File Name) which is the one genuinely new piece here.

**Recommendation**: in the new system, statutory IDs (PAN/Aadhar/UAN/PF/DL/Election/Ration) live in exactly one place — most naturally `PersonalDetails` or a dedicated `EmployeeStatutoryId` table — and the "KYC" screen becomes a read-only rollup of those values plus the document-attachment grid, rather than a fourth data-entry surface for the same facts. This avoids the legacy system's problem where the same ID could be edited in one tab and go stale in another.

---

## 16. Employee Activity tab — **NEW TABLE**

A simple repeating log: free-text Activity Details + an attachment icon + an edit icon. No equivalent exists in the current schema. Reads as a generic notes/timeline feed on the employee record. Recommend a small `EmployeeActivityLog` (employeeId, note, attachmentPath, createdBy, createdAt) if you want to keep this — otherwise it can be dropped if it's rarely used in practice.

---

## New dropdown/master dependencies surfaced by this screen

Beyond the 25 tables already queued for extraction, this screen surfaces these additional lookups that will need sourcing: Title/Salutation, Sub Category (if distinct from Category), Petrol Allowance, Production Line, Additional Role, Induction Status, Payment Mode, PF Type, Asset Type, KYC Doc Name, Skill (name list, not just proficiency level), Relation (for both Dependent and Emergency Contact — may be shared). Most of these are small enough (3–6 values) to live in the existing generic `DropdownMaster` rather than getting dedicated tables — flagging for your call on which ones matter enough to be first-class masters.

---

## Contradictions to add to the running log

1. **Level dropdown (L1–L7) vs Org Structure Level=rank decision.** The core Employee form's "Level" field offers L1–L7, which reads as a grade/pay band, not the 5-tier organizational rank (Founder → Workforce) already agreed for Topic 1. This is likely the same root issue as contradiction C1 (Level vs `HRMS_DESIG_LEVEL_MASTER` carrying pay fields), now confirmed live in the UI. Needs your call: is UI "Level" actually Grade in disguise, and the org-rank "Level" a separate, new concept we're introducing that doesn't exist as a field in the legacy screen at all?
2. **Five overlapping classification dropdowns on one employee**: Category, Sub Category, Type, Grade Code, Class. Need plain-English definitions distinguishing all five before any of them become schema fields — right now there's real risk of building near-duplicate lookup tables.
3. **Statutory ID quadruplication**: PAN/Aadhar/UAN/PF/DL numbers are entered on up to three tabs (Personal Details, Job Profile/KYC). Confirms the "duplicate data-entry surface" pattern already seen at the table level in the ERP schema analysis, now visible at the field level too.
4. **CTC vs Salary**: CTC exists both as a pre-hire applicant concept (`HRMS_NA_SALARY_DETAILS`) and as a mostly-empty post-hire Employee tab here — likely redundant, needs a single source of truth.

---

## Open questions

- What does "Sub Category" mean distinct from Category, and is it the same axis as "Class"?
- Is the Employee-form "Type" dropdown the same concept as `EmployeeType`, or something else (e.g. Staff vs Worker)?
- Do we need two structured addresses (Permanent + Communication) or is one address + a "same as permanent" flag sufficient?
- Should CTC be tracked at the employee level post-hire at all, or only at offer stage?
- Is a Skill *name* master present anywhere in the ERP schema, or does "Machine Operator" etc. come from a free-text/other source? Will check the extracted `.sql` and report back.
- Does "Official Password" on Job Profile map to any real login system you still use, or is it dead/unused data we can safely leave out?

No schema or code has been changed. Once you've weighed in on the flags and open questions above, the next step is turning the **OK** and confirmed **GAP** rows into actual Prisma fields/tables, still without running a migration — per the standing agreement.
