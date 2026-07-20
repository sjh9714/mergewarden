import { describe, expect, it, vi } from "vitest";

import {
  analyze,
  parseConfig,
  parseContractFromPrBody,
  type AnalysisInput,
} from "@mergewarden/core";
import {
  GitHubApiError,
  loadGitHubAnalysis,
  type GitHubApi,
  type GitHubAnalysisInput,
  type LoadGitHubAnalysisOptions,
  type PullRequestLocator,
  type RemotePullRequest,
} from "@mergewarden/github";
import { HELP_TEXT, runCli, type CliDependencies } from "../src/cli.js";
import { NativeGitHubApi } from "../src/githubApi.js";
import { MERGEWARDEN_VERSION } from "../src/version.js";

function analysisInput(options: { blocked?: boolean; complete?: boolean } = {}): AnalysisInput {
  const files = options.blocked
    ? [
        {
          path: "AGENTS.md",
          status: "modified" as const,
          additions: 1,
          deletions: 0,
        },
      ]
    : [];
  const complete = options.complete ?? true;

  return {
    repo: {
      owner: "owner",
      repo: "project",
      defaultBranch: "main",
      baseRef: "main",
      baseSha: "base-sha",
      headRef: "agent/change",
      headSha: "head-sha",
    },
    pr: {
      number: 17,
      title: "Agent change",
      body: "",
      author: "octocat",
      labels: [],
      branchName: "agent/change",
      isFork: false,
      draft: false,
    },
    config: parseConfig(`version: 1\nmode: ${options.blocked ? "block" : "warn"}\n`),
    contract: parseContractFromPrBody(""),
    changes: {
      files,
      totals: { filesChanged: files.length, additions: files.length, deletions: 0 },
    },
    reviews: [],
    checks: [],
    now: "2026-07-10T00:00:00.000Z",
    configSource: "base-branch",
    version: MERGEWARDEN_VERSION,
    analysis: {
      complete,
      expectedFileCount: files.length,
      analyzedFileCount: complete ? files.length : 0,
      contentFileCount: 0,
      runtimeRef: `mergewarden-cli@${MERGEWARDEN_VERSION}`,
      gaps: complete
        ? []
        : [
            {
              ruleId: "analysis/file-list-incomplete",
              message: "The full pull request file list was not available.",
              evidence: [
                { label: "expected_file_count", value: String(files.length) },
                { label: "analyzed_file_count", value: "0" },
              ],
            },
          ],
    },
  };
}

function dependencies(
  input: AnalysisInput,
  options: {
    environment?: CliDependencies["environment"];
    onApiToken?: (token: string | undefined) => void;
    onLoad?: (target: PullRequestLocator, loaderOptions: LoadGitHubAnalysisOptions) => void;
  } = {},
): CliDependencies {
  return {
    environment: options.environment ?? {},
    now: () => "2026-07-10T00:00:00.000Z",
    analyze,
    createGitHubApi(token) {
      options.onApiToken?.(token);
      return {} as GitHubApi;
    },
    async loadGitHubAnalysis(_api, target, loaderOptions) {
      options.onLoad?.(target, loaderOptions);
      return input as GitHubAnalysisInput;
    },
  };
}

function io() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    value: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
  };
}

