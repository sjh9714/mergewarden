import {
  DEFAULT_CONFIG,
  analyze,
  type AnalysisInput,
  type AgentContract,
  type FileChange,
  type Finding,
} from "@mergewarden/core";

export interface CheckScopeRequest {
  /** Paths the agent was asked to change. Empty means no scope was declared. */
  allowedPaths: string[];
  /** Paths the agent was told to leave alone. */
  blockedPaths?: string[];
  /** Paths the agent actually changed, as reported by `git diff --name-only`. */
  changedPaths: string[];
  /** What the agent was asked to do. Recorded in the contract, never interpreted. */
  task?: string;
}

export interface CheckScopeResult {
  ok: boolean;
  findings: Finding[];
  contractBlock: string;
  summary: string;
}

function fileChanges(paths: string[]): FileChange[] {
  return paths.map((path) => ({
    path,
    // The tool is given a list of paths, not a diff. Every rule it can answer works
    // from paths alone, so the status is recorded as a modification rather than
    // guessed at — nothing downstream reads it.
    status: "modified" as const,
    additions: 0,
    deletions: 0,
  }));
}

/**
 * Render the contract exactly as `contract/out-of-scope` will parse it back out of a pull
 * request body, so what the agent checks against locally is what the gate reads later.
 */
export function contractBlock(request: CheckScopeRequest): string {
  const lines = ["<!-- mergewarden-contract", "version: 1"];

  if (request.task) {
    lines.push(`task: ${request.task.replace(/\n/g, " ").trim()}`);
  }

  lines.push("allowed_paths:");
  for (const path of request.allowedPaths) {
    lines.push(`  - ${path}`);
  }

  if (request.blockedPaths?.length) {
    lines.push("blocked_paths:");
    for (const path of request.blockedPaths) {
      lines.push(`  - ${path}`);
    }
  }

  lines.push("-->");
  return lines.join("\n");
}

/**
 * Answer the question a developer is otherwise told to answer by eye: did the agent touch
 * anything outside what it was asked to touch?
 *
 * This runs the same engine the GitHub Action runs, on the same default policy, so a clean
 * result here is the same clean result the gate would produce — not a second opinion that
 * happens to agree. Only rules decidable from paths alone can fire: contract scope, blocked
 * paths, and agent-control-plane drift. Workflow and dependency rules need file contents and
 * are deliberately out of reach.
 */
export async function checkScope(request: CheckScopeRequest): Promise<CheckScopeResult> {
  const contract: AgentContract = {
    version: 1,
    allowed_paths: request.allowedPaths,
    ...(request.blockedPaths?.length ? { blocked_paths: request.blockedPaths } : {}),
  };

  const files = fileChanges(request.changedPaths);

  const input: AnalysisInput = {
    repo: {
      owner: "local",
      repo: "working-tree",
      defaultBranch: "main",
      baseRef: "main",
      baseSha: "local-base",
      headRef: "local-head",
      headSha: "local-head",
    },
    pr: {
      number: 0,
      title: request.task ?? "Local change",
      body: contractBlock(request),
      author: "local-agent",
      labels: [],
      branchName: "local",
      isFork: false,
      draft: false,
    },
    config: DEFAULT_CONFIG,
    contract: request.allowedPaths.length > 0 ? { kind: "valid", contract } : { kind: "missing" },
    changes: {
      files,
      totals: { filesChanged: files.length, additions: 0, deletions: 0 },
    },
    reviews: [],
    checks: [],
    now: "1970-01-01T00:00:00.000Z",
    configSource: "local",
    version: "mcp",
  };

  const result = await analyze(input);

  // Only surface what a path list can actually support. agent/origin-detected is noise here:
  // the caller already knows an agent made the change, that is why they are asking.
  const relevant = result.findings.filter(
    (finding) =>
      finding.ruleId.startsWith("contract/") || finding.ruleId === "agent-control-plane/drift",
  );

  const outOfScope = relevant.filter((f) => f.ruleId === "contract/out-of-scope").length;
  const blocked = relevant.filter((f) => f.ruleId === "contract/blocked-path").length;
  const drift = relevant.filter((f) => f.ruleId === "agent-control-plane/drift").length;

  const parts: string[] = [];
  if (request.allowedPaths.length === 0) {
    parts.push("No scope was declared, so nothing could be checked against it.");
  } else if (outOfScope === 0 && blocked === 0) {
    parts.push(`All ${request.changedPaths.length} changed paths are inside the declared scope.`);
  } else {
    if (outOfScope > 0) parts.push(`${outOfScope} path(s) outside the declared scope.`);
    if (blocked > 0) parts.push(`${blocked} path(s) in a blocked location.`);
  }
  if (drift > 0) {
    parts.push(
      `${drift} agent-instruction file(s) changed — these steer every future agent run in this repository.`,
    );
  }

  return {
    ok: relevant.length === 0 && request.allowedPaths.length > 0,
    findings: relevant,
    contractBlock: contractBlock(request),
    summary: parts.join(" "),
  };
}
