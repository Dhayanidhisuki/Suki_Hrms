# Design system DEPENDENCIES

Exact versions from the source project’s `package.json` at export time.

## Runtime (required for exported UI)

| Package | Version | Used by |
|---------|---------|---------|
| `next` | `16.2.10` | App Router, `next/font`, `next/link`, `next/navigation` |
| `react` | `19.2.4` | All components |
| `react-dom` | `19.2.4` | React DOM |
| `lucide-react` | `^1.25.0` | Icons across UI / layout / charts |
| `sonner` | `^2.0.7` | `AppToaster`, `lib/appToast.ts` |
| `recharts` | `^3.10.0` | `ReportCharts`, `OverviewCharts`, bar/pie/radial charts, `BarChartEffects` consumers |

## Dev / build (required for styles)

| Package | Version | Used by |
|---------|---------|---------|
| `tailwindcss` | `^4` | Utility classes + `@theme` in `globals.css` |
| `@tailwindcss/postcss` | `^4` | `postcss.config.mjs` |
| `typescript` | `^5` | TSX components |
| `@types/react` | `^19` | Types |
| `@types/react-dom` | `^19` | Types |
| `@types/node` | `^20` | Types |

## Install snippet (target project)

```bash
npm install next@16.2.10 react@19.2.4 react-dom@19.2.4 lucide-react@^1.25.0 sonner@^2.0.7 recharts@^3.10.0
npm install -D tailwindcss@^4 @tailwindcss/postcss@^4 typescript@^5 @types/react@^19 @types/react-dom@^19 @types/node@^20
```

## Explicitly NOT required for this design system

These exist in the source app but are **not** needed for the portable UI layer:

- `@prisma/client`, `prisma`
- `bcryptjs`, `iron-session`, `jose`, `jsonwebtoken`
- `jspdf`, `jspdf-autotable`, `xlsx`, `zod`

(Re-add them only if you reconnect APP-SPECIFIC modules like `ReportHub` exports or document panels.)
