# Phase 2: Event CRUD & 7-Step Wizard — Research

**Researched:** 2026-05-10
**Domain:** Next.js App Router multi-step form, Drizzle ORM event CRUD, server-side autosave, optimistic concurrency, admin management UI
**Confidence:** HIGH (stack already installed and verified in Phase 1; patterns confirmed against existing codebase)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZARD-01 | Staff editor creates a new event via 7-step wizard (all fields per PRD §6.2) | Server Component + Client form pattern; Zod validation at API boundary |
| WIZARD-02 | Wizard autosaves draft to server on every step advance (draft row created on open) | PATCH `/api/v1/events/[id]` on every step; optimistic UI via React state |
| WIZARD-03 | Editor can close tab and resume draft from `/dashboard` | `GET /api/v1/events?status=draft` listing; draft persists server-side |
| WIZARD-04 | Date picker bounded by active academic year dates | `react-day-picker` `disabled` prop with `fromDate`/`toDate`; year fetched from DB |
| WIZARD-05 | Grade multi-select respects editor's grade scopes | `editor_scopes` query on load; filter `<option>` elements before render |
| WIZARD-06 | Step 7 "Submit for approval" flips status `draft → pending` | `lib/events/approval.ts` state machine; POST `/api/v1/events/[id]/submit` |
| WIZARD-07 | Dashboard shows editor's draft and pending events with status indicators | Server Component list; `withSchool` + `eq(events.createdBy, userId)` |
| WIZARD-08 | Editor can soft-delete their own draft events | PATCH `events.deleted_at = now()` guarded by status=draft check |
| WIZARD-09 | Concurrent edit: `If-Match`/`version` check; toast warning on conflict | Compare `version` in UPDATE WHERE clause; 409 response → toast |
| ADMIN-01 | Admin manages staff users (create, edit, deactivate) at `/admin/staff` | Server Component table + Server Actions or API routes; `deactivatedAt` column |
| ADMIN-02 | Admin configures event types (label, color, glyph, order) at `/admin/event-types` | CRUD on `event_types` table; `sortOrder` for drag-reorder |
| ADMIN-03 | Admin configures active academic year at `/admin/year` | `schools.activeAcademicYearId` FK update; CRUD on `academic_years` |
</phase_requirements>

---

## Summary

Phase 2 builds the staff-facing event creation workflow and the admin management pages. The multi-step wizard is the most complex component: it manages seven steps of form state in the browser while persisting each step to the server as a draft on every advance. The autosave model (draft row created immediately on wizard open, PATCHed on each step) means the editor can always recover their work from `/dashboard`.

The existing codebase already provides all infrastructure needed: the `events`, `event_grades`, `event_revisions`, `editor_scopes`, `event_types`, `staff_users`, and `academic_years` tables are in place and have RLS. `withSchool()`, `assertEditorScope()`, `getSession()`/`getStaffUser()` are fully implemented. The `react-day-picker` calendar component (v10) is already installed and has RTL chevron patches applied in `components/ui/calendar.tsx`. `date-fns` v4 is installed for date math.

Three architectural decisions need clear upfront choices for the planner:
1. **Wizard state management:** URL-based step param (`?step=N`) with server-persisted draft vs. full client-state via `useState`. Recommendation: URL step param + server autosave on advance (best for tab-close resume).
2. **Autosave transport:** Server Actions vs. `fetch` to REST API routes. Recommendation: REST API routes to maintain the existing `app/api/v1/` pattern and keep server-only boundary explicit.
3. **Admin pages:** Server Components with form actions vs. full client-side data tables. Recommendation: Server Component tables with inline edit forms using Server Actions where appropriate; shadcn `<DataTable>` pattern for the staff list.

**Primary recommendation:** Implement the wizard as a `"use client"` container component with URL-synced step, per-step Zod validation, and PATCH-on-advance to `app/api/v1/events/[id]`. Admin pages use Server Components with Server Actions for mutations.

---

## Standard Stack

### Core (all already installed in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | ^0.45.2 | Event CRUD queries via `withSchool()` | Already in use; typed schema for `events`, `event_grades`, etc. |
| `zod` | ^3.25.0 | API boundary validation for event payloads | Project-mandated; already wired in auth routes |
| `react-day-picker` | ^10.0.0 | Date picker for wizard step date fields | Already installed; `components/ui/calendar.tsx` wraps it with RTL patches |
| `date-fns` | ^4.1.0 | Date math for year boundary validation | Already installed |
| `next-intl` | ^3 | All Hebrew/English strings via `t()` | Already wired; `messages/he.json` is primary locale |
| `lucide-react` | ^1.14.0 | All icons in wizard and admin UI | Project-mandated; already in use |
| `@base-ui/react` | ^1.4.1 | Base UI primitives used by shadcn v4 | Already installed; RTL handled natively via `dir` attribute |

