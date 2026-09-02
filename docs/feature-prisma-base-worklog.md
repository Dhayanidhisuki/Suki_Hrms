# Suki HRMS — feature/prisma-base Branch Worklog

**Project:** Suki HRMS
**Branch:** `feature/prisma-base` (branched from `dev`)
**Date:** July 17, 2026
**Repository:** https://github.com/roshinisuki/Suki_hrms.git
**Commit:** `4061fc3` — `feat: prisma base schema + RBAC auth skeleton`

---

## 1. Original Prompt / Scope

The task was to build ONLY the following on the `feature/prisma-base` branch, with strict scope control and hard checkpoints:

### Part 1: Prisma Schema (MS SQL Server)
- **Organisational masters** (soft-delete via `isActive` + `deletedAt`, never hard-delete):
  Department, SubDepartment, Designation, EmployeeType, Category, Site/Branch, Unit, Grade, Level
- **Versioned statutory slab/rate tables** (effectiveFrom/effectiveTo for historical payroll recalculation):
  TDSSlab, ProfessionalTaxSlab, ESI/PF rate tables
- **Shift & OT definitions:** ShiftMaster, ShiftPlan, OTPlan
- **Generic dropdown:** DropdownMaster (key-value for extensible lists)
- **Category/definition tables (no logic):** LeaveMaster, LoanType, AssetMaster

### Part 2: Auth + RBAC Skeleton
- Role, Permission, RolePermission tables (module/submodule/page level granularity)
- JWT auth: `jose` for Edge runtime, `jsonwebtoken` for Node routes
- Middleware that checks permission before allowing route access
- Prove ONE protected route works end-to-end (do NOT wire to any module UI)

### Hard Checkpoints
- **CHECKPOINT 1:** Schema drafted → show full diff before migrating → get approval
- **CHECKPOINT 2:** Migration runs clean → confirm no out-of-scope tables created
- **CHECKPOINT 3:** RBAC skeleton works on one test route → stop, do not extend

### Rules
- Flag any architectural decision not explicitly covered as a question
- Do not touch Attendance, Payroll, Performance, Training, Recruitment, Reports, Compliance, Leave/Loan/Asset logic, or ESS
- Do not modify `/src/components/layout` or `/src/components/ui`
- Keep branch mergeable to dev within 2-3 days

---

## 2. Project Setup

### Initial State
- The `hrms/` directory initially contained only a `.env` file and `node_modules/` from a previous Prisma install
- No `package.json`, no `prisma/` directory, no Next.js app

### Steps Taken
1. Drafted initial `prisma/schema.prisma` — user reviewed and deleted it to start fresh
2. User ran `npx create-next-app@latest . --typescript --app --src-dir` (Next.js 16.2.10 with Tailwind CSS v4)
3. User ran `npm install prisma` (initially installed Prisma 7.8)
4. Created `prisma/schema.prisma` with all models
5. Attempted migration with Prisma 7.8 — failed due to breaking changes:
   - `url` in `datasource` block no longer supported in v7
   - Required `prisma.config.ts` + driver adapter (`@prisma/adapter-mssql`)
   - Connection string parsing failed
6. **User instructed downgrade to Prisma 6.19** — reverted schema to v6 format:
   - `generator client { provider = "prisma-client-js" }`
   - `datasource db { provider = "sqlserver"; url = env("DATABASE_URL") }`
   - Removed `prisma.config.ts`, uninstalled `@prisma/adapter-mssql`
