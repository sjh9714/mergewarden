import {
  analyze,
  renderJsonReport,
  renderMarkdownReport,
  type AnalysisResult,
} from "@mergewarden/core";
import {
  GitHubApiError,
  describeGitHubApiError,
  loadGitHubAnalysis,
  type GitHubApi,
  type LoadGitHubAnalysisOptions,
  type PullRequestLocator,
} from "@mergewarden/github";

import { NativeGitHubApi } from "./githubApi.js";
import {
  exitCodeForResult,
  renderHumanReport,
  runCli as runReplayCli,
  safeTerminalValue,
  type CliIo,
} from "./replay.js";
import { parsePullRequestTarget } from "./target.js";
import { MERGEWARDEN_VERSION } from "./version.js";

type ScanFormat = "human" | "json" | "markdown";
type Mode = "observe" | "warn" | "block";

interface ScanOptions {
  target: PullRequestLocator;
  format: ScanFormat;
  configPath: string;
  modeOverride?: Mode;
}

export interface CliEnvironment {
  GH_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

export interface CliDependencies {
  createGitHubApi(token: string | undefined): GitHubApi;
  loadGitHubAnalysis: typeof loadGitHubAnalysis;
  analyze: typeof analyze;
  now(): string;
  environment: CliEnvironment;
}

const DEFAULT_DEPENDENCIES: CliDependencies = {
  createGitHubApi: (token) => new NativeGitHubApi({ token }),
  loadGitHubAnalysis,
  analyze,
  now: () => new Date().toISOString(),
  environment: process.env,
};

export const HELP_TEXT = `MergeWarden — checkout-free policy scanning for AI-generated pull requests

Usage:
  mergewarden scan <owner/repository#number> [options]
  mergewarden scan <github-pull-request-url> [options]
  mergewarden replay <fixture-dir> [--format json]

Commands:
  scan     Analyze a GitHub pull request through the GitHub API only.
  replay   Analyze a deterministic local fixture.

Scan options:
  --format <human|json|markdown>  Output format (default: human).
  --config <base-branch-path>     Policy path (default: mergewarden.yml).
  --mode <observe|warn|block>     Override the configured rollout mode.
  -h, --help                      Show help.
  -V, --version                   Show the MergeWarden version.

Authentication:
  GH_TOKEN is preferred over GITHUB_TOKEN. Public repositories can be scanned
  without a token, subject to GitHub's lower unauthenticated API rate limit.

Exit codes:
  0  Complete pass or warning result
  1  Complete block result
  2  Usage, API, configuration, or incomplete-analysis failure
`;

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new CliUsageError(`${option} requires a value.`);
  }

  return value;
}

function parseScanOptions(args: string[]): ScanOptions {
  const targetText = args[0];

  if (!targetText || targetText.startsWith("-")) {
    throw new CliUsageError(
      "Usage: mergewarden scan <owner/repository#number|GitHub PR URL> [options]",
    );
  }

  let format: ScanFormat = "human";
  let configPath = "mergewarden.yml";
  let modeOverride: Mode | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];

    if (option === "--format") {
      const value = requiredValue(args, index, option);
      if (value !== "human" && value !== "json" && value !== "markdown") {
        throw new CliUsageError("--format must be human, json, or markdown.");
      }
      format = value;
      index += 1;
      continue;
    }

    if (option === "--config") {
      configPath = requiredValue(args, index, option);
      if (
        configPath.startsWith("/") ||
        configPath.includes("\\") ||
        configPath.split("/").includes("..")
      ) {
        throw new CliUsageError(
          "--config must be a relative repository path without '..' segments.",
        );
      }
      index += 1;
      continue;
    }

    if (option === "--mode") {
      const value = requiredValue(args, index, option);
      if (value !== "observe" && value !== "warn" && value !== "block") {
        throw new CliUsageError("--mode must be observe, warn, or block.");
      }
      modeOverride = value;
      index += 1;
      continue;
    }

    throw new CliUsageError(`Unknown scan option: ${option ?? ""}`);
  }

  return {
    target: parsePullRequestTarget(targetText),
    format,
    configPath,
    ...(modeOverride ? { modeOverride } : {}),
  };
}

function selectToken(environment: CliEnvironment): string | undefined {
  const ghToken = environment.GH_TOKEN?.trim();
  if (ghToken) {
    return ghToken;
  }

  const githubToken = environment.GITHUB_TOKEN?.trim();
  return githubToken || undefined;
}

function renderResult(result: AnalysisResult, format: ScanFormat): string {
  switch (format) {
    case "json":
      return renderJsonReport(result);
    case "markdown":
      return renderMarkdownReport(result);
    case "human":
      return renderHumanReport(result);
  }
}

async function runScan(args: string[], io: CliIo, dependencies: CliDependencies): Promise<number> {
  const options = parseScanOptions(args);
  const token = selectToken(dependencies.environment);

  if (!token) {
    io.stderr(
      "MergeWarden CLI: scanning without authentication; GitHub's unauthenticated API rate limit applies.\n",
    );
  }

  const loaderOptions: LoadGitHubAnalysisOptions = {
    configPath: options.configPath,
    now: dependencies.now(),
    engineVersion: MERGEWARDEN_VERSION,
    runtimeRef: `mergewarden-cli@${MERGEWARDEN_VERSION}`,
    warning: (message) => io.stderr(`MergeWarden CLI: ${safeTerminalValue(message)}\n`),
    ...(options.modeOverride ? { modeOverride: options.modeOverride } : {}),
  };
  const input = await dependencies.loadGitHubAnalysis(
    dependencies.createGitHubApi(token),
    options.target,
    loaderOptions,
  );
  const result = await dependencies.analyze(input);

  io.stdout(renderResult(result, options.format));
  return exitCodeForResult(result);
}

function errorMessage(error: unknown): string {
  if (error instanceof GitHubApiError) {
    return describeGitHubApiError(error);
  }

  return error instanceof Error ? error.message : "unknown error";
}

function isHelp(args: string[]): boolean {
  return args.length === 1 && (args[0] === "--help" || args[0] === "-h");
}

function isVersion(args: string[]): boolean {
  return args.length === 1 && (args[0] === "--version" || args[0] === "-V");
}

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
  dependencies: CliDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  const knownCommand = argv[0] === "scan" || argv[0] === "replay";
  const commandArguments = argv.slice(1);

  if (isHelp(argv) || (knownCommand && isHelp(commandArguments))) {
    io.stdout(HELP_TEXT);
    return 0;
  }

  if (isVersion(argv) || (knownCommand && isVersion(commandArguments))) {
    io.stdout(`${MERGEWARDEN_VERSION}\n`);
    return 0;
  }

  if (argv[0] === "replay") {
    return runReplayCli(argv, io);
  }

  try {
    if (argv[0] !== "scan") {
      throw new CliUsageError(
        "Expected a command: scan or replay. Run mergewarden --help for usage.",
      );
    }

    return await runScan(argv.slice(1), io, dependencies);
  } catch (error) {
    io.stderr(`MergeWarden CLI error: ${safeTerminalValue(errorMessage(error))}\n`);
    return 2;
  }
}
