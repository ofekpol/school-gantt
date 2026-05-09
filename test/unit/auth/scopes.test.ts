import { describe, it } from "vitest";

describe("AUTH-05: assertEditorScope throws 403 on violation", () => {
  it.todo("editor without grade scope: throws 403 when grade=11");
  it.todo("editor with grade=10 scope: passes when grade=10, throws when grade=11");
  it.todo("editor without event_type scope: throws when eventType='trip'");
});

describe("AUTH-06: admins bypass scope checks", () => {
  it.todo("user with role='admin' returns without throwing for any grade");
  it.todo("user with role='admin' returns without throwing for any eventType");
});
