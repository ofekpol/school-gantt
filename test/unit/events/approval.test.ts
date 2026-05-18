import { describe, it } from "vitest";

describe("publishEvent: valid transitions", () => {
  it.todo("draft → approved is a valid transition (publishEvent)");
  it.todo("approved → approved stays approved (re-publish writes 'edited' revision)");
});

describe("publishEvent: invalid transitions throw", () => {
  it.todo("publishEvent on non-existent event throws 404");
});
