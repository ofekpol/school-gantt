import { describe, it } from "vitest";

describe("AUTH-07: public routes pass through without session", () => {
  it.todo("GET /[school]/agenda returns 200 without any auth cookie");
  it.todo("GET / (root) renders without session check");
  it.todo("middleware does not redirect unauthenticated users on public routes");
});
