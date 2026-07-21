import { describe, expect, it } from "vitest";

import { analyze, parseConfig, renderMarkdownReport } from "../src/index.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

async function controlPlaneFindingId(): Promise<string> {
  const result = await analyze(
    createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    }),
  );
  const findingId = result.findings.find(
    (finding) => finding.ruleId === "agent-control-plane/drift",
  )?.findingId;

  if (!findingId) {
    throw new Error("Expected an agent control-plane finding");
  }

  return findingId;
}

function configWithWaiver(findingId: string, expiresAt: string) {
  return parseConfig(`
version: 1
mode: block
waivers:
  - finding_id: ${findingId}
    reason: Approved temporary exception
    expires_at: ${expiresAt}
`);
}

describe("exact finding-ID waivers", () => {
  it("partitions an active base-policy waiver out of the decision", async () => {
    const findingId = await controlPlaneFindingId();
    const input = createAnalysisInput({
      config: configWithWaiver(findingId, "2026-09-30T00:00:00Z"),
      files: [fileChange("AGENTS.md")],
    });
    input.configSource = "base-branch";

    const result = await analyze(input);

    expect(result.decision).toBe("pass");
    expect(result.status).toBe("passed");
    expect(result.findings).toEqual([]);
    expect(result.waivedFindings).toHaveLength(1);
    expect(result.waivedFindings[0]).toMatchObject({
      ruleId: "agent-control-plane/drift",
      severity: "error",
      findingId,
      disposition: "waived",
      waiver: {
        findingId,
        reason: "Approved temporary exception",
        expiresAt: "2026-09-30T00:00:00Z",
      },
    });
    expect(result.summary.waivedCount).toBe(1);
    expect(renderMarkdownReport(result)).toContain("## Waived Findings");
  });

  it("reactivates the original finding and reports an expired waiver", async () => {
    const findingId = await controlPlaneFindingId();
    const input = createAnalysisInput({
      config: configWithWaiver(findingId, "2026-06-12T00:00:00Z"),
      files: [fileChange("AGENTS.md")],
    });
    input.configSource = "base-branch";

    const result = await analyze(input);

    expect(result.decision).toBe("block");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "agent-control-plane/drift",
          severity: "error",
        }),
        expect.objectContaining({ ruleId: "policy/waiver-expired", severity: "warn" }),
      ]),
    );
    expect(result.waivedFindings).toEqual([]);
  });

  it("does not apply waivers from a local or PR-controlled source", async () => {
    const findingId = await controlPlaneFindingId();
    const result = await analyze(
      createAnalysisInput({
        config: configWithWaiver(findingId, "2026-09-30T00:00:00Z"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.waivedFindings).toEqual([]);
  });

  it("keeps an active unknown finding ID inert", async () => {
    const input = createAnalysisInput({
      config: configWithWaiver("agf_0000000000000000", "2026-09-30T00:00:00Z"),
    });
    input.configSource = "base-branch";

    const result = await analyze(input);

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
    expect(result.waivedFindings).toEqual([]);
    expect(result.summary.waivedCount).toBe(0);
  });

  it("refuses to waive analysis-integrity findings", async () => {
    const baseInput = createAnalysisInput();
    baseInput.analysis = {
      complete: false,
      expectedFileCount: 42,
      analyzedFileCount: 41,
      contentFileCount: 0,
      runtimeRef: "mergewarden@v0.3.0",
      gaps: [
        {
          ruleId: "analysis/file-list-incomplete",
          message: "Expected 42 files but collected 41.",
          evidence: [
            { label: "expected_files", value: "42" },
            { label: "collected_files", value: "41" },
          ],
        },
      ],
    };
    const initial = await analyze(baseInput);
    const findingId = initial.findings[0]?.findingId;
    if (!findingId) {
      throw new Error("Expected analysis-integrity finding");
    }

    const input = {
      ...baseInput,
      config: configWithWaiver(findingId, "2026-09-30T00:00:00Z"),
      configSource: "base-branch" as const,
    };
    const result = await analyze(input);

    expect(result.status).toBe("incomplete");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "analysis/file-list-incomplete", severity: "error" }),
        expect.objectContaining({ ruleId: "policy/waiver-forbidden", severity: "error" }),
      ]),
    );
    expect(result.waivedFindings).toEqual([]);
  });
});
