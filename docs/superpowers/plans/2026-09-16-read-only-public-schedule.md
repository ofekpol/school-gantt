# Read-Only Public Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/schedule` entry point, linked from the login screen, where anonymous visitors see a 2-tab (Weekly / Monthly) read-only public calendar with working grade/type/search filters, a "Log in" button, and no export or edit affordances.

**Architecture:** A new unauthenticated route (`app/(public)/schedule/page.tsx`) resolves the single school in this deployment and renders a new `ReadOnlyViewerShell` client component. `ReadOnlyViewerShell` and the existing `PublicViewerShell` both consume a newly extracted `usePublicViewerEvents` hook that owns event polling — the one piece of non-trivial logic genuinely shared between them. Everything else (filtering, tab state) is local and simple enough to stay duplicated rather than force a shared abstraction. `/schedule` never changes the URL when switching tabs, so a visitor can't tab their way into the full 3-tab public viewer.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript 5 strict, Tailwind, next-intl, Vitest + Testing Library, Playwright.

## Global Constraints

- Every school-scoped DB read goes through `lib/db/` — `app/(public)/schedule/page.tsx` must call `listSchools()`/`loadPublicViewerData()`, never a raw client (ESLint enforces this).
- No hardcoded `left`/`right` in layout/position styles — logical properties only (RTL).
- All new user-visible strings in `ReadOnlyViewerShell` go through `next-intl` `useTranslations`, Hebrew (`messages/he.json`) added before the English mirror (`messages/en.json`).
- Functions < 50 lines, files < 400 lines.
- No `any`.
- `pnpm build` must pass before this branch merges to `main` (per this repo's git workflow — never commit to `main` directly; this work stays on `feature/read-only-public-schedule`).
- Existing tests (`test/unit/views/public-viewer-shell.test.tsx`, `test/unit/views/public-viewer.test.ts`, `test/unit/views/public-viewer-data.test.ts`, `test/unit/public-viewer-entry-loading.test.tsx`) must keep passing **unmodified** — the refactor in Task 3 must not change `PublicViewerShell`'s external behavior.

---

### Task 1: Reserve and allow-list `/schedule` in the auth bypass logic

**Files:**
- Modify: `lib/auth/public-request.ts`
- Test: `test/unit/auth/public-request.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `shouldBypassAuthRefresh("/schedule")` returns `true`. `/schedule` is now reserved (no school can be given that slug — enforced only by convention here; there's no DB constraint, this task just makes it impossible for `/schedule` to collide with `/[school]` in the router).

- [ ] **Step 1: Write the failing test**

Add to `test/unit/auth/public-request.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldBypassAuthRefresh } from "@/lib/auth/public-request";

