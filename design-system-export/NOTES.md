# Design system NOTES

This export was copied from **Suki Tools Management** without modifying the source project.

## Portable (safe to reuse as-is or with light wiring)

| Path | Notes |
|------|--------|
| `app/globals.css` | Tailwind v4 entry + `@theme` tokens + animations |
| `styles/themes.css` | 4 color themes × light/dark CSS variables |
| `postcss.config.mjs` | `@tailwindcss/postcss` |
| `lib/theme*.ts`, `lib/themes.ts`, `lib/applyTheme.ts`, `lib/useTheme.ts` | Theme tokens + cookie helpers |
| `lib/appToast.ts` | Thin sonner wrappers |
| `contexts/ThemeContext.tsx` | Theme provider |
| `components/ui/*` | Button, StatusBadge, AnimatedCountUp |
| `components/LogoSpinner.tsx`, `PageLoader.tsx`, `AppToaster.tsx`, `NavigationLoader.tsx` | Loaders / toasts |
| `components/DataTable.tsx`, `TablePager.tsx`, `BarChartEffects.tsx` | Table + chart loading FX |
| `components/ThemeSwitcher.tsx`, `ThemeConfirmDialog.tsx`, `theme-toggle.tsx`, `ThemeProvider.tsx` | Theme UI |
| `components/ReportCharts.tsx`, `OverviewCharts.tsx` | Chart primitives (theme-aware; some demo data in Overview) |
| `components/SimpleMasterShell.tsx` | Layout shell (depends on Sidebar + TopBar) |
| `app/dashboard/components/LoadingSkeleton.tsx`, `ModuleKpiRow.tsx` | Skeletons + KPI card grid |
| `app/dashboard/components/PageHeader.tsx`, `TopBar.tsx`, `QuickActions.tsx`, `RoleGate.tsx` | **Stripped** to prop-driven presentational APIs in this export |

## APP-SPECIFIC (copied for reference — reconnect or rewrite)

These files still contain Tools Management routes, API calls, nav trees, or auth assumptions. They are **flagged with an `APP-SPECIFIC` comment** at the top. Prefer treating them as design references, not drop-in components.

| Path | Why flagged |
|------|-------------|
| `app/dashboard/components/Sidebar.tsx` | Full Tools Management `navSections`, `useSession` permissions, logo assets |
| `app/dashboard/components/TopNav.tsx` | Hardcoded dashboard links |
| `app/dashboard/components/KpiRow.tsx` | `apiGet("/api/dashboard/kpi")` |
| `app/dashboard/components/ToolsByGroup.tsx` | KPI `groupBreakdown` fetch |
| `app/dashboard/components/MonthlyMovementsBarChart.tsx` | KPI `monthlyTrends` fetch |
| `app/dashboard/components/ActivityTable.tsx` | KPI `recentActivity` fetch |
| `app/dashboard/components/RecentCalibrationTable.tsx` | Calibration-due API |
| `components/ReportHub.tsx` | `/api/reports/{category}` exports, domain KPIs |
| `components/HistoryCardShell.tsx` / `HistoryCardListView.tsx` | Tools History Card module nav + data views |
| `components/ToolDocumentsPanel.tsx` | Document upload APIs + `TOOL_DOC_TYPES` |
| `components/PendingFeature.tsx` | Placeholder page using app Sidebar/TopBar |

## Ambiguous / include-but-flag

| Path | Decision |
|------|----------|
| `components/OverviewCharts.tsx` | Mostly presentational; includes **demo/mock series** for velocity charts — swap data via props in host app |
| `components/ReportCharts.tsx` `ReportProgressChart` | Portable UI; default `detailHref` pointed at tools master in original — pass your own `detailHref` |
| `snippets/root-layout.font-and-theme.tsx` | **Example only** — Poppins + anti-FOUC theme script, SessionProvider removed |

## Missing from original (not used)

- No `tailwind.config.js/ts` (Tailwind **v4** CSS-first config)
- No shadcn/ui, Radix, CVA, `cn()` / `clsx` / `tailwind-merge`
- No local font files (Google Fonts via `next/font`)
- No `components/shared/` folder

## Path aliases

Original project uses `@/` → `src/`. After copying into a new app’s `src/`, keep:

```json
"paths": { "@/*": ["./src/*"] }
```

Export folder mirrors `src/` layout (`components/`, `app/`, `lib/`, `contexts/`, `styles/`).
