# Editor Direct Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove admin approval gate — editors publish events directly; edits go live immediately.

**Architecture:** Collapse the state machine to two transitions: `draft → approved` (publish) and in-place PATCH of approved events. The `pending` and `rejected` statuses remain in the Postgres enum but are never produced. All four removed API routes are deleted as files. Audit trail is preserved via `event_revisions` using new decision values `'published'` and `'edited'`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Drizzle ORM, Vitest integration tests (real Postgres via `withSchool`).

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `lib/events/approval.ts` | Modify | Remove 4 functions; rename `autoApproveAsAdmin` → `publishEvent`; open to all editors |
| `lib/events/crud.ts` | Modify | `updateDraft` — allow editing approved events; write `'edited'` revision on approved-event PATCH |
| `lib/events/revisions.ts` | Modify | Remove `listPendingForQueue`, `getRejectedForEditor`, `QueueRow`, `RejectedEventRow` interfaces |
| `lib/events/queries.ts` | Modify | `getEditorDashboardEvents` — include `approved` status, drop `pending`/`rejected` |
| `app/api/v1/events/[id]/submit/route.ts` | Modify | Both roles call `publishEvent`; return `status: "approved"` always |
| `app/api/v1/events/[id]/route.ts` | Modify | PATCH: remove `invalid_state` guard for approved events |
| `app/api/v1/events/[id]/approve/route.ts` | **Delete** | No approval flow |
| `app/api/v1/events/[id]/reject/route.ts` | **Delete** | No rejection flow |
| `app/api/v1/events/[id]/revise/route.ts` | **Delete** | No revision chain |
| `app/(admin)/admin/queue/page.tsx` | **Delete** | No queue |
| `components/admin/QueueTable.tsx` | **Delete** | No queue |
| `app/(staff)/dashboard/rejected/page.tsx` | **Delete** | No rejected flow |
| `messages/he.json` | Modify | Step 7 button + title; dashboard status labels; remove rejected section |
| `messages/en.json` | Modify | Same |
| `test/integration/approval.test.ts` | Modify | Replace all tests with new `publishEvent` + in-place edit tests |
| `test/unit/events/approval.test.ts` | Modify | Update todo descriptions |

---

## Task 1: Rewrite `lib/events/approval.ts`

Replace the entire file. Remove `submitForApproval`, `approveEvent`, `rejectEvent`, `editApprovedEvent`. Rename `autoApproveAsAdmin` → `publishEvent`. Open it to any active staff user (not just admins).

**Files:**
- Modify: `lib/events/approval.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import "server-only";
import { and, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions, events } from "@/lib/db/schema";

/**
 * Transitions a draft event directly to approved status.
 * Any active editor or admin may call this on their own draft.
 * Writes a 'published' revision row for the audit log.
 *
 * Throws Response(404) if not found or not in draft status.
 */
export async function publishEvent(
  schoolId: string,
  eventId: string,
  actorId: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "draft")))
      .limit(1);

    if (!event) throw new Response("Not found or not a draft", { status: 404 });

    await tx
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      decidedBy: actorId,
      decision: "published",
    });
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
pnpm tsc --noEmit
```

Expected: no errors referencing `approval.ts`. Other files that imported the removed functions will now error — that's expected, you'll fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```
git add lib/events/approval.ts
git commit -m "refactor: replace approval state machine with publishEvent for direct editor publish"
```

---

## Task 2: Update the submit route

**Files:**
- Modify: `app/api/v1/events/[id]/submit/route.ts`

