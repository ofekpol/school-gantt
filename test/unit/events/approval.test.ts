import { describe, it } from "vitest";

describe("approvalStateMachine: valid transitions", () => {
  it.todo("draft → pending is a valid transition (submit action)");
  it.todo("pending → approved is a valid transition (admin approve)");
  it.todo("pending → rejected is a valid transition (admin reject with reason)");
  it.todo("rejected → pending is a valid transition (editor resubmit)");
});

describe("approvalStateMachine: invalid transitions throw", () => {
  it.todo("draft → approved directly throws (must go through pending)");
  it.todo("approved → draft throws (no going back)");
  it.todo("rejected → approved directly throws (must resubmit first)");
});

describe("admin event create: auto-approved on creation", () => {
  it.todo("admin-created event has status=approved immediately");
  it.todo(
    "admin-created event writes event_revisions with decidedBy=admin staff id",
  );
});
