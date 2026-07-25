import { describe, expect, it } from "vitest";

import { analyze, parseCommitTrailers, parseConfig } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

const AGENT_CONFIG = [
  "version: 1",
  "mode: warn",
  "agent_detection:",
  "  branch_patterns:",
  '    - "codex/**"',
  "commit_trailers:",
  "  required:",
  "    - any_of:",
  "        - Assisted-by",
  "        - Generated-by",
  "      applies_to: agent",
  "      severity: warn",
  "",
].join("\n");

const ALL_CONFIG = [
  "version: 1",
  "mode: warn",
  "commit_trailers:",
  "  required:",
  "    - any_of:",
  "        - Signed-off-by",
  "      applies_to: all",
  "      severity: error",
  "",
].join("\n");

const FORBIDDEN_CONFIG = [
  "version: 1",
  "mode: warn",
  "commit_trailers:",
  "  forbidden:",
  "    - name: Assisted-by",
  "      severity: error",
  "",
].join("\n");

const FORBIDDEN_VALUE_CONFIG = [
  "version: 1",
  "mode: warn",
  "commit_trailers:",
  "  forbidden:",
  "    - name: Co-authored-by",
  "      value_patterns:",
  '        - "*claude*"',
  '        - "*copilot*"',
  "      severity: error",
  "",
].join("\n");

function commit(sha: string, message: string) {
  return { sha, message };
}

describe("parseCommitTrailers", () => {
  it("returns nothing for a subject-only message", () => {
    expect(parseCommitTrailers("Fix the parser")).toEqual([]);
  });

  it("does not treat an ordinary closing paragraph as trailers", () => {
    const message = ["Fix the parser", "", "This rewrites the loop so it terminates."].join("\n");

    expect(parseCommitTrailers(message)).toEqual([]);
  });

  it("parses the trailing trailer block and preserves declared casing", () => {
    const message = [
      "Fix the parser",
      "",
      "The loop never terminated on empty input.",
      "",
      "Assisted-by: Claude Code",
      "Signed-off-by: Ada Lovelace <ada@example.com>",
    ].join("\n");

    expect(parseCommitTrailers(message)).toEqual([
      { name: "Assisted-by", value: "Claude Code" },
      { name: "Signed-off-by", value: "Ada Lovelace <ada@example.com>" },
    ]);
  });

  it("folds indented continuation lines into the preceding trailer", () => {
    const message = ["Subject", "", "Assisted-by: Some Tool", "    with a long name"].join("\n");

    expect(parseCommitTrailers(message)).toEqual([
      { name: "Assisted-by", value: "Some Tool with a long name" },
    ]);
  });

  it("rejects the whole block when any line is not a trailer", () => {
    const message = ["Subject", "", "Assisted-by: Claude Code", "and some prose"].join("\n");

    expect(parseCommitTrailers(message)).toEqual([]);
  });
});

describe("commit/trailer-missing", () => {
  it("emits for an agent pull request whose commit carries no disclosure trailer", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(AGENT_CONFIG),
        commits: [commit("1111111111111111111111111111111111111111", "Add retry budget")],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "commit/trailer-missing",
        severity: "warn",
        message: "Commit 111111111111 does not carry a Assisted-by or Generated-by trailer.",
        evidence: expect.arrayContaining([
          { label: "commit", value: "111111111111" },
          { label: "expected_trailer", value: "Assisted-by or Generated-by" },
          { label: "present_trailers", value: "none" },
        ]),
      }),
    );
  });

  it("accepts any listed trailer, matched case-insensitively", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(AGENT_CONFIG),
        commits: [
          commit(
            "2222222222222222222222222222222222222222",
            ["Add retry budget", "", "generated-by: Codex"].join("\n"),
          ),
        ],
      }),
    );

    expect(
      result.findings.filter((finding) => finding.ruleId === "commit/trailer-missing"),
    ).toEqual([]);
  });

  it("stays inert for a non-agent pull request when applies_to is agent", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(AGENT_CONFIG),
        pr: { branchName: "feature/manual-change" },
        commits: [commit("3333333333333333333333333333333333333333", "Add retry budget")],
      }),
    );

    expect(result.findings).toEqual([]);
  });

  it("applies to every pull request when applies_to is all", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(ALL_CONFIG),
        pr: { branchName: "feature/manual-change" },
        commits: [commit("4444444444444444444444444444444444444444", "Add retry budget")],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "commit/trailer-missing",
        severity: "error",
      }),
    );
  });

  it("stays inert when the collector could not enumerate commits", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(ALL_CONFIG),
        pr: { branchName: "feature/manual-change" },
      }),
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("commit/trailer-forbidden", () => {
  it("emits when a forbidden trailer is present", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(FORBIDDEN_CONFIG),
        commits: [
          commit(
            "5555555555555555555555555555555555555555",
            ["Add retry budget", "", "Assisted-by: Claude Code"].join("\n"),
          ),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "commit/trailer-forbidden",
        severity: "error",
        message:
          "Commit 555555555555 carries a Assisted-by trailer this repository does not accept.",
        evidence: expect.arrayContaining([
          { label: "trailer", value: "Assisted-by" },
          { label: "value", value: "Claude Code" },
        ]),
      }),
    );
  });

  it("only flags values matching the configured patterns", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(FORBIDDEN_VALUE_CONFIG),
        commits: [
          commit(
            "6666666666666666666666666666666666666666",
            [
              "Add retry budget",
              "",
              "Co-authored-by: Ada Lovelace <ada@example.com>",
              "Co-authored-by: Claude <noreply@anthropic.com>",
            ].join("\n"),
          ),
        ],
      }),
    );

    const forbidden = result.findings.filter(
      (finding) => finding.ruleId === "commit/trailer-forbidden",
    );

    expect(forbidden).toHaveLength(1);
    expect(forbidden[0]?.evidence).toEqual(
      expect.arrayContaining([
        { label: "value", value: "Claude <noreply@anthropic.com>" },
        { label: "matched_pattern", value: "*claude*" },
      ]),
    );
  });

  it("blocks in block mode", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(FORBIDDEN_CONFIG.replace("mode: warn", "mode: block")),
        commits: [
          commit(
            "7777777777777777777777777777777777777777",
            ["Add retry budget", "", "Assisted-by: Claude Code"].join("\n"),
          ),
        ],
      }),
    );

    expect(result.decision).toBe("block");
  });
});
