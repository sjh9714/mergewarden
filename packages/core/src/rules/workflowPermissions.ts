import { parseWorkflow, type WorkflowDocument } from "../workflow/parseWorkflow.js";
import {
  findPermissionEscalations,
  normalizeWorkflowPermissions,
} from "../workflow/permissions.js";
import type { RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function permissionsForWorkflow(workflow: WorkflowDocument | undefined) {
  return normalizeWorkflowPermissions(workflow?.permissions);
}

function needsBaseContent(file: { status: string; baseContent?: string | null }): boolean {
  return file.status !== "added" && file.baseContent == null;
}

export const workflowPermissionEscalationRule: Rule = {
  id: "workflow/permission-escalation",
  title: "GitHub Actions permission escalation",
  run(ctx) {
    if (!ctx.input.config.github_actions.block_permission_escalation) {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const file of ctx.helpers.changedFiles()) {
      if (
        !isWorkflowFile(ctx, file.path) ||
        file.status === "removed" ||
        !file.headContent ||
        needsBaseContent(file)
      ) {
        continue;
      }

      const head = parseWorkflow(file.headContent);

      if (head.kind !== "valid") {
        continue;
      }

      const base = file.baseContent ? parseWorkflow(file.baseContent) : undefined;
      const baseWorkflow = base?.kind === "valid" ? base.workflow : undefined;
      const escalations = findPermissionEscalations(
        permissionsForWorkflow(baseWorkflow),
        permissionsForWorkflow(head.workflow),
      );

      for (const escalation of escalations) {
        findings.push({
          ruleId: "workflow/permission-escalation",
          severity: ctx.input.config.github_actions.severity,
          title: "GitHub Actions permission escalation",
          message: `${escalation.permission} permission increased from ${escalation.before} to ${escalation.after}.`,
          path: file.path,
          evidence: [
            { label: "changed_file", value: file.path },
            { label: "permission", value: escalation.permission },
            { label: "before", value: escalation.before },
            { label: "after", value: escalation.after },
          ],
          remediation: ["Reduce workflow permissions or justify the escalation before merging."],
          tags: ["workflow", "permission-escalation"],
          confidence: "high",
        });
      }
    }

    return findings;
  },
};