7. Installed `@prisma/client@6.19`
8. Connection string had special characters in password (`^=(_0e`)[Cb>cX3fC4q1TW|JT~c`) — fixed by wrapping password in `{...}` braces (JDBC/SQL Server standard)
9. `prisma migrate dev` failed — shadow database permission denied (`CREATE DATABASE permission denied in database 'master'`)
10. Used `npx prisma db push` instead — succeeded, created all tables + generated Prisma Client v6.19.3

### Final Tech Stack
| Package | Version |
|---------|---------|
| next | 16.2.10 |
| react | 19.2.4 |
| prisma | 6.19 |
| @prisma/client | 6.19 |
| jose | ^6.2.3 |
| jsonwebtoken | ^9.0.3 |
| bcryptjs | ^3.0.3 |
| tailwindcss | ^4 |
| typescript | ^5 |

### Environment Variables (`.env`)
```
DB_PROVIDER="sqlserver"
DATABASE_URL="sqlserver://192.168.1.160:1433;database=suki_hrms;user=suki_hrms_user;password={...};encrypt=true;trustServerCertificate=true;connection_limit=20;pool_timeout=30;"
JWT_SECRET="suki-hrms-super-secret-jwt-key"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret_minimum_32_characters_long"
```
> Note: Password wrapped in `{...}` braces to escape special characters for SQL Server connection string parsing.

---

## 3. CHECKPOINT 1: Schema Design & Approval

### Architectural Questions Flagged (11 total)

| # | Question | Drafted Default | Final Resolution |
|---|----------|----------------|-----------------|
| Q1 | Grade & Level — separate or merged? | Separate tables | **APPROVED** — different HR concepts |
| Q2 | ESI/PF — one table or two? | Two: `EsiRate`, `PfRate` | **APPROVED** — different rate structures (wage ceilings, EPS/EDLI) |
| Q3 | Site/Branch — one or two? | One `Site` with `branchType` discriminator | **PENDING CLIENT CONFIRMATION** — Site model commented out, not migrated. Risk: Site may need factory-license fields that Branch doesn't |
| Q4 | Soft-delete — both fields or one? | Both `isActive` + `deletedAt` | **APPROVED** |
| Q5 | Slab overlap prevention — DB or app? | App-layer only | **CHANGED to Option D** — SQL Server trigger + app validation. App-only rejected because payroll accuracy depends on correct slabs |
| Q6 | SubDepartment → Department FK? | Yes | **APPROVED** |
| Q7 | ID strategy — Int or UUID? | Int autoincrement | **APPROVED** — single-client, no UUID overhead needed |
| Q8 | ShiftPlan shape | Named plan + FK to ShiftMaster + optional overrides | **APPROVED** with TODO: spec override fields before Phase 2 (Attendance) |
| Q9 | OTPlan shape | `otRateMultiplier` + `applicableAfterMinutes` + `maxOtHoursPerDay` | **APPROVED** |
| Q10 | DropdownMaster fields | `category` + `label` + `value` + `sortOrder` | **ALREADY PRESENT** — `isActive` + `deletedAt` were in the schema; summary table had omitted them. No change needed |
| Q11 | Leave/Loan/Asset extra flags? | Minimal: `code` + `name` + `description` | **APPROVED** — category definitions only, detailed logic deferred |

### Reviewer Feedback (3 pushbacks)

1. **Q3 (Site/Branch)** — Reviewer held this: single vs multi-site/state is an open BRD question. Site determines which Factories Act form variant applies. If Site needs factory-license-number fields that Branch doesn't, collapsing them now means retrofitting later. **Action:** Commented out `Site` model, marked as pending client confirmation.

2. **Q5 (Slab overlap prevention)** — Reviewer blocked app-layer-only approach. Payroll accuracy depends on versioned slabs being correct. One bad migration or bug silently lets overlapping ranges reach the DB → payroll picks wrong slab. **Action:** Implemented SQL Server AFTER INSERT/UPDATE triggers on all 4 slab/rate tables (Option D approved).

3. **Q10 (DropdownMaster isActive)** — Reviewer flagged missing `isActive`. **Action:** Non-issue — `isActive` + `deletedAt` were already in the schema. The summary table had omitted them.

### Q8 Clarifying Flag (not a rejection)
ShiftPlan "optional overrides" approved, but reviewer flagged: before Phase 2 (Attendance) starts building against this, spec out exactly which fields an override can touch. Attendance must not guess at override semantics.

---

## 4. Files Created

### 4.1 Prisma Schema
**File:** `prisma/schema.prisma` (434 lines)

**Datasource:** MS SQL Server
**Generator:** `prisma-client-js`

#### Section 1: Organisational Master Tables (soft-delete)

**Department**
- Fields: `id`, `code` (unique, NVarChar(20)), `name` (NVarChar(100)), `description` (NVarChar(500), nullable), `isActive` (Boolean, default true), `deletedAt` (DateTime, nullable), `createdAt`, `updatedAt`
- Relations: `subDepartments SubDepartment[]`

**SubDepartment**
- Fields: `id`, `departmentId` (FK), `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`
- Relations: `department Department @relation(fields: [departmentId], references: [id])`
- Index: `@@index([departmentId])`

**Designation**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**EmployeeType**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**Category**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**Site** — COMMENTED OUT (Q3 pending client confirmation)
- Drafted fields: `id`, `code` (unique), `name`, `branchType` (NVarChar(20), "site" | "branch"), `address`, `city`, `state`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**Unit**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**Grade**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**Level**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

#### Section 2: Versioned Statutory Slab/Rate Tables

All slab/rate tables share:
- `effectiveFrom DateTime` + `effectiveTo DateTime?` (NULL = currently active)
- `isActive Boolean @default(true)`
- `@@index([effectiveFrom, effectiveTo])` + `@@index([code])`
- SQL Server AFTER INSERT/UPDATE triggers for overlap prevention

**TDSSlab**
- Fields: `id`, `code` (NVarChar(20)), `minSalary` (Decimal(18,2)), `maxSalary` (Decimal(18,2), nullable), `ratePercent` (Decimal(5,2)), `effectiveFrom`, `effectiveTo`, `isActive`, `createdAt`, `updatedAt`

**ProfessionalTaxSlab**
- Fields: `id`, `code`, `minSalary` (Decimal(18,2)), `maxSalary` (Decimal(18,2), nullable), `monthlyAmount` (Decimal(18,2)), `effectiveFrom`, `effectiveTo`, `isActive`, `createdAt`, `updatedAt`

**EsiRate**
- Fields: `id`, `code`, `employeeContributionRate` (Decimal(5,2)), `employerContributionRate` (Decimal(5,2)), `wageCeilingMonthly` (Decimal(18,2)), `effectiveFrom`, `effectiveTo`, `isActive`, `createdAt`, `updatedAt`

**PfRate**
- Fields: `id`, `code`, `employeeContributionRate` (Decimal(5,2)), `employerContributionRate` (Decimal(5,2)), `pensionContributionRate` (Decimal(5,2), nullable — EPS share), `wageCeilingMonthly` (Decimal(18,2)), `effectiveFrom`, `effectiveTo`, `isActive`, `createdAt`, `updatedAt`

#### Section 3: Shift & Overtime Definition Tables

**ShiftMaster**
- Fields: `id`, `code` (unique), `name`, `startTime` (NVarChar(8), "HH:mm"), `endTime` (NVarChar(8)), `graceMinutes` (Int, default 0), `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`
- Relations: `shiftPlans ShiftPlan[]`

**ShiftPlan**
- Fields: `id`, `shiftMasterId` (FK), `code` (unique), `name`, `startTime` (NVarChar(8), nullable — override), `endTime` (NVarChar(8), nullable — override), `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`
- Relations: `shiftMaster ShiftMaster @relation(fields: [shiftMasterId], references: [id])`
- Index: `@@index([shiftMasterId])`

**OTPlan**
- Fields: `id`, `code` (unique), `name`, `otRateMultiplier` (Decimal(5,2)), `applicableAfterMinutes` (Int, default 0), `maxOtHoursPerDay` (Int, nullable), `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

#### Section 4: Generic Dropdown Master

**DropdownMaster**
- Fields: `id`, `category` (NVarChar(50)), `label` (NVarChar(100)), `value` (NVarChar(100)), `sortOrder` (Int, default 0), `isActive` (Boolean, default true), `deletedAt` (DateTime, nullable), `createdAt`, `updatedAt`
- Constraints: `@@unique([category, value])`, `@@index([category])`

#### Section 5: Leave / Loan / Asset Definition Tables (no logic)

**LeaveMaster**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**LoanType**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

**AssetMaster**
- Fields: `id`, `code` (unique), `name`, `description`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`

#### Section 6: Auth + RBAC Skeleton

**Role**
- Fields: `id`, `code` (unique, NVarChar(20)), `name` (NVarChar(100)), `description` (NVarChar(500), nullable), `isActive`, `deletedAt`, `createdAt`, `updatedAt`
- Relations: `rolePermissions RolePermission[]`

**Permission**
- Fields: `id`, `code` (unique, NVarChar(50)), `module` (NVarChar(50)), `submodule` (NVarChar(50), nullable), `page` (NVarChar(50), nullable), `action` (NVarChar(20)), `description` (NVarChar(500), nullable), `isActive`, `deletedAt`, `createdAt`, `updatedAt`
- Relations: `rolePermissions RolePermission[]`
- Index: `@@index([module, submodule, page])`

**RolePermission**
- Fields: `id`, `roleId` (FK), `permissionId` (FK), `createdAt`
- Relations: `role Role @relation(...)`, `permission Permission @relation(...)`
- Constraints: `@@unique([roleId, permissionId])`, `@@index([permissionId])`

---

### 4.2 Slab Overlap Prevention Triggers

**Files:**
- `prisma/triggers/slab_overlap_triggers.sql` — combined file with all 4 triggers (reference, uses `GO` batch separators — not executable via `prisma db execute`)
- `prisma/triggers/tr_TDSSlab_no_overlap.sql` — individual trigger (executable)
- `prisma/triggers/tr_ProfessionalTaxSlab_no_overlap.sql` — individual trigger
- `prisma/triggers/tr_EsiRate_no_overlap.sql` — individual trigger
- `prisma/triggers/tr_PfRate_no_overlap.sql` — individual trigger

**Trigger Logic (same for all 4):**
```sql
CREATE OR ALTER TRIGGER tr_{TableName}_no_overlap
ON [{TableName}]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN [{TableName}] t
      ON t.code = i.code
      AND t.id <> i.id
      AND t.effectiveFrom < COALESCE(i.effectiveTo, '9999-12-31T23:59:59')
      AND i.effectiveFrom < COALESCE(t.effectiveTo, '9999-12-31T23:59:59')
  )
  BEGIN
    ROLLBACK TRANSACTION;
    THROW 5000X, 'Overlap detected: another {TableName} record with the same code has an overlapping effective date range.', 1;
  END