- [ ] **Step 1: Replace the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { publishEvent } from "@/lib/events/approval";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    if (user.role === "viewer" || user.status !== "active") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await publishEvent(user.schoolId, id, user.id);
    return NextResponse.json({ ok: true, status: "approved" }, { status: 200 });
  } catch (e) {
    if (e instanceof Response) {
      return NextResponse.json(
        { error: e.statusText || "Error" },
        { status: e.status },
      );
    }
    throw e;
  }
}
```

- [ ] **Step 2: Compile check**

```
pnpm tsc --noEmit
```

Expected: submit route no longer errors.

- [ ] **Step 3: Commit**

```
git add app/api/v1/events/[id]/submit/route.ts
git commit -m "feat: submit route always publishes directly (no pending state)"
```

---

## Task 3: Delete approve, reject, revise routes

**Files:**
- Delete: `app/api/v1/events/[id]/approve/route.ts`
- Delete: `app/api/v1/events/[id]/reject/route.ts`
- Delete: `app/api/v1/events/[id]/revise/route.ts`

- [ ] **Step 1: Delete the three route files**

```
Remove-Item app/api/v1/events/[id]/approve/route.ts
Remove-Item app/api/v1/events/[id]/reject/route.ts
Remove-Item app/api/v1/events/[id]/revise/route.ts
```

Also remove the empty directories if they exist:
```
Remove-Item -Recurse app/api/v1/events/[id]/approve
Remove-Item -Recurse app/api/v1/events/[id]/reject
Remove-Item -Recurse app/api/v1/events/[id]/revise
```

- [ ] **Step 2: Compile check**

```
pnpm tsc --noEmit
```

Expected: no new errors from these deletions (the files had no cross-imports except from tests).

- [ ] **Step 3: Commit**

```
git add -A app/api/v1/events/[id]/approve app/api/v1/events/[id]/reject app/api/v1/events/[id]/revise
git commit -m "feat: remove approve, reject, revise API routes (no approval workflow)"
```

---

## Task 4: Allow editing approved events in `lib/events/crud.ts`

Currently `updateDraft` returns `invalid_state` when a non-admin editor tries to PATCH a `pending` or `approved` event. With no approval flow, approved events must be directly editable by their owner. We also need to write an `'edited'` revision row when an approved event is updated.

**Files:**
- Modify: `lib/events/crud.ts`

- [ ] **Step 1: Add the import for `eventRevisions`**

At the top of `lib/events/crud.ts`, add `eventRevisions` to the schema import:

Current line 4:
```typescript
import { eventGrades, events } from "@/lib/db/schema";
```

Replace with:
```typescript
import { eventGrades, eventRevisions, events } from "@/lib/db/schema";
```

- [ ] **Step 2: Remove the `invalid_state` guard and add `'edited'` audit write**

In `updateDraft`, remove lines 107-109 (the `invalid_state` guard):
```typescript
    // PRD §6.3 — pending events are awaiting admin decision and must not be
    // mutated. Approved events are public; edits go through /revise (which
    // produces a new pending row tied via parent_event_id).
    if (!isAdmin && (current.status === "pending" || current.status === "approved")) {
      return { status: "invalid_state" as const };
    }
