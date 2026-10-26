import { describe, expect, it } from "vitest";
import { resolveSchoolIdFromParam } from "@/lib/db/schools";
import { skipIfNoTestDb, testSchoolA } from "./setup";

describe.skipIf(skipIfNoTestDb)("resolveSchoolIdFromParam", () => {
  it("returns the school id for a known slug", async () => {
    expect(await resolveSchoolIdFromParam("test-a")).toBe(testSchoolA);
  });

  it.each([["no-such-school"], ["../x"], ["UPPER"], [undefined], [42], [null]])(
    "returns null for %s",
    async (raw) => {
      expect(await resolveSchoolIdFromParam(raw)).toBeNull();
    },
  );
});
