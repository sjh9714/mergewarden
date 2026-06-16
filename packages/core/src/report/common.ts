import type { AnalysisResult, Finding } from "../types.js";

export function humanDecisionLabel(decision: AnalysisResult["decision"]): string {
  if (decision === "block") {
    return "BLOCKED";
  }

  if (decision === "warn") {
    return "NEEDS HUMAN DECISION";
  }

  return "PASSED";
}

export function safeReportValue(value: string, maxLength = 500): string {
  const normalized = value
    .replace(/\r?\n/g, "\\n")
    .replace(/<!--/g, "&lt;!--")
    .replace(/-->/g, "--&gt;")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

const severityRank: Record<Finding["severity"], number> = {
  info: 0,
  warn: 1,
  error: 2,
};

function highestSignalFinding(findings: Finding[]): Finding | undefined {
  return findings.reduce<Finding | undefined>((highest, finding) => {
    if (!highest || severityRank[finding.severity] > severityRank[highest.severity]) {
      return finding;
    }

    return highest;
  }, undefined);
}

export function highestActionableFinding(findings: Finding[]): Finding | undefined {
  return highestSignalFinding(findings.filter((finding) => finding.severity !== "info"));
}

export function recommendedNextStep(result: AnalysisResult): string {
  const finding = highestActionableFinding(result.findings);

  if (!finding) {
    return "No action needed beyond normal review.";
  }

  if (
    finding.ruleId === "workflow/dangerous-pattern" ||
    finding.ruleId === "workflow/permission-escalation"
  ) {
    return "Review the workflow change before merging.";
  }

  if (finding.ruleId === "contract/out-of-scope") {
    return "Review or split the out-of-scope file changes before merging.";
  }

  if (finding.ruleId === "contract/blocked-path") {
    return "Review or remove the blocked path changes before merging.";
  }

  if (finding.ruleId === "agent-control-plane/drift") {
    return "Review the agent instruction/tooling change before merging.";
  }

  if (finding.ruleId === "evidence/missing-test-change") {
    return "Add or review matching test evidence before merging.";
  }

  if (finding.ruleId === "risk/high-risk-path") {
    return "Review the high-risk file change before merging.";
  }

  if (finding.ruleId === "contract/invalid") {
    return "Fix the PR contract before merging.";
  }

  if (finding.ruleId === "contract/missing") {
    return "Add a PR contract before relying on scope checks.";
  }

  return "Review the findings before merging.";
}

export function policyStatus(result: AnalysisResult): string {
  if (result.decision === "block") {
    return "Policy status: blocking.";
  }

  if (result.decision === "warn") {
    return "Policy status: warning today; eligible to become a merge gate after tuning.";
  }

  return "Policy status: no blocking or warning findings.";
}
