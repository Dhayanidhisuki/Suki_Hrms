# ERP Data Extraction — Layers L0, L1 and L2

**Date:** 31 August 2026
**Database:** `ERPDB_KUN_HRMS` on `192.168.1.160` (SQL Server)
**Scope:** everything needed to seed the Platform (L0), Organization (L1) and Employee (L2) layers of the new HRMS. Payroll, attendance and statutory masters (L4–L6) are deliberately excluded — they are blocked on client decisions, not on data.
**Companion script:** `03-extract-L0-L1-L2.sql` (same queries, runnable top to bottom)

---

## Why this exists

The 27 August dictionary gave us row counts for 25 master tables and showed that **13 of them are empty**. That is not the whole story. The ERP's masters are thin, but the **`EMPLOYEE` table itself is full** — and it carries the classification, bank, statutory and reporting values as data. Where a master table is empty, the real list can usually be recovered by taking the distinct values out of the employee rows.

So this extraction runs in three passes:

1. **Discover** — find every table that actually holds rows, and every table that references an employee. We only have `script.sql`'s structure; the names of the employee sub-entity tables (education, experience, dependents, documents) were never confirmed.
2. **Extract** — pull the master tables we know about.
3. **Recover** — derive the missing master lists from live employee data.

Everything below is `SELECT` only. Nothing writes, alters or drops. It is safe to run on the live database, though it is polite to avoid the payroll processing window.

---

## Pass 1 — Discovery

### Q1.1 Every table in the database with its row count

The single most useful query in this file. It replaces guessing entirely: 867 tables ranked by how much data they hold.

```sql
SELECT  s.name                        AS schema_name,
        t.name                        AS table_name,
        SUM(p.rows)                   AS row_count
FROM    sys.tables      t
JOIN    sys.schemas     s ON s.schema_id = t.schema_id
JOIN    sys.partitions  p ON p.object_id = t.object_id
                         AND p.index_id IN (0, 1)
GROUP BY s.name, t.name
ORDER BY row_count DESC, table_name;
```

Send the full result. Tables with zero rows tell us as much as tables with data — they tell us which features were never used.

### Q1.2 Every table that references an employee

This is how we find the employee sub-entity tables without knowing their names.

```sql
SELECT  c.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        (SELECT SUM(p.rows)
           FROM sys.partitions p
           JOIN sys.tables t2 ON t2.object_id = p.object_id
          WHERE t2.name = c.TABLE_NAME AND p.index_id IN (0,1)) AS row_count
FROM    INFORMATION_SCHEMA.COLUMNS c
WHERE   c.COLUMN_NAME IN ('EMP_CODE','EMPLOYEE_CODE','EMP_ID','EMPLOYEE_ID',
                          'EMP_NO','EMPLOYEE_NO','EMP_REF_NO','EMP_CD')
ORDER BY row_count DESC, c.TABLE_NAME;
```

### Q1.3 Tables whose names suggest employee sub-entities

```sql
SELECT  t.name AS table_name,
        SUM(p.rows) AS row_count
FROM    sys.tables t
JOIN    sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE   t.name LIKE '%EDU%'      OR t.name LIKE '%EXPER%'
     OR t.name LIKE '%QUALIF%'   OR t.name LIKE '%FAMILY%'
     OR t.name LIKE '%DEPEND%'   OR t.name LIKE '%NOMINEE%'
     OR t.name LIKE '%PASSPORT%' OR t.name LIKE '%DOCUMENT%'
     OR t.name LIKE '%ADDRESS%'  OR t.name LIKE '%CONTACT%'
     OR t.name LIKE '%BANK%'     OR t.name LIKE '%SKILL%'
     OR t.name LIKE '%ASSET%'    OR t.name LIKE '%KYC%'
     OR t.name LIKE '%EMERGENC%' OR t.name LIKE '%PREVIOUS%'
GROUP BY t.name
HAVING  SUM(p.rows) > 0
ORDER BY row_count DESC;
```

### Q1.4 Column list for any table found above

Run once per table of interest — substitute the name.

```sql
SELECT  ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM    INFORMATION_SCHEMA.COLUMNS
WHERE   TABLE_NAME = 'EMPLOYEE'          -- change this
ORDER BY ORDINAL_POSITION;
```

