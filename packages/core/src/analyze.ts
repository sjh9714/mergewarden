import type { AnalysisInput, AnalysisResult } from "./types.js";

export async function analyze(input: AnalysisInput): Promise<AnalysisResult> {
  return {
    decision: "pass",
    riskScore: 0,
    summary: {
      title: "Agent Gate: passed",
      agentDetected: false,
      contractPresent: false,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
    },
    findings: [],
    metadata: {
      analyzedAt: input.now,
      baseSha: input.repo.baseSha,
      headSha: input.repo.headSha,
      configSource: input.configSource,
      version: input.version,
    },
  };
}
