interface ErrorResponseLike {
  status?: unknown;
  headers?: unknown;
  data?: { message?: unknown };
}

interface ErrorLike {
  message?: unknown;
  status?: unknown;
  requestId?: unknown;
  response?: ErrorResponseLike;
}

export interface GitHubApiErrorOptions {
  status?: number;
  requestId?: string;
  retryAfterMs?: number;
  rateLimitResetAt?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class GitHubApiError extends Error {
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  readonly rateLimitResetAt?: number;
  readonly retryable?: boolean;

  constructor(message: string, options: GitHubApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "GitHubApiError";
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
    this.rateLimitResetAt = options.rateLimitResetAt;
    this.retryable = options.retryable;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function header(headers: unknown, name: string): string | undefined {
  const values = record(headers);

  if (!values) {
    return undefined;
  }

  const matchingKey = Object.keys(values).find((key) => key.toLowerCase() === name.toLowerCase());
  const value = matchingKey ? values[matchingKey] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function toGitHubApiError(error: unknown, operation: string): GitHubApiError {
  if (error instanceof GitHubApiError) {
    return error;
  }

  const candidate = (record(error) ?? {}) as ErrorLike;
  const response = record(candidate.response) as ErrorResponseLike | undefined;
  const statusValue = candidate.status ?? response?.status;
  const status = typeof statusValue === "number" ? statusValue : undefined;
  const headers = response?.headers;
  const requestId =
    (typeof candidate.requestId === "string" ? candidate.requestId : undefined) ??
    header(headers, "x-github-request-id");
  const retryAfterSeconds = positiveNumber(header(headers, "retry-after"));
  const resetSeconds = positiveNumber(header(headers, "x-ratelimit-reset"));
  const responseMessage = response?.data?.message;
  const originalMessage =
    typeof candidate.message === "string"
      ? candidate.message
      : typeof responseMessage === "string"
        ? responseMessage
        : String(error);

  return new GitHubApiError(`${operation}: ${originalMessage}`, {
    status,
    requestId,
    retryAfterMs: retryAfterSeconds === undefined ? undefined : retryAfterSeconds * 1_000,
    rateLimitResetAt: resetSeconds === undefined ? undefined : resetSeconds * 1_000,
    cause: error,
  });
}

export function describeGitHubApiError(error: unknown): string {
  const apiError = error instanceof GitHubApiError ? error : toGitHubApiError(error, "GitHub API");
  const details = [apiError.message];

  if (apiError.status !== undefined) {
    details.push(`status=${apiError.status}`);
  }

  if (apiError.requestId) {
    details.push(`request_id=${apiError.requestId}`);
  }

  if (apiError.retryAfterMs !== undefined) {
    details.push(`retry_after_ms=${apiError.retryAfterMs}`);
  }

  if (apiError.rateLimitResetAt !== undefined) {
    details.push(`rate_limit_reset_at=${apiError.rateLimitResetAt}`);
  }

  if (apiError.retryable !== undefined) {
    details.push(`retryable=${apiError.retryable}`);
  }

  return details.join("; ");
}
