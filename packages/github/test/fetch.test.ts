import { describe, expect, it, vi } from "vitest";

import { FetchGitHubApi } from "../src/index.js";

const pullResponse = {
  number: 17,
  title: "Agent change",
  body: null,
  user: { login: "octocat" },
  labels: [{ name: "agent" }],
  draft: false,
  changed_files: 1,
  commits: 2,
  head: {
    ref: "agent/change",
    sha: "head-sha",
    repo: {
      name: "fork",
      owner: { login: "contributor" },
      default_branch: "main",
      fork: true,
    },
  },
  base: {
    ref: "main",
    sha: "base-sha",
    repo: {
      name: "project",
      owner: { login: "owner" },
      default_branch: "main",
      fork: false,
    },
  },
};

describe("fetch GitHub API adapter", () => {
  it("preserves the browser fetch receiver when using the global implementation", async () => {
    const originalFetch = globalThis.fetch;
    const browserFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(new Response(JSON.stringify(pullResponse), { status: 200 }));
    });
    globalThis.fetch = browserFetch as typeof globalThis.fetch;

    try {
      await expect(
        new FetchGitHubApi().getPullRequest({ owner: "owner", repo: "project", number: 17 }),
      ).resolves.toMatchObject({ number: 17 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("normalizes public pull requests without setting a browser-forbidden user agent", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(pullResponse), { status: 200 }));
    const api = new FetchGitHubApi({ fetch });

    await expect(
      api.getPullRequest({ owner: "Owner", repo: "Project", number: 17 }),
    ).resolves.toMatchObject({
      number: 17,
      body: "",
      author: "octocat",
      changedFiles: 1,
      commitCount: 2,
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.github.com/repos/owner/project/pulls/17");
    expect(init?.headers).not.toHaveProperty("User-Agent");
  });
});
