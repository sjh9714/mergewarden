import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  analyze,
  parseConfig,
  parseContractFromPrBody,
  renderJsonReport,
  type AnalysisInput,
  type AnalysisResult,
  type CheckEvidence,
  type ChangeSet,
  type FileChange,
  type PullRequestContext,
  type RepoContext,
  type ReviewEvidence,
} from "@agent-gate/core";

type OutputWriter = (text: string) => void;

export interface CliIo {
  stdout: OutputWriter;
  stderr: OutputWriter;
}

interface ReplayFixtureJson {
  repo?: Partial<RepoContext>;
  pr?: Partial<PullRequestContext>;
  files?: FileChange[];
  reviews?: ReviewEvidence[];
  checks?: CheckEvidence[];
  now?: string;
  version?: string;
}

interface ReplayOptions {
  format: "human" | "json";
}

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const FILE_STATUSES = new Set<FileChange["status"]>(["added", "modified", "removed", "renamed"]);

const DEFAULT_REPO: RepoContext = {
  owner: "agent-gate",
  repo: "replay-fixture",
  defaultBranch: "main",
  baseRef: "main",
  baseSha: "base-sha",
  headRef: "replay/head",
  headSha: "head-sha",
};

const DEFAULT_PR: PullRequestContext = {
  number: 1,
  title: "Replay fixture",
  body: "",
  author: "replay",
  labels: [],
  branchName: "replay/head",
  isFork: false,
  draft: false,
};

function changesFromFiles(files: FileChange[]): ChangeSet {
  return {
    files,
    totals: {
      filesChanged: files.length,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function validateFileChange(value: unknown, index: number): FileChange {
  if (!isRecord(value)) {
    throw new CliError(`fixture.json files[${index}] must be an object.`);
  }

  if (!isNonEmptyString(value.path)) {
    throw new CliError(`fixture.json files[${index}].path must be a non-empty string.`);
  }

  if (
    typeof value.status !== "string" ||
    !FILE_STATUSES.has(value.status as FileChange["status"])
  ) {
    throw new CliError(`fixture.json files[${index}].status is invalid.`);
  }

  if (!isNonNegativeInteger(value.additions)) {
    throw new CliError(`fixture.json files[${index}].additions must be a non-negative integer.`);
  }

  if (!isNonNegativeInteger(value.deletions)) {
    throw new CliError(`fixture.json files[${index}].deletions must be a non-negative integer.`);
  }

  if (!isOptionalString(value.previousPath)) {
    throw new CliError(`fixture.json files[${index}].previousPath must be a string when present.`);
  }

  if (!isOptionalNullableString(value.baseContent)) {
    throw new CliError(
      `fixture.json files[${index}].baseContent must be a string or null when present.`,
    );
  }

  if (!isOptionalNullableString(value.headContent)) {
    throw new CliError(
      `fixture.json files[${index}].headContent must be a string or null when present.`,
    );
  }

  if (!isOptionalString(value.patch)) {
    throw new CliError(`fixture.json files[${index}].patch must be a string when present.`);
  }

  return {
    path: value.path,
    previousPath: value.previousPath,
    status: value.status as FileChange["status"],
    additions: value.additions,
    deletions: value.deletions,
    patch: value.patch,
    baseContent: value.baseContent,
    headContent: value.headContent,
  };
}

function parseFixtureJson(text: string, filePath: string): ReplayFixtureJson {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CliError(`${filePath} is not valid JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new CliError(`${filePath} must contain a JSON object.`);
  }

  if (!Array.isArray(parsed.files)) {
    throw new CliError(`${filePath} must include a files array.`);
  }

  return {
    ...(parsed as ReplayFixtureJson),
    files: parsed.files.map((file, index) => validateFileChange(file, index)),
  };
}

async function readRequiredText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    throw new CliError(`Required fixture file is missing: ${filePath}`);
  }
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  if (!existsSync(filePath)) {
    return undefined;
  }

  return readFile(filePath, "utf8");
}

export async function loadReplayFixture(fixtureDir: string): Promise<AnalysisInput> {
  const root = resolve(fixtureDir);
  const configText = await readRequiredText(resolve(root, "agent-gate.yml"));
  const fixtureText = await readRequiredText(resolve(root, "fixture.json"));
  const prBody = await readOptionalText(resolve(root, "pr-body.md"));
  const fixture = parseFixtureJson(fixtureText, resolve(root, "fixture.json"));
  const pr = {
    ...DEFAULT_PR,
    ...fixture.pr,
    body: prBody ?? fixture.pr?.body ?? DEFAULT_PR.body,
  };

  return {
    repo: {
      ...DEFAULT_REPO,
      ...fixture.repo,
    },
    pr,
    config: parseConfig(configText),
    contract: parseContractFromPrBody(pr.body),
    changes: changesFromFiles(fixture.files ?? []),
    reviews: fixture.reviews ?? [],
    checks: fixture.checks ?? [],
    now: fixture.now ?? new Date(0).toISOString(),
    configSource: "local",
    version: fixture.version ?? "0.0.0",
  };
}

function decisionLabel(decision: AnalysisResult["decision"]): string {
  if (decision === "block") {
    return "BLOCKED";
  }

  if (decision === "warn") {
    return "WARN";
  }

  return "PASSED";
}

export function renderHumanReport(result: AnalysisResult): string {
  const lines = [`Agent Gate: ${decisionLabel(result.decision)}`, ""];

  if (result.findings.length === 0) {
    lines.push("No findings.");
    return `${lines.join("\n")}\n`;
  }

  for (const finding of result.findings) {
    lines.push(`${finding.severity.toUpperCase()} ${finding.ruleId}`, finding.message);

    if (finding.path) {
      lines.push(`Path: ${finding.path}`);
    }

    for (const evidence of finding.evidence) {
      lines.push(`- ${evidence.label}: ${evidence.value}`);
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function parseReplayOptions(argv: string[]): { fixtureDir: string; options: ReplayOptions } {
  const [command, fixtureDir, ...rest] = argv;

  if (command !== "replay" || !fixtureDir) {
    throw new CliError("Usage: agent-gate replay <fixture-dir> [--format json]");
  }

  let format: ReplayOptions["format"] = "human";

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--format" && rest[index + 1] === "json") {
      format = "json";
      index += 1;
      continue;
    }

    throw new CliError(`Unknown replay option: ${arg ?? ""}`);
  }

  return { fixtureDir, options: { format } };
}

function exitCodeForResult(result: AnalysisResult): 0 | 1 {
  return result.decision === "block" ? 1 : 0;
}

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  try {
    const { fixtureDir, options } = parseReplayOptions(argv);
    const input = await loadReplayFixture(fixtureDir);
    const result = await analyze(input);
    io.stdout(options.format === "json" ? renderJsonReport(result) : renderHumanReport(result));
    return exitCodeForResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    io.stderr(`Agent Gate CLI error: ${message}\n`);
    return 2;
  }
}
