import { describe, expect, it, vi } from "vitest";

import {
  GitHubApiError,
  loadGitHubAnalysis,
  type GitHubApi,
  type LoadGitHubAnalysisOptions,
  type PullRequestLocator,
  type RemotePullFile,
  type RemotePullRequest,
  type RemoteRepository,
  type TextFileResult,
} from "../src/index.js";

const TARGET: PullRequestLocator = { owner: "base", repo: "repo", number: 7 };
const BASE_REPO: RemoteRepository = { owner: "base", repo: "repo", defaultBranch: "main" };
const HEAD_REPO: RemoteRepository = { owner: "base", repo: "repo" };
const CONFIG = "version: 1\nmode: block\n";

function pullRequest(overrides: Partial<RemotePullRequest> = {}): RemotePullRequest {
  return {
    number: 7,
    title: "Change workflows",
    body: "",
    author: "agent",
    labels: [],
    draft: false,
    changedFiles: 0,
    head: { ref: "feature", sha: "head-sha", repository: HEAD_REPO, fork: false },
    base: { ref: "main", sha: "base-sha", repository: BASE_REPO },
    ...overrides,
  };
}

function changedFile(path: string, overrides: Partial<RemotePullFile> = {}): RemotePullFile {
  return {
    filename: path,
    status: "modified",
    additions: 1,
    deletions: 1,
    ...overrides,
  };
}

interface ApiOptions {
  pull?: RemotePullRequest;
  files?: RemotePullFile[];
  pages?: Record<number, RemotePullFile[]>;
  content?: (repository: RemoteRepository, path: string, sha: string) => Promise<TextFileResult>;
}

function api(options: ApiOptions = {}): GitHubApi {
  const files = options.files ?? [];
  return {
    getPullRequest: vi.fn(async () => options.pull ?? pullRequest({ changedFiles: files.length })),
    listPullRequestFilesPage: vi.fn(async (_target, page) =>
      options.pages ? (options.pages[page] ?? []) : files.slice((page - 1) * 100, page * 100),
    ),
    getTextFile: vi.fn(async (repository, path, sha) => {
      if (path === "mergewarden.yml") {
        return { kind: "found", text: CONFIG };
      }

      return options.content
        ? options.content(repository, path, sha)
        : { kind: "found", text: "permissions: {}\n" };
    }),
  };
}

function options(overrides: Partial<LoadGitHubAnalysisOptions> = {}): LoadGitHubAnalysisOptions {
  return {
    configPath: "mergewarden.yml",
    now: "2026-07-10T00:00:00.000Z",
    engineVersion: "0.3.0",
    runtimeRef: "test@0.3.0",
    retry: { sleep: vi.fn(async () => undefined), now: () => 0 },
    ...overrides,
  };
}

