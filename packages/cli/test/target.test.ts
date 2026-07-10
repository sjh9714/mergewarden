import { describe, expect, it } from "vitest";

import { parsePullRequestTarget } from "../src/target.js";

describe("pull request target parsing", () => {
  it.each([
    ["openai/codex#123", { owner: "openai", repo: "codex", number: 123 }],
    ["https://github.com/openai/codex/pull/456", { owner: "openai", repo: "codex", number: 456 }],
    [
      "https://www.github.com/openai/codex.git/pull/7/",
      { owner: "openai", repo: "codex", number: 7 },
    ],
  ])("parses %s", (value, expected) => {
    expect(parsePullRequestTarget(value)).toEqual(expected);
  });

  it.each([
    "openai/codex",
    "openai/codex#0",
    "https://github.example/openai/codex/pull/1",
    "http://github.com/openai/codex/pull/1",
    "https://github.com/openai/codex/issues/1",
    "https://token@github.com/openai/codex/pull/1",
    "https://github.com/openai/codex/pull/1?diff=split",
  ])("rejects invalid or ambiguous target %s", (value) => {
    expect(() => parsePullRequestTarget(value)).toThrow();
  });
});
