import type { PullRequestLocator } from "@mergewarden/github";

const SHORTHAND_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([1-9]\d*)$/;
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

export class TargetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TargetParseError";
  }
}

function locator(owner: string, repo: string, numberText: string): PullRequestLocator {
  const number = Number(numberText);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TargetParseError("Pull request number must be a positive integer.");
  }

  return { owner, repo, number };
}

export function parsePullRequestTarget(value: string): PullRequestLocator {
  const shorthand = SHORTHAND_PATTERN.exec(value);

  if (shorthand?.[1] && shorthand[2] && shorthand[3]) {
    return locator(shorthand[1], shorthand[2], shorthand[3]);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TargetParseError(
      "Pull request must be OWNER/REPOSITORY#NUMBER or a full GitHub pull request URL.",
    );
  }

  if (url.protocol !== "https:" || !GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new TargetParseError("Only https://github.com pull request URLs are supported.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new TargetParseError(
      "GitHub pull request URLs must not include credentials, query, or fragment data.",
    );
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length !== 4 || parts[2] !== "pull" || !parts[0] || !parts[1] || !parts[3]) {
    throw new TargetParseError(
      "GitHub URL must have the form https://github.com/OWNER/REPOSITORY/pull/NUMBER.",
    );
  }

  return locator(parts[0], parts[1].replace(/\.git$/, ""), parts[3]);
}
