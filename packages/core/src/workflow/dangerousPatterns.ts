import { normalizeWorkflowPermissions } from "./permissions.js";
import type { WorkflowDocument } from "./parseWorkflow.js";

interface CheckoutStep {
  uses: string;
  ref?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function workflowOn(workflow: WorkflowDocument): unknown {
  return workflow.on ?? workflow["on"];
}

export function hasWorkflowEvent(workflow: WorkflowDocument, eventName: string): boolean {
  const event = workflowOn(workflow);

  if (typeof event === "string") {
    return event === eventName;
  }

  if (Array.isArray(event)) {
    return event.includes(eventName);
  }

  return isRecord(event) && Object.hasOwn(event, eventName);
}

export function hasWriteAllPermissions(workflow: WorkflowDocument): boolean {
  return (
    typeof workflow.permissions === "string" && workflow.permissions.toLowerCase() === "write-all"
  );
}

export function hasIdTokenWritePermission(workflow: WorkflowDocument): boolean {
  return normalizeWorkflowPermissions(workflow.permissions)["id-token"] === "write";
}

export function hasOwnWorkflowPermissions(workflow: WorkflowDocument): boolean {
  return Object.hasOwn(workflow, "permissions");
}

function workflowJobs(workflow: WorkflowDocument): Record<string, unknown> {
  return isRecord(workflow.jobs) ? workflow.jobs : {};
}

export interface JobPermissions {
  jobId: string;
  permissions: unknown;
}

export function findJobPermissions(workflow: WorkflowDocument): JobPermissions[] {
  return Object.entries(workflowJobs(workflow)).flatMap(([jobId, job]) => {
    if (!isRecord(job) || !Object.hasOwn(job, "permissions")) {
      return [];
    }

    return [{ jobId, permissions: job.permissions }];
  });
}

export function findJobsWithWriteAllPermissions(workflow: WorkflowDocument): string[] {
  return findJobPermissions(workflow)
    .filter(
      ({ permissions }) =>
        typeof permissions === "string" && permissions.toLowerCase() === "write-all",
    )
    .map(({ jobId }) => jobId);
}

export function findJobsWithIdTokenWritePermission(workflow: WorkflowDocument): string[] {
  return findJobPermissions(workflow)
    .filter(({ permissions }) => normalizeWorkflowPermissions(permissions)["id-token"] === "write")
    .map(({ jobId }) => jobId);
}

function jobSteps(job: unknown): unknown[] {
  return isRecord(job) && Array.isArray(job.steps) ? job.steps : [];
}

export function findWorkflowActionUses(workflow: WorkflowDocument): string[] {
  return Object.values(workflowJobs(workflow)).flatMap((job) =>
    jobSteps(job).flatMap((step) => {
      if (!isRecord(step)) {
        return [];
      }

      const uses = asString(step.uses);
      return uses ? [uses] : [];
    }),
  );
}

function findCheckoutSteps(workflow: WorkflowDocument): CheckoutStep[] {
  return Object.values(workflowJobs(workflow)).flatMap((job) =>
    jobSteps(job).flatMap((step) => {
      if (!isRecord(step)) {
        return [];
      }

      const uses = asString(step.uses);

      if (!uses?.startsWith("actions/checkout@")) {
        return [];
      }

      const ref = isRecord(step.with) ? asString(step.with.ref) : undefined;
      return [{ uses, ref }];
    }),
  );
}

export function hasPullRequestTargetCheckoutOfHead(workflow: WorkflowDocument): boolean {
  if (!hasWorkflowEvent(workflow, "pull_request_target")) {
    return false;
  }

  return findCheckoutSteps(workflow).some((step) =>
    step.ref?.includes("github.event.pull_request.head"),
  );
}

function isThirdPartyAction(uses: string): boolean {
  return (
    !uses.startsWith("actions/") &&
    !uses.startsWith("./") &&
    !uses.startsWith("../") &&
    !uses.startsWith(".github/") &&
    !uses.startsWith("docker://")
  );
}

function isShaPinnedAction(uses: string): boolean {
  const atIndex = uses.lastIndexOf("@");

  if (atIndex < 0) {
    return false;
  }

  return /^[a-f0-9]{40}$/i.test(uses.slice(atIndex + 1));
}

export function findUnpinnedThirdPartyActions(workflow: WorkflowDocument): string[] {
  return findWorkflowActionUses(workflow).filter(
    (uses) => isThirdPartyAction(uses) && !isShaPinnedAction(uses),
  );
}

export function hasAddedSecretsReference(patch: string | undefined): boolean {
  if (!patch) {
    return false;
  }

  const secretPatterns = [
    /secrets\.[A-Za-z0-9_]+/,
    /secrets\[['"][A-Za-z0-9_]+['"]\]/,
    /toJson\(\s*secrets\s*\)/,
  ];

  return patch
    .split("\n")
    .some(
      (line) =>
        line.startsWith("+") &&
        !line.startsWith("+++") &&
        secretPatterns.some((pattern) => pattern.test(line)),
    );
}
