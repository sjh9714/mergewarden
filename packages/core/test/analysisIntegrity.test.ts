import { describe, expect, it } from "vitest";

import { analyze, parseConfig, renderMarkdownReport } from "../src/index.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("analysis integrity", () => {
  it("fails closed and suppresses partial policy analysis for an incomplete file list", async () => {
    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: observe\n"),
      files: [fileChange("AGENTS.md")],
    });
    input.analysis = {
      complete: false,
      expectedFileCount: 3_001,
      analyzedFileCount: 3_000,
      contentFileCount: 0,
      runtimeRef: "mergewarden@v0.3.0",
      gaps: [
        {
          ruleId: "analysis/file-list-incomplete",
          message: "GitHub reported 3,001 changed files, but only 3,000 were available.",
          evidence: [
            { label: "expected_files", value: "3001" },
            { label: "collected_files", value: "3000" },
          ],
        },
      ],
    };

    const result = await analyze(input);

    expect(result.decision).toBe("block");
    expect(result.status).toBe("incomplete");
    expect(result.metadata.analysisComplete).toBe(false);
    expect(result.metadata.expectedFileCount).toBe(3_001);
    expect(result.metadata.analyzedFileCount).toBe(3_000);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: "analysis/file-list-incomplete",
      severity: "error",
    });
  });

  it("synthesizes a fail-closed file-list gap when collector counts disagree", async () => {
    const input = createAnalysisInput({ files: [fileChange("AGENTS.md")] });
    input.analysis = {
      complete: true,
      expectedFileCount: 2,
      analyzedFileCount: 1,
      contentFileCount: 0,
      runtimeRef: "mergewarden@v0.3.0",
    };

    const result = await analyze(input);

    expect(result.status).toBe("incomplete");
    expect(result.decision).toBe("block");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: "analysis/file-list-incomplete",
      severity: "error",
    });
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "agent-control-plane/drift",
    );
  });

  it("caps public results at 250 findings and records the omitted count", async () => {
    const files = Array.from({ length: 260 }, (_, index) => fileChange(`src/outside-${index}.ts`));
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: { version: 1, allowed_paths: ["allowed/**"] },
        },
        files,
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.status).toBe("incomplete");
    expect(result.findings).toHaveLength(250);
    expect(result.findings.at(-1)).toMatchObject({
      ruleId: "analysis/finding-limit-exceeded",
      severity: "error",
    });
    expect(result.summary.errorCount).toBe(261);
    expect(result.metadata.totalFindingCount).toBe(260);
    expect(result.metadata.omittedFindingCount).toBe(11);
  });

  it("applies a surface finding cap without changing the analysis result", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: { version: 1, allowed_paths: ["allowed/**"] },
        },
        files: [fileChange("src/one.ts"), fileChange("src/two.ts")],
      }),
    );

    const report = renderMarkdownReport(result, {
      maxFindings: 1,
      fullReportPath: "mergewarden-report.md",
    });

    expect(report).toContain("1 finding omitted from this surface");
    expect(report).toContain("Full report: mergewarden-report.md");
    expect(result.findings).toHaveLength(2);
  });
});
