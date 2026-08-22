import { describe, expect, it } from "vitest";

import { parseRepositoryTarget } from "../src/index.js";

describe("repository target parsing", () => {
  it.each([
    ["openai/codex", { owner: "openai", repo: "codex" }],
    ["https://github.com/openai/codex", { owner: "openai", repo: "codex" }],
    ["https://www.github.com/openai/codex.git/", { owner: "openai", repo: "codex" }],
  ])("parses %s", (value, expected) => {
    expect(parseRepositoryTarget(value)).toEqual(expected);
  });

  it.each([
    "openai/codex#12",
    "openai/codex/extra",
    "openai//codex",
    "https://github.example/openai/codex",
    "http://github.com/openai/codex",
    "https://github.com/openai/codex/pull/1",
    "https://token@github.com/openai/codex",
    "https://github.com/openai/codex?tab=pulls",
    "https://github.com/openai/codex#readme",
  ])("rejects invalid or ambiguous target %s", (value) => {
    expect(() => parseRepositoryTarget(value)).toThrow();
  });
});
