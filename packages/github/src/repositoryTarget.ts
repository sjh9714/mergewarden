import { TargetParseError } from "./target.js";
import type { RepositoryLocator } from "./types.js";

const SHORTHAND_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

export function parseRepositoryTarget(value: string): RepositoryLocator {
  const shorthand = SHORTHAND_PATTERN.exec(value);

  if (shorthand?.[1] && shorthand[2]) {
    return { owner: shorthand[1], repo: shorthand[2] };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TargetParseError(
      "Repository must be OWNER/REPOSITORY or a full GitHub repository URL.",
    );
  }

  if (url.protocol !== "https:" || !GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new TargetParseError("Only https://github.com repository URLs are supported.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new TargetParseError(
      "GitHub repository URLs must not include credentials, query, or fragment data.",
    );
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const owner = parts[0];
  const repo = parts[1]?.replace(/\.git$/, "");

  if (
    parts.length !== 2 ||
    !owner ||
    !repo ||
    !NAME_PATTERN.test(owner) ||
    !NAME_PATTERN.test(repo)
  ) {
    throw new TargetParseError(
      "GitHub URL must have the form https://github.com/OWNER/REPOSITORY.",
    );
  }

  return { owner, repo };
}
