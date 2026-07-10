import { GitHubApiError, toGitHubApiError } from "./errors.js";
import type { RetryOptions } from "./types.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_TOTAL_DELAY_MS = 60_000;
const DEFAULT_DELAYS_MS = [250, 1_000] as const;

interface RetryBudget {
  readonly maxAttempts: number;
  readonly maxTotalDelayMs: number;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly now: () => number;
  spentDelayMs: number;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createRetryBudget(options: RetryOptions | undefined): RetryBudget {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxTotalDelayMs = options?.maxTotalDelayMs ?? DEFAULT_MAX_TOTAL_DELAY_MS;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("retry.maxAttempts must be a positive integer.");
  }

  if (!Number.isFinite(maxTotalDelayMs) || maxTotalDelayMs < 0) {
    throw new Error("retry.maxTotalDelayMs must be a non-negative number.");
  }

  return {
    maxAttempts,
    maxTotalDelayMs,
    sleep: options?.sleep ?? defaultSleep,
    now: options?.now ?? Date.now,
    spentDelayMs: 0,
  };
}

function isRateLimitError(error: GitHubApiError): boolean {
  if (error.status === 429) {
    return true;
  }

  if (error.status !== 403) {
    return false;
  }

  return (
    error.retryAfterMs !== undefined || /rate.?limit|secondary rate|abuse/i.test(error.message)
  );
}

function shouldRetry(error: GitHubApiError): boolean {
  if (error.retryable !== undefined) {
    return error.retryable;
  }

  if (error.status === undefined) {
    return true;
  }

  return isRateLimitError(error) || [502, 503, 504].includes(error.status);
}

function retryDelay(error: GitHubApiError, failedAttempt: number, now: number): number {
  if (error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }

  if (error.rateLimitResetAt !== undefined) {
    return Math.max(0, error.rateLimitResetAt - now);
  }

  return DEFAULT_DELAYS_MS[Math.min(failedAttempt - 1, DEFAULT_DELAYS_MS.length - 1)] ?? 1_000;
}

export async function withGitHubRetry<T>(
  operation: string,
  budget: RetryBudget,
  callback: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= budget.maxAttempts; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      const apiError = toGitHubApiError(error, operation);

      if (!shouldRetry(apiError)) {
        throw apiError;
      }

      if (attempt >= budget.maxAttempts) {
        throw new GitHubApiError(
          `${apiError.message}; retry attempts exhausted after ${attempt} attempts.`,
          {
            status: apiError.status,
            requestId: apiError.requestId,
            retryAfterMs: apiError.retryAfterMs,
            rateLimitResetAt: apiError.rateLimitResetAt,
            retryable: false,
            cause: apiError,
          },
        );
      }

      const delayMs = retryDelay(apiError, attempt, budget.now());

      if (budget.spentDelayMs + delayMs > budget.maxTotalDelayMs) {
        throw new GitHubApiError(
          `${apiError.message}; retry delay ${delayMs}ms exceeds the ${budget.maxTotalDelayMs}ms total retry budget.`,
          {
            status: apiError.status,
            requestId: apiError.requestId,
            retryAfterMs: apiError.retryAfterMs,
            rateLimitResetAt: apiError.rateLimitResetAt,
            retryable: false,
            cause: apiError,
          },
        );
      }

      budget.spentDelayMs += delayMs;
      await budget.sleep(delayMs);
    }
  }

  throw new Error(`Unreachable retry state for ${operation}.`);
}
