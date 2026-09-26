# Announcement Module — Analysis & Development Report

**Date:** 2026-09-26
**Repository:** `/Users/sukimacbook01/CascadeProjects/HRMS`
**Scope:** Announcement feature end-to-end — data model, APIs, HR admin UI, ESS read UI, notification fan-out, and the new celebratory unread-announcement popup.

---

## 1. System Overview

The announcement module lets HR publish company circulars/policy updates and
lets employees read them on the ESS portal, with per-employee read receipts.
It is split into two halves:

| Side | Entry point | Audience |
|------|-------------|----------|
| Authoring | `/admin/announcements` | HR / platform admin |
| Consumption | `/ess/announcements`, ESS dashboard, notification bell | Employees |

### Data model (Prisma)

**`Announcement`** (`prisma/schema.prisma`)

| Field | Purpose |
|-------|---------|
| `title`, `body` | Content shown to employees |
| `category` | `POLICY` / `CIRCULAR` / `GENERAL` (colored chip on the list) |
| `priority` | `NORMAL` / `IMPORTANT` — IMPORTANT pins above NORMAL in employee lists |
| `status` | `DRAFT` → `PUBLISHED` → `ARCHIVED` lifecycle |
| `publishedAt` | Set on publish; used for ordering (newest first) |
| `expiresAt` | Optional — past expiry the item drops off ESS but stays in HR archive |
| `audienceScopeType` | `null` = company-wide; otherwise `DEPARTMENT` / `SUB_DEPARTMENT` / `DESIGNATION` / `EMPLOYEE_TYPE` / `UNIT` |
| `audienceScopeValues` | Comma list of the target master's `code` values |
| `createdByUserId` / `publishedByUserId` | Audit trail |
| `deletedAt` | Soft delete |

**`AnnouncementRead`** — per-employee receipt: `announcementId + employeeId`
(unique together), `readAt` timestamp. This is what powers the "who has
actually read the policy update" view for HR.

### API surface

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/platform/announcement` | GET, POST | List + create draft (HR, `platform.announcement.admin` permission) |
| `/api/platform/announcement/[id]` | GET, PUT, DELETE | Read / edit draft / archive |
| `/api/platform/announcement/[id]/publish` | POST | DRAFT → PUBLISHED + fans out `ANNOUNCEMENT_PUBLISHED` notification to the audience |
| `/api/platform/announcement/[id]/clone` | POST | Copy an item back into DRAFT |
| `/api/workforce/my-announcements` | GET | Employee's published announcements with own `readAt`, `unreadCount`, `canMarkRead` |
| `/api/workforce/my-announcements/[id]/read` | POST | Upsert read receipt (idempotent via unique index) |

### Employee consumption surfaces (pre-popup)

1. **`/ess/announcements`** — full list, expandable rows; opening an unread
   row posts the receipt; supports deep-link `?id=` from the bell.
2. **ESS dashboard panel** — top 5 announcements + "N unread" badge.
3. **NotificationDropdown (bell)** — `ANNOUNCEMENT_PUBLISHED` notification
   deep-links into `/ess/announcements?id=N`.

---

## 2. Gap Identified

Everything above is **pull-based**: the employee must visit the announcements
page or click the bell. Nothing actively surfaces an unread item on login.

Requirement: an interruptive, celebratory popup card — matching a provided
reference (warm orange overlay, white rounded card, scroll illustration,
large heading, pill-shaped Confirm button) — shown when the employee lands
on the dashboard with unread announcements.

---

## 3. Development Done (2026-09-26)

### 3.1 New component: `src/components/ess/AnnouncementPopup.tsx`

- **Fetch on mount**: `GET /api/workforce/my-announcements`; keeps only rows
  where `readAt === null`. If `canMarkRead === false` (login with no linked
  Employee — e.g. pure HR/admin), the popup never renders.
- **Queue**: unread items shown one card at a time; a small "x of N" counter
  appears when more than one is pending. Button label is `Next` until the
  last item, then `Confirm`.
- **Confirm**: `POST /api/workforce/my-announcements/[id]/read` — posts the
  read receipt (idempotent server-side) then advances the queue. The module's
  existing read-tracking contract is preserved exactly.
- **Visuals** (matching the reference image):
  - Full-screen warm-orange gradient overlay (`z-80`, above the app shell)
  - Centered white card: `rounded-[28px]`, max-width `sm`, pop-in animation
  - Inline SVG illustration: parchment scroll in a smiling tray + checkmark
    badge + sparkles — no image asset needed, theme-independent
  - Large amber bold heading (announcement title), gray body text
  - Full-width pill button with orange gradient + soft shadow
- **Fails safe**: any fetch error silently skips the popup — the
  announcements page remains the fallback.

### 3.2 Mount point: `src/app/ess/dashboard/page.tsx`

- `<AnnouncementPopup />` rendered at the top of the ESS dashboard — the
  employee's landing page — so an unread announcement greets them on entry.
- Not mounted in the global `AppShell`: keeps admin pages free of it, and
  ESS dashboard is the natural first stop after login.

### 3.3 Test fixtures created

| Item | Detail |
|------|--------|
| `scripts/seed-test-announcement.mjs` | Seeds a PUBLISHED announcement ("Yahooo!") in company 1 |
| `scripts/create-admin-employee.mjs` | Creates `ADMIN-EMP` employee + JobInfo, linked to `demoemployee@gmail.com` (user 276) |
| `scripts/check-demo-user.mjs` | Diagnoses user↔employee linkage |
| `scripts/cleanup-verify-companies.mjs` | Removes throwaway verify companies |

### 3.4 Bug fixed during verification

- **`demoemployee@gmail.com` (user 276) had no Employee record** — every
  `/api/workforce/my-*` route resolved `ownEmployeeId = null`, so the ESS
  dashboard rendered placeholders ("Employee") and the popup was correctly
  suppressed (`canMarkRead: false`). Fixed by creating `ADMIN-EMP` and
  setting `employee.userId = 276`.

---

## 4. Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Clean |
| Popup appears for unread announcement | Pending user confirmation — test announcement id 10 seeded |
| Confirm posts read receipt | Reuses existing `POST .../read` route (idempotent) |
| Read item does not re-show | Filtered client-side by `readAt === null` |
| Multiple unreads queue | "x of N" counter + Next/Confirm |
| HR/admin login without Employee | Popup skipped via `canMarkRead` |
| Type safety / build | `tsc --noEmit` passes |

---

## 5. How to Test Manually

1. Log in as `demoemployee@gmail.com` → open `http://localhost:3000/ess/dashboard`
2. The orange card pops with title **"Yahooo!"** and the seeded body text
3. Click **Confirm** → receipt posts → card closes → dashboard shows
4. Hard-refresh — the popup does **not** reappear (already read)
5. To re-test: publish another announcement from `/admin/announcements`,
   or delete the `AnnouncementRead` row for the employee

## 6. Known Limitations / Future Work

- Popup triggers on the ESS dashboard only — employees who land elsewhere
  (e.g. direct link to `/ess/payslip`) won't see it until they open the
  dashboard. If needed, mount it in an ESS-level layout instead.
- The illustration is a fixed SVG; if the design team supplies branded
  artwork, swap `ScrollIllustration()` for an `<img>` import.
- No "snooze/dismiss without reading" — by design, Confirm = read receipt.
- Announcements with `priority: IMPORTANT` already sort first in the queue.
