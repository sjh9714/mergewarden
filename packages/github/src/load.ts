import {
  CONFIG_FILE_NAME,
  DEFAULT_CONFIG,
  matchesAny,
  parseConfig,
  parseContractFromPrBody,
  type MergeWardenConfig,
  type FileChange,
} from "@mergewarden/core";

import { describeGitHubApiError } from "./errors.js";
import { createRetryBudget, withGitHubRetry } from "./retry.js";
import type {
  CollectionAnalysis,
  GitHubAnalysisInput,
  GitHubApi,
  LoadGitHubAnalysisOptions,
  PullRequestLocator,
  RemotePullFile,
  RemotePullRequest,
  RemoteRepository,
} from "./types.js";

const FILES_PER_PAGE = 100 as const;
const MAX_FILE_PAGES = 30;
const MAX_CHANGED_FILES = FILES_PER_PAGE * MAX_FILE_PAGES;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_TOTAL_CONTENT_BYTES = 64 * 1024 * 1024;
const CONTENT_CONCURRENCY = 8;

type ContentSide = "base" | "head";

interface MutableFileChange extends FileChange {
  baseContent?: string | null;
  headContent?: string | null;
}

interface ContentTask {
  file: MutableFileChange;
  displayPath: string;
  path: string;
  repository: RemoteRepository;
  sha: string;
  side: ContentSide;
}

type ContentTaskResult =
  | { kind: "found"; text: string; byteLength: number }
  | { kind: "gap"; gap: CollectionAnalysis["gaps"][number] };

function applyModeOverride(
  config: MergeWardenConfig,
  modeOverride: MergeWardenConfig["mode"] | undefined,
): MergeWardenConfig {
  return modeOverride ? { ...config, mode: modeOverride } : config;
}

function fileStatus(status: string): FileChange["status"] {
  return status === "added" || status === "modified" || status === "removed" || status === "renamed"
    ? status
    : "modified";
}

