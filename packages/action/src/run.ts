import {
  analyze,
  renderJsonReport,
  renderMarkdownReport,
  renderPlainTextReportSummary,
  type AgentGateConfig,
  type AnalysisResult,
} from "@agent-gate/core";
import {
  createOctokitGitHubApi,
  describeGitHubApiError,
  GitHubApiError,
  loadGitHubAnalysis,
  type OctokitContentApi,
  type PullRequestLocator,
  type RemotePullRequest,
} from "@agent-gate/github";

import { AGENT_GATE_VERSION } from "./version.js";

type Mode = AgentGateConfig["mode"];

interface RepositoryRef {
  owner: string;
  repo: string;
}

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
  changed_files?: number;
  user?: { login?: string | null } | null;
  labels?: Array<string | { name?: string | null }>;
  draft?: boolean | null;
  head: {
    ref: string;
    sha: string;
    repo?: {
      full_name?: string | null;
      name?: string | null;
      owner?: { login?: string | null } | null;
      fork?: boolean | null;
      default_branch?: string | null;
    } | null;
  };
  base: {
    ref: string;
    sha: string;
    repo?: {
      full_name?: string | null;
      name?: string | null;
      owner?: { login?: string | null } | null;
      default_branch?: string | null;
    } | null;
  };
}

export interface ActionContext {
  eventName: string;
  repo: RepositoryRef;
  payload: { pull_request?: ActionPullRequest };
}

interface ListIssueCommentsArgs {
  owner: string;
  repo: string;
  issue_number: number;
  per_page: number;
  page: number;
  sort: "created";
  direction: "desc";
  request: { signal: AbortSignal };
}

interface CreateIssueCommentArgs {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
  request: { signal: AbortSignal };
}

interface UpdateIssueCommentArgs {
  owner: string;
  repo: string;
  comment_id: number;
  body: string;
  request: { signal: AbortSignal };
}

interface IssueComment {
  id: number;
  body?: string | null;
  user?: { login?: string | null; type?: string | null } | null;
  performed_via_github_app?: { slug?: string | null } | null;
}

type PaginatedMethod<TArgs, TItem> = (args: TArgs) => Promise<{ data: TItem[] }>;
type ListIssueCommentsMethod = PaginatedMethod<ListIssueCommentsArgs, IssueComment>;