### Supporting (no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwind-merge` + `clsx` | installed | `cn()` utility for className merging | Every component |
| `@testing-library/react` | ^16.3.2 | Unit tests for wizard components | Wizard step rendering tests |
| `@testing-library/user-event` | ^14.6.1 | Simulating user input in tests | Form interaction tests |
| `vitest` | ^4.1.5 | Unit + integration tests | Already wired with two projects: `unit` (jsdom) + `integration` (node) |

### No New Packages Required

All required packages are already installed. Phase 2 needs no `pnpm add` commands.

**Version verification:** All versions confirmed from `package.json` read on 2026-05-10. No new packages needed.

---

## Architecture Patterns

### Recommended Directory Structure for Phase 2

```
app/
  (staff)/
    layout.tsx                     — Protected layout: calls getStaffUser(), redirect → /login
    dashboard/
      page.tsx                     — Server Component: editor's draft + pending event list
    events/
      new/
        page.tsx                   — Server Component: creates draft event, redirects to /events/[id]/edit?step=1
      [id]/
        edit/
          page.tsx                 — Server Component: loads draft; renders WizardShell client component
  (admin)/
    admin/
      layout.tsx                   — Protected layout: asserts role='admin'
      staff/
        page.tsx                   — Server Component: staff user list
      event-types/
        page.tsx                   — Server Component: event type list + reorder
      year/
        page.tsx                   — Server Component: academic year CRUD
  api/
    v1/
      events/
        route.ts                   — GET (list), POST (create draft)
        [id]/
          route.ts                 — GET (single), PATCH (autosave), DELETE (soft-delete)
          submit/
            route.ts               — POST (draft → pending)
      admin/
        staff/
          route.ts                 — GET, POST (create staff user)
          [id]/
            route.ts               — PATCH (edit/deactivate)
        event-types/
          route.ts                 — GET, POST
          [id]/
            route.ts               — PATCH, DELETE
        years/
          route.ts                 — GET, POST
          [id]/
            route.ts               — PATCH (set active)
lib/
  events/
    crud.ts                        — createDraft(), updateDraft(), softDelete(), getEditorEvents()
    approval.ts                    — submitForApproval() — state machine: draft → pending
    queries.ts                     — DB queries for events + event_grades with withSchool()
  validations/
    events.ts                      — Zod schemas: EventDraftSchema, EventSubmitSchema
    admin.ts                       — Zod schemas: StaffUserCreateSchema, EventTypeSchema
components/
  wizard/
    WizardShell.tsx                — "use client"; step router, step state, autosave trigger
    WizardStep1.tsx                — Event type selector
    WizardStep2.tsx                — Title + description
    WizardStep3.tsx                — Grade multi-select (scope-filtered)
    WizardStep4.tsx                — Date range picker (year-bounded)
    WizardStep5.tsx                — Location
    WizardStep6.tsx                — Review / summary
    WizardStep7.tsx                — Submit confirmation
  dashboard/
    EventList.tsx                  — "use client" or Server Component list of editor's events
  admin/
    StaffTable.tsx                 — Staff user management table
    EventTypeTable.tsx             — Event type CRUD table
```

### Pattern 1: Draft-First Wizard with URL Step Routing

**What:** Create an empty draft event row immediately when the editor opens `/events/new`. Redirect to `/events/[id]/edit?step=1`. Each step renders inside a `"use client"` `WizardShell` component. On "Next", PATCH the draft and advance `?step=N`. The URL always reflects the current step, enabling browser back/forward navigation.

**Why URL-based:** If the editor closes the tab at step 4 and returns, they see `/dashboard` → click "Resume" → redirected to `/events/[id]/edit?step=4` (or step 1 to re-enter). The server is the source of truth; the URL is the navigation state.

**When to use:** Always — this is the only wizard pattern that satisfies WIZARD-02 (autosave) + WIZARD-03 (resume).

```typescript
// app/(staff)/events/new/page.tsx — Server Component
// Source: Next.js App Router pattern; redirect() from next/navigation
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/session";
import { createDraft } from "@/lib/events/crud";

export default async function NewEventPage() {
  const user = await getStaffUser();
  if (!user) redirect("/login");

  // Create draft immediately; this is the canonical WIZARD-02 entry point
  const draft = await createDraft(user.schoolId, user.id);
  redirect(`/events/${draft.id}/edit?step=1`);
}
```