END;
```

**How they were applied:**
- `GO` batch separators are not supported by `prisma db execute`
- Each trigger was split into a separate `.sql` file without `GO`
- Applied individually via: `npx prisma db execute --file "prisma/triggers/tr_*.sql" --schema "prisma/schema.prisma"`
- All 4 triggers applied successfully

---

### 4.3 RBAC Auth Skeleton Files

#### `src/lib/prisma.ts` — Prisma Client Singleton
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### `src/lib/jwt.ts` — Dual JWT Library Strategy
- **jose** (Edge Runtime): `signTokenJose()`, `verifyTokenJose()` — used in middleware
- **jsonwebtoken** (Node Runtime): `signTokenNode()`, `verifyTokenNode()` — used in API routes
- Both use same `JWT_SECRET`, HS256 algorithm, 24h expiry
- `TokenPayload` interface: `{ userId, roleId, roleCode }`

#### `src/lib/rbac.ts` — Permission Check Utility
- `hasPermission(roleId, { module, submodule?, page?, action })` → `Promise<boolean>`
- Uses Prisma `count` query on `RolePermission` with nested `Permission` filter
- Wildcard matching: `submodule` or `page` = `"*"` matches any value
- Also matches `null` submodule/page (for coarse-grained permissions)

#### `src/middleware.ts` — Edge Middleware (JWT Verification)
- Runs on Edge Runtime (uses `jose` for JWT verification)
- Matcher: `/api/protected/:path*`
- `PROTECTED_ROUTES` array maps route patterns to required permissions
- Currently only one route: `GET /api/protected/test` → `system.test.demo.view`
- Flow: extract Bearer token → verify with jose → inject `x-user-id`, `x-role-id`, `x-role-code` headers → pass to route handler
- Returns 401 for missing/invalid token

#### `src/app/api/auth/login/route.ts` — Login Endpoint
- `POST /api/auth/login` with body `{ username, password }`
- SKELETON: Accepts any credentials (no User table yet)
- Seeds demo data via Prisma upserts:
  - Creates `admin` role
  - Creates `system.test.demo.view` permission
  - Grants permission to role
- Returns `{ token, role }` — JWT signed with `jsonwebtoken`

#### `src/app/api/protected/test/route.ts` — Protected Test Route
- `GET /api/protected/test`
- Reads `x-user-id`, `x-role-id`, `x-role-code` from middleware-injected headers
- Calls `hasPermission()` to check `system.test.demo.view`
- Returns 403 if permission denied, 200 with user info if allowed
- This is the ONE test route — not extended to any other routes

---

## 5. CHECKPOINT 2: Migration Verification

### Migration Method
- `prisma migrate dev` failed (shadow database permission denied)
- Used `npx prisma db push` instead — pushes schema directly, no shadow database needed
- Result: `Your database is now in sync with your Prisma schema. Done in 924ms`
- Prisma Client generated: v6.19.3

### Tables Created in Database (22 total)

| # | Table Name | Group |
|---|-----------|-------|
| 1 | Department | Organisational |
| 2 | SubDepartment | Organisational |
| 3 | Designation | Organisational |
| 4 | EmployeeType | Organisational |
| 5 | Category | Organisational |
| 6 | Unit | Organisational |
| 7 | Grade | Organisational |
| 8 | Level | Organisational |
| 9 | TDSSlab | Versioned Slab |
| 10 | ProfessionalTaxSlab | Versioned Slab |
| 11 | EsiRate | Versioned Rate |
| 12 | PfRate | Versioned Rate |
| 13 | ShiftMaster | Shift/OT |
| 14 | ShiftPlan | Shift/OT |
| 15 | OTPlan | Shift/OT |
| 16 | DropdownMaster | Generic |
| 17 | LeaveMaster | Definition |
| 18 | LoanType | Definition |
| 19 | AssetMaster | Definition |
| 20 | Role | RBAC |
| 21 | Permission | RBAC |
| 22 | RolePermission | RBAC |

### Tables NOT Created (as expected)
- **Site** — commented out per Q3 (pending client confirmation)

### Out-of-Scope Verification
- No Employee, Attendance, Payroll, Performance, Training, Recruitment, Reports, Compliance, or ESS tables
- No extra/unexpected tables
- 22 tables = exactly 23 models minus the commented-out `Site`

### Triggers Applied
All 4 overlap prevention triggers applied successfully via `prisma db execute`:
- `tr_TDSSlab_no_overlap`
- `tr_ProfessionalTaxSlab_no_overlap`
- `tr_EsiRate_no_overlap`
- `tr_PfRate_no_overlap`

---

## 6. CHECKPOINT 3: RBAC End-to-End Test

### Test Scenarios & Results

| Scenario | Request | Expected | Actual | Status |
|----------|---------|----------|--------|--------|
| No token | `GET /api/protected/test` (no Authorization header) | 401 | `401` — `"Missing or invalid Authorization header"` | ✅ Pass |
| Invalid token | `GET /api/protected/test` with `Authorization: Bearer invalidtoken123` | 401 | `401` — `"Invalid or expired token"` | ✅ Pass |
| Valid token + permission | `GET /api/protected/test` with valid Bearer token | 200 | `200` — `"RBAC skeleton works!"` with user + permission info | ✅ Pass |

### Test Flow
1. `POST /api/auth/login` with `{"username":"admin","password":"test"}`
   - Seeds `admin` role + `system.test.demo.view` permission + role-permission link
   - Returns: `{"token":"eyJ...","role":"admin"}`
2. `GET /api/protected/test` with `Authorization: Bearer <token>`
   - Middleware (Edge/jose) verifies JWT → injects headers
   - Route handler (Node/Prisma) checks permission via `hasPermission()`
   - Returns: `{"message":"RBAC skeleton works!","user":{"userId":1,"roleId":1,"roleCode":"admin"},"permission":"system.test.demo.view"}`

### TypeScript Compilation
- `npx tsc --noEmit` — zero errors

---

## 7. Git Operations

### Repository Setup
- The `hrms/` directory was initially inside the CRM git repo (root: `C:/Users/Roshini`)
- Initialized a **separate git repo** for HRMS: `git init` in `c:\Users\Roshini\hrms`
- Connected to: `https://github.com/roshinisuki/Suki_hrms.git`

