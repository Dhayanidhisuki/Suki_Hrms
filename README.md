# SUKI Tools Management

Modern web application for **tools / gauge management**, migrated from the legacy SUKI ERP module. Connects to the existing ERP SQL Server database and covers masters, issue/receive, calibration, PO-linked GRN, history card, and reports.

**Full project document:** [`docs/project-overview.md`](./docs/project-overview.md)

---

## Stack

- **Next.js 16** · React 19 · TypeScript · Tailwind CSS 4  
- **Prisma 6** → Microsoft SQL Server (shared ERP DB)  
- **JWT auth** (standalone `TOOLS_APP_USER` + httpOnly cookie)

---

## Quick start

```bash
cp .env.example .env.local   # set DATABASE_URL, AUTH_JWT_SECRET, seed vars
npm install
npx prisma generate
npm run db:seed              # optional admin
npm run dev                  # http://localhost:3000
```

See [`.env.example`](./.env.example) for all variables.

---

## Modules

| Area | Path |
|------|------|
| Dashboard | `/dashboard` |
| Masters | `/dashboard/masters/*` |
| Tool transactions | `/dashboard/transactions/*` |
| Calibration | `/dashboard/calibration/*` |
| Purchase (GRN) | `/dashboard/po-linked/receive` |
| History card | `/dashboard/tools-history-card` |
| Reports | `/dashboard/reports/*` |
| Settings | `/dashboard/settings/*` |

Screen status and test checklists: [`docs/module-wise-testing-guide.md`](./docs/module-wise-testing-guide.md).

---

## Docs

| Doc | Description |
|-----|-------------|
| [Project overview](./docs/project-overview.md) | Purpose, architecture, setup, module map |
| [ERP gap analysis](./docs/erp-gap-analysis.md) | Live ERP vs app gaps (Item Group → Calendar) |
| [ERP gap implementation prompt](./docs/erp-gap-implementation-prompt.md) | Phased prompt to implement those gaps |
| [Module testing guide](./docs/module-wise-testing-guide.md) | Per-screen status + checklists |
| [BRD v7](./Tools_Management_BRD_v7.docx) | Formal requirements & ERP schema mapping |
| [Design system export](./design-system-export/README.md) | Portable UI / theme package |

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed admin user |
| `npm run db:seed:demo-users` | Seed demo role users |
| `npm run tunnel:cloudflare` | Cloudflare tunnel helper |
