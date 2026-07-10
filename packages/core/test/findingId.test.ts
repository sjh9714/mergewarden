import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../src/index.js";
import { attachFindingIds, createFindingId } from "../src/finding/id.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("finding IDs", () => {
  const rawWorkflowFinding = {
    ruleId: "workflow/permission-escalation",
    severity: "error" as const,
    title: "Workflow permissions escalated",
    message: "Workflow permissions changed from read to write.",
    path: ".github/workflows/release.yml",
    evidence: [
      { label: "permission", value: "contents" },
      { label: "before", value: "read" },
      { label: "after", value: "write" },
    ],
    remediation: ["Review the workflow before merging."],
    tags: ["workflow"],
    confidence: "high" as const,
  };

  it("assigns stable finding IDs to analyzed findings", async () => {
    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    });

    const first = await analyze(input);
    const second = await analyze(input);

    expect(first.findings[0]?.findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(first.findings[0]?.findingId).toBe(second.findings[0]?.findingId);
  });

  it("attaches re-derivable evidence snapshots next to finding IDs", () => {
    const [finding] = attachFindingIds([rawWorkflowFinding]);

    expect(finding?.findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(finding?.disposition).toBe("active");
    expect(finding?.evidenceSnapshot).toEqual({
      ruleId: "workflow/permission-escalation",
      severity: "error",
      path: ".github/workflows/release.yml",
      evidence: [
        { label: "after", value: "write" },
        { label: "before", value: "read" },
        { label: "permission", value: "contents" },
      ],
    });
  });

  it("keeps evidence snapshots stable across evidence ordering and analysis metadata", async () => {
    const [first] = attachFindingIds([rawWorkflowFinding]);
    const [reordered] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        evidence: [...rawWorkflowFinding.evidence].reverse(),
      },
    ]);

    expect(first?.evidenceSnapshot).toEqual(reordered?.evidenceSnapshot);

    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    });
    const laterInput = {
      ...input,
      now: "2026-06-14T00:00:00.000Z",
      version: "9.9.9",
    };

    const initial = await analyze(input);
    const later = await analyze(laterInput);

    expect(initial.findings[0]?.evidenceSnapshot).toEqual(later.findings[0]?.evidenceSnapshot);
  });

  it("changes evidence snapshots when stable finding inputs change", () => {
    const [base] = attachFindingIds([rawWorkflowFinding]);
    const [pathChanged] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        path: ".github/workflows/deploy.yml",
      },
    ]);
    const [evidenceChanged] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        evidence: [
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "admin" },
        ],
      },
    ]);

    expect(base?.evidenceSnapshot).not.toEqual(pathChanged?.evidenceSnapshot);
    expect(base?.evidenceSnapshot).not.toEqual(evidenceChanged?.evidenceSnapshot);
  });

  it("keeps mutable display and report metadata out of evidence snapshots", () => {
    const [finding] = attachFindingIds([rawWorkflowFinding]);

    expect(finding?.evidenceSnapshot).not.toHaveProperty("title");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("message");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("remediation");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("tags");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("confidence");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("riskScore");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("version");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("analyzedAt");
  });

  it("changes finding IDs when stable finding evidence changes", () => {
    expect(createFindingId(rawWorkflowFinding)).not.toBe(
      createFindingId({
        ...rawWorkflowFinding,
        path: ".github/workflows/deploy.yml",
      }),
    );
    expect(createFindingId(rawWorkflowFinding)).not.toBe(
      createFindingId({
        ...rawWorkflowFinding,
        evidence: [
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "admin" },
        ],
      }),
    );
  });

  it("keeps finding IDs stable across evidence ordering and analysis metadata", async () => {
    expect(createFindingId(rawWorkflowFinding)).toBe(
      createFindingId({
        ...rawWorkflowFinding,
        evidence: [...rawWorkflowFinding.evidence].reverse(),
      }),
    );

    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    });
    const laterInput = {
      ...input,
      now: "2026-06-14T00:00:00.000Z",
      version: "9.9.9",
    };

    const first = await analyze(input);
    const later = await analyze(laterInput);

    expect(first.findings[0]?.findingId).toBe(later.findings[0]?.findingId);
  });

  it("keeps finding IDs stable when only policy severity changes", () => {
    expect(createFindingId(rawWorkflowFinding)).toBe(
      createFindingId({
        ...rawWorkflowFinding,
        severity: "warn",
      }),
    );
  });

  it("normalizes and bounds dynamic finding fields before JSON exposure", () => {
    const longEvidence = `unsafe\u0000\u0085\u202e\u2066\r\n${"x".repeat(3_000)}`;
    const [finding] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        path: "src/unsafe\u0007.ts",
        message: longEvidence,
        evidence: [{ label: "payload\u0001", value: longEvidence }],
        remediation: [longEvidence],
      },
    ]);

    expect(finding).toBeDefined();
    expect(finding?.path).toBe("src/unsafe.ts");
    expect(
      [...(finding?.message ?? "")].every((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint === 10 || (codePoint > 31 && codePoint !== 127);
      }),
    ).toBe(true);
    expect(finding?.message).toContain("\n");
    expect(finding?.message).not.toContain("\u0085");
    expect(finding?.message).not.toContain("\u202e");
    expect(finding?.message).not.toContain("\u2066");
    expect(finding?.message).toContain("[sha256:");
    expect(finding?.message.length).toBeLessThan(2_150);
    expect(finding?.evidence[0]?.label).toBe("payload");
    expect(JSON.stringify(finding)).not.toContain("\\u0000");
  });

  it("uses a byte-aware preview without splitting Unicode code points", () => {
    const [finding] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        evidence: [{ label: "unicode", value: "한😀".repeat(1_000) }],
      },
    ]);
    const value = finding?.evidence[0]?.value;
    if (!value) {
      throw new Error("Expected bounded Unicode evidence");
    }

    const [preview] = value.split("…");
    expect(Buffer.byteLength(preview ?? "", "utf8")).toBeLessThanOrEqual(2_048);
    expect(value).toContain("[sha256:");
    expect(value).not.toContain("�");
  });
});