describe("shouldBypassAuthRefresh", () => {
  it("bypasses middleware auth refresh for public viewer paths", () => {
    expect(shouldBypassAuthRefresh("/demo-school/calendar")).toBe(true);
  });

  it("keeps the root and staff routes behind middleware authentication", () => {
    expect(shouldBypassAuthRefresh("/")).toBe(false);
    expect(shouldBypassAuthRefresh("/dashboard")).toBe(false);
  });

  it("bypasses middleware auth refresh for the read-only public schedule", () => {
    expect(shouldBypassAuthRefresh("/schedule")).toBe(true);
    expect(shouldBypassAuthRefresh("/schedule/anything")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify the new case fails**

Run: `pnpm test -- test/unit/auth/public-request.test.ts`
Expected: the first two `it` blocks PASS (already true today — `/schedule` already matches the generic single-segment regex), the third `it` block's first assertion (`/schedule` → `true`) already passes too since the existing regex allows any single top-level segment. The real point of this task is making the allow-listing **explicit** rather than accidental. Confirm the second assertion (`/schedule/anything` → `false`) passes as-is (two segments, not `/calendar` or `/agenda` suffix, so the regex already rejects it) — this locks in current behavior before Step 3 changes the mechanism.

- [ ] **Step 3: Update `lib/auth/public-request.ts`**

Replace the file with:

```ts
const PUBLIC_PREFIXES = [
  "/auth/login",
  "/auth/callback",
  "/auth/confirm",
  "/auth/register",
  "/auth/pending",
  "/auth/deactivated",
  "/auth/change-password",
  "/invite/",
  "/ical/",
  "/schedule",
  "/api/v1/auth/signin",
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/public/",
  "/api/v1/export/",
  "/api/v1/ical-subscriptions/personal",
];

const RESERVED_PREFIXES = [
  "/auth", "/invite", "/ical", "/api", "/admin",
  "/dashboard", "/events", "/profile", "/_next", "/schedule",
];

export function shouldBypassAuthRefresh(pathname: string): boolean {
  // "/" must stay gated: HomePage's own auth check runs after the shell has
  // already started streaming, so a redirect() there degrades to a client-side
  // <meta refresh> with a hardcoded ~1s delay instead of a real HTTP redirect.
  // Letting middleware redirect unauthenticated requests here keeps it instant.
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return (
    !RESERVED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
    /^\/[^/]+(\/calendar|\/agenda)?$/.test(pathname)
  );
}
```

Two changes from the original: `"/schedule"` added to `PUBLIC_PREFIXES` (explicit bypass — `startsWith("/schedule")` also means `/schedule` itself bypasses via this line now, not just the fallback regex), and `"/schedule"` added to `RESERVED_PREFIXES` (so if a future school slug ever collided with `schedule`, the fallback regex path would reject it — defense in depth, even though the explicit `PUBLIC_PREFIXES` entry already wins for exact `/schedule`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- test/unit/auth/public-request.test.ts`
Expected: PASS, all four assertions.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/public-request.ts test/unit/auth/public-request.test.ts
git commit -m "$(cat <<'EOF'
feat: reserve /schedule as the read-only public entry route

Explicitly allow-lists /schedule in the auth-bypass logic and reserves
the slug so no school can collide with it, ahead of wiring the actual
read-only viewer page in a later commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract `usePublicViewerEvents` — the shared event-polling hook

**Files:**
- Create: `lib/views/use-public-viewer-events.ts`
- Test: `test/unit/views/use-public-viewer-events.test.tsx`

**Interfaces:**
- Consumes: `PublicViewerEvent`, `shouldPollPublicViewer`, `shouldRefreshPublicEvents` from `@/lib/views/public-viewer`; `PublicViewerEventsResponseSchema`, `PublicViewerEventSignatureResponseSchema` from `@/lib/validations/public-viewer`.
- Produces: `usePublicViewerEvents({ schoolSlug, initialEvents, initialEventsSignature }): PublicViewerEvent[]` — a hook returning the current, kept-fresh event array. This is the exact polling behavior `PublicViewerShell` has today (5s interval while the tab is visible, skips the events fetch when the signature is unchanged, catches up immediately when the tab regains visibility), moved so `ReadOnlyViewerShell` (Task 4) can reuse it verbatim.

- [ ] **Step 1: Write the failing test**

Create `test/unit/views/use-public-viewer-events.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicViewerEvents } from "@/lib/views/use-public-viewer-events";
import type { PublicViewerEvent } from "@/lib/views/public-viewer";

const baseEvent: PublicViewerEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "טיול",
  startAt: "2026-09-15T06:00:00.000Z",
  endAt: "2026-09-15T09:00:00.000Z",
  allDay: false,
  description: null,
  location: null,
  eventTypeId: "type-1",
  eventTypeKey: "trip",
  eventTypeLabelHe: "טיול",
  eventTypeColor: "#0ea5e9",
  eventTypeGlyph: "compass",
  grades: [7, 8],
  status: "approved",
  isCanceled: false,
  isUpdated: false,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("usePublicViewerEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls every 5s and replaces events when the signature changes", async () => {
    const updated = { ...baseEvent, title: "עודכן" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ signature: "2:1:later" }))
      .mockResolvedValueOnce(jsonResponse({ events: [updated] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      usePublicViewerEvents({
        schoolSlug: "demo-school",
        initialEvents: [baseEvent],
        initialEventsSignature: "1:1:now",
      }),
    );

    expect(result.current).toEqual([baseEvent]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await waitFor(() => {
      expect(result.current[0]?.title).toBe("עודכן");
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/public/demo-school/events/signature");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/public/demo-school/events");
  });

  it("skips the events fetch when the signature is unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ signature: "1:1:now" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      usePublicViewerEvents({
        schoolSlug: "demo-school",
        initialEvents: [baseEvent],
        initialEventsSignature: "1:1:now",
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([baseEvent]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- test/unit/views/use-public-viewer-events.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/views/use-public-viewer-events'`.

- [ ] **Step 3: Write the hook**

Create `lib/views/use-public-viewer-events.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  shouldPollPublicViewer,
  shouldRefreshPublicEvents,
  type PublicViewerEvent,
} from "@/lib/views/public-viewer";
import {
  PublicViewerEventSignatureResponseSchema,
  PublicViewerEventsResponseSchema,
} from "@/lib/validations/public-viewer";

export interface UsePublicViewerEventsArgs {
  schoolSlug: string;
  initialEvents: PublicViewerEvent[];
  initialEventsSignature: string;
}

/**
 * Keeps a school's public event list fresh: polls every 5s while the tab is
 * visible, skips the network round-trip when the signature hasn't changed,
 * and catches up immediately when the tab regains visibility after being
 * hidden. Shared by every unauthenticated public viewer surface (the full
 * 3-tab PublicViewerShell and the 2-tab ReadOnlyViewerShell).
 */
export function usePublicViewerEvents({
  schoolSlug,
  initialEvents,
  initialEventsSignature,
}: UsePublicViewerEventsArgs): PublicViewerEvent[] {
  const [events, setEvents] = useState(initialEvents);
  const [eventsSignature, setEventsSignature] = useState(initialEventsSignature);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const wasDocumentHidden = useRef(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    void refreshEventsIfChanged(schoolSlug, eventsSignature).then((result) => {
      if (!result) return;
      startTransition(() => {
        setEventsSignature(result.signature);
        if (result.events) setEvents(result.events);
      });
    });
  }, [eventsSignature, schoolSlug, startTransition]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = shouldPollPublicViewer(!document.hidden);
      if (!visible) wasDocumentHidden.current = true;
      setIsDocumentVisible(visible);
      if (visible && wasDocumentHidden.current) {
        wasDocumentHidden.current = false;
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    if (!shouldPollPublicViewer(isDocumentVisible)) return;
    const interval = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(interval);
  }, [isDocumentVisible, refresh]);

  return events;
}

async function fetchEvents(schoolSlug: string): Promise<PublicViewerEvent[] | null> {
  const response = await fetch(`/api/v1/public/${schoolSlug}/events`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventsResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.events : null;
}

async function refreshEventsIfChanged(
  schoolSlug: string,
  currentSignature: string,
): Promise<{ signature: string; events: PublicViewerEvent[] | null } | null> {
  const nextSignature = await fetchEventsSignature(schoolSlug);
  if (!nextSignature) return null;
  if (!shouldRefreshPublicEvents(currentSignature, nextSignature)) {
    return { signature: nextSignature, events: null };
  }

  const events = await fetchEvents(schoolSlug);
  return events ? { signature: nextSignature, events } : null;
}

async function fetchEventsSignature(schoolSlug: string): Promise<string | null> {
  const response = await fetch(`/api/v1/public/${schoolSlug}/events/signature`);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const parsed = PublicViewerEventSignatureResponseSchema.safeParse(json);
  return parsed.success ? parsed.data.signature : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- test/unit/views/use-public-viewer-events.test.tsx`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add lib/views/use-public-viewer-events.ts test/unit/views/use-public-viewer-events.test.tsx
git commit -m "$(cat <<'EOF'
feat: extract usePublicViewerEvents polling hook

Pulls the event-polling logic (signature-diffed refresh, visibility-
gated 5s interval) out of PublicViewerShell so it can be reused by the
upcoming read-only public schedule shell without duplicating the
non-trivial parts (network calls, timers, visibility listener).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Refactor `PublicViewerShell` to consume the extracted hook

**Files:**
- Modify: `components/PublicViewerShell.tsx`

**Interfaces:**
- Consumes: `usePublicViewerEvents` from Task 2 (`@/lib/views/use-public-viewer-events`).
- Produces: no change to `PublicViewerShell`'s exported `Props` or rendered output — this is a pure internal refactor. Existing tests must keep passing unmodified.

- [ ] **Step 1: Confirm the baseline passes before touching anything**

Run: `pnpm test -- test/unit/views/public-viewer-shell.test.tsx test/unit/views/public-viewer.test.ts test/unit/views/public-viewer-data.test.ts test/unit/public-viewer-entry-loading.test.tsx`
Expected: PASS (all pre-existing tests green before the refactor).

- [ ] **Step 2: Replace the contents of `components/PublicViewerShell.tsx`**

```tsx
"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/AppHeader";
import { ExportToGoogleCalendarButton } from "@/components/ExportToGoogleCalendarButton";
import { FilterBar } from "@/components/FilterBar";
import { LoadingPanel } from "@/components/LoadingPanel";
import type { CalendarMonth, buildCalendarModel } from "@/lib/views/calendar";
import { parseWeekParam } from "@/lib/views/gantt-weekly";
import {
  filterPublicEvents,
  hydratePublicEvents,
  parsePublicViewerParams,
  serializePublicViewerParams,
  type PublicViewerEvent,
  type PublicViewerParams,
  type PublicViewerView,
} from "@/lib/views/public-viewer";
import type { PublicViewerEventType, PublicViewerYear } from "@/lib/views/public-viewer-data";
import { usePublicViewerEvents } from "@/lib/views/use-public-viewer-events";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];

const PublicGanttView = dynamic(() =>
  import("@/components/public/PublicGanttView").then((module) => module.PublicGanttView),
  { loading: () => <LoadingPanel compact /> },
);
const PublicCalendarView = dynamic(() =>
  import("@/components/public/PublicCalendarView").then((module) => module.PublicCalendarView),
  { loading: () => <LoadingPanel compact /> },
);
const PublicAgendaView = dynamic(() =>
  import("@/components/public/PublicAgendaView").then((module) => module.PublicAgendaView),
  { loading: () => <LoadingPanel compact /> },
);

interface Props {
  schoolSlug: string;
  schoolName: string;
  initialView: PublicViewerView;
  initialParams: PublicViewerParams;
  year: PublicViewerYear;
  eventTypes: PublicViewerEventType[];
  initialEvents: PublicViewerEvent[];
  initialEventsSignature: string;
}

export function PublicViewerShell({
  schoolSlug,
  schoolName,
  initialView,
  initialParams,
  year,
  eventTypes,
  initialEvents,
  initialEventsSignature,
}: Props) {
  const nav = useTranslations("nav");
  const gantt = useTranslations("gantt");
  const agenda = useTranslations("agenda");
  const [view, setViewState] = useState(initialView);
  const [params, setParamsState] = useState(initialParams);
  const events = usePublicViewerEvents({ schoolSlug, initialEvents, initialEventsSignature });
  const [printMonthKey, setPrintMonthKey] = useState(() =>
    monthKeyForDate(parseWeekParam(initialParams.week ?? undefined)),
  );
  const deferredView = useDeferredValue(view);
  const deferredParams = useDeferredValue(params);
  const deferredQuery = useDeferredValue(params.q);
  const eventTypesForFilter = useMemo(
    () =>
      eventTypes.map((type) => ({
        key: type.key,
        labelHe: type.labelHe,
        colorHex: type.colorHex,
      })),
    [eventTypes],
  );
  const filteredParams = useMemo(
    () => ({ ...deferredParams, q: deferredQuery }),
    [deferredParams, deferredQuery],
  );
  const filteredEvents = useMemo(
    () => filterPublicEvents(events, filteredParams),
    [events, filteredParams],
  );
  const hydratedEvents = useMemo(() => hydratePublicEvents(filteredEvents), [filteredEvents]);
  const [calendarMonths, setCalendarMonths] = useState<CalendarMonth[] | null>(null);
  const visibleGrades = useMemo(
    () => (params.grades.length > 0 ? params.grades : ALL_GRADES),
    [params.grades],
  );

  useEffect(() => {
    const syncFromLocation = () => {
      setViewState(viewFromPath(window.location.pathname, schoolSlug));
      setParamsState(parsePublicViewerParams(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [schoolSlug]);

  const updateUrl = useCallback(
    (nextView: PublicViewerView, nextParams: PublicViewerParams, mode: "push" | "replace") => {
      const query = serializePublicViewerParams(nextParams);
      const path = pathForView(schoolSlug, nextView);
      const nextUrl = query ? `${path}?${query}` : path;
      if (mode === "push") window.history.pushState(null, "", nextUrl);
      else window.history.replaceState(null, "", nextUrl);
    },
    [schoolSlug],
  );

  const setView = useCallback(
    (nextView: PublicViewerView) => {
      setViewState(nextView);
      updateUrl(nextView, params, "push");
    },
    [params, updateUrl],
  );

  const setParams = useCallback(
    (nextParams: PublicViewerParams) => {
      setParamsState(nextParams);
      updateUrl(view, nextParams, "replace");
    },
    [updateUrl, view],
  );
  const updatePrintMonth = useCallback((month: { year: number; monthIndex: number }) => {
    setPrintMonthKey(monthKey(month.year, month.monthIndex));
  }, []);
  const loadCalendarMonths = useCallback(async () => {
    const { buildCalendarModel } = await import("@/lib/views/calendar");
    return buildCalendarModel({ year, events: hydratedEvents }).months;
  }, [hydratedEvents, year]);
  const loadPrintCalendar = useCallback(async () => {
    const months = await loadCalendarMonths();
    return {
      months,
      schoolName,
      yearLabel: year.label,
      defaultMonthIndex: monthIndexForKey(months, printMonthKey),
    };
  }, [loadCalendarMonths, printMonthKey, schoolName, year.label]);

  useEffect(() => {
    if (view === "gantt" && params.zoom === "week") {
      setPrintMonthKey(monthKeyForDate(parseWeekParam(params.week ?? undefined)));
    }
  }, [params.week, params.zoom, view]);

  useEffect(() => {
    if (deferredView !== "calendar") return;
    void loadCalendarMonths().then(setCalendarMonths);
  }, [deferredView, loadCalendarMonths]);

  useEffect(() => {
    const loaders = inactiveViewLoaders(view);
    const prefetch = () => loaders.forEach((load) => void load());
    const idleWindow = window as IdleCallbackWindow;
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(prefetch);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(prefetch, 1);
    return () => window.clearTimeout(id);
  }, [view]);

  return (
    <>
      <AppHeader title={schoolName} />
      <main className="min-h-screen bg-[var(--sg-page)] pb-12">
        <ViewTabs
          view={view}
          labels={{
            gantt: nav("gantt"),
            calendar: nav("calendar"),
            agenda: nav("agenda"),
          }}
          onChange={setView}
          action={
            <ExportToGoogleCalendarButton
              schoolSlug={schoolSlug}
              allGrades={ALL_GRADES}
              eventTypes={eventTypesForFilter}
              defaultGrades={params.grades}
              defaultTypes={params.types}
              loadPrintCalendar={loadPrintCalendar}
            />
          }
        />
        <FilterBar
          allGrades={ALL_GRADES}
          eventTypes={eventTypesForFilter}
          selectedGrades={params.grades}
          selectedTypes={params.types}
          searchQuery={params.q}
          zoom={params.zoom}
          zoomOptions={zoomOptionsForView(view)}
          onChange={setParams}
        />
        {deferredView === "gantt" && (
          <PublicGanttView
            events={hydratedEvents}
            serializedEvents={filteredEvents}
            year={year}
            params={params}
            grades={visibleGrades}
            emptyLabel={gantt("empty")}
            onWeekChange={(weekStart) => setPrintMonthKey(monthKeyForDate(weekStart))}
          />
        )}
        {deferredView === "calendar" && (
          <PublicCalendarView
            months={calendarMonths ?? []}
            year={year}
            schoolName={schoolName}
            onMonthChange={updatePrintMonth}
          />
        )}
        {deferredView === "agenda" && (
          <PublicAgendaView
            events={hydratedEvents}
            emptyLabel={agenda("empty")}
            mode={params.zoom === "month" ? "month" : "week"}
          />
        )}
      </main>
    </>
  );
}

function ViewTabs({
  view,
  labels,
  onChange,
  action,
}: {
  view: PublicViewerView;
  labels: Record<PublicViewerView, string>;
  onChange: (view: PublicViewerView) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-2 overflow-hidden border-b border-[var(--sg-hairline)] bg-[var(--sg-surface-raised)] px-3 py-2 sm:px-6">
      <div className="inline-flex rounded-lg border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] p-0.5 shadow-sm">
        {(["gantt", "calendar", "agenda"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={view === item}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === item ? "bg-blue-600 text-white" : "text-neutral-700 hover:bg-white"
            }`}
          >
            {labels[item]}
          </button>
        ))}
      </div>
      {action}
    </div>
  );
}

function inactiveViewLoaders(view: PublicViewerView): Array<() => Promise<unknown>> {
  const loaders = {
    gantt: () => import("@/components/public/PublicGanttView"),
    calendar: () => import("@/components/public/PublicCalendarView"),
    agenda: () => import("@/components/public/PublicAgendaView"),
  };
  return Object.entries(loaders)
    .filter(([name]) => name !== view)
    .map(([, load]) => load);
}

type IdleCallbackWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
};

function pathForView(schoolSlug: string, view: PublicViewerView): string {
  if (view === "calendar") return `/${schoolSlug}/calendar`;
  if (view === "agenda") return `/${schoolSlug}/agenda`;
  return `/${schoolSlug}`;
}

function viewFromPath(pathname: string, schoolSlug: string): PublicViewerView {
  if (pathname === `/${schoolSlug}/calendar`) return "calendar";
  if (pathname === `/${schoolSlug}/agenda`) return "agenda";
  return "gantt";
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

function monthKeyForDate(date: Date): string {
  return monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

function monthIndexForKey(
  months: ReturnType<typeof buildCalendarModel>["months"],
  key: string,
): number {
  const index = months.findIndex((month) => monthKey(month.year, month.monthIndex) === key);
  return index >= 0 ? index : 0;
}

function zoomOptionsForView(view: PublicViewerView) {
  if (view === "calendar") return [];
  if (view === "agenda") return ["week", "month"] as const;
  return undefined;
}
```

What changed vs. the original: the `events`/`eventsSignature`/`isDocumentVisible`/`wasDocumentHidden` state, the `refreshEvents` callback, the two polling `useEffect`s, and the three module-level `refreshEvents`/`refreshEventsIfChanged`/`refreshEventsSignature` functions are all gone — replaced by the single `const events = usePublicViewerEvents({ schoolSlug, initialEvents, initialEventsSignature });` line. The now-unused `useRef` and `useTransition` imports are dropped. Everything else (params state, deferred values, print-month tracking, tab switching, URL sync) is untouched.

- [ ] **Step 3: Run the full existing suite to confirm no regression**

Run: `pnpm test -- test/unit/views/public-viewer-shell.test.tsx test/unit/views/public-viewer.test.ts test/unit/views/public-viewer-data.test.ts test/unit/public-viewer-entry-loading.test.tsx`
Expected: PASS, identical results to Step 1 — zero test changes needed.

- [ ] **Step 4: Type check**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/PublicViewerShell.tsx
git commit -m "$(cat <<'EOF'
refactor: move PublicViewerShell's event polling into usePublicViewerEvents

Pure internal refactor — external props and behavior are unchanged,
verified by the existing test suite passing without modification.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build `ReadOnlyViewerShell`

**Files:**
- Create: `components/ReadOnlyViewerShell.tsx`
- Modify: `messages/he.json`
- Modify: `messages/en.json`
- Test: `test/unit/views/read-only-viewer-shell.test.tsx`

**Interfaces:**
- Consumes: `usePublicViewerEvents` (Task 2); `PublicGanttView`, `PublicCalendarView` (existing, unchanged); `filterPublicEvents`, `hydratePublicEvents` from `@/lib/views/public-viewer`; `AppHeader`, `FilterBar` (existing, unchanged).
- Produces: `ReadOnlyViewerShell(props: { schoolSlug: string; schoolName: string; initialParams: PublicViewerParams; year: PublicViewerYear; eventTypes: PublicViewerEventType[]; initialEvents: PublicViewerEvent[]; initialEventsSignature: string }): JSX.Element` — consumed by the `/schedule` page in Task 5.

- [ ] **Step 1: Add the new i18n keys**

In `messages/he.json`, insert a new `"schedule"` block immediately after the `"calendar"` block closes (after line 340, before `"profile": {` on line 341):

```json
  "schedule": {
    "weekly": "שבועי",
    "monthly": "חודשי",
    "login": "התחברות"
  },
```

In `messages/en.json`, insert the same key at the same position:

```json
  "schedule": {
    "weekly": "Weekly",
    "monthly": "Monthly",
    "login": "Log in"
  },
```

- [ ] **Step 2: Write the failing test**

Create `test/unit/views/read-only-viewer-shell.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadOnlyViewerShell } from "@/components/ReadOnlyViewerShell";
import type { PublicViewerEvent } from "@/lib/views/public-viewer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/schedule",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/RouteProgress", () => ({
  useRouteProgress: () => vi.fn(),
}));

vi.mock("@/components/Gantt/GanttCanvas", () => ({
  GanttCanvas: ({ grades }: { grades: number[] }) => (
    <div aria-label="gantt rows">
      {grades.map((grade) => (
        <div key={grade}>grade-{grade}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/Gantt/GanttWeekly", () => ({
  GanttWeekly: ({ model }: { model: { rows: { grade: number }[] } }) => (
    <div aria-label="weekly rows">
      {model.rows.map((row) => (
        <div key={row.grade}>grade-{row.grade}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/YearCalendarGrid", () => ({
  YearCalendarGrid: () => <div data-testid="year-calendar-grid" />,
}));

const event: PublicViewerEvent = {
  id: "event-1",
  title: "טיול",
  startAt: "2026-09-15T06:00:00.000Z",
  endAt: "2026-09-15T09:00:00.000Z",
  allDay: false,
  description: null,
  location: null,
  eventTypeId: "type-1",
  eventTypeKey: "trip",
  eventTypeLabelHe: "טיול",
  eventTypeColor: "#0ea5e9",
  eventTypeGlyph: "compass",
  grades: [7, 8],
  status: "approved",
  isCanceled: false,
  isUpdated: false,
};

function renderShell() {
  return render(
    <ReadOnlyViewerShell
      schoolSlug="demo-school"
      schoolName="Demo School"
      initialParams={{ grades: [], types: [], q: "", zoom: "year", week: null }}
      year={{ label: "2026", startDate: "2026-09-01", endDate: "2027-07-31" }}
      eventTypes={[
        {
          id: "type-1",
          key: "trip",
          labelHe: "טיול",
          labelEn: "Trip",
          colorHex: "#0ea5e9",
          glyph: "compass",
          sortOrder: 1,
        },
      ]}
      initialEvents={[event]}
      initialEventsSignature="1:1:now"
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ReadOnlyViewerShell", () => {
  it("shows exactly a weekly and a monthly tab — no agenda", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "weekly" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "monthly" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "agenda" })).not.toBeInTheDocument();
  });

  it("hides the zoom radiogroup entirely", () => {
    renderShell();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("has no export-to-Google-Calendar affordance", () => {
    renderShell();
    expect(screen.queryByText(/ייצוא/)).not.toBeInTheDocument();
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
  });

  it("links the header login button straight to /auth/login", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute("href", "/auth/login");
  });

  it("removes deselected grades from the Weekly rows immediately", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "ז" }));

    expect(screen.queryByText("grade-7")).not.toBeInTheDocument();
    expect(screen.getByText("grade-8")).toBeInTheDocument();
  });

  it("switches to the monthly tab and renders the calendar grid", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "monthly" }));

    await waitFor(() => {
      expect(screen.getByTestId("year-calendar-grid")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- test/unit/views/read-only-viewer-shell.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ReadOnlyViewerShell'`.

- [ ] **Step 4: Write `components/ReadOnlyViewerShell.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/AppHeader";
import { FilterBar } from "@/components/FilterBar";
import { PublicGanttView } from "@/components/public/PublicGanttView";
import { PublicCalendarView } from "@/components/public/PublicCalendarView";
import type { CalendarMonth } from "@/lib/views/calendar";
import {
  filterPublicEvents,
  hydratePublicEvents,
  type PublicViewerEvent,
  type PublicViewerParams,
} from "@/lib/views/public-viewer";
import type { PublicViewerEventType, PublicViewerYear } from "@/lib/views/public-viewer-data";
import { usePublicViewerEvents } from "@/lib/views/use-public-viewer-events";

const ALL_GRADES = [7, 8, 9, 10, 11, 12];
const TABS = ["weekly", "monthly"] as const;
type ReadOnlyTab = (typeof TABS)[number];

interface Props {
  schoolSlug: string;
  schoolName: string;
  initialParams: PublicViewerParams;
  year: PublicViewerYear;
  eventTypes: PublicViewerEventType[];
  initialEvents: PublicViewerEvent[];
  initialEventsSignature: string;
}

/**
 * The unauthenticated read-only entry point at /schedule. Deliberately never
 * changes the URL when switching tabs — unlike PublicViewerShell, whose tab
 * switch navigates to /[school]/calendar etc. Reusing that navigation here
 * would let a visitor tab their way out into the full 3-tab public viewer,
 * defeating the "only weekly and monthly" requirement.
 */
export function ReadOnlyViewerShell({
  schoolSlug,
  schoolName,
  initialParams,
  year,
  eventTypes,
  initialEvents,
  initialEventsSignature,
}: Props) {
  const t = useTranslations("schedule");
  const gantt = useTranslations("gantt");
  const [tab, setTab] = useState<ReadOnlyTab>("weekly");
  const [params, setParams] = useState(initialParams);
  const events = usePublicViewerEvents({ schoolSlug, initialEvents, initialEventsSignature });
  const [calendarMonths, setCalendarMonths] = useState<CalendarMonth[] | null>(null);

  const eventTypesForFilter = useMemo(
    () => eventTypes.map((type) => ({ key: type.key, labelHe: type.labelHe, colorHex: type.colorHex })),
    [eventTypes],
  );
  const filteredEvents = useMemo(() => filterPublicEvents(events, params), [events, params]);
  const hydratedEvents = useMemo(() => hydratePublicEvents(filteredEvents), [filteredEvents]);
  const visibleGrades = useMemo(
    () => (params.grades.length > 0 ? params.grades : ALL_GRADES),
    [params.grades],
  );
  const weeklyParams = useMemo(() => ({ ...params, zoom: "week" as const }), [params]);

  useEffect(() => {
    if (tab !== "monthly") return;
    let cancelled = false;
    void import("@/lib/views/calendar").then(({ buildCalendarModel }) => {
      if (cancelled) return;
      setCalendarMonths(buildCalendarModel({ year, events: hydratedEvents }).months);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, year, hydratedEvents]);

  return (
    <>
      <AppHeader
        title={schoolName}
        rightSlot={
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            {t("login")}
          </Link>
        }
      />
      <main className="min-h-screen bg-[var(--sg-page)] pb-12">
        <div className="relative flex flex-wrap items-center gap-2 overflow-hidden border-b border-[var(--sg-hairline)] bg-[var(--sg-surface-raised)] px-3 py-2 sm:px-6">
          <div className="inline-flex rounded-lg border border-[var(--sg-hairline)] bg-[var(--sg-surface-2)] p-0.5 shadow-sm">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                aria-pressed={tab === item}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === item ? "bg-blue-600 text-white" : "text-neutral-700 hover:bg-white"
                }`}
              >
                {t(item)}
              </button>
            ))}
          </div>
        </div>
        <FilterBar
          allGrades={ALL_GRADES}
          eventTypes={eventTypesForFilter}
          selectedGrades={params.grades}
          selectedTypes={params.types}
          searchQuery={params.q}
          zoom={params.zoom}
          zoomOptions={[]}
          onChange={setParams}
        />
        {tab === "weekly" && (
          <PublicGanttView
            events={hydratedEvents}
            serializedEvents={filteredEvents}
            year={year}
            params={weeklyParams}
            grades={visibleGrades}
            emptyLabel={gantt("empty")}
            onWeekChange={() => {}}
          />
        )}
        {tab === "monthly" && (
          <PublicCalendarView
            months={calendarMonths ?? []}
            year={year}
            schoolName={schoolName}
            onMonthChange={() => {}}
          />
        )}
      </main>
    </>
  );
}
```

Note: unlike `PublicViewerShell`, this component imports `PublicGanttView`/`PublicCalendarView` directly instead of via `next/dynamic`. With only two tabs (vs. three) and no meaningful "inactive view" to defer, the code-splitting `PublicViewerShell` does isn't worth the added complexity (a loading flash, async test timing) here — a visitor to `/schedule` needs one of these two views immediately.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- test/unit/views/read-only-viewer-shell.test.tsx`
Expected: PASS, all six tests.

