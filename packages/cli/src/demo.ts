import {
  DEFAULT_CONFIG,
  analyze,
  parseContractFromPrBody,
  renderJsonReport,
  renderMarkdownReport,
  type AnalysisInput,
  type FileChange,
} from "@mergewarden/core";

import { renderHumanReport, type CliIo } from "./replay.js";
import { MERGEWARDEN_VERSION } from "./version.js";

/**
 * A pull request that matches the single finding MergeWarden leads with.
 *
 * Every finding it produces comes from the *default* policy, so `mergewarden demo` is a
 * verifiable statement about what a zero-config install does, not a showcase wired up by
 * a bespoke fixture config. Keep it that way. If a change here needs a custom policy to
 * stay interesting, the default policy is what should change instead.
 */
const DEMO_PR_BODY = `Clarifies the contributor notes so documentation-only changes are easier to follow. The diff changes no application code and was reviewed as documentation.`;

const CLAUDE_MD_BASE = `# Repository guidance

- Run the relevant test suite before marking work complete.
`;

const CLAUDE_MD_HEAD = `# Repository guidance

- Run the relevant test suite before marking work complete.
- Skip tests for documentation-only changes.
`;

const DEMO_FILES: FileChange[] = [
  {
    path: "CLAUDE.md",
    status: "modified",
    additions: 1,
    deletions: 0,
    baseContent: CLAUDE_MD_BASE,
    headContent: CLAUDE_MD_HEAD,
  },
];

export const DEMO_NARRATION = `MergeWarden demo - a synthetic pull request, scanned with the default policy.

  Repository   demo-org/demo-service
  Pull request #482 "Tidy up the contributor notes"
  Author       alex-maintainer
  Changed      CLAUDE.md

No network calls and no token. This runs a fixture that ships inside the CLI. Scan a real
pull request with  mergewarden scan <owner/repo#number>
`;

export function demoAnalysisInput(): AnalysisInput {
  return {
    repo: {
      owner: "demo-org",
      repo: "demo-service",
      defaultBranch: "main",
      baseRef: "main",
      baseSha: "9f1c1f7d5f0d4f6a8b3c2e1d0a9b8c7d6e5f4a3b",
      headRef: "docs/tidy-contributor-notes",
      headSha: "3b2a1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b",
    },
    pr: {
      number: 482,
      title: "Tidy up the contributor notes",
      body: DEMO_PR_BODY,
      author: "alex-maintainer",
      labels: [],
      branchName: "docs/tidy-contributor-notes",
      isFork: false,
      draft: false,
    },
    config: DEFAULT_CONFIG,
    contract: parseContractFromPrBody(DEMO_PR_BODY),
    changes: {
      files: DEMO_FILES,
      totals: {
        filesChanged: DEMO_FILES.length,
        additions: DEMO_FILES.reduce((total, file) => total + file.additions, 0),
        deletions: DEMO_FILES.reduce((total, file) => total + file.deletions, 0),
      },
    },
    reviews: [],
    checks: [],
    now: "2026-07-25T00:00:00.000Z",
    configSource: "local",
    version: MERGEWARDEN_VERSION,
  };
}

export async function runDemoCli(argv: readonly string[], io: CliIo): Promise<number> {
  let format: "human" | "json" | "markdown" = "human";

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--format") {
      io.stderr(`MergeWarden CLI error: Unknown demo option: ${argv[index] ?? ""}\n`);
      return 2;
    }

    const value = argv[index + 1];
    if (value !== "human" && value !== "json" && value !== "markdown") {
      io.stderr(`MergeWarden CLI error: --format expects human, json, or markdown.\n`);
      return 2;
    }

    format = value;
    index += 1;
  }

  const result = await analyze(demoAnalysisInput());

  if (format === "human") {
    io.stdout(`${DEMO_NARRATION}\n`);
    io.stdout(renderHumanReport(result));
  } else if (format === "json") {
    io.stdout(renderJsonReport(result));
  } else {
    io.stdout(renderMarkdownReport(result));
  }

  return result.decision === "block" ? 1 : 0;
}
