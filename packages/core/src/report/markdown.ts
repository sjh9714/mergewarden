import type { AnalysisResult, Finding, WaivedFinding } from "../types.js";
import {
  highestActionableFinding,
  humanDecisionLabel,
  policyStatus,
  recommendedNextStep,
  safeReportValue,
} from "./common.js";

export interface MarkdownReportOptions {
  maxFindings?: number;
  maxBytes?: number;
  fullReportPath?: string;
}

const severityRank: Record<Finding["severity"], number> = {
  error: 2,
  warn: 1,
  info: 0,
};

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
    return result.waivedFindings.length > 0
      ? ["All detected findings are covered by active base-policy waivers."]
      : ["No active warning or blocking findings were detected."];
  }

  const lines = [safeReportValue(finding.message)];

  if (finding.path) {
    lines.push("", `Path: ${safeReportValue(finding.path)}`);
  }

  return lines;
}

function pushEvidenceSnapshot(lines: string[], finding: Finding): void {
  lines.push(
    "Evidence Snapshot:",
    "",
    `- ruleId: ${safeReportValue(finding.evidenceSnapshot.ruleId)}`,
    `- severity: ${safeReportValue(finding.evidenceSnapshot.severity)}`,
  );

  if (finding.evidenceSnapshot.path) {
    lines.push(`- path: ${safeReportValue(finding.evidenceSnapshot.path)}`);
  }

  if (finding.evidenceSnapshot.line !== undefined) {
    lines.push(`- line: ${finding.evidenceSnapshot.line}`);
  }

  for (const evidence of finding.evidenceSnapshot.evidence) {
    lines.push(`- evidence.${safeReportValue(evidence.label)}: ${safeReportValue(evidence.value)}`);
  }

  lines.push("");
}

function pushFinding(lines: string[], finding: Finding): void {
  lines.push(
    `### ${finding.severity.toUpperCase()} ${safeReportValue(finding.ruleId)}`,
    "",
    safeReportValue(finding.message),
    "",
    `Finding ID: ${safeReportValue(finding.findingId)}`,
    `Disposition: ${finding.disposition}`,
    "",
  );

  if (finding.path) {
    lines.push(`Path: ${safeReportValue(finding.path)}`, "");
  }

  pushEvidenceSnapshot(lines, finding);

  if (finding.evidence.length > 0) {
    lines.push("Evidence:", "");

    for (const evidence of finding.evidence) {
      lines.push(`- ${safeReportValue(evidence.label)}: ${safeReportValue(evidence.value)}`);
    }

    lines.push("");
  }

  if (finding.remediation.length > 0) {
    lines.push("Remediation:", "");

    for (const remediation of finding.remediation) {
      lines.push(`- ${safeReportValue(remediation)}`);
    }

    lines.push("");
  }
}

function pushWaivedFinding(lines: string[], finding: WaivedFinding): void {
  pushFinding(lines, finding);
  lines.push(
    "Waiver:",
    "",
    `- reason: ${safeReportValue(finding.waiver.reason)}`,
    `- expires_at: ${safeReportValue(finding.waiver.expiresAt)}`,
    "",
  );
}

type MarkdownReportItem =
  | { finding: Finding; waived: false }
  | { finding: WaivedFinding; waived: true };

function buildMarkdownReport(
  result: AnalysisResult,
  combined: MarkdownReportItem[],
  visibleCount: number,
  fullReportPath: string | undefined,
): string {
  const visible = combined.slice(0, visibleCount);
  const surfaceOmitted = combined.length - visible.length;
  const lines = [
    `# MergeWarden: ${humanDecisionLabel(result)}`,
    "",
    `Decision: ${result.decision}`,
    `Status: ${result.status}`,
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
    `- PR-declared contract present: ${yesNo(result.summary.contractPresent)}`,
    `- Policy source: ${policySource(result.metadata.configSource)}`,
    `- Analysis complete: ${yesNo(result.metadata.analysisComplete)}`,
    `- Files analyzed: ${result.metadata.analyzedFileCount} / ${result.metadata.expectedFileCount}`,
    `- Errors: ${result.summary.errorCount}`,
    `- Warnings: ${result.summary.warnCount}`,
    `- Info: ${result.summary.infoCount}`,
    `- Waived: ${result.summary.waivedCount}`,
    `- Policy digest: ${safeReportValue(result.metadata.policyDigest)}`,
    "",
    "## Detailed Findings",
    "",
  ];

  const activeVisible = visible.filter((item) => !item.waived);

  if (activeVisible.length === 0) {
    lines.push(
      result.findings.length === 0 ? "No active findings." : "Active findings omitted.",
      "",
    );
  } else {
    for (const item of activeVisible) {
      pushFinding(lines, item.finding);
    }
  }

  const waivedVisible = visible.filter((item) => item.waived);

  if (waivedVisible.length > 0) {
    lines.push("## Waived Findings", "");

    for (const item of waivedVisible) {
      pushWaivedFinding(lines, item.finding);
    }
  }

  const omitted = result.metadata.omittedFindingCount + surfaceOmitted;

  if (omitted > 0) {
    lines.push(
      `_${omitted} finding${omitted === 1 ? "" : "s"} omitted from this surface._`,
      ...(fullReportPath ? [`Full report: ${safeReportValue(fullReportPath)}`] : []),
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

export function renderMarkdownReport(
  result: AnalysisResult,
  options: MarkdownReportOptions = {},
): string {
  const maxFindings = Math.max(0, Math.floor(options.maxFindings ?? 250));
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 2_000_000));
  const combined: MarkdownReportItem[] = [
    ...result.findings.map((finding) => ({ finding, waived: false as const })),
    ...result.waivedFindings.map((finding) => ({ finding, waived: true as const })),
  ].sort(
    (left, right) =>
      Number(left.waived) - Number(right.waived) ||
      severityRank[right.finding.severity] - severityRank[left.finding.severity] ||
      left.finding.ruleId.localeCompare(right.finding.ruleId) ||
      (left.finding.path ?? "").localeCompare(right.finding.path ?? "") ||
      left.finding.findingId.localeCompare(right.finding.findingId),
  );
  let low = 0;
  let high = Math.min(maxFindings, combined.length);
  let best: string | undefined;

  while (low <= high) {
    const visibleCount = Math.floor((low + high) / 2);
    const candidate = buildMarkdownReport(result, combined, visibleCount, options.fullReportPath);

    if (Buffer.byteLength(candidate, "utf8") <= maxBytes) {
      best = candidate;
      low = visibleCount + 1;
    } else {
      high = visibleCount - 1;
    }
  }

  if (best === undefined) {
    throw new Error(
      `Markdown report metadata exceeds the ${maxBytes}-byte surface limit; increase maxBytes.`,
    );
  }

  return best;
}
