import {
  DEFAULT_CONFIG,
  type AgentGateConfig,
  type AnalysisInput,
  type ChangeSet,
  type FileChange,
  type ParseContractResult,
  type PullRequestContext,
} from "../src/index.js";

interface CreateAnalysisInputOptions {
  config?: AgentGateConfig;
  contract?: ParseContractResult;
  pr?: Partial<PullRequestContext>;
  files?: FileChange[];
  changes?: ChangeSet;
}

function changesFromFiles(files: FileChange[]): ChangeSet {
  return {
    files,
    totals: {
      filesChanged: files.length,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
    },
  };
}

export function fileChange(path: string): FileChange {
  return {
    path,
    status: "modified",
    additions: 1,
    deletions: 0,
  };
}

export function createAnalysisInput(options: CreateAnalysisInputOptions = {}): AnalysisInput {
  const files = options.files ?? [];

  return {
    repo: {
      owner: "agent-gate",
      repo: "demo",
      defaultBranch: "main",
      baseRef: "main",
      baseSha: "base-sha",
      headRef: "codex/task-1-scaffold",
      headSha: "head-sha",
    },
    pr: {
      number: 42,
      title: "Scaffold Agent Gate",
      body: "",
      author: "codex",
      labels: [],
      branchName: "codex/task-1-scaffold",
      isFork: false,
      draft: false,
      ...options.pr,
    },
    config: options.config ?? DEFAULT_CONFIG,
    contract: options.contract ?? { kind: "missing" },
    changes: options.changes ?? changesFromFiles(files),
    reviews: [],
    checks: [],
    now: "2026-06-13T00:00:00.000Z",
    configSource: "local",
    version: "0.0.0",
  };
}
