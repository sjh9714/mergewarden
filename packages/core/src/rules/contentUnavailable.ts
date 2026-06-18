import type { FileChange, RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function missingBaseContent(file: FileChange): boolean {
  return file.status !== "added" && file.baseContent == null;
}

function missingHeadContent(file: FileChange): boolean {
  return file.status !== "removed" && file.headContent == null;
}

function contentUnavailableFinding(file: FileChange, ref: "base" | "head"): RawFinding {
  return {
    ruleId: "analysis/content-unavailable",
    severity: "error",
    title: "Changed file content unavailable",
    message: `Unable to read ${ref} content for ${file.path}; workflow analysis may be incomplete.`,
    path: file.path,
    evidence: [
      { label: "changed_file", value: file.path },
      { label: "content_ref", value: ref },
      { label: "file_status", value: file.status },
    ],
    remediation: ["Review this workflow change manually or rerun once content is available."],
    tags: ["analysis", "content-unavailable", "workflow"],
    confidence: "medium",
  };
}

export const contentUnavailableRule: Rule = {
  id: "analysis/content-unavailable",
  title: "Changed file content unavailable",
  run(ctx) {
    const findings: RawFinding[] = [];

    for (const file of ctx.helpers.changedFiles()) {
      if (!isWorkflowFile(ctx, file.path)) {
        continue;
      }

      if (missingBaseContent(file)) {
        findings.push(contentUnavailableFinding(file, "base"));
      }

      if (missingHeadContent(file)) {
        findings.push(contentUnavailableFinding(file, "head"));
      }
    }

    return findings;
  },
};