describe("CLI scan", () => {
  it("shows help and version with exit code 0", async () => {
    const helpIo = io();
    const versionIo = io();

    expect(await runCli(["--help"], helpIo.value)).toBe(0);
    expect(helpIo.stdout.join("")).toBe(HELP_TEXT);
    expect(helpIo.stderr).toEqual([]);
    expect(await runCli(["--version"], versionIo.value)).toBe(0);
    expect(versionIo.stdout.join("")).toBe(`${MERGEWARDEN_VERSION}\n`);
  });

  it.each([
    ["scan", "--help"],
    ["replay", "--help"],
  ])("shows command help for %s", async (...argv) => {
    const output = io();
    expect(await runCli(argv, output.value)).toBe(0);
    expect(output.stdout.join("")).toBe(HELP_TEXT);
    expect(output.stderr).toEqual([]);
  });

  it.each([
    ["scan", "--version"],
    ["replay", "--version"],
  ])("shows the version for %s", async (...argv) => {
    const output = io();
    expect(await runCli(argv, output.value)).toBe(0);
    expect(output.stdout.join("")).toBe(`${MERGEWARDEN_VERSION}\n`);
    expect(output.stderr).toEqual([]);
  });

  it("scans shorthand targets as JSON and prefers GH_TOKEN", async () => {
    const output = io();
    const tokenSpy = vi.fn();
    const loadSpy = vi.fn();
    const exitCode = await runCli(
      ["scan", "owner/project#17", "--format", "json"],
      output.value,
      dependencies(analysisInput(), {
        environment: { GH_TOKEN: "gh-token", GITHUB_TOKEN: "github-token" },
        onApiToken: tokenSpy,
        onLoad: loadSpy,
      }),
    );

    expect(exitCode).toBe(0);
    expect(tokenSpy).toHaveBeenCalledWith("gh-token");
    expect(loadSpy).toHaveBeenCalledWith(
      { owner: "owner", repo: "project", number: 17 },
      expect.objectContaining({
        configPath: "mergewarden.yml",
        engineVersion: MERGEWARDEN_VERSION,
        runtimeRef: `mergewarden-cli@${MERGEWARDEN_VERSION}`,
      }),
    );
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      decision: "pass",
      status: "passed",
    });
    expect(output.stderr).toEqual([]);
  });

  it("runs the native API collector and analyzer end to end without fetching PR code", async () => {
    const pullRequest: RemotePullRequest = {
      number: 17,
      title: "Update agent instructions",
      body: "",
      author: "octocat",
      labels: [],
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
    };
    const fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/repos/owner/project/pulls/17")) {
        return new Response(
          JSON.stringify({
            number: pullRequest.number,
            title: pullRequest.title,
            body: pullRequest.body,
            user: { login: pullRequest.author },
            labels: [],
            draft: false,
            changed_files: 1,
            head: {
              ref: pullRequest.head.ref,
              sha: pullRequest.head.sha,
              repo: {
                name: pullRequest.head.repository.repo,
                owner: { login: pullRequest.head.repository.owner },
                default_branch: "main",
                fork: true,
              },
            },
            base: {
              ref: pullRequest.base.ref,
              sha: pullRequest.base.sha,
              repo: {
                name: pullRequest.base.repository.repo,
                owner: { login: pullRequest.base.repository.owner },
                default_branch: "main",
                fork: false,
              },
            },
          }),
        );
      }
      if (url.includes("/contents/mergewarden.yml?ref=base-sha")) {
        return new Response("version: 1\nmode: block\n");
      }
      if (url.includes("/pulls/17/files?per_page=100&page=1")) {
        return new Response(
          JSON.stringify([
            {
              filename: "AGENTS.md",
              status: "modified",
              additions: 1,
              deletions: 0,
            },
          ]),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const output = io();

    const exitCode = await runCli(["scan", "owner/project#17", "--format", "json"], output.value, {
      environment: { GH_TOKEN: "token" },
      now: () => "2026-07-10T00:00:00.000Z",
      analyze,
      loadGitHubAnalysis,
      createGitHubApi: (token) => new NativeGitHubApi({ token, fetch }),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      decision: "block",
      status: "blocked",
      metadata: { analysisComplete: true, expectedFileCount: 1, analyzedFileCount: 1 },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.map(([url]) => String(url)).join("\n")).not.toContain(
      "/contents/AGENTS.md",
    );
  });

  it("accepts full URLs, config paths, mode overrides, and markdown output", async () => {
    const output = io();
    const loadSpy = vi.fn();
    const exitCode = await runCli(
      [
        "scan",
        "https://github.com/owner/project/pull/17",
        "--config",
        ".github/mergewarden.yml",
        "--mode",
        "observe",
        "--format",
        "markdown",
      ],
      output.value,
      dependencies(analysisInput(), {
        environment: { GITHUB_TOKEN: "github-token" },
        onLoad: loadSpy,
      }),
    );

    expect(exitCode).toBe(0);
    expect(loadSpy).toHaveBeenCalledWith(
      { owner: "owner", repo: "project", number: 17 },
      expect.objectContaining({ configPath: ".github/mergewarden.yml", modeOverride: "observe" }),
    );
    expect(output.stdout.join("")).toContain("# MergeWarden: PASSED");
  });

  it("supports unauthenticated public scans and explains the lower rate limit", async () => {
    const output = io();
    const tokenSpy = vi.fn();
    const exitCode = await runCli(
      ["scan", "owner/project#17"],
      output.value,
      dependencies(analysisInput(), { onApiToken: tokenSpy }),
    );

    expect(exitCode).toBe(0);
    expect(tokenSpy).toHaveBeenCalledWith(undefined);
    expect(output.stderr.join("")).toContain("scanning without authentication");
  });

  it("prints actionable GitHub API metadata without a stack trace", async () => {
    const output = io();
    const failing = dependencies(analysisInput(), { environment: { GH_TOKEN: "secret-token" } });
    failing.loadGitHubAnalysis = async () => {
      throw new GitHubApiError("Load pull request: rate limited", {
        status: 429,
        requestId: "request-123",
      });
    };

    expect(await runCli(["scan", "owner/project#17"], output.value, failing)).toBe(2);
    expect(output.stderr.join("")).toContain("status=429");
    expect(output.stderr.join("")).toContain("request_id=request-123");
    expect(output.stderr.join("")).not.toContain("secret-token");
    expect(output.stderr.join("")).not.toContain("at ");
  });

  it("returns 1 for a complete block and 2 for an incomplete analysis", async () => {
    const blocked = await runCli(
      ["scan", "owner/project#17"],
      io().value,
      dependencies(analysisInput({ blocked: true }), { environment: { GH_TOKEN: "token" } }),
    );
    const incompleteOutput = io();
    const incomplete = await runCli(
      ["scan", "owner/project#17"],
      incompleteOutput.value,
      dependencies(analysisInput({ blocked: true, complete: false }), {
        environment: { GH_TOKEN: "token" },
      }),
    );

    expect(blocked).toBe(1);
    expect(incomplete).toBe(2);
    expect(incompleteOutput.stdout.join("")).toContain("Analysis: incomplete");
    expect(incompleteOutput.stdout.join("")).toContain("Files analyzed: 0 of 1");
  });

  it.each([
    { argv: [] },
    { argv: ["unknown"] },
    { argv: ["scan"] },
    { argv: ["scan", "owner/project#0"] },
    { argv: ["scan", "owner/project#17", "--format", "xml"] },
    { argv: ["scan", "owner/project#17", "--config", "../mergewarden.yml"] },
    { argv: ["scan", "owner/project#17", "--mode", "strict"] },
    { argv: ["scan", "owner/project#17", "--unknown"] },
  ])("returns 2 without stdout for invalid invocation $argv", async ({ argv }) => {
    const output = io();
    expect(await runCli(argv, output.value, dependencies(analysisInput()))).toBe(2);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join("")).toContain("MergeWarden CLI error:");
  });
});