```

Then, inside the `withSchool` block, after the `tx.update(events)...returning({ version })` call (which sets `result.status = "ok"`), add an audit write when the event was already approved:

Replace the entire `withSchool` closure body in `updateDraft` with:

```typescript
  const result = await withSchool(schoolId, async (tx) => {
    const [current] = await tx
      .select({
        version: events.version,
        createdBy: events.createdBy,
        status: events.status,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!current) return { status: "not_found" as const };
    if (!isAdmin && current.createdBy !== userId) {
      return { status: "not_found" as const };
    }

    // Optimistic concurrency check (WIZARD-09)
    if (expectedVersion !== null && current.version !== expectedVersion) {
      return { status: "conflict" as const };
    }

    const updateSet: EventUpdate = {
      version: current.version + 1,
      updatedAt: new Date(),
    };
    if (eventFields.title !== undefined) updateSet.title = eventFields.title;
    if (eventFields.description !== undefined) updateSet.description = eventFields.description;
    if (eventFields.location !== undefined) updateSet.location = eventFields.location;
    if (eventFields.startAt !== undefined) updateSet.startAt = new Date(eventFields.startAt);
    if (eventFields.endAt !== undefined) updateSet.endAt = new Date(eventFields.endAt);
    if (eventFields.allDay !== undefined) updateSet.allDay = eventFields.allDay;
    if (eventFields.eventTypeId !== undefined) updateSet.eventTypeId = eventFields.eventTypeId;

    const [updated] = await tx
      .update(events)
      .set(updateSet)
      .where(eq(events.id, eventId))
      .returning({ version: events.version });

    if (current.status === "approved") {
      await tx.insert(eventRevisions).values({
        eventId,
        schoolId,
        snapshot: current as unknown as Record<string, unknown>,
        submittedBy: userId,
        decision: "edited",
      });
    }

    return { status: "ok" as const, version: updated.version };
  });
```

Also remove the `invalid_state` case from the `UpdateDraftResult` type at the top of `crud.ts`:

```typescript
export type UpdateDraftResult =
  | { status: "ok"; version: number }
  | { status: "conflict" }
  | { status: "not_found" };
```

- [ ] **Step 3: Fix the PATCH route that checked for `invalid_state`**

In `app/api/v1/events/[id]/route.ts`, remove the `invalid_state` response block (lines 88-93):

```typescript
  if (result.status === "invalid_state") {
    return NextResponse.json(
      { error: "invalid_state", hint: "Use POST /revise for approved events" },
      { status: 409 },
    );
  }
```

- [ ] **Step 4: Compile check**

```
pnpm tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```
git add lib/events/crud.ts app/api/v1/events/[id]/route.ts
git commit -m "feat: allow editors to directly edit their approved events with audit trail"
```

---

## Task 5: Update `lib/events/revisions.ts` — remove dead query functions

**Files:**
- Modify: `lib/events/revisions.ts`

- [ ] **Step 1: Remove `listPendingForQueue`, `QueueRow`, `getRejectedForEditor`, `RejectedEventRow`**

Keep only `getRevisionsForEvent` and `EventRevisionRow`. The file becomes:

```typescript
import "server-only";
import { desc, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions } from "@/lib/db/schema";

export interface EventRevisionRow {
  id: string;
  eventId: string;
  decision: string | null;
  reason: string | null;
  submittedBy: string | null;
  decidedBy: string | null;
  createdAt: Date;
}

/**
 * Returns the full revision history for an event, newest-first.
 */
export async function getRevisionsForEvent(
  schoolId: string,
  eventId: string,
): Promise<EventRevisionRow[]> {
  return withSchool(schoolId, (tx) =>
    tx
      .select({
        id: eventRevisions.id,
        eventId: eventRevisions.eventId,
        decision: eventRevisions.decision,
        reason: eventRevisions.reason,
        submittedBy: eventRevisions.submittedBy,
        decidedBy: eventRevisions.decidedBy,
        createdAt: eventRevisions.createdAt,
      })
      .from(eventRevisions)
      .where(eq(eventRevisions.eventId, eventId))
      .orderBy(desc(eventRevisions.createdAt)),
  );
}
```

- [ ] **Step 2: Compile check**

```
pnpm tsc --noEmit
```

Expected: errors from files that imported `listPendingForQueue` / `getRejectedForEditor` — those are the queue page and rejected page, handled in next tasks.

- [ ] **Step 3: Commit**

```
git add lib/events/revisions.ts
git commit -m "refactor: remove pending queue and rejected editor queries from revisions.ts"
```

---

## Task 6: Update `lib/events/queries.ts` — dashboard shows draft + approved

**Files:**
- Modify: `lib/events/queries.ts`

- [ ] **Step 1: Update `getEditorDashboardEvents` to include `approved`, drop `pending`/`rejected`**

Find the `getEditorDashboardEvents` function (lines 73-98). Change the `inArray` filter from `["draft", "pending"]` to `["draft", "approved"]`:

Old:
```typescript
          inArray(events.status, ["draft", "pending"]),
```

New:
```typescript
          inArray(events.status, ["draft", "approved"]),
```

Also update the `DashboardEvent` type (lines 59-67) — the status field can stay as-is since the enum still has all values, but update the JSDoc comment above `getEditorDashboardEvents`:

Old comment:
```typescript
 * Returns the calling editor's non-deleted draft and pending events,
 * ordered most-recently-updated first (WIZARD-07).
```

New comment (remove the comment entirely or update it):
```typescript
 * Returns the calling editor's non-deleted draft and approved events,
 * ordered most-recently-updated first.
```

- [ ] **Step 2: Compile check**

```
pnpm tsc --noEmit
```

Expected: no errors from this change.

- [ ] **Step 3: Commit**

```
git add lib/events/queries.ts
git commit -m "feat: dashboard shows editor draft and approved events (no pending/rejected)"
```

---

## Task 7: Delete queue page and rejected page

**Files:**
- Delete: `app/(admin)/admin/queue/page.tsx`
- Delete: `components/admin/QueueTable.tsx`
- Delete: `app/(staff)/dashboard/rejected/page.tsx`

- [ ] **Step 1: Delete the files**

```
Remove-Item "app/(admin)/admin/queue/page.tsx"
Remove-Item "components/admin/QueueTable.tsx"
Remove-Item "app/(staff)/dashboard/rejected/page.tsx"
```

- [ ] **Step 2: Compile check**

```
pnpm tsc --noEmit
```

Expected: no errors (these files had no external importers).

- [ ] **Step 3: Commit**

```
git add -A "app/(admin)/admin/queue" "components/admin/QueueTable.tsx" "app/(staff)/dashboard/rejected"
git commit -m "feat: remove admin queue page and editor rejected events page"
```

---

## Task 8: Update dashboard page — remove rejected link and pending status badge

**Files:**
- Modify: `app/(staff)/dashboard/page.tsx`

- [ ] **Step 1: Remove the "rejected events" link from the header**

In `app/(staff)/dashboard/page.tsx`, find and remove the `<Link href="/dashboard/rejected" ...>` block (lines 25-31):

```typescript
          <Link
            href="/dashboard/rejected"
            className="text-sm text-blue-600 hover:underline"
          >
            {t("rejected.linkLabel")}
          </Link>
```

Remove only this `<Link>` — keep the "New event" link.

- [ ] **Step 2: Update `StatusBadge` styles — remove unused pending/rejected entries**

Find the `styles` object in the `StatusBadge` function (lines 81-86). Remove the `pending` and `rejected` entries since they can no longer appear:

```typescript
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    approved: "bg-green-100 text-green-800",
  };
```

- [ ] **Step 3: Update the "resume" link condition — approved events can also be resumed/edited**

Find the conditional that renders the resume link (lines 63-69):
```typescript
                {event.status === "draft" && (
                  <Link
                    href={`/events/new?resumeId=${event.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t("resume")}
                  </Link>
                )}
