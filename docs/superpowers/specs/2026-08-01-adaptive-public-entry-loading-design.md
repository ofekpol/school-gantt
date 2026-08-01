# Adaptive public entry loading

## Goal

Make a first visit to a public school calendar feel deliberate rather than blank while preserving the fastest possible path when data is already available. The loading UI must never impose a minimum display duration.

## Scope

This applies to direct loads and refreshes of `/{school}`, `/{school}/calendar`, and `/{school}/agenda`. It does not replay a full-screen entrance on client-side tab changes; existing route-progress feedback remains responsible for those transitions.

## Design

### Immediate server-rendered entry UI

Add a viewer route loading boundary that renders a lightweight branded entry panel. It uses no data fetching, no custom web fonts beyond the already-preloaded UI font, and no large client-only dependency. The panel includes the school-calendar identity, a restrained motion-safe animation, an accessible status announcement, and a small preview-shaped skeleton rather than a generic spinner.

Next.js streams this boundary while the selected public view fetches its data. If the route resolves quickly, React replaces it immediately; there is no timer, artificial hold, or forced animation completion.

### Faster public route preparation

The public viewer layout should not validate a Supabase session before rendering public content. Its only current authenticated behavior is an optional logout affordance, which is not worth delaying a public page. The page data loader continues to fetch the school, event types, events, and signature, using the existing five-second cache/tag behaviour. School resolution is shared per request to avoid duplicate lookup work between the viewer layout and public page.

### Background tab preloading

The initially selected view remains the only essential view. After it becomes interactive, use an idle callback (with a timeout fallback) to preload the Calendar and Agenda view chunks. This must not block the initial Gantt rendering or cause an additional data fetch. The existing dynamic imports and idle-prefetch mechanism are reused or tightened rather than replacing the navigation model.

## Data flow

1. Browser requests a public viewer route.
2. The server immediately streams the entry loading boundary.
3. Server resolves the school and public event payload, with no public-route auth round trip.
4. The public shell replaces the loading UI as soon as its first view is renderable.
5. Once interactive and idle, inactive tab chunks are prefetched for later navigation.

## Accessibility and resilience

The loading state will have `role="status"` and a translated `aria-live` label. Decorative animation is hidden from assistive technology and respects `prefers-reduced-motion`. If an inactive chunk prefetch fails, it is ignored; selecting the relevant tab continues to use its normal dynamic-import loading fallback. Existing `notFound()` behaviour for unknown schools remains unchanged.

## Verification

- Unit-test the public route auth-bypass and any extracted request-scoped school-resolution helper.
- Add component coverage for the entry panel's accessible loading state and reduced-motion-safe markup.
- Run `pnpm tsc --noEmit`, focused Vitest tests, and `pnpm build`.
- Run the production build locally and compare a cold direct load against the current path using browser Network/Performance timing, confirming the entry UI paints before the public data request completes and that a cached load is not artificially delayed.

## Non-goals

- Do not preload every application route, staff dashboard code, or protected data.
- Do not add a fixed splash-screen duration.
- Do not change public cache freshness (five seconds) or authentication rules for protected routes.
