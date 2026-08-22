import type { RemoteOpenPullRequest, RemotePullRequest, TextFileResult } from "@mergewarden/github";
import { describe, expect, it, vi } from "vitest";

import { triagePublicRepository } from "../src/triage.js";

function summary(
  number: number,
  authorAssociation = "CONTRIBUTOR",
  author = `contributor-${number}`,
): RemoteOpenPullRequest {
  return {
    number,
    title: `Pull request ${number}`,
    body: `Fixes #${number}\n\n${"Useful review context. ".repeat(6)}`,
    author,
    labels: [],
    draft: false,
    authorAssociation,
    updatedAt: `2026-08-${String(number).padStart(2, "0")}T00:00:00Z`,
    htmlUrl: `https://github.com/owner/repo/pull/${number}`,
    head: {
      ref: `change-${number}`,
      sha: `head-${number}`,
      repository: { owner: author, repo: "repo", defaultBranch: "main" },
      fork: true,
    },
    base: {
      ref: "main",
      sha: "base-sha",
      repository: { owner: "owner", repo: "repo", defaultBranch: "main" },
    },
  };
}

function detail(
  pull: RemoteOpenPullRequest,
  overrides: Partial<RemotePullRequest> = {},
): RemotePullRequest {
  return {
    ...pull,
    changedFiles: 2,
    additions: 12,
    deletions: 4,
    ...overrides,
  };
}

function fakeApi(
  pulls: RemoteOpenPullRequest[],
  details = new Map<number, RemotePullRequest | Error>(
    pulls.map((pull) => [pull.number, detail(pull)]),
  ),
  template: TextFileResult = { kind: "not-found" },
) {
  return {
    listOpenPullRequests: vi.fn(async () => pulls),
    getPullRequest: vi.fn(async (target: { number: number }) => {
      const pull = details.get(target.number);
      if (pull instanceof Error) {
        throw pull;
      }
      if (!pull) {
        throw new Error("missing test pull request");
      }
      return pull;
    }),
    getTextFile: vi.fn(async () => template),
  };
}

const now = () => "2026-08-22T00:00:00.000Z";

describe("triagePublicRepository", () => {
  it("filters trusted roles and default maintenance automation", async () => {
    const pulls = [
      summary(1, "OWNER"),
      summary(2, "MEMBER"),
      summary(3, "COLLABORATOR"),
      summary(4, "CONTRIBUTOR", "dependabot[bot]"),
      summary(5, "CONTRIBUTOR", "renovate[bot]"),
      summary(6, "CONTRIBUTOR", "github-actions[bot]"),
      summary(7),
    ];
    const api = fakeApi(pulls);

    const result = await triagePublicRepository("owner/repo", { api, now });

    expect(result.rows.map((row) => row.number)).toEqual([7]);
    expect(result.openPullRequests).toBe(7);
    expect(result.externalPullRequests).toBe(1);
    expect(result.trustedPullRequests).toBe(3);
    expect(result.automationPullRequests).toBe(3);
    expect(api.getPullRequest).toHaveBeenCalledOnce();
  });

  it("keeps external and unknown roles while marking only first contributions", async () => {
    const pulls = [
      summary(1, "CONTRIBUTOR"),
      summary(2, "FIRST_TIME_CONTRIBUTOR"),
      summary(3, "FIRST_TIMER"),
      summary(4, "NONE"),
      summary(5, "UNKNOWN_ROLE"),
    ];
    const api = fakeApi(pulls);

    const result = await triagePublicRepository("owner/repo", { api, now });

    expect(result.rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5]);
    expect(result.rows.map((row) => row.firstContribution)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("lists thirty summaries and loads at most ten external pull requests", async () => {
    const pulls = Array.from({ length: 30 }, (_, index) => summary(index + 1));
    const api = fakeApi(pulls);

    const result = await triagePublicRepository("owner/repo", { api, now });

    expect(api.listOpenPullRequests).toHaveBeenCalledWith({ owner: "owner", repo: "repo" }, 30);
    expect(api.getPullRequest).toHaveBeenCalledTimes(10);
    expect(api.getTextFile).toHaveBeenCalledTimes(3);
    expect(result.rows).toHaveLength(10);
    expect(result.externalPullRequests).toBe(30);
  });

  it("shows four readiness facts and keeps first contribution as context", async () => {
    const pull = summary(1, "FIRST_TIME_CONTRIBUTOR");
    const api = fakeApi(
      [pull],
      new Map([
        [
          1,
          detail(pull, {
            body: "",
            changedFiles: 60,
            additions: 1_600,
            deletions: 20,
          }),
        ],
      ]),
      { kind: "found", text: "## Summary\n\n## Test plan\n" },
    );

    const result = await triagePublicRepository("owner/repo", { api, now });

    expect(result.rows[0]).toMatchObject({
      number: 1,
      firstContribution: true,
      notes: ["no linked issue", "thin description", "template unused", "oversized"],
    });
    expect(api.getTextFile).toHaveBeenCalledOnce();
  });

  it("lifts repository norms before ordering rows by remaining facts", async () => {
    const pulls = Array.from({ length: 8 }, (_, index) => summary(index + 1));
    const details = new Map(
      pulls.map((pull) => [
        pull.number,
        detail(pull, {
          body: "A detailed change with enough review context but no issue reference. ".repeat(2),
          ...(pull.number === 8 ? { additions: 1_600 } : {}),
        }),
      ]),
    );
    const api = fakeApi(pulls, details);

    const result = await triagePublicRepository("owner/repo", { api, now });

    expect(result.uniformNotes).toEqual(["no linked issue"]);
    expect(result.rows[0]).toMatchObject({ number: 8, notes: ["oversized"] });
    expect(result.rows.slice(1).every((row) => row.notes.length === 0)).toBe(true);
  });

  it("keeps readable rows and marks the queue incomplete", async () => {
    const pulls = [summary(1), summary(2), summary(3)];
    const details = new Map<number, RemotePullRequest | Error>([
      [1, detail(pulls[0]!)],
      [2, new Error("head repository disappeared")],
      [3, detail(pulls[2]!)],
    ]);
    const api = fakeApi(pulls, details);

    const result = await triagePublicRepository("owner/repo", { api, now });

    expect(result.analysisComplete).toBe(false);
    expect(result.unreadablePullRequests).toEqual([2]);
    expect(result.rows.map((row) => row.number)).toEqual([1, 3]);
  });
});
