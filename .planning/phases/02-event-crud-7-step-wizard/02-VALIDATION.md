---
phase: 2
slug: event-crud-7-step-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit + integration) + Playwright (e2e) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test:coverage && pnpm playwright test` |
| **Estimated runtime** | ~60 seconds (unit/integration), ~120 seconds (e2e) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test:coverage && pnpm playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | WIZARD-01 | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | WIZARD-02 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | WIZARD-03 | e2e | `pnpm playwright test` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | WIZARD-04 | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | WIZARD-05 | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | WIZARD-06 | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | WIZARD-07 | e2e | `pnpm playwright test` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | WIZARD-08 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 2 | WIZARD-09 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | ADMIN-01 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 2 | ADMIN-02 | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 2-04-03 | 04 | 2 | ADMIN-03 | e2e | `pnpm playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/integration/events/wizard.test.ts` — stubs for WIZARD-01 through WIZARD-09
- [ ] `test/integration/admin/staff.test.ts` — stubs for ADMIN-01, ADMIN-02
- [ ] `test/e2e/wizard-flow.spec.ts` — stub for full wizard e2e (WIZARD-03)
- [ ] `test/e2e/admin-staff.spec.ts` — stub for admin staff management (ADMIN-03)
- [ ] Existing `vitest.config.ts` and Playwright config cover infrastructure; no new installs needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab close → resume draft | WIZARD-03 | Requires real browser session kill | Open wizard, fill step 1, close tab, reopen dashboard, verify draft present |
| Concurrent edit toast | WIZARD-09 | Race condition, hard to automate reliably | Open same event in two tabs, submit edit on tab 1, then submit on tab 2; expect toast on tab 2 |
| RTL wizard layout | WIZARD-01 | Visual/directional correctness | Verify wizard renders correctly in RTL with Hebrew labels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