```typescript
// components/wizard/WizardShell.tsx — "use client"
// Receives: eventId, initialData (from Server Component), allowedGrades, academicYear
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface WizardShellProps {
  eventId: string;
  initialData: Partial<EventDraft>;
  allowedGrades: number[];
  academicYear: { startDate: string; endDate: string };
}

export function WizardShell({ eventId, initialData, allowedGrades, academicYear }: WizardShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = Number(searchParams.get("step") ?? "1");
  const [formData, setFormData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  async function handleNext(stepData: Partial<EventDraft>, currentVersion: number) {
    setSaving(true);
    const res = await fetch(`/api/v1/events/${eventId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "If-Match": String(currentVersion), // WIZARD-09 optimistic concurrency
      },
      body: JSON.stringify(stepData),
    });
    setSaving(false);
    if (res.status === 409) {
      setConflict(true); // Show toast; WIZARD-09
      return;
    }
    if (!res.ok) return; // Handle errors
    setFormData((prev) => ({ ...prev, ...stepData }));
    router.push(`?step=${step + 1}`);
  }
  // ... render step components
}
```

### Pattern 2: PATCH Autosave with Optimistic Concurrency (WIZARD-09)

**What:** Every PATCH request includes an `If-Match: <version>` header. The server compares the submitted version against the DB row's `version` column. If they differ, return 409. On success, increment `version` and return the new value.

**When to use:** Every event PATCH in the wizard and in the edit flow.

```typescript
// app/api/v1/events/[id]/route.ts — PATCH handler
import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { withSchool } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { EventDraftSchema } from "@/lib/validations/events";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ifMatch = request.headers.get("If-Match");
  const clientVersion = ifMatch ? Number(ifMatch) : null;

  const body = await request.json();
  const parsed = EventDraftSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await withSchool(user.schoolId, async (tx) => {
    // Fetch current version for optimistic check (WIZARD-09)
    const [current] = await tx
      .select({ version: events.version, createdBy: events.createdBy, status: events.status })
      .from(events)
      .where(eq(events.id, params.id))
      .limit(1);

    if (!current) return { status: 404 as const };
    if (current.createdBy !== user.id && user.role !== "admin") {
      return { status: 403 as const };
    }
    // Optimistic concurrency check (WIZARD-09)
    if (clientVersion !== null && current.version !== clientVersion) {
      return { status: 409 as const };
    }

    const [updated] = await tx
      .update(events)
      .set({ ...parsed.data, version: current.version + 1, updatedAt: new Date() })
      .where(eq(events.id, params.id))
      .returning({ version: events.version });

    return { status: 200 as const, version: updated.version };
  });

  if (result.status !== 200) {
    return NextResponse.json({ error: "Conflict or not found" }, { status: result.status });
  }
  return NextResponse.json({ version: result.version }, { status: 200 });
}
```

### Pattern 3: Grade Multi-Select with Scope Filtering (WIZARD-05)

**What:** Before rendering step 3, the Server Component fetches the editor's allowed grades from `editor_scopes`. The client component only renders these grades as selectable options. The API additionally validates on write that no out-of-scope grade is submitted.

**When to use:** Step 3 of the wizard (grade selection).

```typescript
// lib/events/queries.ts
import { withSchool } from "@/lib/db/client";
import { editorScopes, academicYears, schools } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getEditorAllowedGrades(
  schoolId: string,
  staffUserId: string,
): Promise<number[]> {
  const rows = await withSchool(schoolId, (tx) =>
    tx
      .select({ scopeValue: editorScopes.scopeValue })
      .from(editorScopes)
      .where(
        and(
          eq(editorScopes.staffUserId, staffUserId),
          eq(editorScopes.scopeKind, "grade"),
        ),
      ),
  );
  return rows.map((r) => Number(r.scopeValue));
}

export async function getActiveAcademicYear(schoolId: string) {
  // Join schools → academic_years via activeAcademicYearId
  const [school] = await withSchool(schoolId, (tx) =>
    tx.select({ activeYearId: schools.activeAcademicYearId }).from(schools)
      .where(eq(schools.id, schoolId)).limit(1),
  );
  if (!school?.activeYearId) return null;
  const [year] = await withSchool(schoolId, (tx) =>
    tx.select().from(academicYears)
      .where(eq(academicYears.id, school.activeYearId!)).limit(1),
  );
  return year ?? null;
}
```

### Pattern 4: Date Picker with Year Boundary (WIZARD-04)

**What:** `react-day-picker` v10 (already installed) accepts `disabled` prop with date constraints. Pass `fromDate` and `toDate` from the active academic year.

**When to use:** Step 4 of the wizard (date range selection).

```typescript
// components/wizard/WizardStep4.tsx — "use client"
import { Calendar } from "@/components/ui/calendar";
import { parseISO } from "date-fns";

interface WizardStep4Props {
  academicYear: { startDate: string; endDate: string };
  value: { startAt: Date | undefined; endAt: Date | undefined };
  onChange: (range: { startAt: Date | undefined; endAt: Date | undefined }) => void;
}

