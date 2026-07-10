import { createHash } from "node:crypto";

import { attachFindingIds } from "./finding/id.js";
import type {
  AnalysisGap,
  AnalysisInput,
  AnalysisResult,
  AnalysisStatus,
  Finding,
  RawFinding,
  Severity,
  WaivedFinding,
} from "./types.js";
import { createRuleContext, builtInRules } from "./rules/index.js";
import { decide } from "./score/decision.js";
import { calculateRiskScore } from "./score/riskScore.js";

const MAX_RESULT_FINDINGS = 250;

const severityRank: Record<Severity, number> = {
  error: 2,
  warn: 1,
  info: 0,
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }

  return value;
}

function policyDigest(input: AnalysisInput): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(input.config)))
    .digest("hex");
}

function rawFindingForGap(gap: AnalysisGap): RawFinding {
  return {
    ruleId: gap.ruleId,
    severity: "error",
    title:
      gap.ruleId === "analysis/file-list-incomplete"
        ? "Pull request file list incomplete"
        : "Changed file content unavailable",
    message: gap.message,
    ...(gap.path ? { path: gap.path } : {}),
    evidence: gap.evidence,
    remediation: [
      gap.ruleId === "analysis/file-list-incomplete"
        ? "Reduce or split the pull request, then rerun Agent Gate with a complete file list."
        : "Rerun Agent Gate once the required base and head content can be read.",
    ],
    tags: ["analysis", "incomplete"],
    confidence: "high",
  };
}

function compareFindings(left: Finding, right: Finding): number {
  const severityDifference = severityRank[right.severity] - severityRank[left.severity];

  if (severityDifference !== 0) {
    return severityDifference;
  }

  return (
    left.ruleId.localeCompare(right.ruleId) ||
    (left.path ?? "").localeCompare(right.path ?? "") ||
    left.findingId.localeCompare(right.findingId)
  );
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const findingsById = new Map<string, Finding>();

  for (const finding of findings) {
    const previous = findingsById.get(finding.findingId);

    if (!previous || severityRank[finding.severity] > severityRank[previous.severity]) {
      findingsById.set(finding.findingId, finding);
    }
  }

  return [...findingsById.values()];
}

function waiverPolicyFindings(input: AnalysisInput, findings: Finding[]): RawFinding[] {
  if (input.configSource !== "base-branch") {
    return [];
  }

  const findingsById = new Map(findings.map((finding) => [finding.findingId, finding]));
  const now = Date.parse(input.now);

  return input.config.waivers.flatMap<RawFinding>((waiver) => {
    const matchingFinding = findingsById.get(waiver.finding_id);
    const expired = Date.parse(waiver.expires_at) <= now;

    if (expired) {
      return [
        {
          ruleId: "policy/waiver-expired",
          severity: "warn" as const,
          title: "Finding waiver expired",
          message: `The policy waiver for ${waiver.finding_id} has expired.`,
          evidence: [
            { label: "finding_id", value: waiver.finding_id },
            { label: "expires_at", value: waiver.expires_at },
            { label: "reason", value: waiver.reason },
          ],
          remediation: ["Remove or renew the waiver in base-branch policy after review."],
          tags: ["policy", "waiver", "expired"],
          confidence: "high" as const,
        },
      ];
    }

    if (matchingFinding?.ruleId.startsWith("analysis/")) {
      return [
        {
          ruleId: "policy/waiver-forbidden",
          severity: "error" as const,
          title: "Analysis integrity finding cannot be waived",
          message: `${matchingFinding.ruleId} is an analysis integrity finding and remains active.`,
          evidence: [
            { label: "finding_id", value: waiver.finding_id },
            { label: "rule_id", value: matchingFinding.ruleId },
          ],
          remediation: ["Remove the waiver and restore complete analysis evidence."],
          tags: ["policy", "waiver", "analysis-integrity"],
          confidence: "high" as const,
        },
      ];
    }

    return [];
  });
}

