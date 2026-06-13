import { parseDocument } from "yaml";

import { formatZodIssues } from "../validation/formatZodIssues.js";
import { AgentGateConfigSchema, CONFIG_FILE_NAME, type AgentGateConfig } from "./schema.js";

function formatYamlErrors(errors: { message: string }[]): string {
  return errors.map((error) => error.message).join("; ");
}

export function parseConfig(yamlText: string): AgentGateConfig {
  const document = parseDocument(yamlText);

  if (document.errors.length > 0) {
    throw new Error(
      `Invalid ${CONFIG_FILE_NAME}: YAML parse error: ${formatYamlErrors(document.errors)}`,
    );
  }

  const parsed = AgentGateConfigSchema.safeParse(document.toJS());

  if (!parsed.success) {
    throw new Error(`Invalid ${CONFIG_FILE_NAME}: ${formatZodIssues(parsed.error.issues)}`);
  }

  return parsed.data;
}
