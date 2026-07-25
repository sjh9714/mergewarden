import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type ParseContractResult } from "../../src/index.js";
import { createAnalysisInput, fileChange } from "../helpers.js";

const validAuthContract: ParseContractResult = {
  kind: "valid",
  contract: {
    version: 1,
    allowed_paths: ["src/auth/**", "tests/auth/**"],
    blocked_paths: [".github/workflows/**"],
  },
};

describe("contract rules", () => {
  it("emits contract/missing for agent PRs without contracts, warning rather than blocking", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nagent_detection:\n  labels:\n    - ai-generated\n",
        ),
        pr: { labels: ["ai-generated"] },
      }),
    );

    // Deliberately not "block". This is the one rule that fires on the absence of a
    // convention rather than on something the PR did, and the scan study measured 0 of
    // 2,204 agent PRs declaring a scope — so blocking by default would reject every agent
    // PR the day a repository switches to block mode. Opt in with contract.missing_severity.
    expect(result.decision).toBe("warn");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "agent/origin-detected",
      "contract/missing",
    ]);
  });

  it("blocks a missing contract when the repository opts in with missing_severity", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          [
            "version: 1",
            "mode: block",
            "agent_detection:",
            "  labels:",
            "    - ai-generated",
            "contract:",
            "  missing_severity: error",
            "",
          ].join("\n"),
        ),
        pr: { labels: ["ai-generated"] },
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "contract/missing", severity: "error" }),
    );
  });

  it("keeps an out-of-scope change blocking even though a missing contract only warns", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: validAuthContract,
        files: [fileChange("src/billing/invoice.ts")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "contract/out-of-scope", severity: "error" }),
    );
  });

  it("passes non-agent PRs without contracts when contracts are required only for agents", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("emits contract/missing for non-agent PRs when contracts are required for all PRs", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\ncontract:\n  required_for:\n    - all\n"),
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["contract/missing"]);
  });

  it("emits contract/invalid for invalid contract parse results", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: { kind: "invalid", message: "allowed_paths is required" },
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings[0]).toMatchObject({
      ruleId: "contract/invalid",
      severity: "error",
    });
  });

  it("passes valid contracts with only allowed files", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: validAuthContract,
        files: [fileChange("src/auth/session.ts"), fileChange("tests/auth/session.test.ts")],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("blocks valid contracts with out-of-scope files", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: validAuthContract,
        files: [fileChange("src/auth/session.ts"), fileChange("src/payments/webhook.ts")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "contract/out-of-scope",
        severity: "error",
        path: "src/payments/webhook.ts",
      }),
    );
  });

  it("blocks renamed files when the previous path is outside contract scope", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: validAuthContract,
        files: [
          {
            ...fileChange("src/auth/webhook.ts"),
            previousPath: "src/payments/webhook.ts",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "contract/out-of-scope",
        severity: "error",
        path: "src/auth/webhook.ts",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "src/auth/webhook.ts" },
          { label: "previous_path", value: "src/payments/webhook.ts" },
          { label: "out_of_scope_paths", value: "src/payments/webhook.ts" },
        ]),
      }),
    );
  });

  it("blocks valid contracts with blocked paths", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: [".github/**"],
            blocked_paths: [".github/workflows/**"],
          },
        },
        files: [fileChange(".github/workflows/ci.yml")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "contract/blocked-path",
        severity: "error",
        path: ".github/workflows/ci.yml",
      }),
    );
  });

  it("blocks renamed files when the previous path matches blocked contract paths", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: ["src/auth/**", "src/payments/**"],
            blocked_paths: ["src/payments/**"],
          },
        },
        files: [
          {
            ...fileChange("src/auth/webhook.ts"),
            previousPath: "src/payments/webhook.ts",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "contract/blocked-path",
        severity: "error",
        path: "src/auth/webhook.ts",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "src/auth/webhook.ts" },
          { label: "previous_path", value: "src/payments/webhook.ts" },
          { label: "blocked_patterns", value: "src/payments/**" },
        ]),
      }),
    );
  });

  it("passes renamed files when both current and previous paths are allowed", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: ["src/auth/**", "src/legacy-auth/**"],
          },
        },
        files: [
          {
            ...fileChange("src/auth/session.ts"),
            previousPath: "src/legacy-auth/session.ts",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("downgrades missing contracts in observe mode when configured", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: observe\nagent_detection:\n  labels:\n    - ai-generated\n",
        ),
        pr: { labels: ["ai-generated"] },
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "contract/missing",
        severity: "warn",
      }),
    );
  });
});
