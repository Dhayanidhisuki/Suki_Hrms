# ERP Master Data Extract

**Goal:** get the *data* out of the 25 master tables in `ERPDB_KUN_HRMS` so the new HRMS can be seeded with the client's real values.

The schema is already analysed (`docs/ERP_MASTER_INVENTORY_2026-08-25.md`). What is missing is the rows.

---

## Method A — SSMS Generate Scripts (recommended)

Same wizard used to produce `script.sql`, with one setting changed.

1. SSMS, connect to the ERP server.
2. Right-click `ERPDB_KUN_HRMS` → **Tasks** → **Generate Scripts**.
3. **Choose Objects** → *Select specific database objects* → tick the 25 tables listed in `tables.txt`.
4. **Set Scripting Options** → *Save to file* → single file → name it `erp-master-data.sql`.
5. Click **Advanced**, then set:
   - **Types of data to script** = `Data only`
   - Script USE DATABASE = `False`
6. Finish, then hand the file over.

Expected size: a few MB at most. These are configuration tables, not transaction tables.

---

## Method B — JSON export (if the wizard is awkward)

Run `02-export-json.sql` in SSMS.

Before running: **Query → Results To → Results to File** (Ctrl+Shift+F), and in
**Tools → Options → Query Results → SQL Server → Results to Text**, set
*Maximum number of characters displayed in each column* to `8000` (the maximum).

It emits one JSON document per table.

---

## Before either method

Run `01-row-counts.sql` first. It takes a second and tells us which tables actually
hold data — no point exporting a table with zero rows, and a surprisingly large count
is worth knowing about before the export.

Send the row-count output back first if you want a quick sanity check.

---

## Not included, deliberately

No employee, payroll, attendance or applicant data. Those carry personal and salary
information and are a separate conversation — they belong to the data-migration phase,
not to seeding masters. If a sample is needed later for payroll verification, it should
be anonymised first.
