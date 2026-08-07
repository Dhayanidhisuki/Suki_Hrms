# SUKI Tools Management — Project Document

**Product:** SUKI Tools Management  
**Company:** SUKI Software Solutions Pvt Ltd  
**Revision:** Aug 2026 (aligned to codebase + BRD v7)  
**Repo:** `suki-tools-dashboard` (`package.json` name)

---

## 1. Purpose

Migrate the legacy ERP **Tools / Gauge Management** module into a modern standalone web app that:

- Connects to the **existing ERP SQL Server database** (`ERPDb_ESSKAY`) with **no destructive schema redesign**
- Delivers better UI/UX, dashboards, and reporting than the ERP screens
- Covers masters, shop-floor issue/receive, calibration lifecycle, PO-linked GRN, history card, and reports

Source BRD: [`Tools_Management_BRD_v7.docx`](../Tools_Management_BRD_v7.docx) (schema, module–table mapping, access requirements).

---

## 2. What this app is / is not

| This app **does** | This app **does not** |
|-------------------|------------------------|
| Manage tool/gauge masters and lookups | Own full ERP purchasing (PO create stays in ERP Purchasing) |
| Issue / receive tools on the shop floor | Replace the entire ERP product |
| Run calibration issue → receive → results | Self-service user signup |
| Post GRN against a PO number (text) | Live-link every PO row from ERP Purchasing UI |
| Read/write shared ERP tools tables via Prisma | Invent a parallel tools database |

---

## 3. Technology stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Framework | **Next.js 16** (App Router) | React 19 |
| Language | **TypeScript** | |
| UI | **Tailwind CSS 4** + Lucide | Theme tokens / multi-theme |
| Charts | **Recharts** | Dashboard + reports |
| ORM | **Prisma 6** | Introspected / mapped to ERP MSSQL |
| Database | **Microsoft SQL Server** | Shared ERP DB |
| Auth (current) | **Standalone JWT** (`httpOnly` cookie) | App users in `TOOLS_APP_USER`; bcrypt passwords |
| Validation | **Zod** | API + client |
| Exports | **xlsx**, **jspdf** | Excel / PDF |
| Toasts | **Sonner** | Via `AppToaster` / `appToast` |

> **BRD vs code:** BRD v7 specified ERP SSO only. As of Aug 2026 the running app uses **standalone JWT auth** (`TOOLS_APP_USER`). Optional `erpUserCode` links audit writes to ERP `USER_ID`. ERP SSO may still be a future integration path.

---

## 4. High-level architecture

```
Browser
  → Next.js pages (/login, /dashboard/*)
  → API routes (/api/*)
  → Prisma Client
  → SQL Server (ERPDb_ESSKAY)

Auth:
  Login → bcrypt verify TOOLS_APP_USER
       → JWT in httpOnly cookie (suki_tools_token)
  Middleware (jose) guards /dashboard/* + APIs
  requireSession() + requirePermission() on handlers
```

**Important data rules**

- Most business tables are **shared ERP tables** (same names as BRD Section 7).
- App-owned additions include e.g. `TOOLS_APP_USER`, `TOOLS_APP_DOCUMENT` (documents under `TOOL_DOCS_ROOT` / `./storage/tool-docs`).
- ERP audit columns (`CREAT_USER_ID_CD`, etc.) expect a real ERP `USER_ID` when writing transactional rows.

---

## 5. Application modules (sidebar)

| # | Module | Routes (examples) | Role |
|---|--------|-------------------|------|
| 0 | Auth & shell | `/login`, TopBar, Sidebar, theme | Session + navigation |
| 1 | Dashboard | `/dashboard`, `/dashboard/overview/*` | KPIs, charts, overview hubs |
| 2 | Masters | `/dashboard/masters/*` | Groups, tools, suppliers, mapping, pricing… |
| 3 | Tool transactions | `/dashboard/transactions/*` | Issue, receive, customer receive |
| 4 | Calibration | `/dashboard/calibration/*` | Issue, receive, results, due list |
| 5 | Purchase | `/dashboard/po-linked/*` | GRN (main); PO screen placeholder |
| 6 | Tools History Card | `/dashboard/tools-history-card/*` | Lifecycle views + docs / PM |
| 7 | Reports | `/dashboard/reports/*` | Tools, calib, supplier, subcon, history |
| 8 | Settings | `/dashboard/settings/*` | Mostly read-only / placeholders |

