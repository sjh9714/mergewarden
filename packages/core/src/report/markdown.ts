import type { AnalysisResult } from "../types.js";

function yesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

export function renderMarkdownReport(result: AnalysisResult): string {
  const lines = [
    "# Agent Gate Report",
    "",
    `Decision: ${result.decision.toUpperCase()}`,
    `Risk score: ${result.riskScore} / 100`,
    "",
    "## Summary",
    "",
    `- Agent detected: ${yesNo(result.summary.agentDetected)}`,
    `- Contract present: ${yesNo(result.summary.contractPresent)}`,
    `- Errors: ${result.summary.errorCount}`,
    `- Warnings: ${result.summary.warnCount}`,
    `- Info: ${result.summary.infoCount}`,
    "",
    "## Findings",
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
      );

      if (finding.path) {
        lines.push(`Path: \`${finding.path}\``, "");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}
