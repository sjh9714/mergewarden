import { scopePathsForFile } from "../path/scopePaths.js";
import type { FileChange, RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function matchingScopePaths(ctx: RuleContext, file: FileChange, patterns: string[]): string[] {
  return scopePathsForFile(file).filter((path) => ctx.helpers.matchesAny(path, patterns));
}

function isPresentAfterChange(file: FileChange): boolean {
  return file.status !== "removed";
}

function isMatchingCurrentTestPath(
  ctx: RuleContext,
  file: FileChange,
  patterns: string[],
): boolean {
  return isPresentAfterChange(file) && ctx.helpers.matchesAny(file.path, patterns);
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

export const missingTestEvidenceRule: Rule = {
  id: "evidence/missing-test-change",
  title: "Missing test evidence",
  run(ctx) {
    const findings: RawFinding[] = [];
    const areas = Object.entries(ctx.input.config.high_risk_paths).sort(([left], [right]) =>
      compareAreaNames(left, right),
    );

    for (const [areaName, area] of areas) {
      if (area.require_tests.length === 0) {
        continue;
      }

      const matchingRiskFiles = [
        ...new Set(
          ctx.helpers.changedFiles().flatMap((file) => matchingScopePaths(ctx, file, area.paths)),
        ),
      ];

      if (matchingRiskFiles.length === 0) {
        continue;
      }

      const hasMatchingTestChange = ctx.helpers
        .changedFiles()
        .some((file) => isMatchingCurrentTestPath(ctx, file, area.require_tests));

      if (hasMatchingTestChange) {
        continue;
      }

      findings.push({
        ruleId: "evidence/missing-test-change",
        severity: area.severity,
        title: "Missing test evidence",
        message: "High-risk area changed without matching test evidence.",
        evidence: [
          { label: "area", value: areaName },
          { label: "risk_paths", value: area.paths.join(", ") },
          { label: "required_test_patterns", value: area.require_tests.join(", ") },
          { label: "matching_risk_files", value: matchingRiskFiles.join(", ") },
        ],
        remediation: [
          "Add or update a matching test file. This only proves test-change evidence, not semantic coverage.",
        ],
        tags: ["evidence", "missing-test-change", areaName],
        confidence: "high",
      });
    }

    return findings;
  },
};