export function WizardStep4({ academicYear, value, onChange }: WizardStep4Props) {
  const fromDate = parseISO(academicYear.startDate);
  const toDate = parseISO(academicYear.endDate);

  return (
    <Calendar
      mode="range"
      selected={{ from: value.startAt, to: value.endAt }}
      onSelect={(range) =>
        onChange({ startAt: range?.from, endAt: range?.to })
      }
      disabled={[
        { before: fromDate },  // Reject dates before academic year start
        { after: toDate },     // Reject dates after academic year end
      ]}
    />
  );
}
```

### Pattern 5: Event Submission State Machine (WIZARD-06)

**What:** `lib/events/approval.ts` is the single entry point for ALL status transitions. Never update `events.status` directly in a route handler. The `submitForApproval()` function validates the event is in `draft` status and transitions to `pending`. It also writes an `event_revisions` row.

**When to use:** Step 7 "Submit for approval" button triggers `POST /api/v1/events/[id]/submit`.

```typescript
// lib/events/approval.ts
import { withSchool } from "@/lib/db/client";
import { events, eventRevisions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function submitForApproval(
  schoolId: string,
  eventId: string,
  submittedById: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "draft")))
      .limit(1);

    if (!event) throw new Response("Not found or not a draft", { status: 404 });

    await tx.update(events)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    // Write revision snapshot (WIZARD-06; every transition writes event_revisions)
    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      submittedBy: submittedById,
      decision: "submitted",
    });
  });
}
```

### Pattern 6: Soft Delete (WIZARD-08)

**What:** Setting `events.deleted_at = now()` instead of a hard DELETE. The API route verifies the event belongs to the editor and is in `draft` status before soft-deleting.

```typescript
// Soft delete in PATCH or DELETE route — never hard DELETE
await withSchool(user.schoolId, (tx) =>
  tx
    .update(events)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(events.id, eventId),
        eq(events.createdBy, user.id),
        eq(events.status, "draft"), // Only drafts can be soft-deleted by editors
      ),
    ),
);
```

### Pattern 7: Admin Staff Management (ADMIN-01)

**What:** Admin-only routes at `/admin/staff`. Creating a new staff user requires creating a Supabase Auth user first (via `supabaseAdmin.auth.admin.createUser()`), then inserting a `staff_users` row with the Auth user's ID. Deactivating sets `deactivatedAt = now()` — a deactivated staff user's session is checked in middleware or layout.

**Important:** Staff user creation must happen via the service-role client (inside `lib/db/`) due to the ESLint restriction.

```typescript
// lib/db/staff.ts — new function for admin use
import { supabaseAdmin } from "@/lib/db/client"; // inside lib/db/ — allowed
import { withSchool } from "@/lib/db/client";
import { staffUsers } from "@/lib/db/schema";

