import { scopePathsForFile } from "../path/scopePaths.js";
import type { Finding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function matchingPatterns(ctx: RuleContext, paths: string[], patterns: string[]): string[] {
  return [...new Set(paths.flatMap((path) => ctx.helpers.findMatchingPatterns(path, patterns)))];
}

export const agentControlPlaneDriftRule: Rule = {
  id: "agent-control-plane/drift",
  title: "Agent control-plane file changed",
  run(ctx) {
    const findings: Finding[] = [];
    const config = ctx.input.config.agent_control_plane;

    for (const file of ctx.helpers.changedFiles()) {
      const patterns = matchingPatterns(ctx, scopePathsForFile(file), config.paths);

      if (patterns.length === 0) {
        continue;
      }

      const finding: Finding = {
        ruleId: "agent-control-plane/drift",
        severity: config.severity,
        title: "Agent control-plane file changed",
        message: "This file can change how AI agents behave in future PRs.",
        path: file.path,
        evidence: [{ label: "changed_file", value: file.path }],
        remediation: ["Review the control-plane change before merging."],
        tags: ["agent-control-plane", "drift"],
        confidence: "high",
      };

      if (file.previousPath) {
        finding.evidence.push({ label: "previous_path", value: file.previousPath });
      }

      finding.evidence.push({ label: "matched_patterns", value: patterns.join(", ") });
      findings.push(finding);
    }

    return findings;
  },
};
