import type { MergeWardenConfig } from "../config/schema.js";
import type { Evidence, RawFinding, Severity } from "../types.js";
import {
  findJobsWithIdTokenWritePermission,
  findJobsWithWriteAllPermissions,
  findPullRequestTargetHeadPatterns,
  findSecretReferences,
  findUnknownWritePermissions,
  findUnpinnedWorkflowUses,
  hasIdTokenWritePermission,
  hasOwnWorkflowPermissions,
  hasWriteAllPermissions,
} from "../workflow/dangerousPatterns.js";
import { parseWorkflow, type WorkflowDocument } from "../workflow/parseWorkflow.js";
import type { Rule, RuleContext } from "./types.js";

type CheckName = keyof MergeWardenConfig["github_actions"]["checks"];

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function wasWorkflowFile(ctx: RuleContext, file: { path: string; previousPath?: string }): boolean {
  return isWorkflowFile(ctx, file.previousPath ?? file.path);
}

function severityFor(
  config: MergeWardenConfig["github_actions"],
  check: CheckName,
): Severity | undefined {
  const value = config.checks[check];
  return value === "off" ? undefined : value;
}

function dangerousFinding(
  filePath: string,
  severity: Severity,
  pattern: string,
  extraEvidence: Evidence[] = [],
): RawFinding {
  return {
    ruleId: "workflow/dangerous-pattern",
    severity,
    title: "Dangerous GitHub Actions workflow pattern",
    message:
      pattern === "workflow deleted"
        ? `${filePath} deletes a GitHub Actions workflow and its policy-enforced automation.`
        : `${filePath} introduces or expands a dangerous GitHub Actions workflow pattern.`,
    path: filePath,
    evidence: [
      { label: "changed_file", value: filePath },
      { label: "pattern", value: pattern },
      ...extraEvidence,
    ],
    remediation: ["Remove the dangerous workflow pattern or reduce its privileges before merging."],
    tags: ["workflow", "dangerous-pattern"],
    confidence: "high",
  };
}

function setDifference<T>(head: T[], base: T[], key: (value: T) => string): T[] {
  const baseKeys = new Set(base.map(key));
  return head.filter((value) => !baseKeys.has(key(value)));
}

function writeAllPatterns(workflow: WorkflowDocument | undefined): Array<{
  key: string;
  pattern: string;
  evidence: Evidence[];
}> {
  if (!workflow) {
    return [];
  }

  return [
    ...(hasWriteAllPermissions(workflow)
      ? [{ key: "workflow", pattern: "permissions: write-all", evidence: [] }]
      : []),
    ...findJobsWithWriteAllPermissions(workflow).map((job) => ({
      key: `job:${job}`,
      pattern: "job permissions: write-all",
      evidence: [{ label: "job", value: job }],
    })),
  ];
}

function idTokenPatterns(workflow: WorkflowDocument | undefined): Array<{
  key: string;
  pattern: string;
  evidence: Evidence[];
}> {
  if (!workflow) {
    return [];
  }

  return [
    ...(hasIdTokenWritePermission(workflow)
      ? [{ key: "workflow", pattern: "id-token: write", evidence: [] }]
      : []),
    ...findJobsWithIdTokenWritePermission(workflow).map((job) => ({
      key: `job:${job}`,
      pattern: "job id-token: write",
      evidence: [{ label: "job", value: job }],
    })),
  ];
}

function parsedBase(file: { status: string; baseContent?: string | null }, treatAsAdded: boolean) {
  if (file.status === "added" || treatAsAdded || file.baseContent == null) {
    return undefined;
  }

  return parseWorkflow(file.baseContent);
}

