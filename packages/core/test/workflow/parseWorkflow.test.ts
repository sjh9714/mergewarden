import { describe, expect, it } from "vitest";

import { parseWorkflow } from "../../src/workflow/parseWorkflow.js";

describe("parseWorkflow", () => {
  it("returns a valid result for workflow YAML objects", () => {
    const result = parseWorkflow("name: CI\n'on': [push]\npermissions:\n  contents: read\n");

    expect(result).toMatchObject({
      kind: "valid",
      workflow: {
        name: "CI",
        permissions: {
          contents: "read",
        },
      },
    });
  });

  it("returns an invalid result for empty workflows", () => {
    expect(parseWorkflow("")).toMatchObject({
      kind: "invalid",
    });
  });

  it("returns an invalid result for malformed workflow YAML", () => {
    expect(parseWorkflow("permissions: [")).toMatchObject({
      kind: "invalid",
    });
  });
});
