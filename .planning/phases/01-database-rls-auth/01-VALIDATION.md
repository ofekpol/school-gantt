---
phase: 1
slug: database-rls-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` (needs node project block for integration tests — Wave 0) |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~30 seconds (unit) / ~90 seconds (integration with real Postgres) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-schema | 01 | 1 | DB-01 | type-check | `pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| 1-rls | 01 | 1 | DB-02, DB-03 | integration | `pnpm test test/integration/rls` | ❌ W0 | ⬜ pending |
| 1-withschool | 01 | 1 | DB-03 | integration | `pnpm test test/integration/withSchool` | ❌ W0 | ⬜ pending |
| 1-eslint | 01 | 1 | DB-04 | lint | `pnpm lint` | ❌ W0 | ⬜ pending |
| 1-seed | 01 | 1 | DB-05, DB-06 | integration | `pnpm tsx db/seed.ts` | ❌ W0 | ⬜ pending |
| 1-session | 02 | 2 | AUTH-01 | unit | `pnpm test test/unit/auth/session` | ❌ W0 | ⬜ pending |
| 1-scopes | 02 | 2 | AUTH-01, AUTH-05 | unit | `pnpm test test/unit/auth/scopes` | ❌ W0 | ⬜ pending |
| 1-lockout | 02 | 2 | AUTH-03 | integration | `pnpm test test/integration/lockout` | ❌ W0 | ⬜ pending |
| 1-public | 02 | 2 | AUTH-07 | integration | `pnpm test test/integration/public-routes` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — add `environment: 'node'` project block for integration tests alongside existing jsdom block
- [ ] `test/integration/setup.ts` — Postgres connection fixtures using `TEST_DATABASE_URL`
- [ ] `test/integration/rls.test.ts` — stubs for DB-02 cross-school isolation (positive + negative cases)
- [ ] `test/unit/auth/session.test.ts` — stubs for AUTH-01 `getSession()` helper
- [ ] `test/unit/auth/scopes.test.ts` — stubs for AUTH-05 `assertEditorScope()`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password reset email delivered | AUTH-02 | Resend SMTP relay configured in Supabase dashboard, not code | Trigger password reset flow, check inbox |
| Admin reaches protected route after login | AUTH-04 | Browser session flow | Log in as seed admin, navigate to /admin |
| Account locked after 10 attempts | AUTH-03 | Partial — lockout counter is automated; UI messaging is manual | Make 10 failed attempts, verify locked_until is set |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
