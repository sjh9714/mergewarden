import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../src/index.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("analyze", () => {
  it("returns a deterministic pass result for safe inputs", async () => {
    const input = createAnalysisInput();

    const result = await analyze(input);

    expect(result).toMatchObject({
      decision: "pass",
      status: "passed",
      riskScore: 0,
      summary: {
        title: "MergeWarden: passed",
        agentDetected: false,
        contractPresent: false,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        waivedCount: 0,
      },
      findings: [],
      waivedFindings: [],
      metadata: {
        analyzedAt: "2026-06-13T00:00:00.000Z",
        baseSha: "base-sha",
        headSha: "head-sha",
        configSource: "local",
        version: "0.0.0",
        analysisComplete: true,
        expectedFileCount: 0,
        analyzedFileCount: 0,
        contentFileCount: 0,
        engineVersion: "0.0.0",
        runtimeRef: "0.0.0",
        totalFindingCount: 0,
        omittedFindingCount: 0,
      },
    });
    expect(result.metadata.policyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(await analyze(input)).toEqual(result);
  });

  it("returns block in block mode when contract scope errors are present", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: ["src/auth/**"],
          },
        },
        files: [fileChange("src/payments/webhook.ts")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.status).toBe("blocked");
    expect(result.summary.errorCount).toBe(1);
    expect(result.riskScore).toBe(20);
  });

  it("returns warn in warn mode when error findings are present", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: warn\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: ["src/auth/**"],
          },
        },
        files: [fileChange("src/payments/webhook.ts")],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.status).toBe("needs-review");
    expect(result.summary.errorCount).toBe(1);
  });

  it("returns pass in observe mode even when error findings are present", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: observe\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: ["src/auth/**"],
          },
        },
        files: [fileChange("src/payments/webhook.ts")],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.status).toBe("observed");
    expect(result.summary.errorCount).toBe(1);
  });

  it("caps risk score at 100", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: {
            version: 1,
            allowed_paths: ["src/auth/**"],
          },
        },
        files: [
          fileChange("src/one.ts"),
          fileChange("src/two.ts"),
          fileChange("src/three.ts"),
          fileChange("src/four.ts"),
          fileChange("src/five.ts"),
          fileChange("src/six.ts"),
        ],
      }),
    );

    expect(result.riskScore).toBe(100);
  });

  it("returns block when agent control-plane drift is present in block mode", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(["agent-control-plane/drift"]);
  });

  it("returns block when missing test evidence is present in block mode", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nhigh_risk_paths:\n  auth:\n    paths:\n      - src/auth/**\n    require_tests:\n      - tests/auth/**\n",
        ),
        files: [fileChange("src/auth/session.ts")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "risk/high-risk-path",
      "evidence/missing-test-change",
    ]);
  });

  it("returns warn for error findings in warn mode", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: warn\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "agent-control-plane/drift",
        severity: "error",
      }),
    );
  });

  it("returns pass in observe mode while recording findings", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: observe\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "agent-control-plane/drift",
        severity: "error",
      }),
    );
  });
});
