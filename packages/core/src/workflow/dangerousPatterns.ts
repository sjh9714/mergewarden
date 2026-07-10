import { KNOWN_WORKFLOW_PERMISSIONS, normalizeWorkflowPermissions } from "./permissions.js";
import type { WorkflowDocument } from "./parseWorkflow.js";
import { canonicalizeExpressionReferences, extractGitHubExpressionBodies } from "./expressions.js";

interface CheckoutStep {
  uses: string;
  ref?: string;
  repository?: string;
}

export interface WorkflowUse {
  kind: "action" | "reusable-workflow" | "container";
  uses: string;
  job?: string;
  service?: string;
}

export interface UnknownWritePermission {
  permission: string;
  scope: "workflow" | "job";
  job?: string;
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

export function workflowJobs(workflow: WorkflowDocument): Record<string, unknown> {
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
  return findWorkflowUses(workflow)
    .filter((item) => item.kind === "action")
    .map((item) => item.uses);
}

function containerImage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return isRecord(value) ? asString(value.image) : undefined;
}

export function findWorkflowUses(workflow: WorkflowDocument): WorkflowUse[] {
  const uses: WorkflowUse[] = [];

  for (const [jobId, job] of Object.entries(workflowJobs(workflow))) {
    if (!isRecord(job)) {
      continue;
    }

    const reusable = asString(job.uses);
    if (reusable) {
      uses.push({ kind: "reusable-workflow", uses: reusable, job: jobId });
    }

    const container = containerImage(job.container);
    if (container) {
      uses.push({ kind: "container", uses: container, job: jobId });
    }

    if (isRecord(job.services)) {
      for (const [service, definition] of Object.entries(job.services)) {
        const image = containerImage(definition);
        if (image) {
          uses.push({ kind: "container", uses: image, job: jobId, service });
        }
      }
    }

    for (const step of jobSteps(job)) {
      if (!isRecord(step)) {
        continue;
      }

      const stepUses = asString(step.uses);
      if (!stepUses) {
        continue;
      }

      if (stepUses.startsWith("docker://")) {
        uses.push({ kind: "container", uses: stepUses.slice("docker://".length), job: jobId });
      } else {
        uses.push({ kind: "action", uses: stepUses, job: jobId });
      }
    }
  }

  return uses;
}

function findCheckoutSteps(workflow: WorkflowDocument): CheckoutStep[] {
  return Object.values(workflowJobs(workflow)).flatMap((job) =>
    jobSteps(job).flatMap((step) => {
      if (!isRecord(step)) {
        return [];
      }

      const uses = asString(step.uses);

      if (!uses?.toLowerCase().startsWith("actions/checkout@")) {
        return [];
      }

      const withConfig = isRecord(step.with) ? step.with : {};
      return [
        {
          uses,
          ref: asString(withConfig.ref),
          repository: asString(withConfig.repository),
        },
      ];
    }),
  );
}

const PR_HEAD_CONTEXT =
  /github\.(?:event\.pull_request\.head(?:\.(?:sha|ref|label)|\.repo\.full_name)?|head_ref)/i;

export function findPullRequestTargetHeadPatterns(workflow: WorkflowDocument): string[] {
  if (!hasWorkflowEvent(workflow, "pull_request_target")) {
    return [];
  }

  const patterns: string[] = [];

  for (const step of findCheckoutSteps(workflow)) {
    const ref = canonicalizeExpressionReferences(step.ref ?? "");
    const repository = canonicalizeExpressionReferences(step.repository ?? "");
    const hasHeadExpression = [step.ref ?? "", step.repository ?? ""].some((value) =>
      extractGitHubExpressionBodies(value).some((expression) => PR_HEAD_CONTEXT.test(expression)),
    );
    if (hasHeadExpression) {
      patterns.push(`checkout:${ref}:${repository}`);
    }
  }

  for (const [jobId, job] of Object.entries(workflowJobs(workflow))) {
    for (const [stepIndex, step] of jobSteps(job).entries()) {
      if (!isRecord(step) || typeof step.run !== "string") {
        continue;
      }

      for (const [lineIndex, line] of step.run.split(/\r?\n/).entries()) {
        const canonicalLine = canonicalizeExpressionReferences(line);
        const hasHeadExpression = extractGitHubExpressionBodies(line).some((expression) =>
          PR_HEAD_CONTEXT.test(expression),
        );
        if (/\bgit\s+(?:fetch|checkout)\b/i.test(line) && hasHeadExpression) {
          patterns.push(`shell:${jobId}:${stepIndex}:${lineIndex}:${canonicalLine.trim()}`);
        }
      }
    }
  }

  return patterns;
}

