import {
  GitHubApiError,
  type GitHubApi,
  type PullRequestLocator,
  type RemotePullFile,
  type RemotePullRequest,
  type RemoteRepository,
  type TextFileResult,
} from "@mergewarden/github";

import { MERGEWARDEN_VERSION } from "./version.js";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_ERROR_BODY_BYTES = 4_096;

export interface NativeGitHubApiOptions {
  token?: string;
  fetch?: Fetch;
  apiBaseUrl?: string;
  requestTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidResponse(`${field} was not an object`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw invalidResponse(`${field} was not a non-empty string`);
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidResponse(`${field} was not a non-negative integer`);
  }
  return value;
}

function invalidResponse(detail: string): GitHubApiError {
  return new GitHubApiError(`GitHub API returned an invalid response: ${detail}.`, {
    retryable: false,
  });
}

function repositoryRoute(owner: string, repo: string): string {
  // GitHub routes are case-insensitive, but mixed-case API routes can fail at edge caches.
  // Canonicalize route segments only; response metadata remains untouched.
  return `${encodeURIComponent(owner.toLowerCase())}/${encodeURIComponent(repo.toLowerCase())}`;
}

function repository(value: unknown, field: string): RemoteRepository {
  const repo = requiredRecord(value, field);
  const owner = requiredRecord(repo.owner, `${field}.owner`);
  return {
    owner: requiredString(owner.login, `${field}.owner.login`),
    repo: requiredString(repo.name, `${field}.name`),
    ...(typeof repo.default_branch === "string" && repo.default_branch.length > 0
      ? { defaultBranch: repo.default_branch }
      : {}),
  };
}

function remotePullRequest(value: unknown): RemotePullRequest {
  const pull = requiredRecord(value, "pull request");
  const head = requiredRecord(pull.head, "pull request.head");
  const base = requiredRecord(pull.base, "pull request.base");
  const user = requiredRecord(pull.user, "pull request.user");
  const headRepositoryRecord = requiredRecord(head.repo, "pull request.head.repo");
  const labels = Array.isArray(pull.labels)
    ? pull.labels.flatMap((label, index) => {
        const candidate = requiredRecord(label, `pull request.labels[${index}]`);
        return typeof candidate.name === "string" ? [candidate.name] : [];
      })
    : [];

  return {
    number: requiredInteger(pull.number, "pull request.number"),
    title: requiredString(pull.title, "pull request.title"),
    body: typeof pull.body === "string" ? pull.body : "",
    author: requiredString(user.login, "pull request.user.login"),
    labels,
    draft: pull.draft === true,
    changedFiles: requiredInteger(pull.changed_files, "pull request.changed_files"),
    head: {
      ref: requiredString(head.ref, "pull request.head.ref"),
      sha: requiredString(head.sha, "pull request.head.sha"),
      repository: repository(head.repo, "pull request.head.repo"),
      fork: headRepositoryRecord.fork === true,
    },
    base: {
      ref: requiredString(base.ref, "pull request.base.ref"),
      sha: requiredString(base.sha, "pull request.base.sha"),
      repository: repository(base.repo, "pull request.base.repo"),
    },
  };
}

function remotePullFile(value: unknown, index: number): RemotePullFile {
  const file = requiredRecord(value, `files[${index}]`);
  return {
    filename: requiredString(file.filename, `files[${index}].filename`),
    status: requiredString(file.status, `files[${index}].status`),
    additions: requiredInteger(file.additions, `files[${index}].additions`),
    deletions: requiredInteger(file.deletions, `files[${index}].deletions`),
    ...(typeof file.patch === "string" && file.patch.length > 0 ? { patch: file.patch } : {}),
    ...(typeof file.previous_filename === "string" && file.previous_filename.length > 0
      ? { previousFilename: file.previous_filename }
      : {}),
  };
}

function headerNumber(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function timeoutError(operation: string, timeoutMs: number, cause?: unknown): GitHubApiError {
  return new GitHubApiError(`${operation}: request timed out after ${timeoutMs}ms.`, {
    retryable: true,
    ...(cause === undefined ? {} : { cause }),
  });
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (byteLength < maxBytes) {
      const { done, value } = await withAbort(reader.read(), signal);
      if (done) {
        break;
      }

      const remaining = maxBytes - byteLength;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      byteLength += chunk.byteLength;

      if (byteLength >= maxBytes) {
        await withAbort(reader.cancel("MergeWarden response body byte limit reached."), signal);
        break;
      }
    }
  } catch (error) {
    void reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // An aborted platform stream can retain the reader until its pending read settles.
    }
  }

  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readTextCapped(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  return new TextDecoder().decode(await readBodyCapped(response, maxBytes, signal));
}

