import type { CandidateEvent } from "@/lib/ai/adder/types";

export const TRIP = "11111111-1111-4111-8111-111111111111";

export const eventTypes = [
  { id: TRIP, key: "trip", labelHe: "טיול", colorHex: "#1f77b4", glyph: "T" },
];

export function cand(overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    clientId: "c1",
    title: "טיול שנתי",
    startDate: "2026-11-12",
    endDate: null,
    dateHint: null,
    startTime: "08:00",
    endTime: "16:00",
    allDay: null,
    grades: [8],
    eventTypeId: TRIP,
    location: "",
    description: "",
    warnings: [],
    ...overrides,
  };
}

/** next-intl stand-in: renders the key, plus params as JSON so tests can see them. */
export function fakeT(key: string, params?: Record<string, unknown>): string {
  return params ? `${key}${JSON.stringify(params)}` : key;
}
