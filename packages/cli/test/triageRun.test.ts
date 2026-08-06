import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `runTriageCli` end to end, with the GitHub calls stubbed.
 *
 * This file exists because the command shipped with an unreadable pull request folded into the
 * findings: a run against a public repository with no token exhausted GitHub's 60-per-hour
 * quota, printed nine "could not be read" rows, counted them in "have something a maintainer
 * checks by hand", and exited 0. Every test in the suite passed, because none of them ever
 * called this function.
 */

const loadGitHubAnalysis = vi.fn();
const analyze = vi.fn();

vi.mock("@mergewarden/github", () => ({
  loadGitHubAnalysis: (...args: unknown[]) => loadGitHubAnalysis(...args),
}));

vi.mock("@mergewarden/core", () => ({
  analyze: (...args: unknown[]) => analyze(...args),
}));

const { runTriageCli } = await import("../src/triage.js");

function pull(number: number, author = "someone") {
  return {
    number,
    title: `pull ${number}`,
    head: { ref: `branch-${number}` },
    user: { login: author },
  };
}

function stubList(pulls: ReturnType<typeof pull>[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(pulls), { status: 200 })),
  );
}

/** Shaped like GitHub's answer to an exhausted quota: 403 carrying a reset timestamp. */
function quotaError() {
  return Object.assign(new Error("rate limit exceeded"), {
    status: 403,
    rateLimitResetAt: 1_800_000_000,
  });
}

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    stdout: (t: string) => out.push(t),
    stderr: (t: string) => err.push(t),
    get out() {
      return out.join("");
    },
    get err() {
      return err.join("");
    },
  };
}

const analysisInput = { config: { triage: { no_linked_issue: "off", exclude_authors: [] } } };

beforeEach(() => {
  loadGitHubAnalysis.mockReset();
  analyze.mockReset();
  loadGitHubAnalysis.mockResolvedValue(structuredClone(analysisInput));
  analyze.mockResolvedValue({ findings: [{ ruleId: "triage/oversized-change" }] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runTriageCli reports an incomplete read as incomplete", () => {
  it("does not count a pull request it could not read as work waiting for a maintainer", async () => {
    stubList([pull(1), pull(2), pull(3)]);
    loadGitHubAnalysis.mockImplementation(async (_api: unknown, target: { number: number }) => {
      if (target.number === 2) throw new Error("head repository is gone");
      return structuredClone(analysisInput);
    });

    const channel = io();
    const code = await runTriageCli(["owner/repo"], channel, {});

    expect(channel.out).toContain("2 open pull request(s) read. 2 have something");
    expect(channel.out).toContain("1 could not be read");
    // The old behaviour: an unreadable pull request became a row with a note, so it was both
    // listed and counted as a finding.
    expect(channel.out).not.toContain("#2");
    expect(code).toBe(1);
  });

  it("stops at an exhausted quota rather than blaming every remaining pull request", async () => {
    stubList([pull(1), pull(2), pull(3), pull(4)]);
    loadGitHubAnalysis.mockRejectedValue(quotaError());

    const channel = io();
    const code = await runTriageCli(["owner/repo"], channel, {});

    expect(loadGitHubAnalysis).toHaveBeenCalledTimes(1);
    expect(channel.err).toContain("none of the 4 open pull request(s) could be read");
    expect(code).toBe(1);
  });

  it("names GH_TOKEN when the quota ran out and there was no token", async () => {
    stubList([pull(1), pull(2)]);
    loadGitHubAnalysis.mockRejectedValue(quotaError());

    const channel = io();
    await runTriageCli(["owner/repo"], channel, {});

    expect(channel.err).toContain("60 unauthenticated requests");
    expect(channel.err).toContain("GH_TOKEN");
  });

  it("does not tell an authenticated caller to set GH_TOKEN", async () => {
    stubList([pull(1), pull(2)]);
    loadGitHubAnalysis.mockRejectedValue(quotaError());

    const channel = io();
    await runTriageCli(["owner/repo"], channel, { GH_TOKEN: "t" });

    expect(channel.err).not.toContain("GH_TOKEN to a personal access token");
    expect(channel.err).toContain("--limit");
  });

  it("marks the JSON view incomplete and agrees with the human one", async () => {
    stubList([pull(1), pull(2)]);
    loadGitHubAnalysis.mockImplementation(async (_api: unknown, target: { number: number }) => {
      if (target.number === 2) throw new Error("gone");
      return structuredClone(analysisInput);
    });

    const channel = io();
    const code = await runTriageCli(["owner/repo", "--format", "json"], channel, {});
    const report = JSON.parse(channel.out) as {
      analysisComplete: boolean;
      unreadablePullRequests: number[];
      rows: { number: number }[];
    };

    expect(report.analysisComplete).toBe(false);
    expect(report.unreadablePullRequests).toEqual([2]);
    expect(report.rows.map((r) => r.number)).toEqual([1]);
    expect(code).toBe(1);
  });

  it("tells an unauthenticated caller about GH_TOKEN when even the listing is refused", async () => {
    const fetchMock = vi.fn(
      async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const channel = io();
    const code = await runTriageCli(["owner/repo"], channel, {});

    expect(channel.err).toContain("60 unauthenticated requests");
    expect(channel.err).not.toContain("rate limiting this token");
    expect(code).toBe(2);
    // An exhausted hourly quota is not retried. Retrying it spent two minutes of the caller's
    // time on a wait that could not have helped.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still retries a secondary rate limit, which does recover", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 403, headers: { "retry-after": "1" } }))
      .mockResolvedValue(new Response(JSON.stringify([pull(1)]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const channel = io();
    const code = await runTriageCli(["owner/repo"], channel, { GH_TOKEN: "t" });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(code).toBe(0);
  });

  it("still exits zero when everything was read", async () => {
    stubList([pull(1), pull(2)]);

    const channel = io();
    const code = await runTriageCli(["owner/repo"], channel, {});

    expect(channel.out).toContain("2 open pull request(s) read.");
    expect(channel.out).not.toContain("could not be read");
    expect(code).toBe(0);
  });
});
