import {
  analyze,
  parseConfig,
  parseContractFromPrBody,
  renderJsonReport,
  renderMarkdownReport,
  type AgentGateConfig,
  type AnalysisInput,
  type AnalysisResult,
  type ChangeSet,
  type FileChange,
  type PullRequestContext,
} from "@agent-gate/core";

type Mode = AgentGateConfig["mode"];

export interface PullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  previous_filename?: string | null;
}

export interface ActionPullRequest {
  number: number;
  title?: string | null;
  body?: string | null;
  user?: {
    login?: string | null;
  } | null;
  labels?: Array<string | { name?: string | null }>;
  draft?: boolean | null;
  head: {
    ref: string;
    sha: string;
    repo?: {
      fork?: boolean | null;
    } | null;
  };
  base: {
    ref: string;
    sha: string;
    repo?: {
      default_branch?: string | null;
    } | null;
  };
}

export interface ActionContext {
  eventName: string;
  repo: {
    owner: string;
    repo: string;
  };
  payload: {
    pull_request?: ActionPullRequest;
  };
}

interface ListFilesArgs {
  owner: string;
  repo: string;
  pull_number: number;
  per_page: number;
}

interface GetContentArgs {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

type ListFilesMethod = (args: ListFilesArgs) => Promise<{ data: PullFile[] }>;
type GetContentMethod = (args: GetContentArgs) => Promise<{ data: unknown }>;

export interface OctokitLike {
  paginate?: (method: ListFilesMethod, args: ListFilesArgs) => Promise<PullFile[]>;
  rest: {
    pulls: {
      listFiles: ListFilesMethod;
    };
    repos: {
      getContent: GetContentMethod;
    };
    issues?: {
      createComment?: unknown;
    };
  };
}

export interface ActionSummary {
  addRaw(content: string): ActionSummary;
  write(): Promise<void>;
}

export interface ActionRuntime {
  context: ActionContext;
  octokit: OctokitLike;
  getInput(name: string): string;
  setOutput(name: string, value: string | number): void;
  setFailed(message: string | Error): void;
  notice(message: string): void;
  summary: ActionSummary;
  writeFile(path: string, content: string): Promise<void>;
  now(): Date;
}

interface FetchContentOptions {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inputOrDefault(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function booleanInput(value: string, fallback: boolean): boolean {
  const trimmed = value.trim().toLowerCase();

  if (trimmed === "") {
    return fallback;
  }

  return trimmed === "true";
}

function parseModeOverride(value: string): Mode | undefined {
  const trimmed = value.trim();

  if (trimmed === "") {
    return undefined;
  }

  if (trimmed === "observe" || trimmed === "warn" || trimmed === "block") {
    return trimmed;
  }

  throw new Error(`Invalid mode input: ${trimmed}. Expected observe, warn, or block.`);
}

function labelsFromPullRequest(pr: ActionPullRequest): string[] {
  return (pr.labels ?? [])
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => typeof label === "string" && label.trim().length > 0);
}

function pullRequestContext(pr: ActionPullRequest): PullRequestContext {
  return {
    number: pr.number,
    title: pr.title ?? "",
    body: pr.body ?? "",
    author: pr.user?.login ?? "",
    labels: labelsFromPullRequest(pr),
    branchName: pr.head.ref,
    isFork: Boolean(pr.head.repo?.fork),
    draft: Boolean(pr.draft),
  };
}

function fileStatus(status: string): FileChange["status"] {
  if (status === "added" || status === "modified" || status === "removed" || status === "renamed") {
    return status;
  }

  return "modified";
}

function stringOrUndefined(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function changeSet(files: FileChange[]): ChangeSet {
  return {
    files,
    totals: {
      filesChanged: files.length,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
    },
  };
}

function isFileContent(
  data: unknown,
): data is { encoding?: unknown; content?: unknown; type?: unknown } {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

export async function fetchRepositoryTextContent(
  octokit: OctokitLike,
  options: FetchContentOptions,
): Promise<string | null> {
  try {
    const response = await octokit.rest.repos.getContent(options);

    if (!isFileContent(response.data)) {
      return null;
    }

    if (response.data.type !== "file") {
      return null;
    }

    if (response.data.encoding !== "base64" || typeof response.data.content !== "string") {
      return null;
    }

    return Buffer.from(response.data.content.replace(/\n/g, ""), "base64").toString("utf8");
  } catch {
    return null;
  }
}

async function listPullFiles(
  octokit: OctokitLike,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullFile[]> {
  const args = {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  };

  if (octokit.paginate) {
    return octokit.paginate(octokit.rest.pulls.listFiles, args);
  }

  const response = await octokit.rest.pulls.listFiles(args);
  return response.data;
}

async function fileChangeFromPullFile(
  octokit: OctokitLike,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
  file: PullFile,
): Promise<FileChange> {
  const status = fileStatus(file.status);
  const previousPath = stringOrUndefined(file.previous_filename);
  const basePath = previousPath ?? file.filename;
  const baseContent = await fetchRepositoryTextContent(octokit, {
    owner,
    repo,
    path: basePath,
    ref: baseSha,
  });
  const headContent =
    status === "removed"
      ? null
      : await fetchRepositoryTextContent(octokit, {
          owner,
          repo,
          path: file.filename,
          ref: headSha,
        });

  return {
    path: file.filename,
    previousPath,
    status,
    additions: file.additions,
    deletions: file.deletions,
    patch: stringOrUndefined(file.patch),
    baseContent,
    headContent,
  };
}

async function loadChangedFiles(
  octokit: OctokitLike,
  owner: string,
  repo: string,
  pr: ActionPullRequest,
): Promise<FileChange[]> {
  const pullFiles = await listPullFiles(octokit, owner, repo, pr.number);

  return Promise.all(
    pullFiles.map((file) =>
      fileChangeFromPullFile(octokit, owner, repo, pr.base.sha, pr.head.sha, file),
    ),
  );
}

async function loadConfig(
  runtime: ActionRuntime,
  owner: string,
  repo: string,
  baseSha: string,
  path: string,
): Promise<AgentGateConfig> {
  const configText = await fetchRepositoryTextContent(runtime.octokit, {
    owner,
    repo,
    path,
    ref: baseSha,
  });

  if (configText === null) {
    throw new Error(`Unable to load ${path} from base ref ${baseSha}.`);
  }

  const config = parseConfig(configText);
  const modeOverride = parseModeOverride(runtime.getInput("mode"));

  return modeOverride ? { ...config, mode: modeOverride } : config;
}

function analysisInput(
  context: ActionContext,
  pr: ActionPullRequest,
  config: AgentGateConfig,
  files: FileChange[],
  now: Date,
): AnalysisInput {
  return {
    repo: {
      owner: context.repo.owner,
      repo: context.repo.repo,
      defaultBranch: pr.base.repo?.default_branch ?? pr.base.ref,
      baseRef: pr.base.ref,
      baseSha: pr.base.sha,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
    },
    pr: pullRequestContext(pr),
    config,
    contract: parseContractFromPrBody(pr.body ?? ""),
    changes: changeSet(files),
    reviews: [],
    checks: [],
    now: now.toISOString(),
    configSource: "base-branch",
    version: "0.0.0",
  };
}

async function runActionInner(runtime: ActionRuntime): Promise<AnalysisResult> {
  const { context } = runtime;
  const pr = context.payload.pull_request;

  if (context.eventName !== "pull_request" || !pr) {
    throw new Error("Agent Gate can only run on pull_request events.");
  }

  const configPath = inputOrDefault(runtime.getInput("config"), "agent-gate.yml");
  const reportJsonPath = inputOrDefault(runtime.getInput("report-json"), "agent-gate-report.json");
  const reportMarkdownPath = inputOrDefault(
    runtime.getInput("report-markdown"),
    "agent-gate-report.md",
  );
  const config = await loadConfig(
    runtime,
    context.repo.owner,
    context.repo.repo,
    pr.base.sha,
    configPath,
  );
  const files = await loadChangedFiles(runtime.octokit, context.repo.owner, context.repo.repo, pr);
  const result = await analyze(analysisInput(context, pr, config, files, runtime.now()));
  const jsonReport = renderJsonReport(result);
  const markdownReport = renderMarkdownReport(result);

  await runtime.writeFile(reportJsonPath, jsonReport);
  await runtime.writeFile(reportMarkdownPath, markdownReport);
  runtime.setOutput("decision", result.decision);
  runtime.setOutput("risk-score", result.riskScore);
  runtime.setOutput("report-json", reportJsonPath);
  await runtime.summary.addRaw(markdownReport).write();

  if (booleanInput(runtime.getInput("comment"), false)) {
    runtime.notice("Agent Gate PR comments are not implemented yet.");
  }

  if (result.decision === "block" && booleanInput(runtime.getInput("fail-on-block"), true)) {
    runtime.setFailed("Agent Gate blocked this pull request.");
  }

  return result;
}

export async function runAction(runtime: ActionRuntime): Promise<AnalysisResult | undefined> {
  try {
    return await runActionInner(runtime);
  } catch (error) {
    runtime.setFailed(errorMessage(error));
    return undefined;
  }
}
