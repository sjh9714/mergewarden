import type { AnalysisInput } from "../src/index.js";

export function createAnalysisInput(): AnalysisInput {
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
    },
    changes: {
      files: [],
      totals: {
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      },
    },
    reviews: [],
    checks: [],
    now: "2026-06-13T00:00:00.000Z",
    configSource: "local",
    version: "0.0.0",
  };
}