export interface OctokitLike extends OctokitContentApi {
  paginate?: <TArgs, TItem>(method: PaginatedMethod<TArgs, TItem>, args: TArgs) => Promise<TItem[]>;
  rest: OctokitContentApi["rest"] & {
    pulls: OctokitContentApi["rest"]["pulls"] & {
      get?: (args: {
        owner: string;
        repo: string;
        pull_number: number;
        request: { signal: AbortSignal };
      }) => Promise<{ data: { changed_files?: number } }>;
    };
    issues?: {
      listComments?: ListIssueCommentsMethod;
      createComment?: (args: CreateIssueCommentArgs) => Promise<{ data: unknown }>;
      updateComment?: (args: UpdateIssueCommentArgs) => Promise<{ data: unknown }>;
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
  setOutput(name: string, value: string | number | boolean): void;
  setFailed(message: string | Error): void;
  info(message: string): void;
  notice(message: string): void;
  warning(message: string): void;
  summary: ActionSummary;
  writeFile(path: string, content: string): Promise<void>;
  now(): Date;
}

const AGENT_GATE_COMMENT_MARKER = "<!-- agent-gate-report -->";
const AGENT_GATE_MANAGED_COMMENT_NOTE =
  "<!-- This comment is managed by Agent Gate. Do not edit manually. -->";
const COMMENT_MAX_BYTES = 60_000;
const COMMENT_WRAPPER_RESERVE_BYTES = 512;
const GITHUB_REQUEST_TIMEOUT_MS = 30_000;

function githubRequestOptions(): { request: { signal: AbortSignal } } {
  return { request: { signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS) } };
}

function errorMessage(error: unknown): string {
  if (error instanceof GitHubApiError) {
    return describeGitHubApiError(error);
  }

  return error instanceof Error ? error.message : String(error);
}

function inputOrDefault(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseBooleanInput(name: string, value: string, fallback: boolean): boolean {
  const trimmed = value.trim().toLowerCase();

  if (trimmed === "") {
    return fallback;
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  throw new Error(`Invalid boolean input ${name}: ${value}. Expected true or false.`);
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

function splitRepositoryFullName(fullName: string | null | undefined): RepositoryRef | undefined {
  if (!fullName?.includes("/")) {
    return undefined;
  }

  const [owner, repo] = fullName.split("/", 2);
  return owner && repo ? { owner, repo } : undefined;
}

function repositoryFromPayload(
  repository: ActionPullRequest["head"]["repo"],
  fallback: RepositoryRef,
): RepositoryRef {
  return (
    splitRepositoryFullName(repository?.full_name) ??
    (repository?.owner?.login && repository.name
      ? { owner: repository.owner.login, repo: repository.name }
      : fallback)
  );
}

function labelsFromPullRequest(pr: ActionPullRequest): string[] {
  return (pr.labels ?? [])
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => typeof label === "string" && label.trim().length > 0);
}

function remotePullRequest(context: ActionContext, pr: ActionPullRequest): RemotePullRequest {
  if (!Number.isInteger(pr.changed_files) || (pr.changed_files ?? -1) < 0) {
    throw new GitHubApiError(
      "GitHub pull request metadata did not include a valid changed_files count.",
      { retryable: false },
    );
  }

  const baseRepository = repositoryFromPayload(pr.base.repo, context.repo);
  const headRepository = repositoryFromPayload(pr.head.repo, context.repo);

  return {
    number: pr.number,
    title: pr.title ?? "",
    body: pr.body ?? "",
    author: pr.user?.login ?? "",
    labels: labelsFromPullRequest(pr),
    draft: Boolean(pr.draft),
    changedFiles: pr.changed_files ?? 0,
    head: {
      ref: pr.head.ref,
      sha: pr.head.sha,
      repository: {
        ...headRepository,
        ...(pr.head.repo?.default_branch ? { defaultBranch: pr.head.repo.default_branch } : {}),
      },
      fork: Boolean(pr.head.repo?.fork),
    },
    base: {
      ref: pr.base.ref,
      sha: pr.base.sha,
      repository: {
        ...baseRepository,
        defaultBranch: pr.base.repo?.default_branch ?? pr.base.ref,
      },
    },
  };
}

async function loadRemotePullRequest(
  context: ActionContext,
  pr: ActionPullRequest,
  octokit: OctokitLike,
  target: PullRequestLocator,
): Promise<RemotePullRequest> {
  if (Number.isInteger(pr.changed_files) && (pr.changed_files ?? -1) >= 0) {
    return remotePullRequest(context, pr);
  }

  const getPullRequest = octokit.rest.pulls.get;

  if (!getPullRequest) {
    throw new GitHubApiError(
      "GitHub pull request payload omitted changed_files and the pull request GET API is unavailable.",
      { retryable: false },
    );
  }

  const response = await getPullRequest({
    owner: target.owner,
    repo: target.repo,
    pull_number: target.number,
    ...githubRequestOptions(),
  });

  return remotePullRequest(context, { ...pr, changed_files: response.data.changed_files });
}

async function listIssueComments(
  octokit: OctokitLike,
  repository: RepositoryRef,
  issueNumber: number,
): Promise<IssueComment[]> {
  const listComments = octokit.rest.issues?.listComments;

  if (!listComments) {
    throw new Error("GitHub Issues comment list API is unavailable.");
  }

  const args = {
    owner: repository.owner,
    repo: repository.repo,
    issue_number: issueNumber,
    per_page: 100,
    page: 1,
    sort: "created" as const,
    direction: "desc" as const,
    ...githubRequestOptions(),
  };

  return (await listComments(args)).data;
}

function markedCommentBody(markdownReport: string): string {
  return `${AGENT_GATE_COMMENT_MARKER}\n${AGENT_GATE_MANAGED_COMMENT_NOTE}\n\n${markdownReport}`;
}

function isAgentGateManagedComment(comment: IssueComment): boolean {
  if (!comment.body?.startsWith(AGENT_GATE_COMMENT_MARKER)) {
    return false;
  }

  if (comment.user?.type !== "Bot" || comment.user.login !== "github-actions[bot]") {
    return false;
  }

  return (
    comment.performed_via_github_app == null ||
    comment.performed_via_github_app.slug === "github-actions"
  );
}

function latestMarkedComment(comments: IssueComment[]): IssueComment | undefined {
  return comments.filter(isAgentGateManagedComment).sort((left, right) => right.id - left.id)[0];
}

async function upsertPullRequestComment(
  octokit: OctokitLike,
  repository: RepositoryRef,
  issueNumber: number,
  markdownReport: string,
): Promise<void> {
  const comments = await listIssueComments(octokit, repository, issueNumber);
  const body = markedCommentBody(markdownReport);
  const existingComment = latestMarkedComment(comments);

  if (existingComment) {
    const updateComment = octokit.rest.issues?.updateComment;

    if (!updateComment) {
      throw new Error("GitHub Issues comment update API is unavailable.");
    }

    await updateComment({
      owner: repository.owner,
      repo: repository.repo,
      comment_id: existingComment.id,
      body,
      ...githubRequestOptions(),
    });
    return;
  }

  const createComment = octokit.rest.issues?.createComment;

  if (!createComment) {
    throw new Error("GitHub Issues comment create API is unavailable.");
  }

  await createComment({
    owner: repository.owner,
    repo: repository.repo,
    issue_number: issueNumber,
    body,
    ...githubRequestOptions(),
  });
}

function setResultOutputs(
  runtime: ActionRuntime,
  result: AnalysisResult,
  reportJsonPath: string,
  reportMarkdownPath: string,
): void {
  runtime.setOutput("decision", result.decision);
  runtime.setOutput("status", result.status);
  runtime.setOutput("analysis-complete", result.metadata.analysisComplete);
  runtime.setOutput("error-count", result.summary.errorCount);
  runtime.setOutput("warning-count", result.summary.warnCount);
  runtime.setOutput("info-count", result.summary.infoCount);
  runtime.setOutput("waived-count", result.summary.waivedCount);
  runtime.setOutput("expected-file-count", result.metadata.expectedFileCount);
  runtime.setOutput("analyzed-file-count", result.metadata.analyzedFileCount);
  runtime.setOutput("risk-score", result.riskScore);
  runtime.setOutput("report-json", reportJsonPath);
  runtime.setOutput("report-markdown", reportMarkdownPath);
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
  const comment = parseBooleanInput("comment", runtime.getInput("comment"), false);
  const failOnBlock = parseBooleanInput("fail-on-block", runtime.getInput("fail-on-block"), true);
  const modeOverride = parseModeOverride(runtime.getInput("mode"));
  const target: PullRequestLocator = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    number: pr.number,
  };
  const api = createOctokitGitHubApi(runtime.octokit, () =>
    loadRemotePullRequest(context, pr, runtime.octokit, target),
  );
  const input = await loadGitHubAnalysis(api, target, {
    configPath,
    modeOverride,
    now: runtime.now().toISOString(),
    engineVersion: AGENT_GATE_VERSION,
    runtimeRef: `agent-gate-action@${AGENT_GATE_VERSION}`,
    warning: (message) => runtime.warning(message),
  });
  const result = await analyze(input);
  const jsonReport = renderJsonReport(result);
  const markdownReport = renderMarkdownReport(result);
  const summaryReport = renderMarkdownReport(result, {
    maxFindings: 200,
    maxBytes: 900_000,
    fullReportPath: reportMarkdownPath,
  });
  const plainTextReportSummary = renderPlainTextReportSummary(result);

  await runtime.writeFile(reportJsonPath, jsonReport);
  await runtime.writeFile(reportMarkdownPath, markdownReport);
  setResultOutputs(runtime, result, reportJsonPath, reportMarkdownPath);
  await runtime.summary.addRaw(summaryReport).write();
  runtime.info(plainTextReportSummary);

  if (comment) {
    try {
      const commentReport = renderMarkdownReport(result, {
        maxFindings: 50,
        maxBytes: COMMENT_MAX_BYTES - COMMENT_WRAPPER_RESERVE_BYTES,
        fullReportPath: reportMarkdownPath,
      });
      await upsertPullRequestComment(runtime.octokit, context.repo, pr.number, commentReport);
    } catch (error) {
      runtime.warning(`Agent Gate could not upsert PR comment: ${errorMessage(error)}`);
    }
  }

  if (!result.metadata.analysisComplete) {
    runtime.setFailed("Agent Gate analysis is incomplete.");
  } else if (result.decision === "block" && failOnBlock) {
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