function fileChange(file: RemotePullFile): MutableFileChange {
  return {
    path: file.filename,
    ...(file.previousFilename ? { previousPath: file.previousFilename } : {}),
    status: fileStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    ...(file.patch ? { patch: file.patch } : {}),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relevantContentPath(path: string, config: MergeWardenConfig): boolean {
  if (matchesAny(path, config.github_actions.paths)) {
    return true;
  }

  return config.package_scripts.enabled && matchesAny(path, config.package_scripts.paths);
}

function needsContent(file: MutableFileChange, config: MergeWardenConfig): boolean {
  return (
    relevantContentPath(file.path, config) ||
    (file.previousPath !== undefined && relevantContentPath(file.previousPath, config))
  );
}

function contentTasks(
  files: MutableFileChange[],
  pullRequest: RemotePullRequest,
  config: MergeWardenConfig,
): ContentTask[] {
  const tasks: ContentTask[] = [];

  for (const file of files) {
    if (!needsContent(file, config) || file.status === "removed") {
      continue;
    }

    if (file.status !== "added") {
      file.baseContent = null;
      tasks.push({
        file,
        displayPath: file.path,
        path: file.previousPath ?? file.path,
        repository: pullRequest.base.repository,
        sha: pullRequest.base.sha,
        side: "base",
      });
    }

    file.headContent = null;
    tasks.push({
      file,
      displayPath: file.path,
      path: file.path,
      repository: pullRequest.head.repository,
      sha: pullRequest.head.sha,
      side: "head",
    });
  }

  return tasks;
}

function contentGap(task: ContentTask, reason: string): CollectionAnalysis["gaps"][number] {
  return {
    ruleId: "analysis/content-unavailable",
    message: `Unable to read ${task.side} content for ${task.displayPath}; deterministic analysis is incomplete.`,
    path: task.displayPath,
    evidence: [
      { label: "changed_file", value: task.displayPath },
      { label: "content_ref", value: task.side },
      { label: "content_path", value: task.path },
      { label: "reason", value: reason },
    ],
  };
}

function aggregateContentGap(
  acceptedBytes: number,
  task: ContentTask,
  rejectedBytes: number,
): CollectionAnalysis["gaps"][number] {
  return {
    ruleId: "analysis/content-unavailable",
    message:
      "The aggregate decoded-content budget was exceeded; remaining content requests were not scheduled.",
    evidence: [
      { label: "reason_code", value: "aggregate-content-budget-exceeded" },
      { label: "aggregate_content_limit_bytes", value: String(MAX_TOTAL_CONTENT_BYTES) },
      { label: "accepted_content_bytes", value: String(acceptedBytes) },
      { label: "rejected_content_bytes", value: String(rejectedBytes) },
      { label: "next_content_path", value: task.path },
      { label: "next_content_ref", value: task.side },
    ],
  };
}

async function fetchContentTask(
  api: GitHubApi,
  task: ContentTask,
  retryBudget: ReturnType<typeof createRetryBudget>,
): Promise<ContentTaskResult> {
  try {
    const result = await withGitHubRetry(
      `Load ${task.side} content for ${task.displayPath}`,
      retryBudget,
      () => api.getTextFile(task.repository, task.path, task.sha),
    );

    if (result.kind === "not-found") {
      return { kind: "gap", gap: contentGap(task, "GitHub returned 404 Not Found") };
    }

    const byteLength = Buffer.byteLength(result.text, "utf8");

    if (byteLength > MAX_TEXT_BYTES) {
      return {
        kind: "gap",
        gap: contentGap(
          task,
          `decoded content is ${byteLength} bytes; limit is ${MAX_TEXT_BYTES} bytes`,
        ),
      };
    }

    return { kind: "found", text: result.text, byteLength };
  } catch (error) {
    return { kind: "gap", gap: contentGap(task, describeGitHubApiError(error)) };
  }
}

async function loadContentTasks(
  api: GitHubApi,
  tasks: ContentTask[],
  retryBudget: ReturnType<typeof createRetryBudget>,
): Promise<{ contentFileCount: number; gaps: CollectionAnalysis["gaps"] }> {
  const gaps: CollectionAnalysis["gaps"] = [];
  let acceptedBytes = 0;
  let contentFileCount = 0;

  for (let offset = 0; offset < tasks.length; offset += CONTENT_CONCURRENCY) {
    const window = tasks.slice(offset, offset + CONTENT_CONCURRENCY);
    const results = await Promise.all(
      window.map((task) => fetchContentTask(api, task, retryBudget)),
    );

    for (let index = 0; index < window.length; index += 1) {
      const task = window[index];
      const result = results[index];

      if (!task || !result) {
        continue;
      }

      if (result.kind === "gap") {
        gaps.push(result.gap);
        continue;
      }

      if (acceptedBytes + result.byteLength > MAX_TOTAL_CONTENT_BYTES) {
        gaps.push(aggregateContentGap(acceptedBytes, task, result.byteLength));
        return { contentFileCount, gaps };
      }

      if (task.side === "base") {
        task.file.baseContent = result.text;
      } else {
        task.file.headContent = result.text;
      }

      acceptedBytes += result.byteLength;
      contentFileCount += 1;
    }
  }

  return { contentFileCount, gaps };
}

async function loadConfig(
  api: GitHubApi,
  pullRequest: RemotePullRequest,
  options: LoadGitHubAnalysisOptions,
  retryBudget: ReturnType<typeof createRetryBudget>,
): Promise<{ config: MergeWardenConfig; source: "base-branch" | "default" }> {
  const result = await withGitHubRetry(
    `Load ${options.configPath} from base SHA ${pullRequest.base.sha}`,
    retryBudget,
    () => api.getTextFile(pullRequest.base.repository, options.configPath, pullRequest.base.sha),
  );

  if (result.kind === "not-found") {
    if (options.configPath !== CONFIG_FILE_NAME) {
      throw new Error(
        `Unable to load ${options.configPath} from base ref ${pullRequest.base.sha}: config file was not found.`,
      );
    }

    options.warning?.(
      `MergeWarden could not load ${options.configPath} from the base branch; using built-in default policy.`,
    );
    return {
      config: applyModeOverride(DEFAULT_CONFIG, options.modeOverride),
      source: "default",
    };
  }

  const configByteLength = Buffer.byteLength(result.text, "utf8");

  if (configByteLength > MAX_TEXT_BYTES) {
    throw new Error(
      `${options.configPath} is ${configByteLength} bytes; the maximum policy size is ${MAX_TEXT_BYTES} bytes.`,
    );
  }

  return {
    config: applyModeOverride(parseConfig(result.text), options.modeOverride),
    source: "base-branch",
  };
}

function fileListGap(
  expected: number,
  collected: number,
  reason: string,
): CollectionAnalysis["gaps"][number] {
  return {
    ruleId: "analysis/file-list-incomplete",
    message:
      "GitHub did not provide the complete pull request file list; policy analysis was stopped.",
    evidence: [
      { label: "expected_file_count", value: String(expected) },
      { label: "collected_file_count", value: String(collected) },
      { label: "github_file_limit", value: String(MAX_CHANGED_FILES) },
      { label: "reason", value: reason },
    ],
  };
}

async function listPullFiles(
  api: GitHubApi,
  target: PullRequestLocator,
  expected: number,
  retryBudget: ReturnType<typeof createRetryBudget>,
): Promise<RemotePullFile[]> {
  const files: RemotePullFile[] = [];

  for (let page = 1; page <= MAX_FILE_PAGES && files.length < expected; page += 1) {
    const pageFiles = await withGitHubRetry(
      `List pull request files page ${page}`,
      retryBudget,
      () => api.listPullRequestFilesPage(target, page, FILES_PER_PAGE),
    );
    files.push(...pageFiles);

    if (pageFiles.length < FILES_PER_PAGE) {
      break;
    }
  }

  return files;
}

function pullRequestContext(pullRequest: RemotePullRequest) {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body,
    author: pullRequest.author,
    labels: pullRequest.labels,
    branchName: pullRequest.head.ref,
    isFork: pullRequest.head.fork,
    draft: pullRequest.draft,
  };
}

export async function loadGitHubAnalysis(
  api: GitHubApi,
  target: PullRequestLocator,
  options: LoadGitHubAnalysisOptions,
): Promise<GitHubAnalysisInput> {
  const retryBudget = createRetryBudget(options.retry);
  const pullRequest = await withGitHubRetry("Load pull request metadata", retryBudget, () =>
    api.getPullRequest(target),
  );

  if (!Number.isInteger(pullRequest.changedFiles) || pullRequest.changedFiles < 0) {
    throw new Error("GitHub pull request metadata did not include a valid changed_files count.");
  }

  const loadedConfig = await loadConfig(api, pullRequest, options, retryBudget);
  const expected = pullRequest.changedFiles;
  let files: MutableFileChange[] = [];
  let contentFileCount = 0;
  const gaps: CollectionAnalysis["gaps"] = [];

  if (expected > MAX_CHANGED_FILES) {
    gaps.push(
      fileListGap(
        expected,
        0,
        `changed_files exceeds GitHub's ${MAX_CHANGED_FILES}-file API response limit`,
      ),
    );
  } else {
    const remoteFiles = await listPullFiles(api, target, expected, retryBudget);

    if (remoteFiles.length !== expected) {
      gaps.push(fileListGap(expected, remoteFiles.length, "expected and collected counts differ"));
    } else {
      files = [...remoteFiles]
        .sort(
          (left, right) =>
            compareText(left.filename, right.filename) ||
            compareText(left.previousFilename ?? "", right.previousFilename ?? "") ||
            compareText(left.status, right.status),
        )
        .map(fileChange);
      const tasks = contentTasks(files, pullRequest, loadedConfig.config);
      const loadedContent = await loadContentTasks(api, tasks, retryBudget);
      contentFileCount = loadedContent.contentFileCount;
      gaps.push(...loadedContent.gaps);
    }
  }

  const analysis: CollectionAnalysis = {
    complete: gaps.length === 0,
    expectedFileCount: expected,
    analyzedFileCount: gaps.some((gap) => gap.ruleId === "analysis/file-list-incomplete")
      ? 0
      : files.length,
    contentFileCount,
    runtimeRef: options.runtimeRef,
    gaps,
  };

  return {
    repo: {
      owner: pullRequest.base.repository.owner,
      repo: pullRequest.base.repository.repo,
      defaultBranch: pullRequest.base.repository.defaultBranch ?? pullRequest.base.ref,
      baseRef: pullRequest.base.ref,
      baseSha: pullRequest.base.sha,
      headRef: pullRequest.head.ref,
      headSha: pullRequest.head.sha,
    },
    pr: pullRequestContext(pullRequest),
    config: loadedConfig.config,
    contract: parseContractFromPrBody(pullRequest.body),
    changes: {
      files,
      totals: {
        filesChanged: expected,
        additions: files.reduce((sum, file) => sum + file.additions, 0),
        deletions: files.reduce((sum, file) => sum + file.deletions, 0),
      },
    },
    reviews: [],
    checks: [],
    now: options.now,
    configSource: loadedConfig.source,
    version: options.engineVersion,
    analysis,
  };
}