```

Since approved events are now directly editable via the wizard, expose the same link for them too. Change the condition:
```typescript
                {(event.status === "draft" || event.status === "approved") && (
                  <Link
                    href={`/events/new?resumeId=${event.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {event.status === "draft" ? t("resume") : t("edit")}
                  </Link>
                )}
```

- [ ] **Step 4: Compile check**

```
pnpm tsc --noEmit
```

Expected: a type error on `t("edit")` if the key doesn't exist yet in messages. If so, add `"edit": "ערוך"` / `"edit": "Edit"` to `messages/he.json` and `messages/en.json` under `"dashboard"` before fixing the type.

- [ ] **Step 5: Commit**

```
git add "app/(staff)/dashboard/page.tsx"
git commit -m "feat: dashboard shows approved events with edit link, remove rejected link"
```

---

## Task 9: Update locale strings

**Files:**
- Modify: `messages/he.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Update `messages/he.json`**

Make these changes:

1. In `wizard.step7`: change `"submit"` and `"title"`:
```json
"step7": {
  "title": "סיכום ופרסום",
  "submit": "פרסם אירוע",
  "submitting": "מפרסם…",
  "submitError": "הפרסום נכשל"
}
```

2. In `dashboard`: update `"status"` labels and remove the `"rejected"` subsection. Add `"edit"` key:
```json
"dashboard": {
  "title": "לוח בקרה",
  "newEvent": "אירוע חדש",
  "empty": "אין אירועים עדיין. לחץ על \"אירוע חדש\" כדי להתחיל.",
  "resume": "המשך",
  "edit": "ערוך",
  "status": {
    "draft": "טיוטה",
    "approved": "פורסם"
  }
}
```

- [ ] **Step 2: Update `messages/en.json`**

Same structure:

1. In `wizard.step7`:
```json
"step7": {
  "title": "Review & publish",
  "submit": "Publish event",
  "submitting": "Publishing…",
  "submitError": "Publish failed"
}
```

2. In `dashboard`:
```json
"dashboard": {
  "title": "Dashboard",
  "newEvent": "New event",
  "empty": "No events yet. Click \"New event\" to start.",
  "resume": "Resume",
  "edit": "Edit",
  "status": {
    "draft": "Draft",
    "approved": "Published"
  }
}
```

- [ ] **Step 3: Compile check**

```
pnpm tsc --noEmit
```

Expected: no type errors (next-intl uses the JSON keys for type inference — removing unused keys is fine).

- [ ] **Step 4: Commit**

```
git add messages/he.json messages/en.json
git commit -m "feat: update locale strings for direct publish (remove approval/rejection labels)"
```

---

## Task 10: Update the wizard — `getDraftForResume` must accept approved events

The wizard's resume flow (`?resumeId=`) calls `getDraftForResume` which checks `eq(events.createdBy, staffUserId)` but does NOT filter by status. However, if an approved event is opened for editing, the wizard will eventually PATCH it (which now works) and submit it. There is one edge case: the wizard creates a new draft via POST when `eventId` is null. For resume, `eventId` is set from the URL, so the wizard won't POST again — it will just PATCH the existing event. The publish button still calls `/submit` which calls `publishEvent` → but `publishEvent` only accepts `status='draft'`. **Fix:** `publishEvent` must also accept `approved` events (i.e., it's a no-op re-publish, or we treat it as "ensure approved").

**Files:**
- Modify: `lib/events/approval.ts`

- [ ] **Step 1: Update `publishEvent` to accept already-approved events**

Change the `where` clause from checking `eq(events.status, "draft")` to accepting both `draft` and `approved`. For an already-approved event, skip the status update (it's already approved) but still write an `'edited'` revision:

```typescript
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { eventRevisions, events } from "@/lib/db/schema";

/**
 * Transitions a draft event directly to approved, or confirms an already-approved event.
 * Any active editor or admin may call this on their own draft or approved event.
 * Writes a 'published' revision row for the audit log.
 *
 * Throws Response(404) if not found or not in a publishable status.
 */
export async function publishEvent(
  schoolId: string,
  eventId: string,
  actorId: string,
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          inArray(events.status, ["draft", "approved"]),
        ),
      )
      .limit(1);

    if (!event) throw new Response("Not found or not publishable", { status: 404 });

    if (event.status === "draft") {
      await tx
        .update(events)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(events.id, eventId));
    }

    await tx.insert(eventRevisions).values({
      eventId,
      schoolId,
      snapshot: event as unknown as Record<string, unknown>,
      decidedBy: actorId,
      decision: event.status === "draft" ? "published" : "edited",
    });
  });
}
```

- [ ] **Step 2: Compile check**

```
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add lib/events/approval.ts
git commit -m "fix: publishEvent accepts approved events (supports editing published event via wizard)"
```

---

## Task 11: Update integration tests

The `test/integration/approval.test.ts` file tests the old state machine. Replace all tests with tests that cover the new `publishEvent` function and direct editing of approved events.

**Files:**
- Modify: `test/integration/approval.test.ts`
- Modify: `test/unit/events/approval.test.ts`

- [ ] **Step 1: Replace `test/integration/approval.test.ts`**

```typescript
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { desc, and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { publishEvent } from "@/lib/events/approval";
import { getRevisionsForEvent } from "@/lib/events/revisions";
import { createDraft, updateDraft } from "@/lib/events/crud";
import { testDb, skipIfNoTestDb, testSchoolA, testSchoolB } from "./setup";

async function ensureEditor(schoolId: string, email: string, role: "editor" | "admin") {
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(and(eq(schema.staffUsers.schoolId, schoolId), eq(schema.staffUsers.email, email)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: email, role })
    .returning();
  return row;
}

async function eventTypeFor(schoolId: string): Promise<string> {
  const [t] = await testDb!
    .select()
    .from(schema.eventTypes)
    .where(eq(schema.eventTypes.schoolId, schoolId))
    .limit(1);
  return t.id;
}

describe.skipIf(skipIfNoTestDb)("PUBLISH-01: publishEvent transitions draft → approved", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "publish-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("changes status to approved and writes a 'published' revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].decision).toBe("published");
    expect(revisions[0].decidedBy).toBe(editorId);
  });

  it("throws 404 when event is not found", async () => {
    await expect(publishEvent(testSchoolA, randomUUID(), editorId)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe.skipIf(skipIfNoTestDb)("PUBLISH-02: publishEvent on already-approved event writes 'edited' revision", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "publish-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("re-publishing an approved event writes 'edited' revision, status stays approved", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await publishEvent(testSchoolA, id, editorId);
    await publishEvent(testSchoolA, id, editorId);

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const decisions = revisions.map((r) => r.decision);
    expect(decisions).toContain("published");
    expect(decisions).toContain("edited");
  });
});

