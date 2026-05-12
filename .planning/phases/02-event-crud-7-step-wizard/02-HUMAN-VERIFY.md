# Phase 2 — Human Verification Checklist

Three UI-level gaps from 02-VERIFICATION.md require manual confirmation. Code is already deployed; this file is the test plan.

## 1. WIZARD-08 — Soft-delete UI trigger on dashboard

**Test:**
1. Log in as a seed editor.
2. Navigate to `/dashboard`.
3. Locate a draft event in the list.

**Expected:** A delete button (or kebab menu with a delete action) is visible on each draft row. Clicking it soft-deletes the event and it disappears from the list after a router.refresh.

**Known state:** `app/(staff)/dashboard/page.tsx` does not currently render a delete button. The DELETE API route exists (`/api/v1/events/[id]`). If the human test confirms the button is missing, file a follow-up task to add it (Phase 3 candidate).

## 2. WIZARD-09 — Concurrent edit conflict toast

**Test:**
1. Open the same draft event in two browser tabs (`/events/new?resumeId=<id>`).
2. In tab 1, advance one step (autosave fires).
3. In tab 2, advance one step (sends a stale `If-Match`).

**Expected:** Tab 2 displays a toast/banner explaining that someone else edited the event and prompts to reload.

**Known state:** `components/wizard/WizardShell.tsx` throws a plain error on non-OK PATCH responses but does NOT surface a toast on HTTP 409. The PATCH route DOES return 409 with `{status:"conflict"}`. The gap is purely client-side UX. If the human test confirms no toast appears, file a follow-up task to wire `sonner` (or equivalent) to the 409 branch.

## 3. WIZARD-03 — Resume populates all step fields

**Test:**
1. As editor, complete wizard steps 1 through 4 (date, grades, event type, title).
2. Close the browser tab.
3. Open `/dashboard`, click "המשך" on the draft.
4. Step through the wizard from step 1.

**Expected:** Steps 1, 2, 3, 4 all show the previously entered values pre-filled. The wizard does not start blank.

**Known state:** `WizardShell.tsx` initializes state from `resumeDraft` using only `title`, `startAt`, `endAt`, `allDay`, `eventTypeId`. It does NOT restore `date` (Step 1), `grades` (Step 2), `responsibleText`, or `requirementsText` (Step 6). If the human test confirms the partial restore, file a follow-up task to extend the resume mapping in `WizardShell.tsx`.

## Resolution

Each item above is a UI/UX bug rather than a data-layer gap. Phase 2 verification accepts these as deferred Phase 3 follow-ups; they do not block Phase 3 planning. Re-verify after Phase 3 introduces the rejected-events surface and revises the wizard prefill.
