# Adaptive Public Entry Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give public school calendars an immediate, branded and accessible loading state while making the initial public route shorter and warming inactive view chunks after the first view is usable.

**Architecture:** A `loading.tsx` boundary at the school route streams a small client entry panel while the public page resolves. The school-specific layout becomes data-free so it cannot hold that boundary back; the public shell owns the existing header once data is ready. The shell preserves its idle callback preload of inactive dynamic view modules.

**Tech Stack:** Next.js 15 App Router streaming/loading boundaries, React 19, TypeScript strict, Tailwind CSS, next-intl, Vitest + Testing Library.

## Global Constraints

- All visible copy is translated through `next-intl`; Hebrew is primary and English mirrors it.
- Animation honours `prefers-reduced-motion` through `motion-safe:` classes; decorative elements are hidden from assistive technology.
- No minimum loading duration, client-side splash gate, or full-application preload.
- Public pages remain unauthenticated; protected-route authentication does not change.
- Keep the existing five-second public cache freshness and polling behaviour.
- TypeScript stays strict with no `any`; use logical Tailwind properties for RTL layout.

---

### Task 1: Add the accessible public entry panel and translated copy

**Files:**
- Create: `components/PublicViewerEntryLoading.tsx`
- Modify: `messages/he.json:12-27`
- Modify: `messages/en.json:12-27`
- Test: `test/unit/public-viewer-entry-loading.test.tsx`

**Interfaces:**
- Consumes: `useTranslations("publicViewerLoading")` and `CalendarDays` from `lucide-react`.
- Produces: `PublicViewerEntryLoading(): JSX.Element`, a self-contained `main` landmark with an accessible status and no props.

- [ ] **Step 1: Write the failing test**

```tsx
it("announces loading while keeping its decorative calendar hidden", () => {
  render(<PublicViewerEntryLoading />);

  expect(screen.getByRole("status")).toHaveTextContent("Preparing your school calendar…");
  expect(screen.getByTestId("public-viewer-entry-visual")).toHaveAttribute("aria-hidden", "true");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project unit test/unit/public-viewer-entry-loading.test.tsx`

Expected: FAIL with a module-resolution error for `@/components/PublicViewerEntryLoading`.

- [ ] **Step 3: Write the minimal component and copy**

```tsx
export function PublicViewerEntryLoading() {
  const t = useTranslations("publicViewerLoading");
  return (
    <main className="min-h-screen ...">
      <div role="status" aria-live="polite" className="...">
        <div data-testid="public-viewer-entry-visual" aria-hidden="true" className="motion-safe:animate-pulse ...">
          <CalendarDays />
        </div>
        <p>{t("title")}</p>
        <span className="motion-safe:animate-pulse">{t("detail")}</span>
      </div>
    </main>
  );
}
```

Add `publicViewerLoading.title` and `publicViewerLoading.detail` in both locale files. Use `motion-safe:` for each animated class and only logical layout utilities.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `pnpm vitest run --project unit test/unit/public-viewer-entry-loading.test.tsx`

Expected: PASS, one test.

- [ ] **Step 5: Commit the UI unit**

```bash
git add components/PublicViewerEntryLoading.tsx messages/he.json messages/en.json test/unit/public-viewer-entry-loading.test.tsx
git commit -m "feat: add public viewer entry loading panel"
```

### Task 2: Stream the entry panel before public calendar data

**Files:**
- Create: `app/(viewer)/[school]/loading.tsx`
- Modify: `app/(viewer)/[school]/layout.tsx:1-35`
- Modify: `components/PublicViewerShell.tsx:1-250`
- Test: `test/unit/public-viewer-entry-loading.test.tsx`

**Interfaces:**
- Consumes: `PublicViewerEntryLoading` from Task 1 and `schoolName` already passed to `PublicViewerShell`.
- Produces: an immediate school-route loading boundary; a `ViewerSchoolLayout` that only passes through `children`; an `AppHeader` rendered by `PublicViewerShell` after the loaded school payload is available.

- [ ] **Step 1: Extend the failing test for the route boundary**

```tsx
it("uses the public entry panel as the school route loading boundary", async () => {
  const Loading = (await import("@/app/(viewer)/[school]/loading")).default;
  render(<Loading />);

  expect(screen.getByRole("status")).toHaveTextContent("Preparing your school calendar…");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project unit test/unit/public-viewer-entry-loading.test.tsx`

