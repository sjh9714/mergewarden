import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../../src/index.js";
import { createAnalysisInput, fileChange } from "../helpers.js";

describe("agent-control-plane/drift", () => {
  it.each([
    "AGENTS.md",
    "services/api/AGENTS.md",
    "CLAUDE.md",
    "services/api/CLAUDE.md",
    ".cursor/rules.md",
    ".github/copilot-instructions.md",
    ".mcp.json",
    "claude_desktop_config.json",
    ".codex/config.toml",
  ])("emits for %s", async (path) => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange(path)],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "agent-control-plane/drift",
        severity: "error",
        path,
        message: "This file can change how AI agents behave in future PRs.",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: path },
          expect.objectContaining({ label: "matched_patterns" }),
        ]),
      }),
    );
  });

  it("does not emit for unrelated files", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange("src/auth/session.ts")],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("emits for renamed files when the previous path was a control-plane file", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          {
            ...fileChange("docs/agent-guide.md"),
            previousPath: "AGENTS.md",
            status: "renamed",
          },
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "agent-control-plane/drift",
        severity: "error",
        path: "docs/agent-guide.md",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "docs/agent-guide.md" },
          { label: "previous_path", value: "AGENTS.md" },
          expect.objectContaining({
            label: "matched_patterns",
            value: expect.stringContaining("AGENTS.md"),
          }),
        ]),
      }),
    );
  });
});