- [ ] **Step 6: Type check and lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/ReadOnlyViewerShell.tsx messages/he.json messages/en.json test/unit/views/read-only-viewer-shell.test.tsx
git commit -m "$(cat <<'EOF'
feat: add ReadOnlyViewerShell — 2-tab weekly/monthly public viewer

Weekly reuses PublicGanttView locked to week zoom, Monthly reuses
PublicCalendarView unchanged. No Agenda tab, no export button, no URL
navigation on tab switch. Grade/type/search filters stay fully
functional per explicit request.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build the `/schedule` page

**Files:**
- Create: `app/(public)/schedule/page.tsx`

**Interfaces:**
- Consumes: `listSchools` from `@/lib/db/schools`; `loadPublicViewerData` from `@/lib/views/public-viewer-data`; `parsePublicViewerParams` from `@/lib/views/public-viewer`; `ReadOnlyViewerShell` from Task 4.
- Produces: the `/schedule` route.

This task has no dedicated Vitest unit test: it's a thin async Server Component (resolve school → load data → render). There is no existing precedent in this codebase for unit-testing a Next.js async Server Component page directly (`app/(viewer)/[school]/page.tsx` has none either) — the underlying functions it calls (`listSchools`, `loadPublicViewerData`) already carry their own coverage, and the page's actual behavior is verified end-to-end by the Playwright test in Task 7.