Expected: FAIL with a module-resolution error for `@/app/(viewer)/[school]/loading`.

- [ ] **Step 3: Make the route segment streamable**

```tsx
// app/(viewer)/[school]/loading.tsx
export default function Loading() {
  return <PublicViewerEntryLoading />;
}

// app/(viewer)/[school]/layout.tsx
export default function ViewerSchoolLayout({ children }: { children: ReactNode }) {
  return children;
}
```

Remove `getSession`, `getSchoolBySlug`, `getTranslations`, and `LogoutButton` from the school layout. In `PublicViewerShell`, render `<AppHeader title={schoolName} />` before its existing `<main>` so the header only appears after public data resolves. Do not change `loadPublicViewerData`, page cache configuration, or API polling.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm vitest run --project unit test/unit/public-viewer-entry-loading.test.tsx test/unit/views/public-viewer-shell.test.tsx test/unit/views/public-viewer-data.test.ts`

Expected: PASS with no new warnings.

- [ ] **Step 5: Commit the streamed route change**

```bash
git add 'app/(viewer)/[school]/loading.tsx' 'app/(viewer)/[school]/layout.tsx' components/PublicViewerShell.tsx test/unit/public-viewer-entry-loading.test.tsx
git commit -m "feat: stream public calendar entry state"
```

### Task 3: Verify inactive-tab warm-up and the complete build

**Files:**
- Modify only if a test exposes a defect: `components/PublicViewerShell.tsx:150-180`
- Test: `test/unit/views/public-viewer-shell.test.tsx`

**Interfaces:**
- Consumes: `inactiveViewLoaders(view): Array<() => Promise<unknown>>` and the existing idle callback effect in `PublicViewerShell`.
- Produces: first-view-only rendering followed by background imports of the two inactive public-view chunks.

- [ ] **Step 1: Write a failing warm-up test only if the current shell test cannot prove this behaviour**

```tsx
it("prefetches inactive public view modules after the first view mounts", async () => {
  renderPublicViewer("gantt");

  await waitFor(() => {
    expect(calendarModuleLoader).toHaveBeenCalledOnce();
    expect(agendaModuleLoader).toHaveBeenCalledOnce();
  });
});
```

Mock `requestIdleCallback` to invoke its callback and mock only the inactive module imports. Do not introduce a new preloading mechanism when the existing idle effect already fulfils the behaviour.

- [ ] **Step 2: Run the shell test**

Run: `pnpm vitest run --project unit test/unit/views/public-viewer-shell.test.tsx`

Expected: PASS if the current effect is observable; otherwise FAIL only because the idle prefetch is not invoked.

- [ ] **Step 3: Apply the smallest repair if Step 2 finds a real failure**

```tsx
const prefetch = () => loaders.forEach((load) => void load());
const id = window.requestIdleCallback?.(prefetch) ?? window.setTimeout(prefetch, 1);
```

Preserve cleanup for both `cancelIdleCallback` and `clearTimeout`; do not preload the active view or any protected app route.

- [ ] **Step 4: Run local automated verification**

Run: `pnpm tsc --noEmit && pnpm vitest run --project unit test/unit/public-viewer-entry-loading.test.tsx test/unit/views/public-viewer-shell.test.tsx test/unit/views/public-viewer-data.test.ts && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 5: Perform a production-mode local cold-load check**

Run: `pnpm start`

Open `http://localhost:3000/<known-school-slug>` in a new browser profile with Network throttling. Confirm the entry panel appears before the public response completes; refresh with cache enabled and confirm the loaded calendar replaces it without a forced wait. Stop the local server after the check.

- [ ] **Step 6: Commit the verified feature**

```bash
git add components/PublicViewerShell.tsx test/unit/views/public-viewer-shell.test.tsx
git commit -m "test: verify public view warm-up"
```

## Plan self-review

- **Spec coverage:** Task 1 implements translated, accessible, motion-safe visual loading; Task 2 makes it server-streamable and removes the blocking public layout fetch; Task 3 preserves and verifies idle inactive-tab warming, build, and local cold-load behaviour.
- **Placeholder scan:** no unfinished markers or unspecified implementation steps remain.
- **Type consistency:** Task 1 exports `PublicViewerEntryLoading`; Task 2 imports it through the route loading boundary. `PublicViewerShell` continues to accept its existing `schoolName: string` prop and `inactiveViewLoaders` retains `Array<() => Promise<unknown>>`.