describe.skipIf(skipIfNoTestDb)("PUBLISH-03: updateDraft allows editing approved events", () => {
  let editorId: string;
  let eventTypeId: string;
  beforeAll(async () => {
    const editor = await ensureEditor(testSchoolA, "publish-editor@test", "editor");
    editorId = editor.id;
    eventTypeId = await eventTypeFor(testSchoolA);
  });

  it("PATCH on approved event succeeds and writes 'edited' revision", async () => {
    const { id } = await createDraft(testSchoolA, editorId, eventTypeId);
    await updateDraft(testSchoolA, id, editorId, false, { title: "גרסה 1" }, null);
    await publishEvent(testSchoolA, id, editorId);

    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "גרסה 2" }, null);
    expect(result.status).toBe("ok");

    const [row] = await testDb!.select().from(schema.events).where(eq(schema.events.id, id));
    expect(row.title).toBe("גרסה 2");
    expect(row.status).toBe("approved");

    const revisions = await getRevisionsForEvent(testSchoolA, id);
    const editedRevision = revisions.find((r) => r.decision === "edited");
    expect(editedRevision).toBeDefined();
  });

  it("cross-school: editor cannot edit another school's event", async () => {
    const editorB = await ensureEditor(testSchoolB, "publish-editor-b@test", "editor");
    const typeB = await eventTypeFor(testSchoolB);
    const { id } = await createDraft(testSchoolB, editorB.id, typeB);
    await publishEvent(testSchoolB, id, editorB.id);

    // Try editing School B event from School A context
    const result = await updateDraft(testSchoolA, id, editorId, false, { title: "hack" }, null);
    expect(result.status).toBe("not_found");
  });
});
```

- [ ] **Step 2: Replace `test/unit/events/approval.test.ts`**

```typescript
import { describe, it } from "vitest";

