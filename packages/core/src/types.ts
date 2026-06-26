import type { AgentGateConfig } from "./config/schema.js";
import type { ParseContractResult } from "./contract/schema.js";

export type Severity = "info" | "warn" | "error";
export type Decision = "pass" | "warn" | "block";
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
  config: AgentGateConfig;
  contract: ParseContractResult;
  changes: ChangeSet;
  reviews: ReviewEvidence[];
  checks: CheckEvidence[];
  now: string;
  configSource: ConfigSource;
  version: string;
}

export interface AnalysisResult {
  decision: Decision;
  riskScore: number;
  summary: {
    title: string;
    agentDetected: boolean;
    contractPresent: boolean;
    errorCount: number;
    warnCount: number;
    infoCount: number;
  };
  findings: Finding[];
  metadata: {
    analyzedAt: string;
    baseSha: string;
    headSha: string;
    configSource: ConfigSource;
    version: string;
  };
}