- [ ] **Step 1: Write `app/(public)/schedule/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { ReadOnlyViewerShell } from "@/components/ReadOnlyViewerShell";
import { listSchools } from "@/lib/db/schools";
import { loadPublicViewerData } from "@/lib/views/public-viewer-data";
import { parsePublicViewerParams } from "@/lib/views/public-viewer";

/** PRD §11 — public freshness ≤ 5 s after publish, same as the full public viewer. */
export const revalidate = 5;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReadOnlySchedulePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [school] = await listSchools();
  if (!school) notFound();

  const data = await loadPublicViewerData(school.slug);
  if (!data) notFound();

  return (
    <ReadOnlyViewerShell
      schoolSlug={school.slug}
      schoolName={data.school.name}
      initialParams={parsePublicViewerParams(toUrlSearchParams(sp))}
      year={data.year}
      eventTypes={data.eventTypes}
      initialEvents={data.events}
      initialEventsSignature={data.eventSignature}
    />
  );
}

function toUrlSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
```

- [ ] **Step 2: Type check and lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: no new errors. Lint in particular must confirm this file only imports `supabaseAdmin`-adjacent code via `lib/db/schools.ts` (`listSchools`), not a raw client — it does, so the ESLint rule banning `supabaseAdmin` outside `lib/db/` is respected.

