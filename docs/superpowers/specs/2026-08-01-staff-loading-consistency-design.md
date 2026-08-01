# Staff loading consistency

## Goal

Make authenticated staff dashboard loads feel consistent in Safari and Chrome: show an immediate, purposeful loading state before session/header work completes, then a dashboard-shaped placeholder while calendar data loads.

## Scope

This change applies to the protected staff route group, including `/dashboard` and event editing routes. Public viewer loading and admin routes are unchanged. Authentication and redirect decisions remain server-side and must complete before any protected child content renders.

## Design

### Stream above the async staff layout

Refactor `app/(staff)/layout.tsx` into a synchronous outer layout and an async guarded content component. The outer layout returns a React `Suspense` boundary immediately. Its fallback is a new `StaffEntryLoading` component with the same calm, motion-safe visual language as the public entry screen, but staff-neutral translated copy.

The async inner component retains every existing `getStaffUser()` status check and redirect, then renders the current header and children. The protected children remain inside that component, so no dashboard markup or school data can stream before authorization succeeds.

This directly addresses Safari's blank pre-layout phase: Next.js can stream the Suspense fallback while authentication is pending instead of waiting for the layout function itself to resolve.

### Eliminate duplicate request work

Memoize `getStaffUser()` for a single React server render using `cache()` from React. The staff layout and dashboard page then share one validated Supabase user lookup and one staff-user database lookup. The cache lifetime is request-bound; it does not persist users across requests and does not weaken JWT validation.

### Keep the second loading stage informative

Replace the staff route group's generic spinner with a small dashboard skeleton. It appears only after the authenticated header is available and while the dashboard page fetches its calendar data. It uses semantic loading status, respects reduced motion, and has no timer or forced display duration.

## Data flow

1. Browser requests an authenticated staff route.
2. Synchronous staff layout streams `StaffEntryLoading` immediately.
3. Inner layout validates JWT and staff status, redirecting as it does today when invalid.
4. Authorized request renders the staff header and the dashboard skeleton.
5. Dashboard reuses the request-cached staff record, fetches school/calendar data, and replaces the skeleton with the usable dashboard.

## Error handling and accessibility

The early fallback has `role="status"`, translated labels, decorative visuals hidden from assistive technology, and `motion-safe:` animation only. Authentication errors still use the existing redirect paths. Database failures continue to reach the existing error boundary; no protected error details are added to the client.

## Verification

- Unit-test both staff-entry and dashboard-skeleton loading states for accessible status text.
- Unit-test that repeated staff lookup calls share the request-scoped resolver.
- Test the staff layout's unauthenticated redirect and authorized header behavior with existing session mocks.
- Run `pnpm tsc --noEmit`, relevant unit tests, and `pnpm build`.
- Compare a cold `/dashboard` load in Safari and Chrome while signed in; both should immediately display the staff entry state, then header plus skeleton, with no forced timing.

## Non-goals

- Do not defer, move, or weaken authorization checks.
- Do not preload the full staff application or protected calendar data.
- Do not change admin-route behavior in this iteration.
