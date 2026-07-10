import type { AgentGateConfig } from "../config/schema.js";
import type { Evidence, RawFinding } from "../types.js";
import {
  findSecretReferences,
  findUnknownWritePermissions,
  workflowJobs,
} from "../workflow/dangerousPatterns.js";
import { extractGitHubExpressionBodies } from "../workflow/expressions.js";
import { parseWorkflow, type WorkflowDocument } from "../workflow/parseWorkflow.js";
import { normalizeWorkflowPermissions } from "../workflow/permissions.js";
import type { Rule } from "./types.js";

interface AgenticAction {
  uses: string;
  promptInputs: string[];
}

interface Candidate {
  key: string;
  action: string;
  input: string;
  job: string;
  source: string;
  capability: "read-only" | "write" | "unknown" | "secret";
}

const DEFAULT_AGENTIC_ACTIONS: AgenticAction[] = [
  { uses: "openai/codex-action", promptInputs: ["prompt"] },
  { uses: "anthropics/claude-code-action", promptInputs: ["prompt"] },
  { uses: "google-github-actions/run-gemini-cli", promptInputs: ["prompt"] },
];

const UNTRUSTED_CONTEXT_PATTERN =
  /github\.(?:event\.(?:pull_request\.(?:body|title|head\.(?:ref|label))|issue\.(?:body|title)|comment\.body|review\.body|review_comment\.body|discussion\.(?:body|title)|head_commit\.message)|head_ref)/gi;
const ENV_REFERENCE_PATTERN = /\benv\.([A-Za-z_][A-Za-z0-9_]*)\b/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function actionName(uses: string): string {
  const index = uses.lastIndexOf("@");
  return (index >= 0 ? uses.slice(0, index) : uses).toLowerCase();
}

function registry(config: AgentGateConfig["agentic_workflows"]): AgenticAction[] {
  const entries = [
    ...DEFAULT_AGENTIC_ACTIONS,
    ...config.additional_actions.map((action) => ({
      uses: action.uses,
      promptInputs: action.prompt_inputs,
    })),
  ];
  const byAction = new Map<string, Set<string>>();

  for (const entry of entries) {
    const name = actionName(entry.uses);
    const inputs = byAction.get(name) ?? new Set<string>();
    entry.promptInputs.forEach((input) => inputs.add(input));
    byAction.set(name, inputs);
  }

  return [...byAction.entries()].map(([uses, inputs]) => ({
    uses,
    promptInputs: [...inputs].sort(),
  }));
}

function untrustedSources(value: string): string[] {
  return [
    ...new Set(
      extractGitHubExpressionBodies(value).flatMap((expression) =>
        [...expression.matchAll(UNTRUSTED_CONTEXT_PATTERN)].map((match) => match[0]),
      ),
    ),
  ].sort();
}

function effectiveEnv(
  workflow: WorkflowDocument,
  job: Record<string, unknown>,
  step: Record<string, unknown>,
): Record<string, string> {
  return {
    ...stringRecord(workflow.env),
    ...stringRecord(job.env),
    ...stringRecord(step.env),
  };
}

function promptSources(prompt: string, env: Record<string, string>): string[] {
  const sources = new Set(untrustedSources(prompt));

  for (const expression of extractGitHubExpressionBodies(prompt)) {
    for (const match of expression.matchAll(ENV_REFERENCE_PATTERN)) {
      const name = match[1];
      if (!name) {
        continue;
      }

      for (const source of untrustedSources(env[name] ?? "")) {
        sources.add(`${source} via env.${name}`);
      }
    }
  }

  return [...sources].sort();
}

function stepHasSecret(step: Record<string, unknown>, env: Record<string, string>): boolean {
  return [...Object.values(stringRecord(step.with)), ...Object.values(env)].some(
    (value) => findSecretReferences(value).length > 0,
  );
}

