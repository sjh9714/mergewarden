import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../src/index.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("analyze", () => {
  it("returns a deterministic pass result for safe inputs", async () => {
    const input = createAnalysisInput();

    const result = await analyze(input);

    expect(result).toEqual({
      decision: "pass",
      riskScore: 0,
      summary: {
        title: "Agent Gate: passed",
        agentDetected: false,
        contractPresent: false,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
      },
      findings: [],
      metadata: {
        analyzedAt: "2026-06-13T00:00:00.000Z",
        baseSha: "base-sha",
        headSha: "head-sha",
        configSource: "local",
        version: "0.0.0",
      },
    });
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
});