describe("publishEvent: valid transitions", () => {
  it.todo("draft → approved is a valid transition (publishEvent)");
  it.todo("approved → approved stays approved (re-publish writes 'edited' revision)");
});

describe("publishEvent: invalid transitions throw", () => {
  it.todo("publishEvent on non-existent event throws 404");
});
```

- [ ] **Step 3: Run integration tests**

```
pnpm test test/integration/approval.test.ts
```

Expected: all `PUBLISH-*` tests pass. If a test DB is not available, they are skipped (that's fine).

- [ ] **Step 4: Run full test suite**

```
pnpm test
```

Expected: tests that referenced `submitForApproval`, `approveEvent`, `rejectEvent`, `editApprovedEvent`, `listPendingForQueue`, `getRejectedForEditor` fail. Fix or remove those references in the test files. The main ones to check:
- `test/integration/events-api.test.ts` — may test submit returning "pending"
- `test/integration/wizard.test.ts` — may test submit flow

- [ ] **Step 5: Commit**

```
git add test/integration/approval.test.ts test/unit/events/approval.test.ts
git commit -m "test: replace approval workflow tests with publishEvent and direct-edit tests"
```

---

## Task 12: Fix remaining test files that reference removed symbols

Run `pnpm test` and fix any remaining failures from deleted symbols.

**Files affected (check each):**
- `test/integration/events-api.test.ts`
- `test/integration/wizard.test.ts`

- [ ] **Step 1: Run tests and identify failures**

```
pnpm test 2>&1 | Select-String "FAIL|Error|Cannot find"
```

- [ ] **Step 2: Fix `events-api.test.ts` — update submit assertions**

Find any assertion that checks `status === "pending"` after calling the submit endpoint, and change it to `status === "approved"`. Find any import of `submitForApproval`, `approveEvent`, `rejectEvent` or similar and remove/replace.

- [ ] **Step 3: Fix `wizard.test.ts` — same pattern**

Find assertions that check for `"pending"` status after submit, change to `"approved"`.

- [ ] **Step 4: Run full test suite again**

```
pnpm test
```

Expected: all tests pass (or are skipped due to no test DB).

- [ ] **Step 5: Commit**

```
git add test/integration/events-api.test.ts test/integration/wizard.test.ts
git commit -m "test: update events-api and wizard tests for direct publish flow"
```

---

## Task 13: Final build verification

- [ ] **Step 1: Full TypeScript check**

```
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Lint**

```
pnpm lint
```

Expected: zero errors or warnings.

- [ ] **Step 3: Full test run**

```
pnpm test
```

Expected: all tests pass (integration tests skip if no DB).

- [ ] **Step 4: Production build**

```
pnpm build
```

Expected: build succeeds with no type or compile errors.

- [ ] **Step 5: Commit if any fixes were needed**

```
git add -A
git commit -m "fix: resolve final lint and build issues post-approval-removal"
```

---

## Verification Checklist

After completing all tasks, manually verify:

1. **Publish flow:** Log in as an editor → create a new event through the 7-step wizard → click "פרסם אירוע" → event appears on the public Gantt/agenda within 5 seconds.
2. **Edit approved event:** From the dashboard, click "ערוך" on a published event → wizard opens with existing data → change something → click "פרסם אירוע" → change appears on public views within 5 seconds.
3. **Dashboard:** Only shows `draft` and `approved` (published) events. No "rejected events" link. Published events show "פורסם" badge.
4. **Admin queue:** `/admin/queue` returns 404 (page deleted).
5. **No leakage:** RLS still enforces school isolation — events from school B are not visible in school A context.
