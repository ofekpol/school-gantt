# Staff Loading Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream an immediate accessible loading state for protected staff routes while removing duplicate staff-user work on dashboard renders.

**Architecture:** A synchronous outer staff layout wraps its existing async authorization/header work in `Suspense`; the fallback streams before that layout waits. A React request-scoped cached `getStaffUser` is shared by the guarded layout and dashboard. Once authorization succeeds, the staff route fallback becomes a dashboard-shaped skeleton.

**Tech Stack:** Next.js 15 App Router, React 19 `Suspense` and `cache`, TypeScript strict, Tailwind CSS, next-intl, Vitest.

## Global Constraints

- Preserve all server-side authentication, status checks, and redirect paths before protected children render.
- All user-visible copy is translated; use `motion-safe:` and hide decorative elements from assistive technology.
- No forced duration, full-app preload, or admin/public route changes.
- Preserve `auth.getUser()` validation; the cache must be React-server-render scoped.

---

### Task 1: Implement and test two staff loading states

**Files:** Create `components/staff/StaffEntryLoading.tsx`, `components/staff/DashboardLoadingSkeleton.tsx`, and `test/unit/staff-loading.test.tsx`; modify `messages/he.json` and `messages/en.json`.

**Interfaces:** `StaffEntryLoading()` is the pre-auth-layout fallback and `DashboardLoadingSkeleton()` is the post-auth data fallback. Both use `useTranslations("staffLoading")`.

- [x] **Step 1: Write failing accessibility tests**

```tsx
expect(screen.getByRole("status")).toHaveTextContent("Preparing your workspace");
expect(screen.getByTestId("staff-entry-visual")).toHaveAttribute("aria-hidden", "true");
expect(screen.getAllByTestId("dashboard-loading-cell")).not.toHaveLength(0);
```

- [x] **Step 2: Run the test**

Run: `pnpm vitest run --project unit test/unit/staff-loading.test.tsx`

Expected: FAIL because the new components do not exist.

- [x] **Step 3: Implement minimal translated components**

```tsx
export function StaffEntryLoading() {
  const t = useTranslations("staffLoading");
  return <main><div role="status" aria-live="polite">{t("entryTitle")}</div></main>;
}
```

Use a motion-safe decorative icon in the entry state. The dashboard skeleton includes heading, controls, and calendar cells with decorative blocks `aria-hidden`.

- [x] **Step 4: Run the passing test**

Run: `pnpm vitest run --project unit test/unit/staff-loading.test.tsx`

Expected: PASS.

- [x] **Step 5: Commit**

Run: `git add components/staff messages/he.json messages/en.json test/unit/staff-loading.test.tsx && git commit -m "feat: add staff loading states"`

### Task 2: Stream before the async staff guard and cache the resolver

**Files:** Modify `app/(staff)/layout.tsx`, `app/(staff)/loading.tsx`, and `lib/auth/session.ts`; test through `test/unit/auth/session.test.ts` and `test/unit/staff-loading.test.tsx`.

**Interfaces:** `StaffLayout` remains default export but synchronously returns `Suspense`. Its `StaffLayoutContent` retains every redirect. `getStaffUser` retains `Promise<StaffUserRecord | null>` and wraps `resolveStaffUser` with React `cache`.

- [x] **Step 1: Add a failing outer-layout test**

```tsx
const Layout = (await import("@/app/(staff)/layout")).default;
expect(Layout({ children: <div /> })).toMatchObject({ type: Suspense });
```

- [x] **Step 2: Run it to confirm the async-layout failure**

Run: `pnpm vitest run --project unit test/unit/staff-loading.test.tsx`

Expected: FAIL because the existing layout returns a Promise.

- [x] **Step 3: Implement guarded inner component and cache**

```tsx
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<StaffEntryLoading />}><StaffLayoutContent>{children}</StaffLayoutContent></Suspense>;
}
```

Move existing body into `async StaffLayoutContent`. In `session.ts`, rename current implementation and export `const getStaffUser = cache(resolveStaffUser)`. Replace staff `loading.tsx` with `DashboardLoadingSkeleton`.

- [x] **Step 4: Run focused tests**

Run: `pnpm vitest run --project unit test/unit/auth/session.test.ts test/unit/staff-loading.test.tsx`

Expected: PASS with JWT tests unchanged.

- [x] **Step 5: Commit**

Run: `git add 'app/(staff)/layout.tsx' 'app/(staff)/loading.tsx' lib/auth/session.ts test/unit/auth/session.test.ts test/unit/staff-loading.test.tsx && git commit -m "fix: stream staff loading before auth layout"`

### Task 3: Verify dashboard behavior

**Files:** Test `test/unit/staff-loading.test.tsx`; modify `app/(staff)/dashboard/page.tsx` only if verification reveals a defect.

- [x] **Step 1: Verify route loading renders the skeleton**

```tsx
const Loading = (await import("@/app/(staff)/loading")).default;
render(<Loading />);
expect(screen.getByRole("status")).toHaveTextContent("Loading your calendar");
```

- [x] **Step 2: Run automated verification**

Run: `pnpm tsc --noEmit && pnpm vitest run --project unit test/unit/auth/session.test.ts test/unit/staff-loading.test.tsx test/unit/dashboard/dashboard-calendar.test.tsx && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Browser check**

With cold cache and signed-in session, open `/dashboard` in Safari and Chrome. Both must show the entry fallback first, then header plus skeleton, then dashboard with no forced delay.

## Plan self-review

- Task 1 covers accessible visual states; Task 2 preserves auth while streaming earlier and deduplicating resolution; Task 3 covers the route fallback, types, build, and browsers.
