import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../../src/index.js";
import { createAnalysisInput, fileChange } from "../helpers.js";

describe("risk/high-risk-path", () => {
  it("emits an error finding for configured auth paths", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nhigh_risk_paths:\n  auth:\n    paths:\n      - src/auth/**\n",
        ),
        files: [fileChange("src/auth/session.ts")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "risk/high-risk-path",
        severity: "error",
        path: "src/auth/session.ts",
        evidence: expect.arrayContaining([
          { label: "area", value: "auth" },
          { label: "changed_file", value: "src/auth/session.ts" },
          { label: "matched_patterns", value: "src/auth/**" },
        ]),
      }),
    );
  });

  it("uses configured warn severity for matching payments paths", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nhigh_risk_paths:\n  payments:\n    paths:\n      - src/payments/**\n    severity: warn\n",
        ),
        files: [fileChange("src/payments/webhook.ts")],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "risk/high-risk-path",
        severity: "warn",
        path: "src/payments/webhook.ts",
      }),
    );
  });

  it("does not emit for unrelated paths", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nhigh_risk_paths:\n  auth:\n    paths:\n      - src/auth/**\n",
        ),
        files: [fileChange("src/profile/view.ts")],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("emits for renamed files when the previous path matched a high-risk area", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nhigh_risk_paths:\n  auth:\n    paths:\n      - src/auth/**\n",
        ),
        files: [
          {
            ...fileChange("src/profile/session.ts"),
            previousPath: "src/auth/session.ts",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "risk/high-risk-path",
        severity: "error",
        path: "src/profile/session.ts",
        evidence: expect.arrayContaining([
          { label: "area", value: "auth" },
          { label: "changed_file", value: "src/profile/session.ts" },
          { label: "previous_path", value: "src/auth/session.ts" },
          { label: "matched_patterns", value: "src/auth/**" },
        ]),
      }),
    );
  });
});
