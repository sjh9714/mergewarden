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
const RETRYABLE = new Set([403, 429, 500, 502, 503, 504]);

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
  author: string;
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

  // GitHub answers a burst of requests with 403 under its secondary rate limit, which is
  // transient and unrelated to the hourly budget. The rest of the CLI retries through
  // @mergewarden/github; this listing is a direct call and needs its own bounded backoff.
  let response = await fetch(url, { headers });

  for (let attempt = 1; attempt <= 3 && RETRYABLE.has(response.status); attempt++) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 20_000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    response = await fetch(url, { headers });
  }

  if (!response.ok) {
    const hint = RETRYABLE.has(response.status)
      ? " — GitHub is rate limiting this token; try again in a few minutes"
      : "";
    throw new Error(
      `Could not list pull requests for ${owner}/${repo}: HTTP ${response.status}${hint}`,
    );
  }

  const payload = (await response.json()) as {
    number: number;
    title: string;
    draft?: boolean;
    head?: { ref?: string };
    user?: { login?: string };
  }[];

  return payload.slice(0, limit).map((pull) => ({
    number: pull.number,
    title: pull.title,
    headRef: pull.head?.ref ?? "",
    author: pull.user?.login ?? "",
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

/**
 * A note that appears on nearly every pull request cannot rank any of them.
 *
 * RSSHub links an issue on none of its open pull requests — that is the project's norm, not a
 * fact about any one contribution. Repeating it on all fifteen rows says nothing about which to
 * open first, which is the failure this command exists to avoid. Such a note is reported once,
 * about the repository, and removed from the rows so the remaining signals do the ranking.
 *
 * Only applied above a floor: on four pull requests "three of four" is a coincidence, not a norm.
 */
export const UNIFORM_THRESHOLD = 0.8;
const UNIFORM_MIN_PULLS = 8;

export function partitionUniformNotes(rows: { notes: string[] }[]): {
  uniform: string[];
  rows: { notes: string[] }[];
} {
  if (rows.length < UNIFORM_MIN_PULLS) {
    return { uniform: [], rows };
  }

  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const note of row.notes) {
      counts.set(note, (counts.get(note) ?? 0) + 1);
    }
  }

  const uniform = [...counts.entries()]
    .filter(([, count]) => count / rows.length >= UNIFORM_THRESHOLD)
    .map(([note]) => note);

  if (uniform.length === 0) {
    return { uniform: [], rows };
  }

  return {
    uniform,
    rows: rows.map((row) => ({ ...row, notes: row.notes.filter((n) => !uniform.includes(n)) })),
  };
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

  const rows: {
    number: number;
    title: string;
    headRef: string;
    author: string;
    notes: string[];
  }[] = [];
  const automation: OpenPullRequest[] = [];

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

      // Maintenance automation is excluded from the rules, so it can never be flagged. Counting
      // it as a read pull request that happened to be clean is what made a queue of ten
      // dependabot bumps print as "10 read, 0 flagged" — a result that reads as the tool
      // failing rather than as there being nothing for a human here.
      if (
        input.config.triage.exclude_authors.some(
          (entry) => entry.toLowerCase() === pull.author.toLowerCase(),
        )
      ) {
        automation.push(pull);
        continue;
      }

      const result = await analyze(input);
      rows.push({ ...pull, notes: notesFor(result) });
    } catch {
      // One unreadable pull request must not end the run — a deleted head repository is
      // ordinary. It is reported as unreadable rather than silently dropped.
      rows.push({ ...pull, notes: ["could not be read"] });
    }
  }

  // Applied before the format branch. The human and JSON views must not disagree about which
  // notes rank a pull request — they did, and a validation run measured the unfixed behaviour
  // because it asked for JSON.
  const partitioned = partitionUniformNotes(rows) as { uniform: string[]; rows: typeof rows };

  if (options.format === "json") {
    io.stdout(
      `${JSON.stringify(
        {
          repository: `${options.owner}/${options.repo}`,
          uniformNotes: partitioned.uniform,
          automationPullRequests: automation.length,
          rows: partitioned.rows,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  // Most signals first: the point of the command is which pull request to open next.
  const flagged = partitioned.rows
    .filter((row) => row.notes.length > 0)
    .sort((left, right) => right.notes.length - left.notes.length || left.number - right.number);

  if (rows.length === 0) {
    io.stdout(
      automation.length > 0
        ? `${options.owner}/${options.repo}: all ${automation.length} open pull request(s) read are maintenance automation. Nothing here is waiting on a human.\n`
        : `${options.owner}/${options.repo} has no open pull requests.\n`,
    );
    return 0;
  }

  const lines = [
    `${rows.length} open pull request(s) read. ${flagged.length} have something a maintainer checks by hand.`,
    ...(automation.length > 0
      ? [`${automation.length} more are maintenance automation and were not read.`]
      : []),
    "",
  ];

  for (const note of partitioned.uniform) {
    lines.push(
      `Nearly every open pull request here trips "${note}", so it reads as this repository's norm and is not listed per row.`,
    );
  }

  if (partitioned.uniform.length > 0) {
    lines.push("");
  }

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
