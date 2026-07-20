import { describe, expect, it } from "vitest";

import { parseContractFromPrBody, type ParseContractResult } from "../../src/index.js";

const validContractBlock = `<!-- mergewarden-contract
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

  it("returns a valid contract parsed from the mergewarden HTML comment block", () => {
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
      },
    });
  });

  it("returns invalid for malformed YAML", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
version: 1
allowed_paths:
  - "src/**"
  - [
-->`);

    expect(expectInvalid(result).message).toMatch(/Invalid mergewarden contract YAML/);
  });

  it("returns invalid when allowed_paths is missing", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
version: 1
agent: codex
-->`);

    expect(expectInvalid(result).message).toMatch(/allowed_paths/);
  });

  it("returns invalid when allowed_paths is empty", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
version: 1
allowed_paths: []
-->`);

    expect(expectInvalid(result).message).toMatch(/allowed_paths/);
  });

  it("returns invalid when allowed_paths contains an empty pattern", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
version: 1
allowed_paths:
  - ""
-->`);

    expect(expectInvalid(result).message).toMatch(/allowed_paths\.0/);
  });

  it("returns invalid when scalar contract strings are whitespace-only", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
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
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
-->`);

    expect(expectInvalid(result).message).toMatch(/Invalid mergewarden contract/);
  });

  it("returns invalid when multiple contract blocks are present", () => {
    const result = parseContractFromPrBody(`${validContractBlock}\n\n${validContractBlock}`);

    expect(result).toEqual({
      kind: "invalid",
      message: "Multiple mergewarden contract blocks found; expected exactly one.",
    });
  });

  it("rejects planned risk budget fields that are not implemented yet", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
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
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
version: 1
allowed_paths:
  - "src/**"
unexpected: true
-->`);

    expect(expectInvalid(result).message).toMatch(/unexpected/);
  });

  it("rejects the removed required_evidence claim instead of silently accepting it", () => {
    const result = parseContractFromPrBody(`<!-- mergewarden-contract
version: 1
allowed_paths:
  - "src/**"
required_evidence:
  - ci_passed
-->`);

    expect(expectInvalid(result).message).toMatch(/required_evidence/);
  });
});
