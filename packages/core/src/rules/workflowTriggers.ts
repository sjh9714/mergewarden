import { parseWorkflow, type WorkflowDocument } from "../workflow/parseWorkflow.js";
import type { RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkflowFile(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.github_actions.paths);
}

function wasWorkflowFile(ctx: RuleContext, file: { path: string; previousPath?: string }): boolean {
  return isWorkflowFile(ctx, file.previousPath ?? file.path);
}

/**
 * The event names a workflow triggers on.
 *
 * GitHub Actions accepts three shapes for `on:` — a bare string, a sequence, or a mapping —
 * and all three appear in the wild, so all three are read here.
 */
export function workflowEventNames(workflow: WorkflowDocument): string[] {
  const on = workflow.on;

  if (typeof on === "string") {
    return [on];
  }

  if (Array.isArray(on)) {
    return on.filter((entry): entry is string => typeof entry === "string");
  }

  return isRecord(on) ? Object.keys(on) : [];
}

/**
 * Events that used to fire this workflow and no longer do.
 */
export function removedWorkflowEvents(
  base: WorkflowDocument | undefined,
  head: WorkflowDocument,
): string[] {
  if (!base) {
    return [];
  }

  const headEvents = new Set(workflowEventNames(head));
  return workflowEventNames(base).filter((event) => !headEvents.has(event));
}

/**
 * How much a reviewer should care that a given event stopped firing.
 *
 * `pull_request` and `pull_request_target` are called out separately because losing them is
 * the specific case GitHub's review guidance names — a workflow that no longer runs on pull
 * requests stops gating the very change that removed it.
 */
function eventConsequence(event: string): string {
  switch (event) {
    case "pull_request":
    case "pull_request_target":
      return "this workflow no longer runs on pull requests, including the one removing it";
    case "push":
      return "this workflow no longer runs on pushes";
    case "merge_group":
      return "this workflow no longer runs in the merge queue";
    case "schedule":
      return "this workflow no longer runs on its schedule";
    case "workflow_call":
      return "this workflow can no longer be called by other workflows";
    default:
      return `this workflow no longer runs on ${event}`;
  }
}

export const workflowTriggerRemovedRule: Rule = {
  id: "workflow/trigger-removed",
  title: "Workflow trigger removed",
  run(ctx) {
    const setting = ctx.input.config.github_actions.checks.trigger_removed;

    if (setting === "off") {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const file of ctx.helpers.changedFiles()) {
      // A workflow that is added, or was not a workflow before, had no triggers to lose.
      // A deleted workflow is already reported by the workflow_deleted check.
      const treatAsAdded = file.status === "added" || !wasWorkflowFile(ctx, file);
      if (
        !isWorkflowFile(ctx, file.path) ||
        file.status === "removed" ||
        treatAsAdded ||
        !file.headContent ||
        !file.baseContent
      ) {
        continue;
      }

      const base = parseWorkflow(file.baseContent);
      const head = parseWorkflow(file.headContent);

      // A workflow that cannot be parsed on either side is reported by malformed_workflow.
      // Guessing at triggers from an unparseable document would only produce noise.
      if (base.kind !== "valid" || head.kind !== "valid") {
        continue;
      }

      for (const event of removedWorkflowEvents(base.workflow, head.workflow)) {
        findings.push({
          ruleId: "workflow/trigger-removed",
          severity: setting,
          title: "Workflow trigger removed",
          message: `${file.path} no longer triggers on ${event}; ${eventConsequence(event)}. Confirm this reduction in coverage is intended.`,
          path: file.path,
          evidence: [
            { label: "changed_file", value: file.path },
            { label: "removed_event", value: event },
            { label: "events_before", value: workflowEventNames(base.workflow).join(", ") },
            {
              label: "events_after",
              value: workflowEventNames(head.workflow).join(", ") || "none",
            },
          ],
          remediation: [
            "Confirm the workflow is still expected to run in the situations it stopped covering.",
            "If coverage moved to another workflow, say so in the pull request description.",
          ],
          tags: ["workflow", "ci-coverage"],
          confidence: "high",
        });
      }
    }

    return findings;
  },
};
