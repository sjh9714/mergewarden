import { describe, expect, it, vi } from "vitest";

import { GitHubApiError } from "@mergewarden/github";
import { NativeGitHubApi } from "../src/githubApi.js";

const pullResponse = {
  number: 17,
  title: "Agent change",
  body: null,
  user: { login: "octocat" },
  labels: [{ name: "agent" }, { name: null }],
  draft: false,
  changed_files: 1,
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

describe("native GitHub API adapter", () => {
  it("normalizes pull requests and sends the preferred token without exposing it", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(pullResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = new NativeGitHubApi({ token: "secret-token", fetch });

    await expect(
      api.getPullRequest({ owner: "Owner", repo: "Project", number: 17 }),
    ).resolves.toEqual({
      number: 17,
      title: "Agent change",
      body: "",
      author: "octocat",
      labels: ["agent"],
      draft: false,
      changedFiles: 1,
      head: {
        ref: "agent/change",
        sha: "head-sha",
        repository: { owner: "contributor", repo: "fork", defaultBranch: "main" },
        fork: true,
      },
      base: {
        ref: "main",
        sha: "base-sha",
        repository: { owner: "owner", repo: "project", defaultBranch: "main" },
      },
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.github.com/repos/owner/project/pulls/17");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("normalizes paginated file data", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              filename: "src/new.ts",
              previous_filename: "src/old.ts",
              status: "renamed",
              additions: 3,
              deletions: 1,
              patch: "@@",
            },
          ]),
          { status: 200 },
        ),
    );
    const api = new NativeGitHubApi({ fetch });

    await expect(
      api.listPullRequestFilesPage({ owner: "owner", repo: "project", number: 17 }, 2, 100),
    ).resolves.toEqual([
      {
        filename: "src/new.ts",
        previousFilename: "src/old.ts",
        status: "renamed",
        additions: 3,
        deletions: 1,
        patch: "@@",
      },
    ]);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/files?per_page=100&page=2");
  });

  it("returns raw text and treats only content 404 as not found", async () => {
    const found = new NativeGitHubApi({ fetch: async () => new Response("version: 1\n") });
    const missing = new NativeGitHubApi({
      fetch: async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
    });

    await expect(
      found.getTextFile({ owner: "owner", repo: "project" }, "policies/gate.yml", "base-sha"),
    ).resolves.toEqual({ kind: "found", text: "version: 1\n" });
    await expect(
      missing.getTextFile({ owner: "owner", repo: "project" }, "mergewarden.yml", "base-sha"),
    ).resolves.toEqual({ kind: "not-found" });
  });

  it("caps chunked raw content at one MiB plus one byte and cancels the stream", async () => {
    const chunkSize = 700 * 1024;
    let pullCount = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        controller.enqueue(new Uint8Array(chunkSize).fill(0x61));
        if (pullCount >= 3) {
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const api = new NativeGitHubApi({ fetch: async () => new Response(stream) });

    const result = await api.getTextFile(
      { owner: "owner", repo: "project" },
      ".github/workflows/large.yml",
      "head-sha",
    );

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(Buffer.byteLength(result.text, "utf8")).toBe(1024 * 1024 + 1);
    }
    expect(cancelled).toBe(true);
    expect(pullCount).toBeLessThanOrEqual(3);
  });

  it("rejects an oversized content-length without buffering the body", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([0x61]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const api = new NativeGitHubApi({
      fetch: async () =>
        new Response(stream, { headers: { "content-length": String(2 * 1024 * 1024) } }),
    });

    const error = await api
      .getTextFile(
        { owner: "owner", repo: "project" },
        ".github/workflows/too-large.yml",
        "head-sha",
      )
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({ retryable: false });
    expect(String(error)).toContain("content-length 2097152 bytes");
    expect(cancelled).toBe(true);
  });

  it("aborts timed-out requests with a retryable error and never leaks the token", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const api = new NativeGitHubApi({
        token: "never-print-timeout-token",
        requestTimeoutMs: 30,
        fetch: async (_input, init) => {
          requestSignal = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), {
              once: true,
            });
          });
        },
      });

      const errorPromise = api
        .getPullRequest({ owner: "owner", repo: "project", number: 17 })
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(30);
      const error = await errorPromise;

      expect(requestSignal?.aborted).toBe(true);
      expect(error).toBeInstanceOf(GitHubApiError);
      expect(error).toMatchObject({ retryable: true });
      expect(String(error)).toContain("request timed out after 30ms");
      expect(String(error)).not.toContain("never-print-timeout-token");
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies the timeout while streaming a response body", async () => {
    vi.useFakeTimers();
    try {
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull: async () => new Promise<void>(() => undefined),
        cancel() {
          cancelled = true;
        },
      });
      const api = new NativeGitHubApi({
        requestTimeoutMs: 30,
        fetch: async () => new Response(stream),
      });

      const errorPromise = api
        .getTextFile(
          { owner: "owner", repo: "project" },
          ".github/workflows/hanging.yml",
          "head-sha",
        )
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(30);
      const error = await errorPromise;

      expect(error).toBeInstanceOf(GitHubApiError);
      expect(error).toMatchObject({ retryable: true });
      expect(cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves API status, request id, and retry headers without leaking the token", async () => {
    const api = new NativeGitHubApi({
      token: "never-print-this-token",
      fetch: async () =>
        new Response(JSON.stringify({ message: "secondary rate limit" }), {
          status: 429,
          headers: {
            "retry-after": "2",
            "x-ratelimit-reset": "100",
            "x-github-request-id": "request-123",
          },
        }),
    });

    const error = await api
      .getPullRequest({ owner: "owner", repo: "project", number: 17 })
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({
      status: 429,
      requestId: "request-123",
      retryAfterMs: 2_000,
      rateLimitResetAt: 100_000,
    });
    expect(String(error)).not.toContain("never-print-this-token");
  });

  it("fails closed on malformed GitHub responses", async () => {
    const api = new NativeGitHubApi({
      fetch: async () => new Response(JSON.stringify({ number: 17 }), { status: 200 }),
    });

    await expect(
      api.getPullRequest({ owner: "owner", repo: "project", number: 17 }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("rejects invalid timeout configuration", () => {
    expect(() => new NativeGitHubApi({ requestTimeoutMs: 0 })).toThrow(
      "requestTimeoutMs must be a positive number.",
    );
  });
});