function partitionWaivers(
  input: AnalysisInput,
  findings: Finding[],
): { active: Finding[]; waived: WaivedFinding[] } {
  if (input.configSource !== "base-branch") {
    return { active: findings, waived: [] };
  }

  const now = Date.parse(input.now);
  const waiverById = new Map(input.config.waivers.map((waiver) => [waiver.finding_id, waiver]));
  const active: Finding[] = [];
  const waived: WaivedFinding[] = [];

  for (const finding of findings) {
    const waiver = waiverById.get(finding.findingId);

    if (waiver && !finding.ruleId.startsWith("analysis/") && Date.parse(waiver.expires_at) > now) {
      waived.push({
        ...finding,
        disposition: "waived",
        waiver: {
          findingId: waiver.finding_id,
          reason: waiver.reason,
          expiresAt: waiver.expires_at,
        },
      });
    } else {
      active.push(finding);
    }
  }

  return { active, waived };
}

function capFinding(total: number, retained: number): Finding {
  const [finding] = attachFindingIds([
    {
      ruleId: "analysis/finding-limit-exceeded",
      severity: "error",
      title: "Analysis finding limit exceeded",
      message: `Agent Gate produced ${total} findings; only ${retained} are included in this result.`,
      evidence: [
        { label: "total_findings", value: String(total) },
        { label: "retained_findings", value: String(retained) },
        { label: "finding_limit", value: String(MAX_RESULT_FINDINGS) },
      ],
      remediation: ["Split the pull request and rerun Agent Gate to obtain complete evidence."],
      tags: ["analysis", "incomplete", "limit"],
      confidence: "high",
    },
  ]);

  if (!finding) {
    throw new Error("Unable to construct finding-limit finding");
  }

  return finding;
}

function statusFor(
  input: AnalysisInput,
  decision: AnalysisResult["decision"],
  activeFindingCount: number,
  incomplete: boolean,
): AnalysisStatus {
  if (incomplete) {
    return "incomplete";
  }

  if (decision === "block") {
    return "blocked";
  }

  if (decision === "warn") {
    return "needs-review";
  }

  return input.config.mode === "observe" && activeFindingCount > 0 ? "observed" : "passed";
}

function titleForStatus(status: AnalysisStatus): string {
  const label: Record<AnalysisStatus, string> = {
    passed: "passed",
    observed: "observed findings",
    "needs-review": "needs review",
    blocked: "blocked",
    incomplete: "analysis incomplete",
  };

  return `Agent Gate: ${label[status]}`;
}