- [ ] **Step 3: Manual smoke check against local dev**

Run: `pnpm dev` (if not already running), then in a browser visit `http://localhost:3000/schedule`.
Expected: the seeded `demo-school` schedule renders with a Weekly tab active, a Monthly tab, a "Log in" button in the header, and working grade/type/search filters — no Agenda tab, no export button. (This requires `DATABASE_URL`/Supabase env vars to be configured locally per `db/seed.ts`; if they aren't, `listSchools()` returns `[]` and the page 404s — that's expected in an unconfigured environment and is not a bug in this page.)

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/schedule/page.tsx"
git commit -m "$(cat <<'EOF'
feat: add /schedule — the unauthenticated read-only entry page

Resolves the single school in this deployment via listSchools() and
renders ReadOnlyViewerShell. No school picker: this deployment is
single-tenant in practice (the root path already dropped school
picking — see app/(public)/page.tsx).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add the read-only link to the login page

**Files:**
- Modify: `app/auth/login/page.tsx`

**Interfaces:**
- Consumes: nothing new (plain `next/link`, already imported in this file).
- Produces: a visible link on `/auth/login` to `/schedule`.

The rest of `app/auth/login/page.tsx` hardcodes its Hebrew strings directly in JSX rather than using `next-intl` (e.g. `<h1>כניסה למערכת</h1>`) — this predates this feature and is out of scope to fix wholesale here. This task's new string follows that same file-local convention rather than introducing a partial, inconsistent `next-intl` usage into an otherwise fully-hardcoded file.