export async function createStaffUser(params: {
  schoolId: string;
  email: string;
  fullName: string;
  role: "editor" | "admin";
  temporaryPassword: string;
}): Promise<{ id: string }> {
  // Step 1: Create Supabase Auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.temporaryPassword,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Auth user creation failed");

  // Step 2: Insert staff_users row (id mirrors auth.users.id)
  // Note: schools table has no RLS, but staff_users does — use withSchool for the insert
  await withSchool(params.schoolId, (tx) =>
    tx.insert(staffUsers).values({
      id: data.user.id,
      schoolId: params.schoolId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
    }),
  );
  return { id: data.user.id };
}
```

### Pattern 8: Dashboard Event List (WIZARD-07)

**What:** Server Component that queries the current editor's events filtered to `draft` and `pending` status (excluding soft-deleted). Returns a list with status badges.

```typescript
// lib/events/queries.ts
export async function getEditorDashboardEvents(
  schoolId: string,
  staffUserId: string,
) {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        updatedAt: events.updatedAt,
        startAt: events.startAt,
      })
      .from(events)
      .where(
        and(
          eq(events.createdBy, staffUserId),
          inArray(events.status, ["draft", "pending"]),
          isNull(events.deletedAt),
        ),
      )
      .orderBy(desc(events.updatedAt)),
  );
}
```

### Anti-Patterns to Avoid

- **Updating `events.status` directly in a route handler:** All status transitions MUST go through `lib/events/approval.ts`. This is a hard project constraint from CLAUDE.md.
- **Calling `supabaseAdmin` outside `lib/db/`:** Staff user creation in admin pages calls a function in `lib/db/staff.ts` — it cannot call `supabaseAdmin` directly from a route handler.
- **Storing wizard state only in browser localStorage:** The draft must live on the server from step 1 to satisfy WIZARD-03 (tab-close resume). localStorage is a supplement only.
- **Skipping `withSchool()` in event queries:** Every event query must use the wrapper. Grade filtering in step 3 of the wizard — the scope check happens at query time, not just render time.
- **Using `left` / `right` in CSS for wizard step layout:** All layout uses logical properties (`start`/`end`) per CLAUDE.md RTL constraint.
- **Hardcoded strings in JSX:** All user-facing text in wizard steps and admin pages goes through `next-intl` `t()`. No exceptions.
- **`react-day-picker` mode without `disabled` constraints:** Date pickers in the wizard MUST enforce the academic year boundaries via the `disabled` prop — not just client-side validation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-step form step routing | Custom step state manager with localStorage | URL `?step=N` param + server-side draft | Survives tab close (WIZARD-03); shareable links; back/forward nav works |
| Optimistic concurrency | Row-level DB lock (SELECT FOR UPDATE) | `version` integer comparison + 409 response | SELECT FOR UPDATE holds a lock across the async PATCH round-trip; `version` compare-and-swap is lightweight and sufficient |
| Date bounds validation | Custom date range comparison logic | `react-day-picker` `disabled` prop + Zod `.refine()` at API | react-day-picker handles calendar UX; Zod validates the API payload; both layers needed |
| Admin staff user creation | Direct INSERT into `staff_users` without Auth record | `supabaseAdmin.auth.admin.createUser()` then `staff_users` insert | Auth record is required for login; `staff_users.id = auth.users.id` invariant must hold |
| Event state machine | Inline `status = 'pending'` assignments in route handlers | `lib/events/approval.ts` functions | CLAUDE.md hard constraint; ensures `event_revisions` rows are always written |
| Scope-based grade filtering | Frontend-only filter (render all, hide some) | DB query filters to only allowed grades | Frontend-only is bypassable; API must also enforce (defense in depth) |

**Key insight:** The most dangerous anti-pattern in this phase is bypassing `lib/events/approval.ts` for status transitions. Every path that touches `events.status` must go through the state machine functions. The DB schema has no DB-level constraint preventing direct status updates — the enforcement is entirely in code.

---

## Common Pitfalls

### Pitfall 1: Wizard Step Validation vs. Draft Permissiveness

**What goes wrong:** Requiring all fields to be filled before the draft can be saved means partial data can never be persisted. The wizard must allow saving incomplete drafts.
**Why it happens:** Developers apply the full `EventSubmitSchema` (required title, dates, type, grades) to every PATCH. This breaks the autosave-on-advance pattern.
**How to avoid:** Use two Zod schemas: `EventDraftSchema` (all fields optional — allows partial saves) and `EventSubmitSchema` (all required — validated at the `POST /submit` endpoint). The PATCH route uses the draft schema.
**Warning signs:** Editors can't advance past step 1 without filling all fields; wizard feels unusable.

### Pitfall 2: `schools.activeAcademicYearId` Is a Nullable FK

**What goes wrong:** Assuming `activeAcademicYearId` is always set causes null-pointer errors when a new school hasn't configured a year yet.
**Why it happens:** The column is nullable per the schema (`activeAcademicYearId: uuid("active_academic_year_id")` — no `.notNull()`).
**How to avoid:** The wizard entry point (Server Component at `/events/new`) must check that an active year exists. If not, redirect to a "configure your academic year first" page or show an error. Do not let editors create events without a year.
**Warning signs:** `parseISO(undefined)` in the date picker step; uncaught TypeErrors.

### Pitfall 3: RLS Prevents Admin Reads Without `withSchool()`

**What goes wrong:** Admin routes that read `staff_users`, `event_types`, or `academic_years` return empty results because RLS requires `app.school_id` to be set even for admins (the `authenticated` role has `bypassrls=false`).
**Why it happens:** Developers assume admins bypass RLS. They do not — RLS is bypassed only by the `postgres` superuser connection. `withSchool()` is still required for admin pages.
**How to avoid:** All admin page queries use `withSchool(admin.schoolId, ...)`. The admin's `schoolId` is available from `getStaffUser()`.
**Warning signs:** `/admin/staff` shows an empty staff list even when users exist in the DB.

### Pitfall 4: Concurrent Edit Check Uses Wrong Column

**What goes wrong:** Using `updatedAt` timestamp for the `If-Match` header instead of the `version` integer. Timestamps have millisecond precision and can collide on fast saves.
**Why it happens:** Timestamps feel natural for "last modified" checks; `version` requires a dedicated increment.
**How to avoid:** The `events` table has a `version integer not null default 1` column specifically for this. Always use `version` for the `If-Match` value and the compare-and-swap in the PATCH handler.
**Warning signs:** WIZARD-09 test passes with a single editor but fails under concurrent load.

### Pitfall 5: `createDraft()` Called Inside `withSchool()` Leaks School Context

**What goes wrong:** Calling `createDraft()` (which itself calls `withSchool()`) from inside another `withSchool()` block creates a nested transaction. Drizzle's `node-postgres` driver does not support nested transactions — the inner `db.transaction()` call creates a SAVEPOINT, which may behave unexpectedly if the outer transaction rolls back.
**Why it happens:** Convenience — passing the outer `tx` to `createDraft()` seems natural.
**How to avoid:** `createDraft()` should be a top-level function that creates its own transaction. Server Actions or route handlers call it at the top level, not inside another `withSchool()` block.
**Warning signs:** Integration test for draft creation passes standalone but fails when called from inside another DB transaction.

### Pitfall 6: `event_grades` Multi-Insert on Each PATCH

**What goes wrong:** Every autosave PATCH re-inserts all selected grades without deleting the old ones, causing duplicate `(event_id, grade)` primary key violations.
**Why it happens:** Grades are a separate table joined to events; naive re-insert doesn't account for existing rows.
**How to avoid:** In the PATCH handler that updates grades: `DELETE FROM event_grades WHERE event_id = $id` then re-insert the new set. Wrap both in the same `withSchool()` transaction to make it atomic.
**Warning signs:** Second step-advance on step 3 throws a PK constraint violation.

### Pitfall 7: Admin Deactivation vs. Supabase Auth

**What goes wrong:** Deactivating a staff user (setting `deactivated_at`) does not invalidate their existing Supabase Auth JWT. The user can continue to make authenticated API calls until their token expires (up to 1 hour).
**Why it happens:** Deactivation is a DB-level concept; Supabase Auth sessions are independent.
**How to avoid:** After setting `deactivated_at`, also call `supabaseAdmin.auth.admin.signOut(userId, "global")` to revoke all sessions. Add a `deactivated_at IS NOT NULL` check in the middleware or protected layout so even a valid JWT is rejected if the staff user is deactivated.
**Warning signs:** Deactivated user can still submit events for 45 minutes.

---

## Code Examples

### Verified: Drizzle `inArray` + `isNull` for Dashboard Query

```typescript
// Source: https://orm.drizzle.team/docs/operators
import { inArray, isNull, desc } from "drizzle-orm";

