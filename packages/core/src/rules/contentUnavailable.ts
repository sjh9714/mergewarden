import type { FileChange, RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function isPackageManifest(ctx: RuleContext, path: string): boolean {
  return (
    ctx.input.config.package_scripts.enabled &&
    ctx.helpers.matchesAny(path, ctx.input.config.package_scripts.paths)
  );
}

function missingBaseContent(file: FileChange, baseRequired = true): boolean {
  return (
    baseRequired &&
    (file.status === "modified" || file.status === "renamed") &&
    file.baseContent == null
  );
}

function missingHeadContent(file: FileChange): boolean {
  return file.status !== "removed" && file.headContent == null;
}

function hasExplicitGap(ctx: RuleContext, file: FileChange, ref: "base" | "head"): boolean {
  return (ctx.input.analysis?.gaps ?? []).some(
    (gap) =>
      gap.ruleId === "analysis/content-unavailable" &&
      gap.path === file.path &&
      gap.evidence.some((evidence) => evidence.label === "content_ref" && evidence.value === ref),
  );
}

function contentUnavailableFinding(
  file: FileChange,
  ref: "base" | "head",
  options: {
    severity: RawFinding["severity"];
    subject: "workflow" | "package manifest";
    tags: string[];
  },
): RawFinding {
  return {
    ruleId: "analysis/content-unavailable",
    severity: options.severity,
    title: "Changed file content unavailable",
    message: `Unable to read ${ref} content for ${file.path}; ${options.subject} analysis may be incomplete.`,
    path: file.path,
    evidence: [
      { label: "changed_file", value: file.path },
      { label: "content_ref", value: ref },
      { label: "file_status", value: file.status },
    ],
    remediation: [
      `Review this ${options.subject} change manually or rerun once content is available.`,
    ],
    tags: options.tags,
    confidence: "medium",
  };
}

export const contentUnavailableRule: Rule = {
  id: "analysis/content-unavailable",
  title: "Changed file content unavailable",
  run(ctx) {
    const aggregateBudgetGap = (ctx.input.analysis?.gaps ?? []).some(
      (gap) =>
        gap.ruleId === "analysis/content-unavailable" &&
        gap.evidence.some(
          (evidence) =>
            evidence.label === "reason_code" &&
            evidence.value === "aggregate-content-budget-exceeded",
        ),
    );

    if (aggregateBudgetGap) {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const file of ctx.helpers.changedFiles()) {
      const workflowFile = isWorkflowFile(ctx, file.path);
      const previousWorkflowFile = isWorkflowFile(ctx, file.previousPath ?? file.path);
      const workflowRenamedOut = file.status === "renamed" && previousWorkflowFile && !workflowFile;
      if (workflowRenamedOut) {
        continue;
      }

      const packageManifest = !workflowFile && isPackageManifest(ctx, file.path);

      if (!workflowFile && !packageManifest) {
        continue;
      }

      const findingOptions = workflowFile
        ? {
            severity: "error" as const,
            subject: "workflow" as const,
            tags: ["analysis", "content-unavailable", "workflow"],
          }
        : {
            severity: ctx.input.config.package_scripts.severity,
            subject: "package manifest" as const,
            tags: ["analysis", "content-unavailable", "dependency", "package-script"],
          };

      const baseRequired = !workflowFile || previousWorkflowFile;

      if (missingBaseContent(file, baseRequired) && !hasExplicitGap(ctx, file, "base")) {
        findings.push(contentUnavailableFinding(file, "base", findingOptions));
      }

      if (missingHeadContent(file) && !hasExplicitGap(ctx, file, "head")) {
        findings.push(contentUnavailableFinding(file, "head", findingOptions));
      }
    }

    return findings;
  },
};