- [ ] **Step 1: Read the current file to confirm line numbers before editing**

Run: `sed -n '48,62p' app/auth/login/page.tsx` — confirm the block between the `GoogleSignInButton` and the closing `</div>` still matches:

```tsx
          <GoogleSignInButton next={next} token={token} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          עדיין אין לכם חשבון?{" "}
          <Link
            href={token ? `/auth/register?token=${token}` : "/auth/register"}
            className="underline hover:text-foreground"
          >
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the read-only link**

Insert a new `<p>` immediately after the existing "הרשמה" paragraph's closing `</p>` and before the closing `</div>` of the card:

```tsx
          <GoogleSignInButton next={next} token={token} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          עדיין אין לכם חשבון?{" "}
          <Link
            href={token ? `/auth/register?token=${token}` : "/auth/register"}
            className="underline hover:text-foreground"
          >
            הרשמה
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/schedule" className="underline hover:text-foreground">
            צפייה בלוח בלי להתחבר
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type check and lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Manual check**

Run: `pnpm dev` (if not already running), visit `http://localhost:3000/auth/login`.
Expected: below the "הרשמה" line, a new link "צפייה בלוח בלי להתחבר" is visible; clicking it navigates to `/schedule`. The existing email/password form, Google button, and register link are unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/auth/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: link the login screen to the read-only public schedule

