import { analyze, type AnalysisResult } from "@mergewarden/core";
import { loadGitHubAnalysis, type LoadGitHubAnalysisOptions } from "@mergewarden/github";

import { NativeGitHubApi } from "./githubApi.js";
import { MERGEWARDEN_VERSION } from "./version.js";

/**
 * `mergewarden triage <owner/repo>` reads the open pull requests of a repository and reports,
 * for each, the facts a maintainer normally checks by hand before spending review time.
 *
 * It changes nothing. Nothing is closed, labelled, commented on, or ranked by a quality score —
 * the output is a read of what is there, and every line names the rule that produced it so a
 * maintainer can disagree with it.
 */

export interface TriageIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

const REPO = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class TriageUsageError extends Error {}

export interface TriageOptions {
  owner: string;
  repo: string;
  limit: number;
  format: "human" | "json";
}

export function parseTriageOptions(args: string[]): TriageOptions {
  const positional: string[] = [];
  let limit = DEFAULT_LIMIT;
  let format: TriageOptions["format"] = "human";

  // Single pass, so that an option's value is never mistaken for the repository argument.
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? "";

    if (arg === "--limit") {
      const value = Number(args[++index]);

      if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
        throw new TriageUsageError(`--limit expects an integer from 1 to ${MAX_LIMIT}.`);
      }

      limit = value;
      continue;
    }

    if (arg === "--format") {
      const value = args[++index];

      if (value !== "human" && value !== "json") {
        throw new TriageUsageError("--format expects human or json.");
      }

      format = value;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new TriageUsageError(`Unknown triage option: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length !== 1) {
    throw new TriageUsageError("Usage: mergewarden triage <owner/repository> [options]");
  }

  const match = REPO.exec(positional[0] ?? "");

  if (!match) {
    throw new TriageUsageError(`Expected owner/repository, received: ${positional[0] ?? ""}`);
  }

  return { owner: match[1] ?? "", repo: match[2] ?? "", limit, format };
}

interface OpenPullRequest {
  number: number;
  title: string;
  headRef: string;
}

async function listOpenPullRequests(
  owner: string,
  repo: string,
  limit: number,
  token: string | undefined,
): Promise<OpenPullRequest[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
  url.searchParams.set("state", "open");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", String(Math.min(limit, MAX_LIMIT)));

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": `mergewarden-cli/${MERGEWARDEN_VERSION}`,
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Could not list pull requests for ${owner}/${repo}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    number: number;
    title: string;
    draft?: boolean;
    head?: { ref?: string };
  }[];

  return payload.slice(0, limit).map((pull) => ({
    number: pull.number,
    title: pull.title,
    headRef: pull.head?.ref ?? "",
  }));
}

/** Short labels, so a row stays readable when a pull request trips several rules. */
const LABELS: Record<string, string> = {
  "triage/no-linked-issue": "no linked issue",
  "triage/empty-description": "no description",
  "triage/template-unused": "template unused",
  "triage/oversized-change": "oversized",
  "triage/unverified-author": "first contribution",
  "contract/out-of-scope": "outside declared scope",
  "contract/blocked-path": "blocked path",
  "agent-control-plane/drift": "agent instructions changed",
  "evidence/missing-test-change": "no test change",
  "workflow/permission-escalation": "workflow permissions",
  "workflow/trigger-removed": "workflow trigger removed",
  "commit/ai-assistance-disclosed": "AI disclosed",
  "agent/origin-detected": "agent-authored",
};

function notesFor(result: AnalysisResult): string[] {
  const notes: string[] = [];

  for (const finding of result.findings) {
    const label = LABELS[finding.ruleId];

    if (label && !notes.includes(label)) {
      notes.push(label);
    }
  }

  return notes;
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

/** Only the two variables the CLI reads, so callers can pass their own environment shape. */
export interface TriageEnvironment {
  GH_TOKEN?: string | undefined;
  GITHUB_TOKEN?: string | undefined;
}

export async function runTriageCli(
  args: string[],
  io: TriageIo,
  environment: TriageEnvironment = process.env,
): Promise<number> {
  let options: TriageOptions;

  try {
    options = parseTriageOptions(args);
  } catch (error) {
    io.stderr(`MergeWarden CLI error: ${error instanceof Error ? error.message : "usage"}\n`);
    return 2;
  }

  const token = environment.GH_TOKEN ?? environment.GITHUB_TOKEN;

  if (!token) {
    io.stderr(
      "MergeWarden CLI: triaging without authentication; GitHub's unauthenticated API rate limit applies.\n",
    );
  }

  const api = new NativeGitHubApi(token ? { token } : {});
  const loaderOptions: LoadGitHubAnalysisOptions = {
    configPath: "mergewarden.yml",
    now: new Date().toISOString(),
    engineVersion: MERGEWARDEN_VERSION,
    runtimeRef: `mergewarden-cli@${MERGEWARDEN_VERSION}`,
    // The policy file is usually absent on someone else's repository; that is the default
    // policy path, not a problem worth printing once per pull request.
    warning: () => {},
  };

  let openPullRequests: OpenPullRequest[];

  try {
    openPullRequests = await listOpenPullRequests(
      options.owner,
      options.repo,
      options.limit,
      token,
    );
  } catch (error) {
    io.stderr(
      `MergeWarden CLI error: ${error instanceof Error ? error.message : "could not list pull requests"}\n`,
    );
    return 2;
  }

  const rows: { number: number; title: string; headRef: string; notes: string[] }[] = [];

  for (const pull of openPullRequests) {
    try {
      const input = await loadGitHubAnalysis(
        api,
        { owner: options.owner, repo: options.repo, number: pull.number },
        loaderOptions,
      );
      // `no_linked_issue` is off in the gate, where it would attach a finding to nearly every
      // report. Here it earns its place: the question is which of many open pull requests to
      // read first, and comparing them on the same facts is the point.
      input.config.triage.no_linked_issue = "info";
      const result = await analyze(input);
      rows.push({ ...pull, notes: notesFor(result) });
    } catch {
      // One unreadable pull request must not end the run — a deleted head repository is
      // ordinary. It is reported as unreadable rather than silently dropped.
      rows.push({ ...pull, notes: ["could not be read"] });
    }
  }

  if (options.format === "json") {
    io.stdout(
      `${JSON.stringify({ repository: `${options.owner}/${options.repo}`, rows }, null, 2)}\n`,
    );
    return 0;
  }

  // Most signals first: the point of the command is which pull request to open next.
  const flagged = rows
    .filter((row) => row.notes.length > 0)
    .sort((left, right) => right.notes.length - left.notes.length || left.number - right.number);

  if (rows.length === 0) {
    io.stdout(`${options.owner}/${options.repo} has no open pull requests.\n`);
    return 0;
  }

  const lines = [
    `${rows.length} open pull request(s) read. ${flagged.length} have something a maintainer checks by hand.`,
    "",
  ];

  // Column widths follow the data: pull request numbers reach six digits on large repositories.
  const numberWidth = Math.max(...flagged.map((row) => `#${row.number}`.length), 4) + 2;

  for (const row of flagged) {
    const head = `#${row.number}`.padEnd(numberWidth);
    lines.push(
      `${head}${truncate(row.headRef || row.title, 34).padEnd(36)}${row.notes.join(" · ")}`,
    );
  }

  lines.push(
    "",
    "Nothing was closed, labelled, or commented on. Run `mergewarden scan <owner/repo#number>` for the evidence behind any row.",
    "",
  );

  io.stdout(lines.join("\n"));
  return 0;
}
