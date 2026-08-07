# Suki design system export — setup guide

Portable UI tokens, theme system, and components extracted from the Suki Tools Management Next.js app.

> **Do not overwrite your target project blindly.** Merge styles and configs as described below.  
> See [NOTES.md](./NOTES.md) for APP-SPECIFIC files that still need data wiring.

## Prerequisites

- Next.js App Router project (this export targets **Next 16** + **React 19**)
- Tailwind **v4** (CSS-first — there is no `tailwind.config.ts` in the source app)
- TypeScript path alias `@/*` → `./src/*`

## 1. Install dependencies

Follow [DEPENDENCIES.md](./DEPENDENCIES.md), or:

```bash
npm install lucide-react@^1.25.0 sonner@^2.0.7 recharts@^3.10.0
npm install -D tailwindcss@^4 @tailwindcss/postcss@^4
```

Ensure `next`, `react`, and `react-dom` are already present (preferably matching the versions in DEPENDENCIES.md).

## 2. Copy files into your `src/`

From this folder, map into your project:

| Export path | Target path |
|-------------|-------------|
| `app/globals.css` | `src/app/globals.css` (or merge into yours) |
| `styles/themes.css` | `src/styles/themes.css` |
| `postcss.config.mjs` | project root `postcss.config.mjs` |
| `lib/*` | `src/lib/` |
| `contexts/ThemeContext.tsx` | `src/contexts/ThemeContext.tsx` |
| `components/**` | `src/components/` |
| `app/dashboard/components/**` | `src/app/dashboard/components/` (or relocate under `src/components/layout/` and update imports) |

Keep the relative import `globals.css` → `../styles/themes.css` working, or adjust the `@import` path.

## 3. PostCSS

Use (or merge) the exported PostCSS config:

```js
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

## 4. Tailwind / globals — merge, don’t blindly overwrite

This project uses **Tailwind v4**. Theme tokens live in CSS:

1. Ensure your global CSS starts with:

```css
@import "tailwindcss";
@import "../styles/themes.css"; /* adjust path */

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* paste @theme block from exported app/globals.css */
}
```

2. Then merge base rules (body, headings, scrollbar, `.logo-spin`, `.bar-chart-skeleton-bar*`) from the export.
3. If you already have a `tailwind.config.ts` from an older Tailwind v3 app:
   - Prefer migrating to v4 CSS `@theme`, **or**
   - Manually map CSS variables (`--primary`, `--bg-card`, etc.) into your existing theme `extend.colors` — do not delete your config without checking breakpoints/plugins you rely on.

There is **no** `tailwind.config.ts` to merge from this export.

## 5. Fonts (Poppins)

Wire Google Poppins via `next/font` (see `snippets/root-layout.font-and-theme.tsx`):

```tsx
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// on <html>: className={poppins.variable}
```

`globals.css` already sets `--font-sans: "Poppins", system-ui, sans-serif` inside `@theme`.

## 6. Theme provider + anti-FOUC

1. Wrap the app with `ThemeProvider` from `@/contexts/ThemeContext` (or `@/components/ThemeProvider`).
2. Copy the anti-FOUC inline script pattern from `snippets/root-layout.font-and-theme.tsx` so `data-theme` / `data-mode` / `.dark` apply before paint.
3. Mount `<AppToaster />` once near the root for sonner toasts.
4. Optionally mount `<NavigationLoader />` for route-change full-page loading.

## 7. Using components

```tsx
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import TopBar from "@/app/dashboard/components/TopBar";

<Button variant="primary">Save</Button>
<StatusBadge status="Available" />
<TopBar
  user={{ name: "Ada", roleName: "Admin" }}
  onSignOut={async () => { /* your logout */ }}
/>
```

## 8. APP-SPECIFIC components

Files listed in [NOTES.md](./NOTES.md) still reference Tools Management APIs, nav, or auth. In the new project you must:

- Replace hardcoded `/dashboard/...` routes
- Reconnect data fetching (or delete unused modules)
- Supply your own session/permissions (Sidebar / original RoleGate)

Prop-driven replacements already in this export: `PageHeader`, `TopBar`, `QuickActions`, `RoleGate`.

## 9. Verify

- [ ] Theme switcher changes `data-theme` and CSS variables
- [ ] Dark mode toggles `.dark` / `data-mode`
- [ ] Buttons / badges / skeletons render with token colors
- [ ] No broken imports to `@/lib/SessionContext`, `@/lib/apiClient`, or Prisma

## License / attribution

Extracted for reuse from the Suki Tools Management UI. Adapt freely in your product.
