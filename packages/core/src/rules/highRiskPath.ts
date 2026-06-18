import { scopePathsForFile } from "../path/scopePaths.js";
import type { RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function matchingPatterns(ctx: RuleContext, paths: string[], patterns: string[]): string[] {
  return [...new Set(paths.flatMap((path) => ctx.helpers.findMatchingPatterns(path, patterns)))];
}

function compareAreaNames(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

export const highRiskPathRule: Rule = {
  id: "risk/high-risk-path",
  title: "High-risk path changed",
  run(ctx) {
    const findings: RawFinding[] = [];
    const areas = Object.entries(ctx.input.config.high_risk_paths).sort(([left], [right]) =>
      compareAreaNames(left, right),
    );

    for (const [areaName, area] of areas) {
      for (const file of ctx.helpers.changedFiles()) {
        const patterns = matchingPatterns(ctx, scopePathsForFile(file), area.paths);

        if (patterns.length === 0) {
          continue;
        }

        const finding: RawFinding = {
          ruleId: "risk/high-risk-path",
          severity: area.severity,
          title: "High-risk path changed",
          message: `${file.path} changed in high-risk area ${areaName}.`,
          path: file.path,
          evidence: [
            { label: "area", value: areaName },
            { label: "changed_file", value: file.path },
          ],
          remediation: ["Review this high-risk change before merging."],
          tags: ["risk", "high-risk-path", areaName],
          confidence: "high",
        };

        if (file.previousPath) {
          finding.evidence.push({ label: "previous_path", value: file.previousPath });
        }

        finding.evidence.push({ label: "matched_patterns", value: patterns.join(", ") });
        findings.push(finding);
      }
    }

    return findings;
  },
};
