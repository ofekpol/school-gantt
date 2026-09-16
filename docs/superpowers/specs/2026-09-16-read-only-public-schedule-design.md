# Read-Only Public Schedule (No Login Required) — Design Spec

**Date:** 2026-09-16
**Status:** Approved
**Scope:** Add a "view the schedule without logging in" entry point on the login screen. It opens a stripped-down, unauthenticated public view with exactly two tabs (Weekly, Monthly), the existing grade/event-type/search filters, and a "Log in" button — no editing, no export, no other tabs.

---

## Context

The public viewer (`/[school]`, `/[school]/calendar`, `/[school]/agenda`) is already fully unauthenticated and already read-only (no edit UI exists on any of these pages — editing only happens through the staff wizard behind auth). What's missing is a *discoverable, simplified* entry point: today the root path `/` always redirects unauthenticated visitors straight to `/auth/login` (school-picking was intentionally removed — see the comment in `app/(public)/page.tsx`: "Users no longer pick a school manually"), and nothing on the login screen points anonymous visitors anywhere else.

This spec adds that entry point without touching the existing `/[school]/*` routes, which keep working unchanged for anyone who has a direct link (e.g. shared by staff).

**Decisions confirmed with the customer/user during brainstorming:**

1. **Target school:** this deployment is single-tenant in practice (the school picker was removed). The new route resolves the one school via `listSchools()` server-side — no slug needed in the URL, no picker UI.
2. **View mapping:** "weekly" = the existing Gantt view locked to `zoom: "week"` (its own zoom toggle hidden). "monthly" = the existing Calendar (printable yearly calendar) view, unchanged. Agenda is dropped entirely from this entry point.
3. **Filters:** the existing `FilterBar` (grade filter, event-type filter, search) stays fully functional — explicitly requested, so anonymous visitors can still narrow to specific grades.
4. **Export:** the "Export to Google Calendar" button is **dropped** from this view — export is a logged-in-only action per the user's explicit call ("if the user isn't logged in he shouldn't have the option to export the calendar, just view it").

---

## Routing & Data Resolution

- New route: **`app/(public)/schedule/page.tsx`** → served at `/schedule`.
- Server Component: calls `listSchools()`, takes the first (only) result. If the list is empty, `notFound()`. Loads the same `loadPublicViewerData(slug)` used today by `app/(viewer)/[school]/page.tsx`.
- **Single URL, no sub-routes.** Weekly ⇄ Monthly is client-side state only (`useState`, no `pushState`/route change). This is a deliberate divergence from `PublicViewerShell`'s current tab-switching (which does `pushState` to `/[slug]/calendar` etc.): if `/schedule` reused that path-based navigation, clicking "Monthly" would navigate the browser to `/[slug]/calendar` — the *full* 3-tab public page — and the visitor could tab back into Gantt/Agenda from there, defeating the "no other tabs" requirement. Keeping everything on `/schedule` avoids that escape hatch entirely.
- `lib/auth/public-request.ts`:
  - Add `"/schedule"` to `RESERVED_PREFIXES` — so no school can ever be given the slug `schedule` (would collide with this route).
  - Add `"/schedule"` to `PUBLIC_PREFIXES` — explicit auth bypass. (The existing single-segment regex in `shouldBypassAuthRefresh` would technically already allow `/schedule` through, but relying on that implicitly is fragile — being explicit here matches how `/auth/*`, `/invite/`, `/ical/` etc. are already listed.)

---

## Component Structure

### Shared hook extraction (refactor, no behavior change)

`PublicViewerShell` currently inlines all of its state management: event polling + signature-based refresh, visibility-based poll pause/resume, filter param state, calendar-month lazy loading, print-month tracking. This logic needs to be reused by the new read-only shell without duplicating it (polling/signature-refresh in particular is non-trivial and easy to get subtly wrong twice).