export const workflowDangerousPatternRule: Rule = {
  id: "workflow/dangerous-pattern",
  title: "Dangerous GitHub Actions workflow pattern",
  run(ctx) {
    const findings: RawFinding[] = [];
    const config = ctx.input.config.github_actions;

    for (const file of ctx.helpers.changedFiles()) {
      const isHeadWorkflow = isWorkflowFile(ctx, file.path);
      const isBaseWorkflow = wasWorkflowFile(ctx, file);

      if (!isHeadWorkflow && !isBaseWorkflow) {
        continue;
      }

      if (file.status === "removed" || (file.status === "renamed" && !isHeadWorkflow)) {
        const severity = severityFor(config, "workflow_deleted");
        if (severity) {
          findings.push(
            dangerousFinding(file.previousPath ?? file.path, severity, "workflow deleted"),
          );
        }
        continue;
      }

      if (file.headContent == null) {
        continue;
      }

      const head = parseWorkflow(file.headContent);

      if (head.kind === "invalid") {
        const severity = severityFor(config, "malformed_workflow");
        if (severity) {
          findings.push(
            dangerousFinding(file.path, severity, "malformed workflow YAML", [
              { label: "parse_error", value: head.message },
            ]),
          );
        }
        continue;
      }

      const treatAsAdded = file.status === "added" || !isBaseWorkflow;
      const base = parsedBase(file, treatAsAdded);
      let baseWorkflow: WorkflowDocument | undefined;

      if (base?.kind === "invalid") {
        findings.push({
          ruleId: "workflow/base-invalid",
          severity: "warn",
          title: "Base workflow could not be parsed",
          message: `${file.path} has a valid head workflow, but its base workflow cannot be parsed for differential checks.`,
          path: file.path,
          evidence: [
            { label: "changed_file", value: file.path },
            { label: "parse_error", value: base.message },
          ],
          remediation: ["Review the complete workflow manually before merging."],
          tags: ["workflow", "analysis", "base-invalid"],
          confidence: "high",
        });
      } else {
        baseWorkflow = base?.workflow;
      }

      const writeAllSeverity = severityFor(config, "write_all");
      if (writeAllSeverity) {
        for (const item of setDifference(
          writeAllPatterns(head.workflow),
          writeAllPatterns(baseWorkflow),
          (value) => value.key,
        )) {
          findings.push(dangerousFinding(file.path, writeAllSeverity, item.pattern, item.evidence));
        }
      }

      const idTokenSeverity = severityFor(config, "id_token_write");
      if (idTokenSeverity) {
        for (const item of setDifference(
          idTokenPatterns(head.workflow),
          idTokenPatterns(baseWorkflow),
          (value) => value.key,
        )) {
          findings.push(dangerousFinding(file.path, idTokenSeverity, item.pattern, item.evidence));
        }
      }

      if (
        baseWorkflow &&
        hasOwnWorkflowPermissions(baseWorkflow) &&
        !hasOwnWorkflowPermissions(head.workflow)
      ) {
        findings.push(dangerousFinding(file.path, "warn", "explicit workflow permissions removed"));
      }

      if (treatAsAdded) {
        const severity = severityFor(config, "missing_permissions");
        if (severity && !hasOwnWorkflowPermissions(head.workflow)) {
          findings.push(dangerousFinding(file.path, severity, "top-level permissions missing"));
        }
      }

      const unknownPermissionSeverity = severityFor(config, "unknown_write_permission");
      if (unknownPermissionSeverity) {
        for (const permission of setDifference(
          findUnknownWritePermissions(head.workflow),
          findUnknownWritePermissions(baseWorkflow ?? {}),
          (value) => `${value.scope}:${value.job ?? ""}:${value.permission}`,
        )) {
          findings.push(
            dangerousFinding(file.path, unknownPermissionSeverity, "unknown write permission", [
              { label: "permission", value: permission.permission },
              { label: "permission_scope", value: permission.scope },
              ...(permission.job ? [{ label: "job", value: permission.job }] : []),
            ]),
          );
        }
      }

      const headPatterns = findPullRequestTargetHeadPatterns(head.workflow);
      const basePatterns = findPullRequestTargetHeadPatterns(baseWorkflow ?? {});
      const pullRequestTargetSeverity = severityFor(config, "pull_request_target_head");
      if (pullRequestTargetSeverity) {
        for (const headPattern of setDifference(headPatterns, basePatterns, String)) {
          findings.push(
            dangerousFinding(
              file.path,
              pullRequestTargetSeverity,
              "pull_request_target checkout of PR head",
              [{ label: "head_reference", value: headPattern }],
            ),
          );
        }
      }

      const newUnpinnedUses = setDifference(
        findUnpinnedWorkflowUses(head.workflow),
        findUnpinnedWorkflowUses(baseWorkflow ?? {}),
        (value) => `${value.kind}:${value.job ?? ""}:${value.service ?? ""}:${value.uses}`,
      );

      for (const use of newUnpinnedUses) {
        const check: CheckName =
          use.kind === "action"
            ? "unpinned_action"
            : use.kind === "reusable-workflow"
              ? "unpinned_reusable_workflow"
              : "unpinned_container";
        const severity = severityFor(config, check);

        if (severity) {
          const pattern =
            use.kind === "action"
              ? "unpinned action"
              : use.kind === "reusable-workflow"
                ? "unpinned reusable workflow"
                : "unpinned container";
          findings.push(
            dangerousFinding(file.path, severity, pattern, [
              { label: "uses", value: use.uses },
              ...(use.job ? [{ label: "job", value: use.job }] : []),
              ...(use.service ? [{ label: "service", value: use.service }] : []),
            ]),
          );
        }
      }

      const secretSeverity = severityFor(config, "added_secret_reference");
      if (secretSeverity) {
        const addedSecretReferences = setDifference(
          findSecretReferences(file.headContent),
          findSecretReferences(file.baseContent),
          String,
        );

        for (const secret of addedSecretReferences) {
          findings.push(
            dangerousFinding(file.path, secretSeverity, "added secrets reference", [
              { label: "secret", value: secret },
            ]),
          );
        }
      }
    }

    return findings;
  },
};
