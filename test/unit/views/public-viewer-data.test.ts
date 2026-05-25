import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  unstable_cache: (fn: unknown) => fn,
}));

import {
  getPublicViewerCacheTag,
  invalidatePublicViewerCache,
} from "@/lib/views/public-viewer-data";

describe("public viewer data cache", () => {
  beforeEach(() => {
    revalidateTagMock.mockReset();
  });

  it("uses a tenant-specific cache tag for public viewer data", () => {
    expect(getPublicViewerCacheTag("school-a")).toBe("public-viewer:school-a");
  });

  it("invalidates the tenant cache after event mutations", () => {
    invalidatePublicViewerCache("school-a");

    expect(revalidateTagMock).toHaveBeenCalledWith("public-viewer:school-a");
  });
});