export function hasPullRequestTargetCheckoutOfHead(workflow: WorkflowDocument): boolean {
  return findPullRequestTargetHeadPatterns(workflow).length > 0;
}

function isLocalUse(uses: string): boolean {
  return uses.startsWith("./") || uses.startsWith("../");
}

function isShaPinnedAction(uses: string): boolean {
  const atIndex = uses.lastIndexOf("@");
  return atIndex >= 0 && /^[a-f0-9]{40}$/i.test(uses.slice(atIndex + 1));
}

function isDigestPinnedContainer(image: string): boolean {
  return /@sha256:[a-f0-9]{64}$/i.test(image);
}

export function findUnpinnedWorkflowUses(workflow: WorkflowDocument): WorkflowUse[] {
  return findWorkflowUses(workflow).filter((item) => {
    if (isLocalUse(item.uses)) {
      return false;
    }

    return item.kind === "container"
      ? !isDigestPinnedContainer(item.uses)
      : !isShaPinnedAction(item.uses);
  });
}

/** @deprecated Use findUnpinnedWorkflowUses. This now includes official actions. */
export function findUnpinnedThirdPartyActions(workflow: WorkflowDocument): string[] {
  return findUnpinnedWorkflowUses(workflow)
    .filter((item) => item.kind === "action")
    .map((item) => item.uses);
}

export function findSecretReferences(content: string | null | undefined): string[] {
  if (!content) {
    return [];
  }

  const references = new Set<string>();
  const expressionBodies = extractGitHubExpressionBodies(content);
  const canonicalContent = expressionBodies.join("\n");
  const patterns = [/secrets\.([A-Za-z0-9_]+)/gi];

  for (const pattern of patterns) {
    for (const match of canonicalContent.matchAll(pattern)) {
      if (match[1]) {
        references.add(match[1]);
      }
    }
  }

  if (/toJson\s*\(\s*secrets\s*\)/i.test(canonicalContent)) {
    references.add("*");
  }

  if (expressionBodies.some((expression) => /\bsecrets\s*\[/.test(expression))) {
    references.add("*dynamic*");
  }

  return [...references].sort();
}

/** @deprecated Patch-based secret detection cannot prove a base/head delta. */
export function hasAddedSecretsReference(patch: string | undefined): boolean {
  return patch
    ? patch
        .split("\n")
        .some(
          (line) =>
            line.startsWith("+") &&
            !line.startsWith("+++") &&
            findSecretReferences(line).length > 0,
        )
    : false;
}

function unknownWritePermissions(
  permissions: unknown,
  scope: "workflow" | "job",
  job?: string,
): UnknownWritePermission[] {
  if (!isRecord(permissions)) {
    return [];
  }

  const known = new Set<string>(KNOWN_WORKFLOW_PERMISSIONS);
  return Object.entries(permissions).flatMap(([permission, value]) => {
    if (known.has(permission) || typeof value !== "string" || value.toLowerCase() !== "write") {
      return [];
    }

    return [{ permission, scope, ...(job ? { job } : {}) }];
  });
}

export function findUnknownWritePermissions(workflow: WorkflowDocument): UnknownWritePermission[] {
  return [
    ...unknownWritePermissions(workflow.permissions, "workflow"),
    ...findJobPermissions(workflow).flatMap(({ jobId, permissions }) =>
      unknownWritePermissions(permissions, "job", jobId),
    ),
  ];
}