- Extract into **`lib/views/use-public-viewer-data.ts`** — a hook `usePublicViewerData({ schoolSlug, schoolName, initialParams, year, eventTypes, initialEvents, initialEventsSignature })` returning: `params`, `setParams`, `filteredEvents`, `hydratedEvents`, `eventTypesForFilter`, `visibleGrades`, calendar-months loader/state, print-month state/handlers.
- `PublicViewerShell` is rewritten to consume this hook instead of holding the state inline. **Its external props, rendered output, and the view-switching (`pushState`-based) behavior must not change** — this is a pure internal refactor. The existing test `test/unit/views/public-viewer-shell.test.tsx` must keep passing unmodified (its mocks target `PublicGanttView`/`PublicCalendarView`/etc., not the internal state shape, so it should be unaffected — verify at implementation time).

### New: `components/ReadOnlyViewerShell.tsx`

Consumes the same `usePublicViewerData` hook. Renders:

- `AppHeader` — `title` = school name, `rightSlot` = a "Log in" link/button (`<Link href="/auth/login">`).
- A 2-tab bar (Weekly / Monthly) — same visual pattern as `PublicViewerShell`'s `ViewTabs` but only two items, using new i18n labels (not `nav.gantt`/`nav.calendar` — see i18n below), and `onChange` only flips local state (no URL change).
- `FilterBar` — same as today, `zoomOptions={[]}` when on the Weekly tab (hides the in-tab zoom toggle; week is implied by the tab itself), `zoomOptions={[]}` on Monthly too (calendar view has never taken a zoom toggle).
- Weekly tab body: `PublicGanttView` with `params.zoom` forced to `"week"` regardless of what's in `params` (defensive — `FilterBar` won't offer another zoom option to select, but the render stays correct even if state ever drifted).
- Monthly tab body: `PublicCalendarView`, unchanged usage from `PublicViewerShell`.
- No `ExportToGoogleCalendarButton`. No Agenda tab, no agenda-related imports/loaders.
- Reuses the same 5s polling behavior from the hook (freshness requirement applies here too — PRD §11 / CLAUDE.md's "≤ 5 s after publish" bar isn't view-specific).

---

## Auth / Login Wiring

- `app/auth/login/page.tsx`: add a link below the existing "הרשמה" (register) line:
  ```tsx
  <p className="text-center text-sm text-muted-foreground">
    <Link href="/schedule" className="underline hover:text-foreground">
      צפייה בלוח בלי להתחבר
    </Link>
  </p>
  ```
  **Amended post-implementation:** the rest of `app/auth/login/page.tsx` hardcodes its Hebrew strings directly in JSX rather than using `next-intl` (predates this feature). To avoid introducing a partial, inconsistent i18n usage into an otherwise fully-hardcoded file, this link's text is a plain hardcoded string matching the file's existing local convention — there is no `auth.viewReadOnly` i18n key. (Exact placement/styling to match the existing card; this is illustrative, not final markup.)
- No middleware changes beyond the two `public-request.ts` list entries above.
- The "Log in" button inside `ReadOnlyViewerShell` links to plain `/auth/login` — no `next` param. `getPostLoginRedirect` always sends an authenticated staff member to `/dashboard` (or `/auth/pending`, `/auth/change-password`, etc. per their status), so a `next` back to `/schedule` wouldn't be honored anyway.
- Nothing about `/[school]`, `/[school]/calendar`, `/[school]/agenda`, or the staff/admin routes changes.

---

## i18n

New keys, `he.json` first (primary), mirrored in `en.json`:

| Key | he | en |
|---|---|---|
| `schedule.weekly` | "שבועי" | "Weekly" |
| `schedule.monthly` | "חודשי" | "Monthly" |
| `schedule.login` | "התחברות" | "Log in" |

`schedule` is a new namespace, used by `ReadOnlyViewerShell`. The login-page link's own text is **not** an i18n key — see the amendment in "Auth / Login Wiring" above. (Neither `he.json` nor `en.json` actually had an `auth` namespace before this feature — it does not exist, so there's nothing to populate there.) Copy is easy to adjust at implementation/review time; the keys and structure are what matter for the spec.