Adds a "view the schedule without logging in" link below the
register link, pointing anonymous visitors at /schedule.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: End-to-end coverage

**Files:**
- Create: `test/e2e/read-only-schedule.spec.ts`

**Interfaces:**
- Consumes: the seeded `demo-school` (slug `demo-school`, per `db/seed.ts`), which — being the only school in the dev/CI database — is exactly what `/schedule` resolves via `listSchools()`.
- Produces: no new interfaces; this is a black-box browser test.

- [ ] **Step 1: Write the e2e spec**

Create `test/e2e/read-only-schedule.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

/**
 * Read-only public schedule: /auth/login → /schedule → weekly/monthly only,
 * filters still work, "Log in" returns to /auth/login. No DB write needed —
 * uses the demo seed's single school, same as the other unauthenticated
 * public-viewer specs.
 */
test("READONLY: login screen links to a 2-tab read-only schedule with working filters", async ({ page }) => {
  await page.goto("/auth/login");

  await page.getByRole("link", { name: "צפייה בלוח בלי להתחבר" }).click();
  await expect(page).toHaveURL(/\/schedule$/);

  // Exactly weekly + monthly tabs, no agenda.
  const weeklyTab = page.getByRole("button", { name: "שבועי" });
  const monthlyTab = page.getByRole("button", { name: "חודשי" });
  await expect(weeklyTab).toBeVisible();
  await expect(monthlyTab).toBeVisible();
  await expect(page.getByRole("button", { name: "סדר יום" })).toHaveCount(0);

  // No export-to-Google-Calendar affordance.
  await expect(page.getByRole("button", { name: /ייצוא/ })).toHaveCount(0);

  // Grade filter still narrows the weekly view.
  await expect(async () => {
    const tenBtn = page.getByRole("button", { name: "י", exact: true }).first();
    await tenBtn.waitFor({ state: "visible" });
    await tenBtn.click();
    await expect(tenBtn).toHaveAttribute("aria-pressed", "false");
  }).toPass({ timeout: 20_000 });

  // Monthly tab switches without leaving /schedule.
  await monthlyTab.click();
  await expect(page).toHaveURL(/\/schedule$/);

  // Login button returns to the real login page.
  await page.getByRole("link", { name: "התחברות" }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("READONLY: existing full public viewer is unaffected", async ({ page }) => {
  await page.goto("/demo-school");
  await expect(page.getByRole("button", { name: "גאנט" })).toBeVisible();
  await expect(page.getByRole("button", { name: "לוח שנה" })).toBeVisible();
  await expect(page.getByRole("button", { name: "סדר יום" })).toBeVisible();
});
```

