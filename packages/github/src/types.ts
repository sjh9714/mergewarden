import type { AgentGateConfig, AnalysisInput } from "@agent-gate/core";

export interface PullRequestLocator {
  owner: string;
  repo: string;
  number: number;
}

export interface RemoteRepository {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export interface RemotePullRequest {
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  draft: boolean;
  changedFiles: number;
  head: {
    ref: string;
    sha: string;
    repository: RemoteRepository;
    fork: boolean;
  };
  base: {
    ref: string;
    sha: string;
    repository: RemoteRepository;
  };
}

export interface RemotePullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  previousFilename?: string;
}

export type TextFileResult = { kind: "found"; text: string } | { kind: "not-found" };

export interface GitHubApi {
  getPullRequest(target: PullRequestLocator): Promise<RemotePullRequest>;
  listPullRequestFilesPage(
    target: PullRequestLocator,
    page: number,
    perPage: 100,
  ): Promise<RemotePullFile[]>;
  getTextFile(repository: RemoteRepository, path: string, sha: string): Promise<TextFileResult>;
}

export interface RetryOptions {
  maxAttempts?: number;
  maxTotalDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export interface LoadGitHubAnalysisOptions {
  configPath: string;
  modeOverride?: AgentGateConfig["mode"];
  now: string;
  engineVersion: string;
  runtimeRef: string;
  warning?: (message: string) => void;
  retry?: RetryOptions;
}

export interface CollectionAnalysis {
  complete: boolean;
  expectedFileCount: number;
  analyzedFileCount: number;
  contentFileCount: number;
  runtimeRef: string;
  gaps: Array<{
    ruleId: "analysis/file-list-incomplete" | "analysis/content-unavailable";
    message: string;
    path?: string;
    evidence: Array<{ label: string; value: string }>;
  }>;
}

export type GitHubAnalysisInput = AnalysisInput & { analysis: CollectionAnalysis };