export async function analyze(input: AnalysisInput): Promise<AnalysisResult> {
  const ctx = createRuleContext(input);
  const rawFindings: RawFinding[] = [];
  const analysisGaps = [...(input.analysis?.gaps ?? [])];

  if (
    input.analysis &&
    input.analysis.expectedFileCount !== input.analysis.analyzedFileCount &&
    !analysisGaps.some((gap) => gap.ruleId === "analysis/file-list-incomplete")
  ) {
    analysisGaps.push({
      ruleId: "analysis/file-list-incomplete",
      message: `Expected ${input.analysis.expectedFileCount} changed files but analyzed ${input.analysis.analyzedFileCount}.`,
      evidence: [
        { label: "expected_files", value: String(input.analysis.expectedFileCount) },
        { label: "analyzed_files", value: String(input.analysis.analyzedFileCount) },
        { label: "reason_code", value: "file-count-mismatch" },
      ],
    });
  }

  if (input.analysis && !input.analysis.complete && analysisGaps.length === 0) {
    analysisGaps.push({
      ruleId: "analysis/content-unavailable",
      message: "The collector marked this analysis incomplete without complete content evidence.",
      evidence: [{ label: "reason_code", value: "collector-marked-incomplete" }],
    });
  }

  const fileListIncomplete = analysisGaps.some(
    (gap) => gap.ruleId === "analysis/file-list-incomplete",
  );

  if (!fileListIncomplete) {
    for (const rule of builtInRules) {
      rawFindings.push(...(await rule.run(ctx)));
    }
  }

  rawFindings.push(
    ...analysisGaps
      .filter((gap) => !fileListIncomplete || gap.ruleId === "analysis/file-list-incomplete")
      .map(rawFindingForGap),
  );

  const initialFindings = dedupeFindings(attachFindingIds(rawFindings));
  const policyFindings = attachFindingIds(waiverPolicyFindings(input, initialFindings));
  const partitioned = partitionWaivers(
    input,
    dedupeFindings([...initialFindings, ...policyFindings]),
  );
  const fullActiveFindings = partitioned.active;
  const fullWaivedFindings = partitioned.waived;
  const totalFindingCount = fullActiveFindings.length + fullWaivedFindings.length;
  const overLimit = totalFindingCount > MAX_RESULT_FINDINGS;

  let findings = fullActiveFindings;
  let waivedFindings = fullWaivedFindings;
  let omittedFindingCount = 0;

  if (overLimit) {
    const retained = [
      ...fullActiveFindings.map((finding) => ({ finding, waived: false as const })),
      ...fullWaivedFindings.map((finding) => ({ finding, waived: true as const })),
    ]
      .sort(
        (left, right) =>
          Number(left.waived) - Number(right.waived) ||
          compareFindings(left.finding, right.finding),
      )
      .slice(0, MAX_RESULT_FINDINGS - 1);

    findings = retained.filter((item) => !item.waived).map((item) => item.finding);
    waivedFindings = retained
      .filter((item) => item.waived)
      .map((item) => item.finding as WaivedFinding);
    findings.push(capFinding(totalFindingCount, retained.length));
    omittedFindingCount = totalFindingCount - retained.length;
  }

  const errorCount =
    fullActiveFindings.filter((finding) => finding.severity === "error").length +
    (overLimit ? 1 : 0);
  const warnCount = fullActiveFindings.filter((finding) => finding.severity === "warn").length;
  const infoCount = fullActiveFindings.filter((finding) => finding.severity === "info").length;
  const collectionComplete = input.analysis?.complete ?? true;
  const hasIntegrityGap = fullActiveFindings.some(
    (finding) =>
      finding.ruleId === "analysis/file-list-incomplete" ||
      finding.ruleId === "analysis/content-unavailable" ||
      finding.ruleId === "analysis/finding-limit-exceeded",
  );
  const incomplete = !collectionComplete || hasIntegrityGap || overLimit;
  const decision = incomplete ? "block" : decide(input.config.mode, { errorCount, warnCount });
  const status = statusFor(input, decision, fullActiveFindings.length, incomplete);
  const expectedFileCount = input.analysis?.expectedFileCount ?? input.changes.totals.filesChanged;
  const analyzedFileCount = input.analysis?.analyzedFileCount ?? input.changes.files.length;
  const contentFileCount =
    input.analysis?.contentFileCount ??
    input.changes.files.filter(
      (file) => file.baseContent !== undefined || file.headContent !== undefined,
    ).length;

  return {
    decision,
    status,
    riskScore: calculateRiskScore(fullActiveFindings),
    summary: {
      title: titleForStatus(status),
      agentDetected: ctx.helpers.getAgentOrigin().detected,
      contractPresent: input.contract.kind !== "missing",
      errorCount,
      warnCount,
      infoCount,
      waivedCount: fullWaivedFindings.length,
    },
    findings,
    waivedFindings,
    metadata: {
      analyzedAt: input.now,
      baseSha: input.repo.baseSha,
      headSha: input.repo.headSha,
      configSource: input.configSource,
      version: input.version,
      analysisComplete: !incomplete,
      expectedFileCount,
      analyzedFileCount,
      contentFileCount,
      policyDigest: policyDigest(input),
      engineVersion: input.version,
      runtimeRef: input.analysis?.runtimeRef ?? input.version,
      totalFindingCount,
      omittedFindingCount,
    },
  };
}
