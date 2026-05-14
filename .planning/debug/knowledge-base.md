# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## e2e-failing-tests — 4 prd14 Playwright tests failing (wizard, filters, ical, approval)
- **Date:** 2026-05-14
- **Error patterns:** ENOENT auth state, vendor chunk missing, wizard strict mode, array ANY() type mismatch, Request context disposed, Revoke button visible, toHaveURL grades=10, no active year
- **Root cause:** Multiple independent layers: (1) WizardShell.save() posted to /api/v1/events at Step 1 without required eventTypeId (Steps 1-2 must buffer locally); (2) FilterBar startTransition deferred router.replace + click-before-hydration under parallel load; (3) iCal locator.first() matched wrong subscription when multiple exist; (4) approval test approved wrong queue item; (5) missing global.setup.ts auth state; (6) Drizzle ANY($n) array type mismatch; (7) updateAcademicYear "No values to set" on setActive-only PATCH
- **Fix:** Defer wizard draft creation to Step 3; remove startTransition from FilterBar; use retry-loop for filter URL; target specific subscription row by token; approve by eventId via API; create global.setup.ts; use sql.join IN() for grade filter; handle setActive-only PATCH in years.ts
- **Files changed:** components/wizard/WizardShell.tsx, components/FilterBar.tsx, components/staff/ProfileSubscriptions.tsx, lib/views/agenda.ts, lib/admin/years.ts, playwright.config.ts, test/e2e/global.setup.ts, test/e2e/prd14-approval.spec.ts, test/e2e/prd14-filters.spec.ts, test/e2e/prd14-ical.spec.ts, test/e2e/prd14-wizard.spec.ts
---

