import { describe, expect, it, vi } from "vitest";

import { scanPublicPullRequest } from "../src/scan.js";

describe("scanPublicPullRequest", () => {
  it("uses one attempt and no retry delay in the browser", async () => {
    const load = vi.fn(async (_api, _target, options) => ({
      options,
      repo: { owner: "owner", repo: "repo", defaultBranch: "main" },
    }));
    const analyze = vi.fn((input) => ({ input }));

    await scanPublicPullRequest("owner/repo#12", {
      createApi: () => ({}) as never,
      load: load as never,
      analyze: analyze as never,
      now: () => "2026-08-22T00:00:00.000Z",
    });

    expect(load).toHaveBeenCalledWith(
      expect.anything(),
      { owner: "owner", repo: "repo", number: 12 },
      expect.objectContaining({ retry: { maxAttempts: 1, maxTotalDelayMs: 0 } }),
    );
  });
});