function effectiveCapability(
  workflow: WorkflowDocument,
  job: Record<string, unknown>,
  step: Record<string, unknown>,
  env: Record<string, string>,
): Candidate["capability"] {
  if (stepHasSecret(step, env)) {
    return "secret";
  }

  const hasJobPermissions = Object.hasOwn(job, "permissions");
  const hasWorkflowPermissions = Object.hasOwn(workflow, "permissions");

  if (!hasJobPermissions && !hasWorkflowPermissions) {
    return "unknown";
  }

  const effectivePermissions = hasJobPermissions ? job.permissions : workflow.permissions;
  if (findUnknownWritePermissions({ permissions: effectivePermissions }).length > 0) {
    return "unknown";
  }

  const permissions = normalizeWorkflowPermissions(effectivePermissions);
  return Object.values(permissions).some((value) => value === "write") ? "write" : "read-only";
}

function candidates(
  workflow: WorkflowDocument | undefined,
  config: AgentGateConfig["agentic_workflows"],
): Candidate[] {
  if (!workflow) {
    return [];
  }

  const registered = new Map(
    registry(config).map((action) => [action.uses, new Set(action.promptInputs)]),
  );
  const results: Candidate[] = [];

  for (const [jobId, rawJob] of Object.entries(workflowJobs(workflow))) {
    if (!isRecord(rawJob) || !Array.isArray(rawJob.steps)) {
      continue;
    }

    for (const rawStep of rawJob.steps) {
      if (!isRecord(rawStep) || typeof rawStep.uses !== "string") {
        continue;
      }

      const action = actionName(rawStep.uses);
      const promptInputs = registered.get(action);

      if (!promptInputs) {
        continue;
      }

      const withConfig = stringRecord(rawStep.with);
      const env = effectiveEnv(workflow, rawJob, rawStep);
      const capability = effectiveCapability(workflow, rawJob, rawStep, env);

      for (const input of promptInputs) {
        const prompt = withConfig[input];
        if (!prompt) {
          continue;
        }

        for (const source of promptSources(prompt, env)) {
          results.push({
            key: `${action}:${jobId}:${input}:${source}:${capability}`,
            action,
            input,
            job: jobId,
            source,
            capability,
          });
        }
      }
    }
  }

  return results;
}

function finding(filePath: string, candidate: Candidate, config: AgentGateConfig): RawFinding {
  const privileged = candidate.capability !== "read-only";
  const evidence: Evidence[] = [
    { label: "changed_file", value: filePath },
    { label: "source_expression", value: candidate.source },
    { label: "sink_action", value: candidate.action },
    { label: "sink_input", value: candidate.input },
    { label: "job", value: candidate.job },
    { label: "effective_capability", value: candidate.capability },
  ];

  return {
    ruleId: "workflow/agentic-untrusted-input",
    severity: privileged
      ? config.agentic_workflows.privileged_severity
      : config.agentic_workflows.severity,
    title: "Untrusted event data reaches an agent prompt",
    message: `${filePath} passes untrusted GitHub event data into an agent prompt input.`,
    path: filePath,
    evidence,
    remediation: [
      "Replace the untrusted prompt value with reviewed, fixed instructions or isolate the agent in a read-only workflow.",
    ],
    tags: ["workflow", "agentic-workflow", "prompt-injection"],
    confidence: "high",
  };
}

export const agenticWorkflowInjectionRule: Rule = {
  id: "workflow/agentic-untrusted-input",
  title: "Untrusted event data reaches an agent prompt",
  run(ctx) {
    const config = ctx.input.config;
    if (!config.agentic_workflows.enabled) {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const file of ctx.helpers.changedFiles()) {
      const wasWorkflow = ctx.helpers.matchesAny(
        file.previousPath ?? file.path,
        config.github_actions.paths,
      );
      if (
        file.status === "removed" ||
        file.headContent == null ||
        !ctx.helpers.matchesAny(file.path, config.github_actions.paths)
      ) {
        continue;
      }

      const head = parseWorkflow(file.headContent);
      if (head.kind !== "valid") {
        continue;
      }

      const base =
        file.status === "added" || !wasWorkflow ? undefined : parseWorkflow(file.baseContent);
      const baseWorkflow = base?.kind === "valid" ? base.workflow : undefined;
      const baseKeys = new Set(
        candidates(baseWorkflow, config.agentic_workflows).map((candidate) => candidate.key),
      );

      for (const candidate of candidates(head.workflow, config.agentic_workflows)) {
        if (!baseKeys.has(candidate.key)) {
          findings.push(finding(file.path, candidate, config));
        }
      }
    }

    return findings;
  },
};