describe("loadGitHubAnalysis", () => {
  it("stops before listing files when changed_files exceeds GitHub's 3,000-file limit", async () => {
    const github = api({ pull: pullRequest({ changedFiles: 3_001 }) });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(github.listPullRequestFilesPage).not.toHaveBeenCalled();
    expect(loaded.analysis).toMatchObject({
      complete: false,
      expectedFileCount: 3_001,
      analyzedFileCount: 0,
      contentFileCount: 0,
    });
    expect(loaded.analysis.gaps).toHaveLength(1);
    expect(loaded.analysis.gaps[0]?.ruleId).toBe("analysis/file-list-incomplete");
    expect(loaded.changes.files).toEqual([]);
  });

  it("stops policy analysis when authoritative and collected file counts differ", async () => {
    const files = Array.from({ length: 41 }, (_, index) => changedFile(`src/${index}.ts`));
    const github = api({ pull: pullRequest({ changedFiles: 42 }), files });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(loaded.analysis.complete).toBe(false);
    expect(loaded.analysis.analyzedFileCount).toBe(0);
    expect(loaded.analysis.gaps[0]?.evidence).toEqual(
      expect.arrayContaining([{ label: "collected_file_count", value: "41" }]),
    );
    expect(loaded.changes.files).toEqual([]);
  });

  it("fetches content only for configured workflows and package manifests", async () => {
    const ordinary = Array.from({ length: 100 }, (_, index) => changedFile(`src/${index}.ts`));
    const files = [
      ...ordinary,
      changedFile(".github/workflows/ci.yml"),
      changedFile(".github/workflows/release.yaml"),
      changedFile("package.json"),
    ];
    const github = api({ pull: pullRequest({ changedFiles: files.length }), files });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(loaded.analysis).toMatchObject({
      complete: true,
      analyzedFileCount: 103,
      contentFileCount: 6,
    });
    expect(github.getTextFile).toHaveBeenCalledTimes(7);
    expect(github.listPullRequestFilesPage).toHaveBeenNthCalledWith(1, TARGET, 1, 100);
    expect(github.listPullRequestFilesPage).toHaveBeenNthCalledWith(2, TARGET, 2, 100);
    expect(
      vi.mocked(github.getTextFile).mock.calls.filter(([, path]) => path.startsWith("src/")),
    ).toHaveLength(0);
  });

  it("normalizes changed files into deterministic path order", async () => {
    const files = [changedFile("z.ts"), changedFile("a.ts"), changedFile("m.ts")];
    const github = api({ pull: pullRequest({ changedFiles: files.length }), files });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(loaded.changes.files.map((file) => file.path)).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  it("keeps content request concurrency at or below eight", async () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      changedFile(`.github/workflows/${index}.yml`, { status: "added" }),
    );
    let active = 0;
    let maximum = 0;
    const github = api({
      pull: pullRequest({ changedFiles: files.length }),
      files,
      content: async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return { kind: "found", text: "permissions: {}\n" };
      },
    });

    await loadGitHubAnalysis(github, TARGET, options());

    expect(maximum).toBe(8);
  });

  it("stops scheduling new windows after the 64 MiB aggregate content budget is exceeded", async () => {
    const files = Array.from({ length: 80 }, (_, index) =>
      changedFile(`.github/workflows/${String(index).padStart(3, "0")}.yml`, {
        status: "added",
      }),
    );
    const oneMiB = "x".repeat(1024 * 1024);
    const github = api({
      pull: pullRequest({ changedFiles: files.length }),
      files,
      content: async () => ({ kind: "found", text: oneMiB }),
    });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(loaded.analysis).toMatchObject({
      complete: false,
      contentFileCount: 64,
    });
    expect(loaded.analysis.gaps).toHaveLength(1);
    expect(loaded.analysis.gaps[0]).toMatchObject({
      ruleId: "analysis/content-unavailable",
      evidence: expect.arrayContaining([
        { label: "reason_code", value: "aggregate-content-budget-exceeded" },
        { label: "aggregate_content_limit_bytes", value: "67108864" },
        { label: "accepted_content_bytes", value: "67108864" },
      ]),
    });
    // Config + 64 accepted requests + one eight-request detection window. No later window starts.
    expect(github.getTextFile).toHaveBeenCalledTimes(73);
  });

  it("reads fork head content from the fork repository and base content from the base repository", async () => {
    const fork = { owner: "contributor", repo: "repo" };
    const github = api({
      pull: pullRequest({
        changedFiles: 1,
        head: { ref: "feature", sha: "fork-sha", repository: fork, fork: true },
      }),
      files: [changedFile(".github/workflows/ci.yml")],
    });

    await loadGitHubAnalysis(github, TARGET, options());

    expect(github.getTextFile).toHaveBeenCalledWith(
      BASE_REPO,
      ".github/workflows/ci.yml",
      "base-sha",
    );
    expect(github.getTextFile).toHaveBeenCalledWith(fork, ".github/workflows/ci.yml", "fork-sha");
  });

  it("does not fetch content for a removed workflow", async () => {
    const github = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile(".github/workflows/old.yml", { status: "removed" })],
    });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(github.getTextFile).toHaveBeenCalledTimes(1);
    expect(loaded.analysis.complete).toBe(true);
  });

  it("marks required missing and oversized content as incomplete", async () => {
    const files = [
      changedFile(".github/workflows/missing.yml", { status: "added" }),
      changedFile(".github/workflows/large.yml", { status: "added" }),
    ];
    const github = api({
      pull: pullRequest({ changedFiles: files.length }),
      files,
      content: async (_repository, path) =>
        path.includes("missing")
          ? { kind: "not-found" }
          : { kind: "found", text: "x".repeat(1024 * 1024 + 1) },
    });

    const loaded = await loadGitHubAnalysis(github, TARGET, options());

    expect(loaded.analysis.complete).toBe(false);
    expect(loaded.analysis.gaps).toHaveLength(2);
    expect(loaded.analysis.gaps.map((gap) => gap.ruleId)).toEqual([
      "analysis/content-unavailable",
      "analysis/content-unavailable",
    ]);
  });

  it("uses built-in policy only for a confirmed 404 at the default config path", async () => {
    const warning = vi.fn();
    const github = api();
    vi.mocked(github.getTextFile).mockResolvedValueOnce({ kind: "not-found" });

    const loaded = await loadGitHubAnalysis(github, TARGET, options({ warning }));

    expect(loaded.configSource).toBe("default");
    expect(warning).toHaveBeenCalledOnce();
  });

  it("rejects a missing custom config path", async () => {
    const github = api();
    vi.mocked(github.getTextFile).mockResolvedValueOnce({ kind: "not-found" });

    await expect(
      loadGitHubAnalysis(github, TARGET, options({ configPath: ".github/gate.yml" })),
    ).rejects.toThrow("config file was not found");
  });

  it("rejects base policy content larger than one MiB", async () => {
    const github = api();
    vi.mocked(github.getTextFile).mockResolvedValueOnce({
      kind: "found",
      text: "x".repeat(1024 * 1024 + 1),
    });

    await expect(loadGitHubAnalysis(github, TARGET, options())).rejects.toThrow(
      "maximum policy size is 1048576 bytes",
    );
  });

  it("retries transient errors but not ordinary 403 errors", async () => {
    const transient = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(transient.listPullRequestFilesPage)
      .mockRejectedValueOnce(new GitHubApiError("Unavailable", { status: 503 }))
      .mockResolvedValueOnce([changedFile("src/a.ts")]);
    const sleep = vi.fn(async () => undefined);

    await loadGitHubAnalysis(transient, TARGET, options({ retry: { sleep, now: () => 0 } }));

    expect(transient.listPullRequestFilesPage).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);

    const forbidden = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(forbidden.listPullRequestFilesPage).mockRejectedValue(
      new GitHubApiError("Forbidden", { status: 403 }),
    );

    await expect(loadGitHubAnalysis(forbidden, TARGET, options())).rejects.toThrow("Forbidden");
    expect(forbidden.listPullRequestFilesPage).toHaveBeenCalledOnce();

    const forbiddenWithResetHeader = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(forbiddenWithResetHeader.listPullRequestFilesPage).mockRejectedValue(
      new GitHubApiError("Resource not accessible by integration", {
        status: 403,
        rateLimitResetAt: 5_000,
      }),
    );

    await expect(
      loadGitHubAnalysis(forbiddenWithResetHeader, TARGET, options({ retry: { sleep } })),
    ).rejects.toThrow("Resource not accessible by integration");
    expect(forbiddenWithResetHeader.listPullRequestFilesPage).toHaveBeenCalledOnce();
  });

  it.each([502, 504])(
    "retries GitHub status %s with transient backoff despite rate-limit headers",
    async (status) => {
      const github = api({
        pull: pullRequest({ changedFiles: 1 }),
        files: [changedFile("src/a.ts")],
      });
      vi.mocked(github.listPullRequestFilesPage)
        .mockRejectedValueOnce(
          new GitHubApiError("Transient", {
            status,
            retryAfterMs: 60_001,
            rateLimitResetAt: 3_600_000,
          }),
        )
        .mockResolvedValueOnce([changedFile("src/a.ts")]);
      const sleep = vi.fn(async () => undefined);

      await loadGitHubAnalysis(github, TARGET, options({ retry: { sleep, now: () => 0 } }));

      expect(github.listPullRequestFilesPage).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(250);
    },
  );

  it("retries network failures and stops after three total attempts", async () => {
    const github = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(github.listPullRequestFilesPage).mockRejectedValue(new Error("socket closed"));
    const sleep = vi.fn(async () => undefined);

    await expect(
      loadGitHubAnalysis(github, TARGET, options({ retry: { sleep, now: () => 0 } })),
    ).rejects.toThrow("socket closed");
    expect(github.listPullRequestFilesPage).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[250], [1_000]]);
  });

  it("honors Retry-After and rejects waits beyond the shared 60-second budget", async () => {
    const retrying = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(retrying.listPullRequestFilesPage)
      .mockRejectedValueOnce(
        new GitHubApiError("Rate limited", { status: 429, retryAfterMs: 2_000 }),
      )
      .mockResolvedValueOnce([changedFile("src/a.ts")]);
    const sleep = vi.fn(async () => undefined);

    await loadGitHubAnalysis(retrying, TARGET, options({ retry: { sleep, now: () => 0 } }));

    expect(sleep).toHaveBeenCalledWith(2_000);

    const excessive = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(excessive.listPullRequestFilesPage).mockRejectedValue(
      new GitHubApiError("Rate limited", { status: 429, retryAfterMs: 60_001 }),
    );

    await expect(loadGitHubAnalysis(excessive, TARGET, options())).rejects.toThrow(
      "exceeds the 60000ms total retry budget",
    );
  });

  it("honors the GitHub rate-limit reset time", async () => {
    const github = api({
      pull: pullRequest({ changedFiles: 1 }),
      files: [changedFile("src/a.ts")],
    });
    vi.mocked(github.listPullRequestFilesPage)
      .mockRejectedValueOnce(
        new GitHubApiError("secondary rate limit", {
          status: 403,
          rateLimitResetAt: 5_000,
        }),
      )
      .mockResolvedValueOnce([changedFile("src/a.ts")]);
    const sleep = vi.fn(async () => undefined);

    await loadGitHubAnalysis(github, TARGET, options({ retry: { sleep, now: () => 1_000 } }));

    expect(sleep).toHaveBeenCalledWith(4_000);
  });
});
