import { act, renderHook } from "@testing-library/react";
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

    expect(result.current[0]?.title).toBe("עודכן");
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