async function responseError(
  response: Response,
  operation: string,
  signal: AbortSignal,
): Promise<GitHubApiError> {
  const fallback = response.statusText || "request failed";
  let message = fallback;

  try {
    const body = await readTextCapped(response, MAX_ERROR_BODY_BYTES, signal);
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed) && typeof parsed.message === "string") {
      message = parsed.message.slice(0, 1_000);
    }
  } catch (error) {
    if (signal.aborted) {
      throw signal.reason ?? error;
    }
    // GitHub error responses are normally JSON. The stable status text is sufficient otherwise.
  }

  const retryAfterSeconds = headerNumber(response.headers, "retry-after");
  const resetSeconds = headerNumber(response.headers, "x-ratelimit-reset");
  return new GitHubApiError(`${operation}: ${message}`, {
    status: response.status,
    requestId: response.headers.get("x-github-request-id") ?? undefined,
    retryAfterMs: retryAfterSeconds === undefined ? undefined : retryAfterSeconds * 1_000,
    rateLimitResetAt: resetSeconds === undefined ? undefined : resetSeconds * 1_000,
  });
}

export class NativeGitHubApi implements GitHubApi {
  readonly #token: string | undefined;
  readonly #fetch: Fetch;
  readonly #apiBaseUrl: string;
  readonly #requestTimeoutMs: number;

  constructor(options: NativeGitHubApiOptions = {}) {
    this.#token = options.token;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
    this.#requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    if (!Number.isFinite(this.#requestTimeoutMs) || this.#requestTimeoutMs <= 0) {
      throw new Error("requestTimeoutMs must be a positive number.");
    }
  }

  async #request<T>(
    path: string,
    operation: string,
    accept: string,
    handle: (response: Response, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `mergewarden-cli/${MERGEWARDEN_VERSION}`,
    };

    if (this.#token) {
      headers.Authorization = `Bearer ${this.#token}`;
    }

    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort(timeoutError(operation, this.#requestTimeoutMs));
    }, this.#requestTimeoutMs);

    try {
      const response = await withAbort(
        this.#fetch(`${this.#apiBaseUrl}${path}`, {
          headers,
          redirect: "error",
          signal: controller.signal,
        }),
        controller.signal,
      );
      return await handle(response, controller.signal);
    } catch (cause) {
      if (cause instanceof GitHubApiError) {
        throw cause;
      }

      if (didTimeout || controller.signal.aborted) {
        throw timeoutError(operation, this.#requestTimeoutMs, cause);
      }

      throw new GitHubApiError(`${operation}: network request failed.`, { cause });
    } finally {
      clearTimeout(timer);
    }
  }

  async getPullRequest(target: PullRequestLocator): Promise<RemotePullRequest> {
    const operation = `Load pull request ${target.owner}/${target.repo}#${target.number}`;
    return this.#request(
      `/repos/${repositoryRoute(target.owner, target.repo)}/pulls/${target.number}`,
      operation,
      "application/vnd.github+json",
      async (response, signal) => {
        if (!response.ok) {
          throw await responseError(response, operation, signal);
        }
        return remotePullRequest(await withAbort(response.json(), signal));
      },
    );
  }

  async listPullRequestFilesPage(
    target: PullRequestLocator,
    page: number,
    perPage: 100,
  ): Promise<RemotePullFile[]> {
    const operation = `List files for ${target.owner}/${target.repo}#${target.number} page ${page}`;
    return this.#request(
      `/repos/${repositoryRoute(target.owner, target.repo)}/pulls/${target.number}/files?per_page=${perPage}&page=${page}`,
      operation,
      "application/vnd.github+json",
      async (response, signal) => {
        if (!response.ok) {
          throw await responseError(response, operation, signal);
        }
        const body: unknown = await withAbort(response.json(), signal);
        if (!Array.isArray(body)) {
          throw invalidResponse("pull request files response was not an array");
        }
        return body.map(remotePullFile);
      },
    );
  }

  async getTextFile(
    targetRepository: RemoteRepository,
    path: string,
    sha: string,
  ): Promise<TextFileResult> {
    const operation = `Read ${targetRepository.owner}/${targetRepository.repo}:${path}@${sha}`;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return this.#request(
      `/repos/${repositoryRoute(targetRepository.owner, targetRepository.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(sha)}`,
      operation,
      "application/vnd.github.raw+json",
      async (response, signal) => {
        if (response.status === 404) {
          return { kind: "not-found" };
        }
        if (!response.ok) {
          throw await responseError(response, operation, signal);
        }
        const contentLength = headerNumber(response.headers, "content-length");
        if (contentLength !== undefined && contentLength > MAX_TEXT_FILE_BYTES) {
          void response.body
            ?.cancel("MergeWarden content-length limit exceeded.")
            .catch(() => undefined);
          throw new GitHubApiError(
            `${operation}: content-length ${contentLength} bytes exceeds the ${MAX_TEXT_FILE_BYTES}-byte analysis limit.`,
            { retryable: false },
          );
        }
        return {
          kind: "found",
          text: await readTextCapped(response, MAX_TEXT_FILE_BYTES + 1, signal),
        };
      },
    );
  }
}
