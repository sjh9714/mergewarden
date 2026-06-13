import { parseDocument } from "yaml";

export type WorkflowDocument = Record<string, unknown>;

export type ParseWorkflowResult =
  | {
      kind: "valid";
      workflow: WorkflowDocument;
    }
  | {
      kind: "invalid";
      message: string;
    };

function isRecord(value: unknown): value is WorkflowDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkflow(yamlText: string | null | undefined): ParseWorkflowResult {
  if (!yamlText?.trim()) {
    return { kind: "invalid", message: "workflow is empty" };
  }

  try {
    const document = parseDocument(yamlText, { prettyErrors: false });

    if (document.errors.length > 0) {
      return {
        kind: "invalid",
        message: document.errors.map((error) => error.message).join("; "),
      };
    }

    const value = document.toJS() as unknown;

    if (!isRecord(value)) {
      return { kind: "invalid", message: "workflow must be a YAML object" };
    }

    return { kind: "valid", workflow: value };
  } catch (error) {
    return {
      kind: "invalid",
      message: error instanceof Error ? error.message : "workflow could not be parsed",
    };
  }
}
