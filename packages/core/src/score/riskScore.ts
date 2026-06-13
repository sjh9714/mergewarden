import type { Finding } from "../types.js";

const severityScore = {
  error: 20,
  warn: 8,
  info: 1,
};

export function calculateRiskScore(findings: Finding[]): number {
  const score = findings.reduce((total, finding) => total + severityScore[finding.severity], 0);
  return Math.min(score, 100);
}
