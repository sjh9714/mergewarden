import { describe, expect, it } from "vitest";

import { parseContractFromPrBody, type ParseContractResult } from "../../src/index.js";

const validContractBlock = `<!-- agent-gate-contract
version: 1
agent: codex
task: "Fix session expiration bug"
issue: 482
allowed_paths:
  - "src/auth/**"
  - "tests/auth/**"
blocked_paths:
  - ".github/workflows/**"
  - "src/payments/**"
required_evidence:
  - "auth_tests_changed"
  - "ci_passed"
-->`;

function expectInvalid(
  result: ParseContractResult,
): Extract<ParseContractResult, { kind: "invalid" }> {
  expect(result.kind).toBe("invalid");

  if (result.kind !== "invalid") {
    throw new Error(`Expected invalid contract result, got ${result.kind}`);
  }

  return result;
}

describe("parseContractFromPrBody", () => {
  it("returns missing when no contract block is present", () => {
    expect(parseContractFromPrBody("Regular pull request body")).toEqual({ kind: "missing" });
  });

  it("returns a valid contract parsed from the agent-gate HTML comment block", () => {
    const result = parseContractFromPrBody(`Context before\n\n${validContractBlock}\n`);

    expect(result).toEqual({
      kind: "valid",
      contract: {
        version: 1,
        agent: "codex",
        task: "Fix session expiration bug",
        issue: 482,
        allowed_paths: ["src/auth/**", "tests/auth/**"],
        blocked_paths: [".github/workflows/**", "src/payments/**"],
        required_evidence: ["auth_tests_changed", "ci_passed"],
      },
    });
  });

  it("returns invalid for malformed YAML", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
allowed_paths:
  - "src/**"
  - [
-->`);

    expect(expectInvalid(result).message).toMatch(/Invalid agent-gate contract YAML/);
  });

  it("returns invalid when allowed_paths is missing", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
agent: codex
-->`);

    expect(expectInvalid(result).message).toMatch(/allowed_paths/);
  });

  it("returns invalid when allowed_paths is empty", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
allowed_paths: []
-->`);

    expect(expectInvalid(result).message).toMatch(/allowed_paths/);
  });

  it("returns invalid when allowed_paths contains an empty pattern", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
allowed_paths:
  - ""
-->`);

    expect(expectInvalid(result).message).toMatch(/allowed_paths\.0/);
  });

  it("returns invalid when scalar contract strings are whitespace-only", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
agent: " "
task: "   "
allowed_paths:
  - "src/**"
-->`);

    expect(expectInvalid(result).message).toMatch(/agent/);
    expect(expectInvalid(result).message).toMatch(/task/);
  });

  it("returns invalid when the contract block is empty", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
-->`);

    expect(expectInvalid(result).message).toMatch(/Invalid agent-gate contract/);
  });

  it("returns invalid when multiple contract blocks are present", () => {
    const result = parseContractFromPrBody(`${validContractBlock}\n\n${validContractBlock}`);

    expect(result).toEqual({
      kind: "invalid",
      message: "Multiple agent-gate contract blocks found; expected exactly one.",
    });
  });

  it("rejects planned risk budget fields that are not implemented yet", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
allowed_paths:
  - "src/**"
risk_budget:
  max_files_changed: 8
  max_lines_changed: 300
-->`);

    expect(expectInvalid(result).message).toMatch(/risk_budget/);
  });

  it("rejects unknown fields instead of stripping them", () => {
    const result = parseContractFromPrBody(`<!-- agent-gate-contract
version: 1
allowed_paths:
  - "src/**"
unexpected: true
-->`);

    expect(expectInvalid(result).message).toMatch(/unexpected/);
  });
});
