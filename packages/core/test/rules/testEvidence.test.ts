import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../../src/index.js";
import { createAnalysisInput, fileChange } from "../helpers.js";

const authTestConfig = parseConfig(
  "version: 1\nmode: block\nhigh_risk_paths:\n  auth:\n    paths:\n      - src/auth/**\n    require_tests:\n      - tests/auth/**\n",
);

describe("evidence/missing-test-change", () => {
  it("emits when auth source changes without matching test evidence", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: authTestConfig,
        files: [fileChange("src/auth/session.ts")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "evidence/missing-test-change",
        severity: "error",
        message: "High-risk area changed without matching test evidence.",
        evidence: expect.arrayContaining([
          { label: "area", value: "auth" },
          { label: "risk_paths", value: "src/auth/**" },
          { label: "required_test_patterns", value: "tests/auth/**" },
          { label: "matching_risk_files", value: "src/auth/session.ts" },
        ]),
        remediation: expect.arrayContaining([
          "Add or update a matching test file. This only proves test-change evidence, not semantic coverage.",
        ]),
      }),
    );
  });

  it("does not emit when auth source and matching auth test both change", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: authTestConfig,
        files: [fileChange("src/auth/session.ts"), fileChange("tests/auth/session.test.ts")],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "evidence/missing-test-change",
    );
  });

  it("emits when auth source changes and a matching test file is removed", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: authTestConfig,
        files: [
          fileChange("src/auth/session.ts"),
          {
            ...fileChange("tests/auth/session.test.ts"),
            status: "removed",
            additions: 0,
            deletions: 12,
          },
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "evidence/missing-test-change",
        severity: "error",
      }),
    );
  });

  it("emits when auth source changes and a test file is renamed away from required tests", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: authTestConfig,
        files: [
          fileChange("src/auth/session.ts"),
          {
            ...fileChange("docs/session-test-notes.md"),
            previousPath: "tests/auth/session.test.ts",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "evidence/missing-test-change",
        severity: "error",
      }),
    );
  });

  it("does not emit when auth source changes and a test file is renamed into required tests", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: authTestConfig,
        files: [
          fileChange("src/auth/session.ts"),
          {
            ...fileChange("tests/auth/session.test.ts"),
            previousPath: "docs/session-test-notes.md",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "evidence/missing-test-change",
    );
  });

  it("does not emit for areas without required tests", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\nhigh_risk_paths:\n  auth:\n    paths:\n      - src/auth/**\n",
        ),
        files: [fileChange("src/auth/session.ts")],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "evidence/missing-test-change",
    );
  });

  it("does not emit for unrelated source changes", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: authTestConfig,
        files: [fileChange("src/profile/view.ts")],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});
