import { parseDocument } from "yaml";

import { formatZodIssues } from "../validation/formatZodIssues.js";
import { AgentContractSchema, type AgentContract, type ParseContractResult } from "./schema.js";

const CONTRACT_BLOCK_PATTERN = /<!--\s*mergewarden-contract\b([\s\S]*?)-->/g;

function formatYamlErrors(errors: { message: string }[]): string {
  return errors.map((error) => error.message).join("; ");
}

function parseContractYaml(yamlText: string): ParseContractResult {
  const document = parseDocument(yamlText);

  if (document.errors.length > 0) {
    return {
      kind: "invalid",
      message: `Invalid mergewarden contract YAML: ${formatYamlErrors(document.errors)}`,
      issues: document.errors,
    };
  }

  const parsed = AgentContractSchema.safeParse(document.toJS());

  if (!parsed.success) {
    return {
      kind: "invalid",
      message: `Invalid mergewarden contract: ${formatZodIssues(parsed.error.issues)}`,
      issues: parsed.error.issues,
    };
  }

  return { kind: "valid", contract: parsed.data satisfies AgentContract };
}

export function parseContractFromPrBody(body: string): ParseContractResult {
  const matches = [...body.matchAll(CONTRACT_BLOCK_PATTERN)];

  if (matches.length === 0) {
    return { kind: "missing" };
  }

  if (matches.length > 1) {
    return {
      kind: "invalid",
      message: "Multiple mergewarden contract blocks found; expected exactly one.",
    };
  }

  const contractYaml = matches[0]?.[1]?.trim() ?? "";

  // PR body contracts are untrusted claims from the pull request, not policy decisions.
  return parseContractYaml(contractYaml);
}
