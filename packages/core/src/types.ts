import type { MergeWardenConfig } from "./config/schema.js";
import type { ParseContractResult } from "./contract/schema.js";

export type Severity = "info" | "warn" | "error";
export type Decision = "pass" | "warn" | "block";
export type AnalysisStatus = "passed" | "observed" | "needs-review" | "blocked" | "incomplete";
export type ConfigSource = "base-branch" | "default" | "local";

export interface Evidence {
  label: string;
  value: string;
}

export interface RawFinding {
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  path?: string;
  line?: number;
  evidence: Evidence[];
  remediation: string[];
  tags: string[];
  confidence: "low" | "medium" | "high";
}

export interface EvidenceSnapshot {
  ruleId: string;
  severity: Severity;
  path?: string;
  line?: number;
  evidence: Evidence[];
}

export interface Finding extends RawFinding {
  findingId: string;
  evidenceSnapshot: EvidenceSnapshot;
  disposition: "active" | "waived";
}

export interface RepoContext {
  owner: string;
  repo: string;
  defaultBranch: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
}

export interface PullRequestContext {
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  branchName: string;
  isFork: boolean;
  draft: boolean;
  /**
   * GitHub's relationship between the author and the repository, e.g. `OWNER`, `MEMBER`,
   * `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, `NONE`. Optional so that callers predating its
   * collection keep compiling; rules that read it stay inert when it is absent rather than
   * assuming a value.
   */
  authorAssociation?: string;
}

export interface FileChange {
  path: string;
  previousPath?: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
  baseContent?: string | null;
  headContent?: string | null;
}

export interface ChangeSet {
  files: FileChange[];
  totals: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

export interface CommitContext {
  sha: string;
  message: string;
}

export interface ReviewEvidence {
  reviewer: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  submittedAt?: string;
}

export interface CheckEvidence {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required";
  startedAt?: string;
  completedAt?: string;
  url?: string;
}

export interface AnalysisInput {
  repo: RepoContext;
  pr: PullRequestContext;
  config: MergeWardenConfig;
  contract: ParseContractResult;
  changes: ChangeSet;
  /**
   * Commits belonging to the pull request, when the collector could enumerate all of them.
   * Optional so that callers predating commit collection remain source compatible. Commit
   * trailer rules stay inert when this is undefined: a partial commit list would under-report
   * violations, so MergeWarden declines to decide rather than decide on incomplete evidence.
   */
  commits?: CommitContext[];
  reviews: ReviewEvidence[];
  checks: CheckEvidence[];
  /**
   * Repository documents read from the base branch that are not part of the change. Optional,
   * and each entry is `null` when the collector confirmed the file does not exist — which is
   * different from `undefined`, meaning it was never looked for.
   */
  repoDocs?: {
    pullRequestTemplate?: string | null;
  };
  now: string;
  configSource: ConfigSource;
  version: string;
  /**
   * Completeness information supplied by an API or fixture collector. It is optional so that
   * callers which already possess a complete in-memory change set remain source compatible.
   */
  analysis?: {
    complete: boolean;
    expectedFileCount: number;
    analyzedFileCount: number;
    contentFileCount: number;
    runtimeRef: string;
    gaps?: AnalysisGap[];
  };
}

export interface AnalysisGap {
  ruleId: "analysis/file-list-incomplete" | "analysis/content-unavailable";
  message: string;
  path?: string;
  evidence: Evidence[];
}

export interface AppliedWaiver {
  findingId: string;
  reason: string;
  expiresAt: string;
}

export interface WaivedFinding extends Finding {
  disposition: "waived";
  waiver: AppliedWaiver;
}

export interface AnalysisResult {
  decision: Decision;
  status: AnalysisStatus;
  /** @deprecated Use status and the explicit finding counts. Scheduled for removal in v1. */
  riskScore: number;
  summary: {
    title: string;
    agentDetected: boolean;
    contractPresent: boolean;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    waivedCount: number;
  };
  findings: Finding[];
  waivedFindings: WaivedFinding[];
  metadata: {
    analyzedAt: string;
    baseSha: string;
    headSha: string;
    configSource: ConfigSource;
    version: string;
    analysisComplete: boolean;
    expectedFileCount: number;
    analyzedFileCount: number;
    contentFileCount: number;
    policyDigest: string;
    engineVersion: string;
    runtimeRef: string;
    totalFindingCount: number;
    omittedFindingCount: number;
  };
}