// Get editor's non-deleted draft/pending events
const rows = await withSchool(schoolId, (tx) =>
  tx
    .select({ id: events.id, title: events.title, status: events.status })
    .from(events)
    .where(
      and(
        eq(events.createdBy, staffUserId),
        inArray(events.status, ["draft", "pending"]),
        isNull(events.deletedAt),
      ),
    )
    .orderBy(desc(events.updatedAt)),
);
```

### Verified: react-day-picker v10 `disabled` Prop for Date Ranges

```typescript
// Source: https://daypicker.dev/docs/disable-days (react-day-picker v10 / daypicker.dev)
// The Calendar component in components/ui/calendar.tsx wraps DayPicker
// disabled accepts an array of Matcher objects
<Calendar
  mode="range"
  disabled={[
    { before: new Date(academicYear.startDate) },
    { after: new Date(academicYear.endDate) },
  ]}
/>
```

### Verified: Drizzle Grade Bulk Replace Pattern

```typescript
// Source: Drizzle ORM transactions docs
// Replace event_grades atomically during wizard PATCH
await withSchool(schoolId, async (tx) => {
  // 1. Remove all existing grade associations
  await tx.delete(eventGrades).where(eq(eventGrades.eventId, eventId));
  // 2. Insert new set (if any grades selected)
  if (grades.length > 0) {
    await tx.insert(eventGrades).values(
      grades.map((grade) => ({ eventId, grade, schoolId })),
    );
  }
});
```

### Verified: Supabase Admin — Revoke All Sessions on Deactivation

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-signout
// File: lib/db/staff.ts — inside lib/db/ so supabaseAdmin import is allowed
await supabaseAdmin.auth.admin.signOut(staffUserId, "global");
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wizard state in localStorage | Server-persisted draft + URL step | Always recommended for resumable forms | Tab close = work preserved (WIZARD-03) |
| `SELECT FOR UPDATE` for concurrent edits | `version` integer + 409 response | Standard optimistic concurrency | No DB lock held during HTTP round-trip |
| `events.status = 'pending'` inline in routes | `lib/events/approval.ts` state machine | Project architectural decision | `event_revisions` always written; no orphan state |
| react-day-picker v7 (`disabled: { before, after }` as object) | react-day-picker v10 (`disabled: [{ before }, { after }]` as array of Matcher) | v8 release | Array of matchers is the v10 API; object form is deprecated |
| shadcn Radix UI primitives | shadcn v4 + Base UI (`@base-ui/react`) | 2025 shadcn v4 release | RTL handled natively via HTML `dir` attribute; fewer CSS overrides needed |

**Deprecated/outdated:**

- `react-day-picker` v7/v8 docs: The `disabled` prop previously accepted a single object `{ before, after }`. In v10, pass an array of Matcher objects. The installed version is v10 — use array syntax only.
- `@supabase/auth-helpers-nextjs`: Deprecated; replaced by `@supabase/ssr` (already in use).

---

## Open Questions

1. **What are the exact 7 wizard steps per PRD §6.2?**
   - What we know: CLAUDE.md mentions "7-step wizard" with components `WizardStep[1..7]`. The PRD fields reference event type, title, description, grades, dates, location, and submission.
   - What's unclear: The PRD document itself is not available in the repository. The exact field-to-step mapping is not explicitly specified.
   - Recommendation: Infer from the data model and the WIZARD-XX requirements. Proposed mapping:
     - Step 1: Event type (event_type_id)
     - Step 2: Title + description
     - Step 3: Grade multi-select (scope-filtered)
     - Step 4: Date range + all-day toggle (year-bounded)
     - Step 5: Location
     - Step 6: Review / summary
     - Step 7: Submit for approval
   - Planner can codify this mapping in the plan; if incorrect, it can be adjusted before implementation.

2. **`schools` table RLS and `withSchool()` for admin reads**
   - What we know: `schools` table has no RLS (it is the tenant root, no `school_id` FK). The admin page needs to display the school's name and active year.
   - What's unclear: Whether admin queries to `schools` need `withSchool()` or can use `db` directly.
   - Recommendation: `schools` reads can use `db` directly (no RLS). For all other school-scoped tables, `withSchool()` is mandatory. Document this explicitly in admin query helpers.

3. **Admin academic year "set active" action — circular FK**
   - What we know: `schools.activeAcademicYearId` references `academic_years.id`. Setting a new active year is an UPDATE to `schools` — but `schools` has no RLS, so this can use `db` directly (not `withSchool()`).
   - What's unclear: Whether the migration should add a FK constraint from `schools.active_academic_year_id → academic_years.id` and whether it's currently set.
   - Recommendation: Check the existing migration SQL. If the FK is not present, add it in a new migration (`0002_schools_active_year_fk.sql`). This is a Phase 2 prerequisite.

4. **Editor scope "all grades" for department editors**
   - What we know: The seed script creates a "counselor" department editor whose scope is likely event-type-based, not grade-based. WIZARD-05 says the grade multi-select shows only the editor's grade scopes. A counselor with no grade scopes would see an empty multi-select.
   - What's unclear: Whether counselor-type editors should see all grades, or have no grade restriction (i.e., `scopeKind = 'event_type'` only).
   - Recommendation: Treat an editor with zero `grade` scopes as having access to all grades (only event-type scoped). Query the scope kind and if no grade entries exist for the user, return all grades (7–12).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22 | pnpm scripts | Provisioned in Phase 0 | 22 LTS | — |
| Supabase project (remote) | All DB queries, staff creation | Assumed connected (Phase 1 complete) | — | — |
| `react-day-picker` | WIZARD-04 date picker | ✓ | ^10.0.0 (package.json) | — |
| `date-fns` | Date math for year boundaries | ✓ | ^4.1.0 (package.json) | — |
| `@base-ui/react` | shadcn v4 primitives | ✓ | ^1.4.1 (package.json) | — |
| TEST_DATABASE_URL | Integration tests | Unknown — set in Phase 1 if human provided | — | Tests skip gracefully via `skipIfNoTestDb` |

**Missing dependencies with no fallback:** None — all required packages already installed.

**Missing dependencies with fallback:** TEST_DATABASE_URL — integration tests skip with a warning if absent. Wizard integration tests (WIZARD-01 through WIZARD-09) are new and will be added to the `test/integration/` directory; they follow the existing `skipIfNoTestDb` guard pattern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (exists — two projects: `unit`/jsdom + `integration`/node) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |
| Unit only | `pnpm test:unit` |
| Integration only | `pnpm test:integration` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZARD-01 | Event created with all 7 steps | integration | `vitest run --project integration test/integration/wizard.test.ts` | Wave 0 |
| WIZARD-02 | Draft row exists on wizard open; PATCH saves step data | integration | `vitest run --project integration test/integration/wizard.test.ts` | Wave 0 |
| WIZARD-03 | Draft appears in dashboard event list after tab close | integration | `vitest run --project integration test/integration/wizard.test.ts` | Wave 0 |
| WIZARD-04 | Date picker rejects dates outside academic year | unit | `pnpm test:unit test/unit/wizard/step4.test.tsx` | Wave 0 |
| WIZARD-05 | Grade multi-select only shows editor's scope grades | unit | `pnpm test:unit test/unit/wizard/step3.test.tsx` | Wave 0 |
| WIZARD-06 | Submit flips status to `pending`; revision row written | integration | `vitest run --project integration test/integration/wizard.test.ts` | Wave 0 |
| WIZARD-07 | Dashboard lists only editor's non-deleted draft+pending events | integration | `vitest run --project integration test/integration/dashboard.test.ts` | Wave 0 |
| WIZARD-08 | Soft delete sets `deleted_at`; event removed from dashboard | integration | `vitest run --project integration test/integration/dashboard.test.ts` | Wave 0 |
| WIZARD-09 | PATCH returns 409 on version mismatch; success increments version | integration | `vitest run --project integration test/integration/wizard.test.ts` | Wave 0 |
| ADMIN-01 | Admin creates/deactivates staff users; deactivated user loses session | integration | `vitest run --project integration test/integration/admin.test.ts` | Wave 0 |
| ADMIN-02 | Admin creates/updates event types | integration | `vitest run --project integration test/integration/admin.test.ts` | Wave 0 |
| ADMIN-03 | Admin sets active academic year; wizard reflects new year bounds | integration | `vitest run --project integration test/integration/admin.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm lint && pnpm tsc --noEmit`
- **Per wave merge:** `pnpm test && pnpm lint && pnpm tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/integration/wizard.test.ts` — covers WIZARD-01 through WIZARD-09
- [ ] `test/integration/dashboard.test.ts` — covers WIZARD-07, WIZARD-08
- [ ] `test/integration/admin.test.ts` — covers ADMIN-01, ADMIN-02, ADMIN-03
- [ ] `test/unit/wizard/step3.test.tsx` — grade scope filtering unit tests
- [ ] `test/unit/wizard/step4.test.tsx` — date boundary unit tests
- [ ] `lib/events/crud.ts` — new file (createDraft, updateDraft, softDelete, getEditorEvents)
- [ ] `lib/events/approval.ts` — new file (submitForApproval state machine)
- [ ] `lib/events/queries.ts` — new file (getEditorAllowedGrades, getActiveAcademicYear, getEditorDashboardEvents)
- [ ] `lib/validations/events.ts` — new file (EventDraftSchema, EventSubmitSchema)
- [ ] `lib/validations/admin.ts` — new file (StaffUserCreateSchema, EventTypeSchema, AcademicYearSchema)

---

## Project Constraints (from CLAUDE.md)

All directives below are mandatory and override any pattern recommended in this research if they conflict:

- **Tech stack is locked:** Next.js 15 App Router + React 19 + TypeScript 5 strict + Tailwind + shadcn/ui + Supabase + Drizzle ORM + `next-intl` + Zod + Vitest + Playwright. No substitutions.
- **RTL layout:** CSS logical properties only (`start`/`end`). Never `left`/`right` in layout/position styles.
- **DB safety:** Every query touching school data MUST run inside `db.withSchool(schoolId, fn)`. ESLint rule bans `supabaseAdmin` outside `lib/db/`.
- **State machine:** ALL `events.status` transitions go through `lib/events/approval.ts`. Never set `events.status` directly in a route handler.
- **Schema immutability:** Do not modify `lib/db/schema.ts` without a corresponding new migration file in `db/migrations/`. Never edit existing migration files.
- **Security:** Parameterized queries only. No SQL string interpolation. No `any` TypeScript.
- **Code style:** Functions < 50 lines. Files < 400 lines. `snake_case` DB columns → `camelCase` frontend types, transformed at the API route layer.
- **i18n:** All user-visible strings via `next-intl` `t()`. No hardcoded string literals in JSX.
- **Dates:** All date display via `lib/datetime.ts` using `Asia/Jerusalem` timezone. Never raw `new Date()` in display code.
- **Server Components by default:** `"use client"` only when hooks or browser APIs are used.
- **Testing:** ≥ 80% coverage on new code. Integration tests use real Postgres (no mocks).
- **Git:** Never commit directly to `main`. `pnpm build` must pass before commit.

---

## Sources

### Primary (HIGH confidence)

- Codebase — `lib/db/schema.ts`, `lib/db/client.ts`, `lib/auth/scopes.ts`, `lib/auth/session.ts`, `app/api/v1/auth/login/route.ts`, `components/ui/calendar.tsx` — read directly 2026-05-10
- `package.json` — dependency versions confirmed 2026-05-10
- `vitest.config.ts` — test infrastructure confirmed 2026-05-10
- `test/integration/setup.ts` — integration test pattern confirmed 2026-05-10
- [Drizzle ORM — Operators](https://orm.drizzle.team/docs/operators) — `inArray`, `isNull`, `and`, `desc`
- [Drizzle ORM — Transactions](https://orm.drizzle.team/docs/transactions) — transaction scoping for grade bulk replace
- [Supabase — Auth Admin signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout) — session revocation on deactivation
- [react-day-picker v10 — Disable Days](https://daypicker.dev/docs/disable-days) — `disabled` Matcher array API

### Secondary (MEDIUM confidence)

- Phase 1 RESEARCH.md — patterns, pitfalls, and architectural decisions from DB/Auth phase (already proven in production codebase)
- [Optimistic concurrency with version columns](https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html) — standard pattern for WIZARD-09

### Tertiary (LOW confidence)

- Inferred 7-step field mapping (Step 1–7) from data model + requirement text — not from an explicit PRD §6.2 document. LOW confidence on exact step order; planner should confirm with user if ambiguity causes implementation uncertainty.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages confirmed in package.json; no new installs needed
- Architecture (wizard patterns): HIGH — URL-step + server draft is the canonical Next.js App Router pattern for resumable multi-step forms; confirmed by codebase inspection
- Admin patterns: HIGH — same DB/auth infrastructure from Phase 1; only new queries and UI
- Pitfalls: HIGH — all pitfalls grounded in specific code inspection (schema, existing routes) and known Drizzle/Supabase behavior
- Wizard step field mapping: LOW — inferred from data model; PRD §6.2 not available in repo

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable stack; Drizzle, react-day-picker, and Supabase APIs are stable at these versions)
