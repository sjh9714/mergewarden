import { parseWorkflow, type WorkflowDocument } from "../workflow/parseWorkflow.js";
import {
  findScopedPermissionEscalations,
  normalizeWorkflowPermissions,
  type ScopedPermissionEscalation,
  type WorkflowPermissionName,
} from "../workflow/permissions.js";
import type { RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function permissionsForWorkflow(workflow: WorkflowDocument | undefined) {
  return normalizeWorkflowPermissions(workflow?.permissions);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jobsForWorkflow(workflow: WorkflowDocument | undefined): Record<string, WorkflowDocument> {
  if (!isRecord(workflow?.jobs)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(workflow.jobs).filter((entry): entry is [string, WorkflowDocument] =>
      isRecord(entry[1]),
    ),
  );
}

function hasExplicitPermissions(value: WorkflowDocument | undefined): boolean {
  return value !== undefined && Object.prototype.hasOwnProperty.call(value, "permissions");
}

function needsBaseContent(file: { status: string; baseContent?: string | null }): boolean {
  return file.status !== "added" && file.baseContent == null;
}

function affectedArea(permission: WorkflowPermissionName): string {
  switch (permission) {
    case "contents":
      return "release, tag, and repository content writes";
    case "pull-requests":
      return "pull request writes";
    case "issues":
      return "issue and PR comment writes";
    case "deployments":
      return "deployment writes";
    case "packages":
      return "package publishing";
    case "pages":
      return "GitHub Pages publishing";
    case "id-token":
      return "OIDC token minting for cloud credentials";
    case "security-events":
      return "code scanning and security event writes";
    case "checks":
      return "check run writes";
    case "statuses":
      return "commit status writes";
    default:
      return "GitHub API writes for this permission";
  }
}

function scopeLabel(escalation: ScopedPermissionEscalation): string {
  return escalation.scope.kind;
}

function scopeDescription(escalation: ScopedPermissionEscalation): string {
  if (escalation.scope.kind === "job") {
    return `job '${escalation.scope.job}'`;
  }

  return "workflow";
}

function escalationFinding(
  ctx: RuleContext,
  filePath: string,
  escalation: ScopedPermissionEscalation,
): RawFinding {
  const area = affectedArea(escalation.permission);
  const evidence = [
    { label: "changed_file", value: filePath },
    { label: "permission", value: escalation.permission },
    { label: "before", value: escalation.before },
    { label: "after", value: escalation.after },
    { label: "permission_scope", value: scopeLabel(escalation) },
    { label: "affected_area", value: area },
  ];

  if (escalation.scope.kind === "job") {
    evidence.push({ label: "job", value: escalation.scope.job });
  }

  return {
    ruleId: "workflow/permission-escalation",
    severity: ctx.input.config.github_actions.severity,
    title: "GitHub Actions permission escalation",
    message: `${escalation.permission} permission increased from ${escalation.before} to ${escalation.after} at ${scopeDescription(escalation)} scope; this can affect ${area}. Confirm whether this permission boundary change is expected.`,
    path: filePath,
    evidence,
    remediation: [
      "Review the workflow permission boundary before merging.",
      "Scope the permission to the smallest workflow or job that needs it.",
      "Record reviewer approval or repo policy justification before promoting this finding to block.",
    ],
    tags: ["workflow", "permission-escalation"],
    confidence: "high",
  };
}

function workflowPermissionEscalations(
  baseWorkflow: WorkflowDocument | undefined,
  headWorkflow: WorkflowDocument,
): ScopedPermissionEscalation[] {
  const escalations = findScopedPermissionEscalations(
    permissionsForWorkflow(baseWorkflow),
    permissionsForWorkflow(headWorkflow),
    { kind: "workflow" },
  );
  const baseJobs = jobsForWorkflow(baseWorkflow);
  const headJobs = jobsForWorkflow(headWorkflow);

  for (const [job, headJob] of Object.entries(headJobs)) {
    if (!hasExplicitPermissions(headJob)) {
      continue;
    }

    const basePermissions = hasExplicitPermissions(baseJobs[job])
      ? normalizeWorkflowPermissions(baseJobs[job]?.permissions)
      : permissionsForWorkflow(baseWorkflow);

    escalations.push(
      ...findScopedPermissionEscalations(
        basePermissions,
        normalizeWorkflowPermissions(headJob.permissions),
        { kind: "job", job },
      ),
    );
  }

  return escalations;
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
      const escalations = workflowPermissionEscalations(baseWorkflow, head.workflow);

      for (const escalation of escalations) {
        findings.push(escalationFinding(ctx, file.path, escalation));
      }
    }

    return findings;
  },
};
