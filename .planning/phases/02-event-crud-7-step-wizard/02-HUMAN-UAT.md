---
status: partial
phase: 02-event-crud-7-step-wizard
source: [02-VERIFICATION.md]
started: 2026-05-12T00:00:00Z
updated: 2026-05-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. WIZARD-08: Soft-delete UI trigger
expected: Log in as editor, open dashboard, find a draft event — verify a delete button is present and clicking it soft-deletes the event (disappears from list). Non-draft events have no delete button.
result: [pending]

### 2. WIZARD-09: Concurrent edit conflict toast
expected: Open same draft in two browser tabs. Advance a step in tab 1. Then advance a step in tab 2 (stale version). Tab 2 should show a toast/warning that a conflict was detected.
result: [pending]

### 3. WIZARD-03: Resume with fully populated step data
expected: Complete steps 1-4, close browser, reopen /dashboard, click "Continue". Wizard should open with title, event type, dates, AND grades pre-filled from DB.
result: [pending]

### 4. RTL layout correctness
expected: Navigate each wizard step and admin page in Hebrew RTL browser. All text alignment, button placement, and form field direction should be correct (text-start/text-end, logical CSS properties).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