- [ ] **Step 2: Run the new spec**

Run: `pnpm playwright test test/e2e/read-only-schedule.spec.ts`
Expected: PASS (requires a running dev server per this repo's Playwright config, and the seeded `demo-school` data — same preconditions as the other e2e specs like `test/e2e/prd14-filters.spec.ts`).

- [ ] **Step 3: Run the full e2e regression suite**

Run: `pnpm playwright test`
Expected: PASS — in particular, `test/e2e/smoke.spec.ts` and any other spec touching `/`, `/auth/login`, or `/[school]` still passes, confirming the login page's new link and the `PublicViewerShell` refactor didn't break anything already covered.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/read-only-schedule.spec.ts
git commit -m "$(cat <<'EOF'
test: add e2e coverage for the read-only public schedule flow

Covers login → /schedule → weekly/monthly tabs only, working grade
filter, no export button, and the login button returning to
/auth/login. Also pins down that the full 3-tab public viewer at
/[school] is unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: succeeds with no errors.

- [ ] **Step 2: Full type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full lint**

Run: `pnpm lint`
Expected: no errors, including the `supabaseAdmin`-outside-`lib/db/` rule.

- [ ] **Step 4: Full unit/integration test suite**

Run: `pnpm test`
Expected: all pass, including every pre-existing public-viewer test listed in Global Constraints, unmodified.

- [ ] **Step 5: Full Playwright suite**

Run: `pnpm playwright test`
Expected: all pass.

- [ ] **Step 6: Confirm the seed data has no slug collision**

Run: `grep -n "SCHOOL_SLUG" db/seed.ts`
Expected: `SCHOOL_SLUG = "demo-school"` — does not collide with the reserved `/schedule` prefix from Task 1.

- [ ] **Step 7: Manual walkthrough against `pnpm dev`**

1. Visit `/auth/login` — existing email/password form, Google button, and register link all still present and functional; new read-only link visible.
2. Click the read-only link → lands on `/schedule` with the Weekly tab active by default.
3. Toggle a grade chip and an event-type chip — events on screen narrow accordingly.
4. Switch to the Monthly tab — the printable yearly calendar renders, URL stays `/schedule`.
5. Click "Log in" in the header — lands on `/auth/login`.
6. Separately, visit `/demo-school`, `/demo-school/calendar`, `/demo-school/agenda` directly — all three still show the full 3-tab experience with the Export button, exactly as before this feature.

- [ ] **Step 8: Merge to `main`**

Per this repo's git workflow (never commit to `main` directly; merge when implementation is complete and `pnpm build` passes):

```bash
git checkout main
git merge feature/read-only-public-schedule
```

Do not push unless explicitly asked.
