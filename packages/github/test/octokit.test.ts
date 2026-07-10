import { describe, expect, it, vi } from "vitest";

import { createOctokitGitHubApi, GitHubApiError, type RemotePullRequest } from "../src/index.js";

const pullRequest: RemotePullRequest = {
  number: 1,
  title: "PR",
  body: "",
  author: "agent",
  labels: [],
  draft: false,
  changedFiles: 0,
  head: {
    ref: "feature",
    sha: "head",
    repository: { owner: "owner", repo: "repo" },
    fork: false,
  },
  base: {
    ref: "main",
    sha: "base",
    repository: { owner: "owner", repo: "repo" },
  },
};

function octokit(content: () => Promise<{ data: unknown }>) {
  return {
    rest: {
      pulls: { listFiles: vi.fn(async () => ({ data: [] })) },
      repos: { getContent: vi.fn(content) },
    },
  };
}

describe("createOctokitGitHubApi", () => {
  it("decodes base64 files and treats only confirmed 404 as not found", async () => {
    const success = createOctokitGitHubApi(
      octokit(async () => ({
        data: {
          type: "file",
          encoding: "base64",
          content: Buffer.from("hello").toString("base64"),
        },
      })),
      () => pullRequest,
    );

    await expect(success.getTextFile({ owner: "o", repo: "r" }, "a.txt", "sha")).resolves.toEqual({
      kind: "found",
      text: "hello",
    });

    const notFoundError = Object.assign(new Error("Not Found"), { status: 404 });
    const missing = createOctokitGitHubApi(
      octokit(async () => Promise.reject(notFoundError)),
      () => pullRequest,
    );
    await expect(missing.getTextFile({ owner: "o", repo: "r" }, "a.txt", "sha")).resolves.toEqual({
      kind: "not-found",
    });
  });

  it("preserves status, request ID, and rate-limit headers in structured errors", async () => {
    const error = Object.assign(new Error("secondary rate limit"), {
      status: 403,
      response: {
        status: 403,
        headers: {
          "x-github-request-id": "REQ_123",
          "retry-after": "2",
          "x-ratelimit-reset": "123",
        },
      },
    });
    const github = createOctokitGitHubApi(
      octokit(async () => Promise.reject(error)),
      () => pullRequest,
    );

    const promise = github.getTextFile({ owner: "o", repo: "r" }, "a.txt", "sha");
    await expect(promise).rejects.toBeInstanceOf(GitHubApiError);
    await expect(promise).rejects.toMatchObject({
      status: 403,
      requestId: "REQ_123",
      retryAfterMs: 2_000,
      rateLimitResetAt: 123_000,
    });
  });

  it("adds a fresh 30-second abort signal to every Octokit collection request", async () => {
    const client = octokit(async () => ({
      data: {
        type: "file",
        encoding: "base64",
        content: Buffer.from("hello").toString("base64"),
      },
    }));
    const github = createOctokitGitHubApi(client, () => pullRequest);

    await github.listPullRequestFilesPage({ owner: "o", repo: "r", number: 1 }, 1, 100);
    await github.getTextFile({ owner: "o", repo: "r" }, "a.txt", "sha");

    const listArgs = client.rest.pulls.listFiles.mock.calls[0]?.[0];
    const contentArgs = client.rest.repos.getContent.mock.calls[0]?.[0];
    expect(listArgs?.request.signal).toBeInstanceOf(AbortSignal);
    expect(contentArgs?.request.signal).toBeInstanceOf(AbortSignal);
    expect(listArgs?.request.signal.aborted).toBe(false);
    expect(contentArgs?.request.signal.aborted).toBe(false);
    expect(listArgs?.request.signal).not.toBe(contentArgs?.request.signal);
  });
});
