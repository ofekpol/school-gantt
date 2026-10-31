import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";

const prompts: string[] = [];
let reply = "";

vi.mock("@/lib/ai/model", () => ({
  getAiModel: () =>
    new MockLanguageModelV4({
      doGenerate: async (options) => {
        prompts.push(JSON.stringify(options.prompt));
        return {
          content: [{ type: "text", text: reply }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        };
      },
    }),
}));

import { extractEvents } from "@/lib/ai/adder/extract";

const ctx = { today: "2026-10-27", eventTypes: [{ key: "trip", labelHe: "טיול" }] };

describe("extractEvents", () => {
  it("returns the model's structured events and gives it today's date and the type list", async () => {
    reply = JSON.stringify({
      events: [
        {
          title: "טיול", startDay: 1, startMonth: 1, startYear: null, endDay: null, endMonth: null,
          endYear: null, startTime: null, endTime: null, allDay: true, grades: [7], allGrades: false,
          eventTypeKey: "trip", typeConfident: true, location: null, description: null, recurring: false,
        },
      ],
    });
    const events = await extractEvents("טיול לז' 1/1 כל היום", ctx);
    expect(events).toHaveLength(1);
    expect(events[0].startYear).toBeNull();
    const sent = prompts.at(-1) ?? "";
    expect(sent).toContain("2026-10-27");
    expect(sent).toContain("trip");
  });

  it("throws when the model returns invalid JSON", async () => {
    reply = "sure! here is a poem";
    await expect(extractEvents("x", ctx)).rejects.toThrow();
  });
});
