# Public Viewer Performance Design

## Goal

Make the public school viewer faster to load and cheaper to keep fresh without changing event visibility, permissions, database schema, RLS behavior, or the six-year calendar browsing scope.

## Approved Scope

1. Split public Gantt, calendar, and agenda rendering into view-specific client chunks. The initially selected view remains server-renderable; inactive views load on demand and are prefetched while the browser is idle.
2. Build the expensive calendar projection only when the calendar view or the print flow needs it. The existing six-year range stays unchanged.
3. Pause signature polling while a document is hidden and refresh once it becomes visible. Visible pages retain the five-second refresh interval.
4. Make the public events endpoint load only its event payload instead of the full viewer payload (event types and signature are not needed by that endpoint). Cache tags and invalidation after event edits/publishes remain unchanged.
5. Skip Supabase auth refresh only for unauthenticated public data endpoints and token-gated iCal feeds, which do not render session-dependent UI.

## Non-goals

- No migrations, SQL/index changes, RLS changes, payload schema changes, or event filtering changes.
- No change to the calendar's six-year browsing range, typography, or public/staff route semantics.
- No real-time transport migration; polling remains the freshness mechanism.

## Safety and Verification

Existing public-view payload schemas, cache tags, and event mutation invalidation stay in place. Unit tests cover visibility-aware refresh eligibility, endpoint-specific loading, and middleware bypass classification; public-view tests cover the lazy view boundary. The full unit suite, type check, and production build must pass before handoff.
