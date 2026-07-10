import { createHash } from "node:crypto";

import type { AnalysisResult, Finding } from "../types.js";

// Findings are already bounded to a 2 KiB preview plus a digest. This slightly larger report
// bound preserves that digest instead of truncating and hashing the bounded representation again.
const MAX_DYNAMIC_VALUE_LENGTH = 2_150;

function isSafeReportCharacter(codePoint: number): boolean {
  return (
    codePoint === 10 ||
    (codePoint > 31 &&
      !(codePoint >= 127 && codePoint <= 159) &&
      !(codePoint >= 0x202a && codePoint <= 0x202e) &&
      !(codePoint >= 0x2066 && codePoint <= 0x2069))
  );
}

export function humanDecisionLabel(result: Pick<AnalysisResult, "status">): string {
  const labels: Record<AnalysisResult["status"], string> = {
    passed: "PASSED",
    observed: "OBSERVED FINDINGS",
    "needs-review": "NEEDS REVIEW",
    blocked: "BLOCKED",
    incomplete: "ANALYSIS INCOMPLETE",
  };

  return labels[result.status];
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([`*[\]#|])/g, "\\$1")
    .replace(/^([+-])\s/, "\\$1 ")
    .replace(/^(\d+)\.\s/, "$1\\. ")
    .replace(/@/g, "@\u200b");
}

export function safeReportValue(value: string, maxLength = MAX_DYNAMIC_VALUE_LENGTH): string {
  const normalized = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return isSafeReportCharacter(codePoint);
    })
    .join("")
    .replace(/\\/g, "&#92;")
    .replace(/\n/g, "\\n")
    .replace(/\s+/g, " ")
    .trim();
  const digest = createHash("sha256").update(normalized).digest("hex");
  const preview =
    normalized.length <= maxLength
      ? normalized
      : `${normalized.slice(0, Math.max(0, maxLength - 1))}… [sha256:${digest}]`;

  return escapeMarkdown(preview);
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
  if (result.status === "incomplete") {
    return "Restore complete analysis evidence and rerun Agent Gate before merging.";
  }

  const finding = highestActionableFinding(result.findings);

  if (!finding) {
    return "No action needed beyond normal review.";
  }

  if (
    finding.ruleId === "workflow/dangerous-pattern" ||
    finding.ruleId === "workflow/permission-escalation" ||
    finding.ruleId === "workflow/agentic-untrusted-input"
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
  if (result.status === "incomplete") {
    return "Policy status: analysis incomplete; merge gating is fail-closed.";
  }

  if (result.status === "blocked") {
    return "Policy status: blocking.";
  }

  if (result.status === "needs-review") {
    return "Policy status: warning today; eligible to become a merge gate after tuning.";
  }

  if (result.status === "observed") {
    return "Policy status: findings observed; observe mode does not block this pull request.";
  }

  return "Policy status: no active blocking or warning findings.";
}
