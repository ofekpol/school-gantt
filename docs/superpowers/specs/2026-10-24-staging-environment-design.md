# Staging environment — design

## Intent

Only production is deployed today. Every fix should ship to a private test environment
first, be verified there against production-like data, then be promoted to production.
The test environment matches production in code (when nothing is pending) and in data
(refreshed nightly).

## Decisions

- **Flow:** feature branch → PR into `staging` → verify on the staging URL → PR `staging` → `main`.
- **Hosting:** same Vercel project (`school-gantt`); `staging` is a long-lived branch deployed to the
  Preview target at `school-gantt-git-staging-ofekpols-projects.vercel.app`. Feature-branch previews
  also run against the test DB.
- **Database:** Supabase project `school-gantt-tests` in `eu-central-1` (same region as prod).
- **Data:** nightly GitHub Actions job copies prod `public` schema + `auth.users`/`auth.identities`
  into the test DB, then re-applies any staging-only migrations. Ad-hoc test rows are wiped nightly.
  Manual trigger available.
- **Accepted side effects:** real staff passwords and iCal tokens work on the test env.
- **Privacy:** Vercel SSO protection keeps every non-custom-domain URL private.
- **Email:** `RESEND_API_KEY` unset on Preview — all senders in `lib/email/*` no-op.
- **App URL:** `NEXT_PUBLIC_APP_URL` unset on Preview; routes fall back to request origin.

## Non-goals

Per-PR databases, PII scrubbing, custom staging domain, Storage bucket copy.

## Safety

- The refresh script only reads from prod (`pg_dump`), and refuses to run if the target URL
  is the prod project or equals the source.
