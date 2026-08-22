import type { Finding } from "@mergewarden/core";
import { GitHubApiError, parsePullRequestTarget, TargetParseError } from "@mergewarden/github";

export const passCopy = {
  title: "No high-signal boundary changes found.",
  body: "This is not a general code review. MergeWarden checks specific workflow, agent-control, and install-time risks.",
} as const;

export const incompleteCopy = {
  title: "Scan incomplete.",
  body: "GitHub did not provide all evidence required for a deterministic result. Do not treat this result as a pass.",
} as const;

export const installWorkflow = `name: MergeWarden PR Risk Check

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.10.4
        with:
          comment: auto
`;

export type ScanErrorKind = "invalid" | "unavailable" | "rate-limit" | "network";

export const errorCopy: Record<ScanErrorKind, { title: string; body: string }> = {
  invalid: {
    title: "Enter a valid GitHub pull request.",
    body: "Use a full GitHub PR URL or owner/repository#number.",
  },
  unavailable: {
    title: "This pull request is not publicly available.",
    body: "Check that the PR exists and belongs to a public repository.",
  },
  "rate-limit": {
    title: "GitHub API rate limit reached.",
    body: "Anonymous browser requests are limited. Use the CLI with a GitHub token or try again after the limit resets.",
  },
  network: {
    title: "The scan could not reach GitHub.",
    body: "Check your connection and try again. The request may also have timed out.",
  },
};

export function resultFindings(findings: Finding[]): {
  primary: Finding[];
  remaining: Finding[];
} {
  const rank = { error: 0, warn: 1 } as const;
  const actionable = findings
    .filter(
      (finding): finding is Finding & { severity: "error" | "warn" } =>
        finding.severity === "error" || finding.severity === "warn",
    )
    .sort((left, right) => rank[left.severity] - rank[right.severity]);

  return { primary: actionable.slice(0, 3), remaining: actionable.slice(3) };
}

export function reviewHeading(count: number): string {
  return `${count} ${count === 1 ? "change" : "changes"} deserve${count === 1 ? "s" : ""} review`;
}

export function buildInstallUrl(owner: string, repo: string, branch: string): string {
  const path = [owner, repo, "new", branch].map(encodeURIComponent).join("/");
  return `https://github.com/${path}?filename=${encodeURIComponent(".github/workflows/mergewarden.yml")}`;
}

export function targetHash(value: string): string {
  return `#pr=${encodeURIComponent(value)}`;
}

export function parseTargetHash(hash: string): string | null {
  const match = /^#pr=(.+)$/.exec(hash);
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function classifyScanError(error: unknown): ScanErrorKind {
  if (error instanceof TargetParseError) {
    return "invalid";
  }
  if (error instanceof GitHubApiError && error.status === 404) {
    return "unavailable";
  }
  if (error instanceof GitHubApiError && (error.status === 403 || error.status === 429)) {
    return "rate-limit";
  }
  return "network";
}

export function cliCommand(value: string): string {
  const target = parsePullRequestTarget(value.trim());
  return `GH_TOKEN=... npx --yes mergewarden@0.10.4 scan https://github.com/${target.owner}/${target.repo}/pull/${target.number}`;
}
