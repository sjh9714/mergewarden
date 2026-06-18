import { attachFindingIds } from "./finding/id.js";
import type { AnalysisInput, AnalysisResult, RawFinding } from "./types.js";
import { createRuleContext, builtInRules } from "./rules/index.js";
import { decide } from "./score/decision.js";
import { calculateRiskScore } from "./score/riskScore.js";

function titleForDecision(decision: AnalysisResult["decision"]): string {
  if (decision === "block") {
    return "Agent Gate: blocked";
  }

  if (decision === "warn") {
    return "Agent Gate: warnings found";
  }

  return "Agent Gate: passed";
}

export async function analyze(input: AnalysisInput): Promise<AnalysisResult> {
  const ctx = createRuleContext(input);
  const rawFindings: RawFinding[] = [];

  for (const rule of builtInRules) {
    rawFindings.push(...(await rule.run(ctx)));
  }

  const findings = attachFindingIds(rawFindings);
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warnCount = findings.filter((finding) => finding.severity === "warn").length;
  const infoCount = findings.filter((finding) => finding.severity === "info").length;
  const decision = decide(input.config.mode, { errorCount, warnCount });

  return {
    decision,
    riskScore: calculateRiskScore(findings),
    summary: {
      title: titleForDecision(decision),
      agentDetected: ctx.helpers.getAgentOrigin().detected,
      contractPresent: input.contract.kind !== "missing",
      errorCount,
      warnCount,
      infoCount,
    },
    findings,
    metadata: {
      analyzedAt: input.now,
      baseSha: input.repo.baseSha,
      headSha: input.repo.headSha,
      configSource: input.configSource,
      version: input.version,
    },
  };
}