### Branch Strategy
```
origin/dev (existing) → dev (local) → feature/prisma-base (local + pushed)
```

### Commit Details
- **Commit hash:** `4061fc3`
- **Commit message:** `feat: prisma base schema + RBAC auth skeleton`
- **Files changed:** 31 files, 8547 insertions(+), 1 deletion(-)
- **Branch:** `feature/prisma-base`
- **Pushed to:** `origin/feature/prisma-base`
- **PR link:** https://github.com/roshinisuki/Suki_hrms/pull/new/feature/prisma-base

### Files in Commit
```
.gitignore
AGENTS.md
CLAUDE.md
README.md (modified)
eslint.config.mjs
next.config.ts
package-lock.json
package.json
postcss.config.mjs
prisma/schema.prisma
prisma/triggers/slab_overlap_triggers.sql
prisma/triggers/tr_EsiRate_no_overlap.sql
prisma/triggers/tr_PfRate_no_overlap.sql
prisma/triggers/tr_ProfessionalTaxSlab_no_overlap.sql
prisma/triggers/tr_TDSSlab_no_overlap.sql
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/window.svg
src/app/api/auth/login/route.ts
src/app/api/protected/test/route.ts
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/lib/jwt.ts
src/lib/prisma.ts
src/lib/rbac.ts
src/middleware.ts
tsconfig.json
```

