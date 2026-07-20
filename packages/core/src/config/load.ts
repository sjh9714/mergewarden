import { parseDocument } from "yaml";

import { formatZodIssues } from "../validation/formatZodIssues.js";
import { MergeWardenConfigSchema, CONFIG_FILE_NAME, type MergeWardenConfig } from "./schema.js";

function formatYamlErrors(errors: { message: string }[]): string {
  return errors.map((error) => error.message).join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoGitHubActionsConfigMixing(value: unknown): void {
  if (!isRecord(value) || !isRecord(value.github_actions)) {
    return;
  }

  const githubActions = value.github_actions;
  const legacyKeys = [
    "block_permission_escalation",
    "block_pull_request_target_checkout",
    "require_pinned_actions",
    "severity",
  ];

  if (
    Object.hasOwn(githubActions, "checks") &&
    legacyKeys.some((key) => Object.hasOwn(githubActions, key))
  ) {
    throw new Error(
      `Invalid ${CONFIG_FILE_NAME}: github_actions.checks cannot be mixed with legacy github_actions fields`,
    );
  }
}

export function parseConfig(yamlText: string): MergeWardenConfig {
  const document = parseDocument(yamlText);

  if (document.errors.length > 0) {
    throw new Error(
      `Invalid ${CONFIG_FILE_NAME}: YAML parse error: ${formatYamlErrors(document.errors)}`,
    );
  }

  const rawValue = document.toJS();
  assertNoGitHubActionsConfigMixing(rawValue);
  const parsed = MergeWardenConfigSchema.safeParse(rawValue);

  if (!parsed.success) {
    throw new Error(`Invalid ${CONFIG_FILE_NAME}: ${formatZodIssues(parsed.error.issues)}`);
  }

  return parsed.data;
}