---

## New / Modified Files

| File | Change |
|---|---|
| `lib/views/use-public-viewer-data.ts` (new) | Extracted shared hook (polling, filters, calendar months, print-month) |
| `components/PublicViewerShell.tsx` | Refactored to use the hook; no external behavior change |
| `components/ReadOnlyViewerShell.tsx` (new) | 2-tab read-only shell described above |
| `app/(public)/schedule/page.tsx` (new) | Resolves the single school, loads public viewer data, renders `ReadOnlyViewerShell` |
| `lib/auth/public-request.ts` | Add `/schedule` to `RESERVED_PREFIXES` and `PUBLIC_PREFIXES` |
| `app/auth/login/page.tsx` | Add the read-only entry link |
| `messages/he.json` / `messages/en.json` | Add `auth.viewReadOnly`, `schedule.weekly`, `schedule.monthly`, `schedule.login` |

No deletions. No changes to `lib/db/schema.ts`, no new migration, no changes to any staff/admin route, no changes to the event state machine, no changes to `/[school]/*` route files themselves (only the shared component they render is refactored internally).

---

## Verification Checklist (pre- and post-implementation)

Explicitly called out because the user asked to double-check nothing breaks or gets deleted:

- [ ] `pnpm build` and `pnpm tsc --noEmit` pass.
- [ ] `pnpm lint` passes (including the ESLint rule banning `supabaseAdmin` outside `lib/db/` — `/schedule` page must go through `lib/db/schools.ts`, not a raw client).
- [ ] Existing test `test/unit/views/public-viewer-shell.test.tsx` passes unmodified after the hook extraction.
- [ ] Existing tests `test/unit/views/public-viewer.test.ts`, `test/unit/views/public-viewer-data.test.ts`, `test/unit/public-viewer-entry-loading.test.tsx` all still pass unmodified.
- [ ] Manually verify (or via Playwright) that `/[school]`, `/[school]/calendar`, `/[school]/agenda` still render identically to before the refactor (3 tabs, export button, zoom toggle, all present).
- [ ] Manually verify `/auth/login` still works for actual login (email/password + Google) — only a new link was added, nothing in the existing form changed.
- [ ] Manually verify `/schedule` end-to-end: loads without auth, shows Weekly + Monthly only, filters work, no export button, no agenda, "Log in" goes to `/auth/login`.
- [ ] Confirm no school in the seed/dev data has slug `schedule` (would now collide with the reserved prefix) — check `db/seed.ts` and any fixture data.

---

## Testing Plan

| Test | Type | Coverage |
|---|---|---|
| `usePublicViewerData` — polling, signature refresh, filter param round-trip, calendar month lazy load | Unit (Vitest) | Behavior parity with what's currently inline in `PublicViewerShell` |
| `PublicViewerShell` (existing suite) | Unit (Vitest) | Must keep passing unmodified — proves the refactor didn't change external behavior |
| `ReadOnlyViewerShell` — renders exactly 2 tabs, no export button, no agenda, zoom toggle hidden on Weekly | Unit (Vitest) | New |
| `/schedule` page — resolves the single school; `notFound()` when `listSchools()` is empty | Unit/Integration | New |
| E2E: `/auth/login` → click read-only link → `/schedule` → assert 2 tabs only, no Agenda/export → apply a grade filter, confirm events narrow → click "Log in" → lands on `/auth/login` | Playwright | New |
| E2E (regression): existing full-viewer spec(s) covering `/[school]`, `/[school]/calendar`, `/[school]/agenda` still pass | Playwright | Existing, unmodified |

---

## Out of Scope

- A school picker for genuinely multi-school deployments (not needed today; `listSchools()[0]` is sufficient given the single-tenant-per-deployment reality confirmed with the user).
- Any change to the existing `/[school]/*` public routes' behavior, tabs, or the export button there — they're untouched.
- iCal subscription flow — unrelated, unchanged.
- Any edit/staff capability on `/schedule` — it is, and remains, purely read-only.