---

## 8. Scope Compliance Audit

### What Was Built (in scope)
- [x] 22 Prisma models for master/definition tables
- [x] Soft-delete (`isActive` + `deletedAt`) on all organisational/definition tables
- [x] Versioned slab/rate tables with `effectiveFrom`/`effectiveTo`
- [x] SQL Server triggers for slab overlap prevention (Option D)
- [x] ShiftMaster, ShiftPlan (FK to ShiftMaster), OTPlan
- [x] DropdownMaster with category/label/value/sortOrder
- [x] LeaveMaster, LoanType, AssetMaster (definition only, no logic)
- [x] Role, Permission (module/submodule/page/action), RolePermission
- [x] JWT auth with jose (Edge) + jsonwebtoken (Node)
- [x] Middleware with JWT verification + permission checking
- [x] ONE protected test route proving end-to-end RBAC

### What Was NOT Done (out of scope, per rules)
- [x] Did NOT create Employee, Attendance, Payroll, Performance, Training, Recruitment, Reports, Compliance, or ESS models
- [x] Did NOT wire RBAC to any module UI
- [x] Did NOT extend protection beyond the one test route
- [x] Did NOT touch `/src/components/layout` or `/src/components/ui` (directories don't exist yet)
- [x] Did NOT add Leave/Loan/Asset logic (only definition tables)

### Pending Items
1. **Q3 (Site/Branch)** — `Site` model commented out. Needs client confirmation on whether Site needs factory-license-number / legal-entity / registration fields that Branch doesn't. Can be a follow-up commit once confirmed.
2. **Q8 (ShiftPlan overrides)** — Before Phase 2 (Attendance), spec out exactly which fields an override can touch (startTime, endTime, graceMinutes, breakDuration?).
3. **Next.js middleware deprecation** — Next.js 16 shows warning: `"middleware" file convention is deprecated. Please use "proxy" instead.` Works fine, but rename `src/middleware.ts` to `src/proxy.ts` when ready to clean up.
4. **Git identity** — Commit used auto-configured identity (`Roshini <Roshini@sss.com>`). Should set proper git config.

---

## 9. Full File Listing

```
hrms/
├── .env                          (gitignored — DB connection + JWT secret)
├── .gitignore                    (Next.js default + .env* + *.tsbuildinfo)
├── AGENTS.md                     (Next.js generated)
├── CLAUDE.md                     (Next.js generated)
├── README.md                     (Next.js generated)
├── eslint.config.mjs
├── next.config.ts
├── package.json                  (dependencies: prisma 6.19, jose, jsonwebtoken, bcryptjs)
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json
├── prisma/
│   ├── schema.prisma             (434 lines — 23 models, Site commented out)
│   └── triggers/
│       ├── slab_overlap_triggers.sql    (reference file with GO separators)
│       ├── tr_TDSSlab_no_overlap.sql     (individual trigger — applied to DB)
│       ├── tr_ProfessionalTaxSlab_no_overlap.sql
│       ├── tr_EsiRate_no_overlap.sql
│       └── tr_PfRate_no_overlap.sql
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
└── src/
    ├── middleware.ts             (Edge middleware — JWT verification via jose)
    ├── app/
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx              (Next.js default homepage)
    │   └── api/
    │       ├── auth/
    │       │   └── login/
    │       │       └── route.ts  (POST — issues JWT, seeds demo role+permission)
    │       └── protected/
    │           └── test/
    │               └── route.ts  (GET — protected route, checks system.test.demo.view)
    └── lib/
        ├── prisma.ts             (Prisma client singleton)
        ├── jwt.ts                (Dual JWT: jose for Edge, jsonwebtoken for Node)
        └── rbac.ts               (Permission check with wildcard support)
```