---

## Pass 2 — Extraction

### L0 — Platform: users, roles, page access

These seed our `Role` / `Permission` / `RolePermission` models and tell us the real access granularity in use.

```sql
SELECT * FROM ERP_ROLE_MASTER;
SELECT * FROM ERP_PAGE_ACCESS_MASTER;
SELECT * FROM ERP_MENU;
SELECT * FROM ERP_SUB_MENU;
SELECT * FROM ERP_PAGE_MASTER;
SELECT * FROM ERP_PAGE_MENU_USER_ROLE;
SELECT * FROM SUKI_ERP_USER_MODULE;
```

The user table's exact name was never confirmed. Find it first:

```sql
SELECT  t.name AS table_name, SUM(p.rows) AS row_count
FROM    sys.tables t
JOIN    sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE   t.name LIKE '%USER%'
GROUP BY t.name
ORDER BY row_count DESC;
```

**Do not export password columns.** If the user table carries a password or hash column, list the columns with Q1.4 and select every column except that one. We are not migrating credentials.

### L1 — Organization masters

```sql
-- Company and sites
SELECT * FROM COMPANY_DETAILS;
SELECT * FROM COMPANY_CHILD_UNIT_DETAILS;

-- Departments
SELECT * FROM DEPT ORDER BY SEQ_NO, DEPT_NAME;
SELECT * FROM CLASS_SUB_DEPT ORDER BY CLASS_NAME;

-- Designations and grades
SELECT * FROM HRMS_DESIG_MASTER ORDER BY SEQ_NO, NAME;
SELECT * FROM HRMS_DESIG_LEVEL_MASTER;
SELECT * FROM HRMS_GRADE_MASTER ORDER BY SEQ_NO, GRADE_CODE;

-- Employee classification axes
SELECT * FROM HRMS_EMP_CLASS;
SELECT * FROM HRMS_EMPLOYEE_TYPE_MASTER;

-- Lookups
SELECT * FROM HRMS_DROPDOWN_MASTER ORDER BY TYPE, VALUE;
SELECT * FROM STATE_MASTER ORDER BY STATE;
SELECT * FROM COUNTRY_MASTER;

-- Skills (requested on 25 Aug, not returned in the 27 Aug dictionary)
SELECT * FROM SKILL_NAME_DETAILS;
SELECT * FROM PROFICIENCY_MASTER;
```

### L2 — Employee master

The core record. Export in full — we will decide field by field what carries across.

```sql
SELECT * FROM EMPLOYEE;
```

If the table is wide enough to be awkward in one file, split it by status rather than by columns, so every row stays whole:

```sql
SELECT * FROM EMPLOYEE WHERE STATUS = 'ACTIVE';    -- confirm the actual status column with Q1.4
SELECT * FROM EMPLOYEE WHERE STATUS <> 'ACTIVE' OR STATUS IS NULL;
```

Then export each sub-entity table found by Q1.2 and Q1.3. Based on the field map, we expect roughly: education, experience, family/dependents, bank details, documents, passport, skill matrix (`HRMS_EMP_SKILL_MATRIX`), asset allocation, memos (`HRMS_EMP_MEMO`), transfers (`EMPLOYEE_TRANSFER`) and grievances (`EMP_GRIEVANCE`). Use the names Q1.2 actually returns — do not assume ours.

---

## Pass 3 — Recovery: rebuild the empty masters from employee data

This is the part that matters most, and it is why an empty master table is not a dead end.

`HRMS_EMP_CLASS`, `CLASS_SUB_DEPT` and `HRMS_DESIG_LEVEL_MASTER` all returned zero rows — but the employee records still classify people. The values were entered as free text or as dropdown codes that live on the employee row itself.

### Q3.1 Generate a distinct-value query for every classification column

Rather than guessing column names, let SQL Server list them and write the queries for us:

```sql
SELECT  'SELECT ''' + COLUMN_NAME + ''' AS column_name, ' +
        QUOTENAME(COLUMN_NAME) + ' AS value, COUNT(*) AS employee_count ' +
        'FROM EMPLOYEE WHERE ' + QUOTENAME(COLUMN_NAME) + ' IS NOT NULL ' +
        'GROUP BY ' + QUOTENAME(COLUMN_NAME) + ' ORDER BY employee_count DESC;'
        AS query_to_run
FROM    INFORMATION_SCHEMA.COLUMNS
WHERE   TABLE_NAME = 'EMPLOYEE'
  AND   DATA_TYPE IN ('nvarchar','varchar','char','nchar')
  AND  (COLUMN_NAME LIKE '%CAT%'      OR COLUMN_NAME LIKE '%CLASS%'
     OR COLUMN_NAME LIKE '%TYPE%'     OR COLUMN_NAME LIKE '%GRADE%'
     OR COLUMN_NAME LIKE '%LEVEL%'    OR COLUMN_NAME LIKE '%DEPT%'
     OR COLUMN_NAME LIKE '%DESIG%'    OR COLUMN_NAME LIKE '%UNIT%'
     OR COLUMN_NAME LIKE '%SHIFT%'    OR COLUMN_NAME LIKE '%STATE%'
     OR COLUMN_NAME LIKE '%BANK%'     OR COLUMN_NAME LIKE '%RELIGION%'
     OR COLUMN_NAME LIKE '%BLOOD%'    OR COLUMN_NAME LIKE '%QUALIF%'
     OR COLUMN_NAME LIKE '%MARITAL%'  OR COLUMN_NAME LIKE '%STATUS%'
     OR COLUMN_NAME LIKE '%LOCATION%' OR COLUMN_NAME LIKE '%NATION%');
```

Copy the generated statements, run them, and send the results. Each one is a master list with usage counts attached — which is better than the master table would have given us, because it also tells us which values are actually in use and which are dead.

### Q3.2 Reporting structure as actually populated

The ERP holds four manager roles per employee. This tells us which are real and which are decorative — it settles blocker B2.

```sql
SELECT  COUNT(*)                                                   AS total_employees,
        SUM(CASE WHEN HOME_MANAGER     IS NOT NULL THEN 1 ELSE 0 END) AS has_home_manager,
        SUM(CASE WHEN BUSINESS_MANAGER IS NOT NULL THEN 1 ELSE 0 END) AS has_business_manager,
        SUM(CASE WHEN HR_MANAGER       IS NOT NULL THEN 1 ELSE 0 END) AS has_hr_manager,
        SUM(CASE WHEN VR_MANAGER       IS NOT NULL THEN 1 ELSE 0 END) AS has_vr_manager
FROM    EMPLOYEE;
```

### Q3.3 Headcount by department and designation

Confirms the org shape and gives us seed data volumes.

```sql
SELECT  DEPT_NO, DESIG_CODE, COUNT(*) AS employee_count
FROM    EMPLOYEE
GROUP BY DEPT_NO, DESIG_CODE
ORDER BY employee_count DESC;
```

