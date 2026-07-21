import type { AnalysisResult, Finding } from "../types.js";
import {
  highestActionableFinding,
  humanDecisionLabel,
  policyStatus,
  recommendedNextStep,
  safeReportValue,
} from "./common.js";

const MAX_LOG_FINDINGS = 10;

function whyText(result: AnalysisResult): string {
  const finding = highestActionableFinding(result.findings);

  if (!finding) {
    return "No warning or blocking findings were detected.";
  }

  return safeReportValue(finding.message);
}

function findingLine(finding: Finding): string {
  const parts = [
    "-",
    safeReportValue(finding.severity),
    safeReportValue(finding.findingId),
    safeReportValue(finding.ruleId),
  ];

  if (finding.path) {
    parts.push(safeReportValue(finding.path));
  }

  return parts.join(" ");
}

export function renderPlainTextReportSummary(result: AnalysisResult): string {
  const actionableFinding = highestActionableFinding(result.findings);
  const findings = result.findings.slice(0, MAX_LOG_FINDINGS);
  const omittedFindings = result.findings.length - findings.length;
  const lines = [
    `MergeWarden: ${humanDecisionLabel(result)}`,
    `Decision: ${result.decision}`,
    `Status: ${result.status}`,
    `Why: ${whyText(result)}`,
  ];

  if (actionableFinding?.path) {
    lines.push(`Path: ${safeReportValue(actionableFinding.path)}`);
  }

  lines.push(
    `Recommended next step: ${recommendedNextStep(result)}`,
    policyStatus(result),
    "Findings:",
  );

  if (findings.length === 0) {
    lines.push("- none");
  } else {
    for (const finding of findings) {
      lines.push(findingLine(finding));
    }
  }

  if (omittedFindings > 0) {
    lines.push(`... ${omittedFindings} more findings omitted`);
  }

  if (result.waivedFindings.length > 0) {
    lines.push(`Waived findings: ${result.waivedFindings.length}`);
  }

  return `${lines.join("\n")}\n`;
}
