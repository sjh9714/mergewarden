import type { Finding } from "@mergewarden/core";
import { describe, expect, it } from "vitest";

import {
  buildInstallUrl,
  classifyScanError,
  cliCommand,
  errorCopy,
  incompleteCopy,
  installWorkflow,
  parseTargetHash,
  passCopy,
  resultFindings,
  reviewHeading,
  targetHash,
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
  });
});

describe("share hashes", () => {
  it("round trips a compact pull request target", () => {
    expect(parseTargetHash(targetHash("owner/repo#42"))).toBe("owner/repo#42");
    expect(parseTargetHash("#anything-else")).toBeNull();
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