*(Column names here follow the ERP's convention; confirm them with Q1.4 before running.)*

---

## How to run and what to send back

**Method A — SSMS, results to file (simplest).**
Open each section, set **Query → Results To → Results to File**, run, and save as `<TABLE_NAME>.csv`. Zip the folder.

**Method B — JSON in one pass (preferred for the master tables).**
Wrap any query to get a single JSON document:

```sql
SELECT * FROM DEPT FOR JSON PATH, INCLUDE_NULL_VALUES;
```

Run `03-extract-L0-L1-L2.sql`, which does this for every L0/L1 table in one execution, and save the output as `erp-L0-L1.json`.

**Method C — Generate Scripts, data only.**
The same SSMS wizard that produced `script.sql`, with *Types of data to script* set to **Data only** and the L0/L1/L2 tables ticked. Produces one `.sql` of INSERT statements.

**What to send back, in priority order**

1. Q1.1 — all tables with row counts *(one query, answers the "where is the data" question completely)*
2. Q1.2 and Q1.3 — the employee sub-entity table list
3. L1 master exports
4. L2 `EMPLOYEE` export plus its sub-tables
5. Q3.1 generated distinct-value results
6. L0 access tables

Items 1–3 are enough to start building. Nothing here is large: on the 27 August counts, the entire L1 layer is under 200 rows.

---

## Note on scope

L4 and L6 masters — OT slabs, PT slabs, leave rules, TDS, bank file, salary components — are **not** in this file, with one exception. `HRMS_SALARY_COMPONENT` (35 rows) and `HRMS_SALARY_LOGIC` (57 rows) are still the highest-priority extraction in the whole project and are requested separately in `tables.txt`. Everything else at those layers is empty in the ERP and must come from the client as decisions, not as data.

---

## Method D — run it yourself over Docker

You do not have to wait for the client's DBA to run these. The dev machine already talks to the same SQL Server: `.env` points the new HRMS at `192.168.1.160:1433`, database `suki_hrms`. The ERP database `ERPDB_KUN_HRMS` is on that same instance. The only open question is whether the login you have can read it.

Docker is just a way to get `sqlcmd` without installing anything.

**Note:** this must be run from a normal terminal on the Mac. The assistant's sandboxed shell has no network access and no Docker daemon, so it cannot reach `192.168.1.160` itself — but it can read whatever output files land in this folder.

### D1 — Can the existing login read the ERP database?

```bash
docker run --rm mcr.microsoft.com/mssql-tools18 \
  /opt/mssql-tools18/bin/sqlcmd \
  -S 192.168.1.160,1433 -U suki_hrms_user -P '<password from .env>' -C \
  -Q "SELECT HAS_DBACCESS('ERPDB_KUN_HRMS') AS can_read;"
```

`1` means yes, go to D2. `0` or NULL means the login is scoped to `suki_hrms` only — ask the client's DBA for a read-only login on `ERPDB_KUN_HRMS` (`db_datareader` is enough; no write permission is needed for anything in this file).

On Apple Silicon, add `--platform linux/amd64` if the image refuses to start.

### D2 — Run the whole extraction script

```bash
docker run --rm \
  -v ~/CascadeProjects/HRMS/scripts/erp-extract:/work \
  mcr.microsoft.com/mssql-tools18 \
  /opt/mssql-tools18/bin/sqlcmd \
  -S 192.168.1.160,1433 -U <user> -P '<password>' -C -b -y 0 \
  -i /work/03-extract-L0-L1-L2.sql \
  -o /work/out/extract-full.txt
```

`-y 0` matters: without it sqlcmd truncates wide columns at 256 characters, which silently corrupts the `FOR JSON` output. `-b` stops on the first error rather than carrying on quietly.

### D3 — One CSV per table

```bash
for T in DEPT CLASS_SUB_DEPT COMPANY_DETAILS COMPANY_CHILD_UNIT_DETAILS \
         HRMS_DESIG_MASTER HRMS_GRADE_MASTER HRMS_EMP_CLASS \
         HRMS_EMPLOYEE_TYPE_MASTER HRMS_DROPDOWN_MASTER \
         SKILL_NAME_DETAILS PROFICIENCY_MASTER \
         HRMS_SALARY_COMPONENT HRMS_SALARY_LOGIC EMPLOYEE; do
  docker run --rm -v ~/CascadeProjects/HRMS/scripts/erp-extract:/work \
    mcr.microsoft.com/mssql-tools18 \
    /opt/mssql-tools18/bin/sqlcmd \
    -S 192.168.1.160,1433 -U <user> -P '<password>' -C -y 0 \
    -d ERPDB_KUN_HRMS -s"," -W -Q "SET NOCOUNT ON; SELECT * FROM dbo.$T" \
    -o "/work/out/$T.csv"
done
```

Drop the results in `scripts/erp-extract/out/` and they can be analysed directly from the repo.

### D4 — Safer alternative: restore a backup locally

If the client will hand over a `.bak`, this is the better path — it removes any risk to the live system and lets us query as freely as we like:

```bash
docker run -d --name erpdb -p 1433:1433 \
  -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<strong-password>" \
  -v ~/erp-backup:/backup \
  mcr.microsoft.com/mssql/server:2022-latest
```

Then restore `/backup/ERPDB_KUN_HRMS.bak` inside the container and point every query in this file at `localhost` instead. Nothing touches production, and the full 867-table database is available offline for as long as the build needs it.

### Ground rules

- Every query in this package is `SELECT` only. Nothing in it should ever be run with a write-capable login.
- Avoid the payroll processing window; Q1.1 scans metadata for 867 tables.
- Do not export password or hash columns from the user table.
