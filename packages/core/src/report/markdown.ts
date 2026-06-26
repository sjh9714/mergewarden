import type { AnalysisResult } from "../types.js";
import {
  highestActionableFinding,
  humanDecisionLabel,
  policyStatus,
  recommendedNextStep,
  safeReportValue,
} from "./common.js";

function yesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function policySource(source: AnalysisResult["metadata"]["configSource"]): string {
  if (source === "base-branch") {
    return "base branch";
  }

  if (source === "default") {
    return "built-in default";
  }

  return "local fixture";
}

function whyLines(result: AnalysisResult): string[] {
  const finding = highestActionableFinding(result.findings);

  if (!finding) {
    return ["No warning or blocking findings were detected."];
  }

  const lines = [finding.message];

  if (finding.path) {
    lines.push("", `Path: \`${safeReportValue(finding.path)}\``);
  }

  return lines;
}

function pushEvidenceSnapshot(lines: string[], result: AnalysisResult["findings"][number]): void {
  lines.push(
    "Evidence Snapshot:",
    `- ruleId: ${safeReportValue(result.evidenceSnapshot.ruleId)}`,
    `- severity: ${safeReportValue(result.evidenceSnapshot.severity)}`,
  );

  if (result.evidenceSnapshot.path) {
    lines.push(`- path: ${safeReportValue(result.evidenceSnapshot.path)}`);
  }

  if (result.evidenceSnapshot.line !== undefined) {
    lines.push(`- line: ${result.evidenceSnapshot.line}`);
  }

  if (result.evidenceSnapshot.evidence.length > 0) {
    for (const evidence of result.evidenceSnapshot.evidence) {
      lines.push(
        `- evidence.${safeReportValue(evidence.label)}: ${safeReportValue(evidence.value)}`,
      );
    }
  }

  lines.push("");
}

export function renderMarkdownReport(result: AnalysisResult): string {
  const lines = [
    `# Agent Gate: ${humanDecisionLabel(result.decision)}`,
    "",
    `Decision: ${result.decision}`,
    `Risk score: ${result.riskScore} / 100`,
    "",
    "## Why",
    "",
    ...whyLines(result),
    "",
    "## Recommended Next Step",
    "",
    recommendedNextStep(result),
    "",
    "## Policy Status",
    "",
    policyStatus(result),
    "",
    "## Summary",
    "",
    `- Agent detected: ${yesNo(result.summary.agentDetected)}`,
    `- Contract present: ${yesNo(result.summary.contractPresent)}`,
    `- Policy source: ${policySource(result.metadata.configSource)}`,
    `- Errors: ${result.summary.errorCount}`,
    `- Warnings: ${result.summary.warnCount}`,
    `- Info: ${result.summary.infoCount}`,
    "",
    "## Detailed Findings",
    "",
  ];

  if (result.findings.length === 0) {
    lines.push("No findings.");
  } else {
    for (const finding of result.findings) {
      lines.push(
        `### ${finding.severity.toUpperCase()} ${finding.ruleId}`,
        "",
        finding.message,
        "",
        `Finding ID: \`${safeReportValue(finding.findingId)}\``,
        "",
      );

      if (finding.path) {
        lines.push(`Path: \`${safeReportValue(finding.path)}\``, "");
      }

      pushEvidenceSnapshot(lines, finding);

      if (finding.evidence.length > 0) {
        lines.push("Evidence:");

        for (const evidence of finding.evidence) {
          lines.push(`- ${safeReportValue(evidence.label)}: ${safeReportValue(evidence.value)}`);
        }

        lines.push("");
      }

      if (finding.remediation.length > 0) {
        lines.push("Remediation:");

        for (const remediation of finding.remediation) {
          lines.push(`- ${safeReportValue(remediation)}`);
        }

        lines.push("");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}
