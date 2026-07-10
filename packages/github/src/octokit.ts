import { GitHubApiError, toGitHubApiError } from "./errors.js";
import type {
  GitHubApi,
  PullRequestLocator,
  RemotePullFile,
  RemotePullRequest,
  RemoteRepository,
  TextFileResult,
} from "./types.js";

interface OctokitPullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string | null;
  previous_filename?: string | null;
}

interface ListFilesArgs {
  owner: string;
  repo: string;
  pull_number: number;
  page: number;
  per_page: number;
  request: { signal: AbortSignal };
}

interface GetContentArgs {
  owner: string;
  repo: string;
  path: string;
  ref: string;
  request: { signal: AbortSignal };
}

const REQUEST_TIMEOUT_MS = 30_000;

function requestOptions(): { request: { signal: AbortSignal } } {
  return { request: { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) } };
}

export interface OctokitContentApi {
  rest: {
    pulls: {
      listFiles(args: ListFilesArgs): Promise<{ data: OctokitPullFile[] }>;
    };
    repos: {
      getContent(args: GetContentArgs): Promise<{ data: unknown }>;
    };
  };
}

type PullRequestLoader = (
  target: PullRequestLocator,
) => Promise<RemotePullRequest> | RemotePullRequest;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeTextFile(data: unknown, path: string): string {
  if (
    !isRecord(data) ||
    data.type !== "file" ||
    data.encoding !== "base64" ||
    typeof data.content !== "string"
  ) {
    throw new GitHubApiError(`Read ${path}: response was not base64 file content.`, {
      retryable: false,
    });
  }

  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function pullFile(file: OctokitPullFile): RemotePullFile {
  return {
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    ...(typeof file.patch === "string" && file.patch.length > 0 ? { patch: file.patch } : {}),
    ...(typeof file.previous_filename === "string" && file.previous_filename.length > 0
      ? { previousFilename: file.previous_filename }
      : {}),
  };
}

export function createOctokitGitHubApi(
  octokit: OctokitContentApi,
  getPullRequest: PullRequestLoader,
): GitHubApi {
  return {
    async getPullRequest(target) {
      try {
        return await getPullRequest(target);
      } catch (error) {
        throw toGitHubApiError(
          error,
          `Load pull request ${target.owner}/${target.repo}#${target.number}`,
        );
      }
    },

    async listPullRequestFilesPage(target, page, perPage) {
      try {
        const response = await octokit.rest.pulls.listFiles({
          owner: target.owner,
          repo: target.repo,
          pull_number: target.number,
          page,
          per_page: perPage,
          ...requestOptions(),
        });
        return response.data.map(pullFile);
      } catch (error) {
        throw toGitHubApiError(
          error,
          `List files for ${target.owner}/${target.repo}#${target.number} page ${page}`,
        );
      }
    },

    async getTextFile(
      repository: RemoteRepository,
      path: string,
      sha: string,
    ): Promise<TextFileResult> {
      try {
        const response = await octokit.rest.repos.getContent({
          owner: repository.owner,
          repo: repository.repo,
          path,
          ref: sha,
          ...requestOptions(),
        });
        return { kind: "found", text: decodeTextFile(response.data, path) };
      } catch (error) {
        const apiError = toGitHubApiError(
          error,
          `Read ${repository.owner}/${repository.repo}:${path}@${sha}`,
        );

        if (apiError.status === 404) {
          return { kind: "not-found" };
        }

        throw apiError;
      }
    },
  };
}
