import type { AgentGateConfig } from "../config/schema.js";
import type { Finding, Severity } from "../types.js";
import {
  findUnpinnedThirdPartyActions,
  findJobsWithIdTokenWritePermission,
  findJobsWithWriteAllPermissions,
  hasAddedSecretsReference,
  hasIdTokenWritePermission,
  hasOwnWorkflowPermissions,
  hasPullRequestTargetCheckoutOfHead,
  hasWriteAllPermissions,
} from "../workflow/dangerousPatterns.js";
import { parseWorkflow } from "../workflow/parseWorkflow.js";
import type { Rule, RuleContext } from "./types.js";

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function dangerousFinding(
  filePath: string,
  severity: Severity,
  pattern: string,
  extraEvidence: { label: string; value: string }[] = [],
): Finding {
  return {
    ruleId: "workflow/dangerous-pattern",
    severity,
    title: "Dangerous GitHub Actions workflow pattern",
    message: `${filePath} contains a dangerous GitHub Actions workflow pattern.`,
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

function pinnedActionSeverity(
  config: AgentGateConfig["github_actions"],
): Exclude<AgentGateConfig["github_actions"]["require_pinned_actions"], "off"> | undefined {
  return config.require_pinned_actions === "off" ? undefined : config.require_pinned_actions;
}

export const workflowDangerousPatternRule: Rule = {
  id: "workflow/dangerous-pattern",
  title: "Dangerous GitHub Actions workflow pattern",
  run(ctx) {
    const findings: Finding[] = [];
    const config = ctx.input.config.github_actions;

    for (const file of ctx.helpers.changedFiles()) {
      if (!isWorkflowFile(ctx, file.path) || file.status === "removed" || !file.headContent) {
        continue;
      }

      const parsed = parseWorkflow(file.headContent);

      if (parsed.kind === "invalid") {
        findings.push(
          dangerousFinding(file.path, config.severity, "malformed workflow YAML", [
            { label: "parse_error", value: parsed.message },
          ]),
        );
        continue;
      }

      if (hasWriteAllPermissions(parsed.workflow)) {
        findings.push(dangerousFinding(file.path, config.severity, "permissions: write-all"));
      }

      if (hasIdTokenWritePermission(parsed.workflow)) {
        findings.push(dangerousFinding(file.path, config.severity, "id-token: write"));
      }

      for (const jobId of findJobsWithWriteAllPermissions(parsed.workflow)) {
        findings.push(
          dangerousFinding(file.path, config.severity, "job permissions: write-all", [
            { label: "job", value: jobId },
          ]),
        );
      }

      for (const jobId of findJobsWithIdTokenWritePermission(parsed.workflow)) {
        findings.push(
          dangerousFinding(file.path, config.severity, "job id-token: write", [
            { label: "job", value: jobId },
          ]),
        );
      }

      const base = file.baseContent ? parseWorkflow(file.baseContent) : undefined;
      if (
        base?.kind === "valid" &&
        hasOwnWorkflowPermissions(base.workflow) &&
        !hasOwnWorkflowPermissions(parsed.workflow)
      ) {
        findings.push(dangerousFinding(file.path, "warn", "explicit workflow permissions removed"));
      }

      if (
        config.block_pull_request_target_checkout &&
        hasPullRequestTargetCheckoutOfHead(parsed.workflow)
      ) {
        findings.push(
          dangerousFinding(file.path, config.severity, "pull_request_target checkout of PR head"),
        );
      }

      const actionPinSeverity = pinnedActionSeverity(config);

      if (actionPinSeverity) {
        for (const action of findUnpinnedThirdPartyActions(parsed.workflow)) {
          findings.push(
            dangerousFinding(file.path, actionPinSeverity, "unpinned third-party action", [
              { label: "action", value: action },
            ]),
          );
        }
      }

      if (hasAddedSecretsReference(file.patch)) {
        findings.push(dangerousFinding(file.path, "warn", "added secrets reference"));
      }
    }

    return findings;
  },
};
