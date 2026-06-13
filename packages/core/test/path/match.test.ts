import { describe, expect, it } from "vitest";

import { findMatchingPatterns, matchesAny, normalizePath } from "../../src/index.js";

describe("path matching helpers", () => {
  it("normalizes Windows separators and removes leading current-directory markers", () => {
    expect(normalizePath(".\\src\\auth\\session.ts")).toBe("src/auth/session.ts");
    expect(normalizePath("./src/auth/session.ts")).toBe("src/auth/session.ts");
  });

  it("matches application paths with glob patterns", () => {
    expect(matchesAny("src/auth/session.ts", ["src/auth/**"])).toBe(true);
  });

  it("matches nested agent instruction files", () => {
    expect(matchesAny("packages/web/AGENTS.md", ["**/AGENTS.md"])).toBe(true);
    expect(matchesAny("packages/web/CLAUDE.md", ["**/CLAUDE.md"])).toBe(true);
  });

  it("matches dotfile workflow paths", () => {
    expect(matchesAny(".github/workflows/ci.yml", [".github/workflows/*.yml"])).toBe(true);
  });

  it("handles Windows separators before matching", () => {
    expect(matchesAny("src\\auth\\session.ts", ["src/auth/**"])).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(matchesAny("src/payments/webhook.ts", ["src/auth/**"])).toBe(false);
  });

  it("returns every matching pattern for a path", () => {
    expect(
      findMatchingPatterns("src/auth/session.ts", ["src/**", "src/auth/**", "tests/**"]),
    ).toEqual(["src/**", "src/auth/**"]);
  });
});