Status legend used across docs: ✅ full workflow · 👁 read-only · 🚧 placeholder · 🔗 hub · ⚠️ incomplete.

Detailed screen inventory and test checklists: [`module-wise-testing-guide.md`](./module-wise-testing-guide.md).

---

## 6. Core business flows

### 6.1 Master setup

```
Tool Group → Tool Subgroup → Item/Asset Master (GAUGEANDTOOLS)
         ↘ Tools Name for Type / Lookups / Mapping / Pricing
```

### 6.2 Shop-floor issue / return

```
Tool in stock
  → Tool Issue (DC; qty out)
  → Tool Receive (partial / full; qty in / DC closed)
```

### 6.3 Calibration

```
HISTORY_CARD_REQ = Yes
  → Due List
  → Calibration Issue (DC OPEN)
  → Calibration Receive (partial / full)
  → Results Update (PASSED / FAILED / RECALIBRATED + next date)
```

### 6.4 Purchase (tools scope)

```
PO created in ERP Purchasing (external)
  → GRN in this app (PO no + supplier + lines)
  → Stock / qty updated on tool master
```

---

## 7. Roles & permissions

Runtime matrix: `src/lib/rolePermissions.ts`.

| Role | Typical access |
|------|----------------|
| Tools Admin (and Admin aliases) | Full |
| Store Keeper | Issue / receive |
| Calibration Engineer | Calibration |
| Purchase Coordinator | PO / purchase-related flags |
| Viewer | Read-oriented |

Settings UI for users/roles is largely **placeholder**; accounts are created by admin / seed.

---

## 8. Database footprint (summary)

Prisma models map to ERP tables such as:

| Domain | Examples |
|--------|----------|
| Masters | `SUPPLIER`, `SUBCONTRACTOR`, `OTHER_TOOLS_TYPE`, `QMS_OTHER_TOOLS_TYPE`, `GAUGEANDTOOLS`, `TOOLS_TYPE`, `GAUGE_TYPE`, `TOOLS_PRICE_MASTER`, `TOOLS_MAPPING` |
| Issue / receive | `GAUGE_TOOLS_ISSUE`, `TOOLS_TRANS_ISSUE`, receive tables, consumption |
| Calibration | `TOOLS_ISSUE_FOR_CALIBRATION`, receive/result tables, `GAUGE_CONTROL_CARD(_TRANS)`, `CALIBRATION_FREQUENCY_MASTER` |
| PO-linked | `TOOLS_PO_RECEIVE(_TRANS)`, `TOOLS_PO_SCH_*` |
| Identity / app | `ERP_USER` (read), `EMPLOYEE`, `TOOLS_APP_USER`, `TOOLS_APP_DOCUMENT` |

Full field-level reference remains in BRD v7. Schema source of truth in repo: `prisma/schema.prisma`.

---

## 9. Local setup

### Prerequisites

- Node.js 20+
- Access to SQL Server (ERP or approved sample DB)
- npm

### Steps

```bash
cp .env.example .env.local   # or .env — fill secrets
npm install
npx prisma generate
npm run db:seed              # optional admin bootstrap
npm run db:seed:demo-users   # optional demo roles
npm run dev                  # http://localhost:3000
```

### Required environment variables

See [`.env.example`](../.env.example):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQL Server connection string |
| `AUTH_JWT_SECRET` | JWT signing (≥32 chars) |
| `AUTH_JWT_TTL_SECONDS` | Session TTL (default 28800) |
| `AUTH_COOKIE_NAME` | Cookie name (default `suki_tools_token`) |
| `SEED_ADMIN_*` | Bootstrap admin for `npm run db:seed` |
| `SEED_ADMIN_ERP_USER_CODE` / `ERP_AUDIT_USER_ID` | ERP `USER_ID` for audit columns |
| `TOOL_DOCS_ROOT` | Optional document storage root |

### Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Dev server (webpack) |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed admin user |
| `npm run db:seed:demo-users` | Demo users by role |
| `npm run tunnel:cloudflare` | Cloudflare tunnel helper |

---

## 10. Repository layout

```
src/app/
  login/                 Login UI
  dashboard/             All product screens + layout shell
  api/                   Route handlers (auth, masters, txns, reports…)
src/components/          Shared UI (tables, charts, overlays, forms)
src/lib/                 Auth, Prisma, validators, permissions, exports
src/contexts/            Theme / session contexts
prisma/                  schema.prisma, seeds, SQL helpers
docs/                    Project + module docs, worklogs, audits
design-system-export/    Portable UI/theme package (read-only export)
storage/                 Local tool documents (default)
```

---

## 11. UX conventions (current)

- **Overlay create/edit:** list stays mounted; `OverlayModal` + URL `?action=add|edit…`
- **Shared form system:** `src/components/ui/form.tsx` + `.form-*` classes in `globals.css`
- **Searchable selects:** `SearchSelect`
- **Toasts:** Sonner via app toast helpers
- **Themes:** multi-accent themes via ThemeContext / cookies

Design tokens / portable copies: [`design-system-export/README.md`](../design-system-export/README.md).

---

## 12. Build status (Aug 2026 snapshot)

| Area | Status |
|------|--------|
| Auth (JWT + middleware) | ✅ |
| Masters (tools, groups, suppliers, mapping…) | ✅ (some screens 👁) |
| Tool Issue / Receive | ✅ |
| Calibration Issue / Receive / Results / Due | ✅ |
| GRN | ✅ |
| Purchase Order UI | 🚧 (ERP-owned) |
| History Card + reports exports | ✅ / 👁 |
| Users / Roles / Notifications settings UI | 🚧 |
| Requisition Pending | 🚧 |

Known gaps and ambiguities: end of [`module-wise-testing-guide.md`](./module-wise-testing-guide.md) and [`modules-4-8-codebase-audit-2026-08-04.md`](./modules-4-8-codebase-audit-2026-08-04.md).

---

## 13. Documentation index

| Document | Use when |
|----------|----------|
| [project-overview.md](./project-overview.md) | This file — onboarding / stakeholders |
| [erp-gap-analysis.md](./erp-gap-analysis.md) | Live ERP vs app gap log (from Item Group onward) |
| [erp-gap-implementation-prompt.md](./erp-gap-implementation-prompt.md) | Phased agent/dev prompt to close those gaps |
| [module-wise-testing-guide.md](./module-wise-testing-guide.md) | Screen map, status, test checklists |
| [modules-4-8-codebase-audit-2026-08-04.md](./modules-4-8-codebase-audit-2026-08-04.md) | Calibration → Settings code audit |
| [end-to-end-practice-flow.md](./end-to-end-practice-flow.md) | Guided practice path |
| [masters-calibration-flow.md](./masters-calibration-flow.md) | Masters + calibration deep dive |
| [reports-and-analytics.md](./reports-and-analytics.md) | Reports module detail |
| [tool-pricing-master.md](./tool-pricing-master.md) | Pricing master notes |
| [demo-click-guide.md](./demo-click-guide.md) | Demo click path |
| Worklogs `worklog-2026-08-*.md` | Day-by-day engineering notes |
| BRD `Tools_Management_BRD_v7.docx` | Formal requirements + schema |

---

## 14. Related product constraints

1. **Do not alter ERP table structures** without customer sign-off.
2. **PO creation** is out of Tools Management scope.
3. Prefer writing through Prisma models that match live ERP columns.
4. Prefer ERP `USER_ID` for creat/update audit fields on transactional writes.
5. Treat BRD as schema/business authority; treat this repo’s `docs/` + code as **implementation status** authority when they diverge (e.g. auth model).
