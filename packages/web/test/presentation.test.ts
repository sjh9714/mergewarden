import type { Finding } from "@mergewarden/core";
import { describe, expect, it } from "vitest";

import {
  buildInstallUrl,
  classifyTarget,
  classifyScanError,
  cliCommand,
  errorCopy,
  incompleteCopy,
  installWorkflow,
  parseShareHash,
  parseTargetHash,
  passCopy,
  queueCopy,
  repositoryHash,
  resultFindings,
  reviewHeading,
  targetHash,
  triageCliCommand,
} from "../src/product.js";
import { GitHubApiError, TargetParseError } from "@mergewarden/github";

function finding(severity: Finding["severity"], title: string): Finding {
  return {
    ruleId: `test/${title}`,
    severity,
    title,
    message: `${title} message`,
    evidence: [],
    remediation: [`Fix ${title}`, `Ignore ${title}`],
    tags: [],
    confidence: "high",
    findingId: title,
    evidenceSnapshot: { ruleId: `test/${title}`, severity, evidence: [] },
    disposition: "active",
  };
}

describe("resultFindings", () => {
  it("orders errors before warnings, excludes info, and folds after three", () => {
    const result = resultFindings([
      finding("warn", "warn one"),
      finding("info", "info one"),
      finding("error", "error one"),
      finding("warn", "warn two"),
      finding("error", "error two"),
    ]);

    expect(result.primary.map((item) => item.title)).toEqual([
      "error one",
      "error two",
      "warn one",
    ]);
    expect(result.remaining.map((item) => item.title)).toEqual(["warn two"]);
  });

  it("uses correct singular and plural result headings", () => {
    expect(reviewHeading(1)).toBe("1 change deserves review");
    expect(reviewHeading(2)).toBe("2 changes deserve review");
  });
});

describe("installation", () => {
  it("encodes repository and branch components in the GitHub new-file URL", () => {
    expect(buildInstallUrl("owner name", "repo#name", "feature/a b")).toBe(
      "https://github.com/owner%20name/repo%23name/new/feature%2Fa%20b?filename=.github%2Fworkflows%2Fmergewarden.yml",
    );
  });

  it("pins the stable action and enables automatic comments", () => {
    expect(installWorkflow).toContain("sjh9714/mergewarden@v0.10.4");
    expect(installWorkflow).toContain("comment: auto");
  });

  it("renders the authenticated CLI fallback with a full PR URL", () => {
    expect(cliCommand("owner/repo#123")).toBe(
      "GH_TOKEN=... npx --yes mergewarden@0.10.4 scan https://github.com/owner/repo/pull/123",
    );
    expect(triageCliCommand("owner/repo")).toBe(
      "GH_TOKEN=... npx --yes mergewarden@0.10.4 triage owner/repo",
    );
  });
});

describe("share hashes", () => {
  it("round trips a compact pull request target", () => {
    expect(parseTargetHash(targetHash("owner/repo#42"))).toBe("owner/repo#42");
    expect(parseTargetHash("#anything-else")).toBeNull();
  });

  it("round trips repository targets without changing the PR hash contract", () => {
    expect(parseShareHash(repositoryHash("owner/repo"))).toEqual({
      kind: "repository",
      value: "owner/repo",
    });
    expect(parseShareHash(targetHash("owner/repo#42"))).toEqual({
      kind: "pull-request",
      value: "owner/repo#42",
    });
  });
});

describe("target classification", () => {
  it.each([
    ["owner/repo", "repository"],
    ["https://github.com/owner/repo", "repository"],
    ["owner/repo#42", "pull-request"],
    ["https://github.com/owner/repo/pull/42", "pull-request"],
  ] as const)("classifies %s as %s", (value, expected) => {
    expect(classifyTarget(value)).toBe(expected);
  });

  it("rejects a target that is neither a repository nor a pull request", () => {
    expect(() => classifyTarget("not a GitHub target")).toThrow();
  });
});

describe("review queue copy", () => {
  it("states the maintainer job and the four facts directly", () => {
    expect(queueCopy.title).toBe("See which pull requests need context before code review.");
    expect(queueCopy.body).toBe(
      "Paste a public GitHub repository. MergeWarden surfaces missing issue links, thin descriptions, skipped templates, and oversized changes. No login. No AI.",
    );
  });
});

describe("scan error classification", () => {
  it("distinguishes invalid, unavailable, rate-limit, and network failures", () => {
    expect(classifyScanError(new TargetParseError("bad"))).toBe("invalid");
    expect(classifyScanError(new GitHubApiError("missing", { status: 404 }))).toBe("unavailable");
    expect(classifyScanError(new GitHubApiError("limited", { status: 429 }))).toBe("rate-limit");
    expect(classifyScanError(new GitHubApiError("limited", { status: 403 }))).toBe("rate-limit");
    expect(classifyScanError(new Error("offline"))).toBe("network");
  });

  it("keeps the pass, incomplete, and rate-limit language explicit", () => {
    expect(passCopy.title).toBe("No high-signal boundary changes found.");
    expect(incompleteCopy.title).toBe("Scan incomplete.");
    expect(incompleteCopy.body).toContain("Do not treat this result as a pass.");
    expect(errorCopy["rate-limit"].title).toBe("GitHub API rate limit reached.");
  });
});
