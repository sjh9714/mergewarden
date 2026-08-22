import { describe, expect, it, vi } from "vitest";

import { FetchGitHubApi } from "../src/index.js";

const pullResponse = {
  number: 17,
  title: "Agent change",
  body: null,
  user: { login: "octocat" },
  labels: [{ name: "agent" }],
  draft: false,
  author_association: "FIRST_TIME_CONTRIBUTOR",
  changed_files: 1,
  additions: 12,
  deletions: 4,
  updated_at: "2026-08-22T01:02:03Z",
  html_url: "https://github.com/owner/project/pull/17",
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
      authorAssociation: "FIRST_TIME_CONTRIBUTOR",
      additions: 12,
      deletions: 4,
      updatedAt: "2026-08-22T01:02:03Z",
      htmlUrl: "https://github.com/owner/project/pull/17",
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.github.com/repos/owner/project/pulls/17");
    expect(init?.headers).not.toHaveProperty("User-Agent");
  });

  it("lists recent open pull requests in updated order", async () => {
    const summary = {
      ...pullResponse,
      changed_files: undefined,
      commits: undefined,
      additions: undefined,
      deletions: undefined,
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify([summary]), { status: 200 }));
    const api = new FetchGitHubApi({ fetch });

    await expect(
      api.listOpenPullRequests({ owner: "Owner", repo: "Project" }, 30),
    ).resolves.toEqual([
      {
        number: 17,
        title: "Agent change",
        body: "",
        author: "octocat",
        labels: ["agent"],
        draft: false,
        authorAssociation: "FIRST_TIME_CONTRIBUTOR",
        updatedAt: "2026-08-22T01:02:03Z",
        htmlUrl: "https://github.com/owner/project/pull/17",
        head: {
          ref: "agent/change",
          sha: "head-sha",
          repository: {
            owner: "contributor",
            repo: "fork",
            defaultBranch: "main",
          },
          fork: true,
        },
        base: {
          ref: "main",
          sha: "base-sha",
          repository: { owner: "owner", repo: "project", defaultBranch: "main" },
        },
      },
    ]);

    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://api.github.com/repos/owner/project/pulls?state=open&sort=updated&direction=desc&per_page=30",
    );
  });

  it("bounds the pull request list page size", async () => {
    const fetch = vi.fn(async () => new Response("[]", { status: 200 }));
    const api = new FetchGitHubApi({ fetch });

    await api.listOpenPullRequests({ owner: "owner", repo: "project" }, 500);

    expect(String(fetch.mock.calls[0]?.[0])).toContain("per_page=100");
  });
});
