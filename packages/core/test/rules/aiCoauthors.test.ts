import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../../src/index.js";
import { aiCoauthorTool } from "../../src/rules/aiCoauthors.js";
import { createAnalysisInput } from "../helpers.js";

const BASE_CONFIG = ["version: 1", "mode: warn", ""].join("\n");

function commit(sha: string, message: string) {
  return { sha, message };
}

describe("aiCoauthorTool", () => {
  it("recognises the addresses observed in real merged history", () => {
    expect(aiCoauthorTool("Claude Opus 4.8 <noreply@anthropic.com>")).toBe("Claude Code");
    expect(aiCoauthorTool("Cursor Agent <cursoragent@cursor.com>")).toBe("Cursor");
    expect(aiCoauthorTool("Copilot <copilot@github.com>")).toBe("GitHub Copilot");
    expect(aiCoauthorTool("Copilot <175728472+Copilot@users.noreply.github.com>")).toBe(
      "GitHub Copilot",
    );
    expect(
      aiCoauthorTool("Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"),
    ).toBe("Devin");
    expect(aiCoauthorTool("Codex <codex@openai.com>")).toBe("Codex");
  });

  it("does not treat a person at a vendor as a tool", () => {
    // Both addresses appear as co-authors in the scanned corpus and belong to people. Matching
    // on the domain rather than the address would report them as AI.
    expect(aiCoauthorTool("Eric Traut <etraut@openai.com>")).toBeUndefined();
    expect(aiCoauthorTool("M D'Angelo <mdangelo@openai.com>")).toBeUndefined();
  });

  it("does not match an ordinary GitHub no-reply address", () => {
    expect(aiCoauthorTool("Alice <12345+alice@users.noreply.github.com>")).toBeUndefined();
    expect(aiCoauthorTool("Someone <copilot@example.com>")).toBeUndefined();
  });

  it("ignores the display name, which the tool varies between commits", () => {
    expect(aiCoauthorTool("Claude <noreply@anthropic.com>")).toBe("Claude Code");
    expect(aiCoauthorTool("Claude Opus 4.8 (1M context) <noreply@anthropic.com>")).toBe(
      "Claude Code",
    );
    // A person cannot claim to be a tool by writing the name.
    expect(aiCoauthorTool("Claude <someone@example.com>")).toBeUndefined();
  });
});

describe("commit/ai-assistance-disclosed", () => {
  it("records the tool and model without changing the decision", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(BASE_CONFIG),
        commits: [
          commit(
            "1111111111111111111111111111111111111111",
            "Add retry budget\n\nCo-authored-by: Claude Opus 4.8 <noreply@anthropic.com>",
          ),
          commit("2222222222222222222222222222222222222222", "Tidy imports"),
        ],
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "commit/ai-assistance-disclosed",
        severity: "info",
        message: "1 of 2 commit(s) disclose AI assistance: Claude Code.",
        evidence: expect.arrayContaining([
          { label: "tools", value: "Claude Code (Claude Opus 4.8)" },
          { label: "disclosed_commits", value: "1" },
        ]),
      }),
    );
  });

  it("stays silent when every co-author is a person", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(BASE_CONFIG),
        commits: [
          commit(
            "3333333333333333333333333333333333333333",
            "Fix parser\n\nCo-authored-by: Alice <alice@example.com>",
          ),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "commit/ai-assistance-disclosed",
    );
  });

  it("can be switched off, and can be raised for a disclosure policy", async () => {
    const off = await analyze(
      createAnalysisInput({
        config: parseConfig(
          ["version: 1", "mode: warn", "commit_trailers:", "  ai_disclosure: off", ""].join("\n"),
        ),
        commits: [
          commit(
            "4444444444444444444444444444444444444444",
            "x\n\nCo-authored-by: Claude <noreply@anthropic.com>",
          ),
        ],
      }),
    );
    expect(off.findings.map((finding) => finding.ruleId)).not.toContain(
      "commit/ai-assistance-disclosed",
    );

    const raised = await analyze(
      createAnalysisInput({
        config: parseConfig(
          ["version: 1", "mode: warn", "commit_trailers:", "  ai_disclosure: warn", ""].join("\n"),
        ),
        commits: [
          commit(
            "5555555555555555555555555555555555555555",
            "x\n\nCo-authored-by: Claude <noreply@anthropic.com>",
          ),
        ],
      }),
    );
    expect(raised.decision).toBe("warn");
  });

  it("stays inert when the collector could not enumerate commits", async () => {
    const result = await analyze(
      createAnalysisInput({ config: parseConfig(BASE_CONFIG), commits: undefined }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "commit/ai-assistance-disclosed",
    );
  });
});
