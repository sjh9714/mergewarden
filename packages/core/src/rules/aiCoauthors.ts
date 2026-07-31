/**
 * Identities that coding tools write into `Co-authored-by:` trailers.
 *
 * Every entry was observed in real merged history rather than taken from vendor documentation:
 * a scan of 1,029 repositories (674 from the agent-PR corpus plus a 355-repository sample
 * balanced across eight languages) found 124 distinct addresses, and these are the ones that
 * could be attributed to a tool with certainty. Counts are commits carrying the address.
 *
 * | Address                                                     | Tool           | Observed |
 * | ----------------------------------------------------------- | -------------- | -------- |
 * | `noreply@anthropic.com`                                     | Claude Code    | 198,954  |
 * | `cursoragent@cursor.com`                                    | Cursor         |  17,174  |
 * | `<id>+copilot@users.noreply.github.com`                     | GitHub Copilot |  38,530  |
 * | `copilot@github.com`                                        | GitHub Copilot |   2,189  |
 * | `<id>+devin-ai-integration[bot]@users.noreply.github.com`   | Devin          |   7,577  |
 * | `<id>+google-labs-jules[bot]@users.noreply.github.com`      | Google Jules   |     201  |
 * | `codex@openai.com`                                          | Codex          |   1,295  |
 *
 * Matching is on the address, never the display name: the name is free text, and the same tool
 * writes `Claude`, `Claude Opus 4.8` and `Claude Opus 4.8 (1M context)` across commits.
 *
 * Matching is also never on the domain. `mdangelo@openai.com` and `etraut@openai.com` appear in
 * this data and belong to people who work at OpenAI, so an `@openai.com` rule would report human
 * co-authors as AI. The numeric-prefix forms are GitHub's no-reply addresses for a named bot
 * account, so the account login has to match too — a bare `users.noreply.github.com` test would
 * match every GitHub user on the platform.
 */
export interface AiCoauthorIdentity {
  readonly tool: string;
  readonly match: (email: string) => boolean;
}

function githubBotAddress(login: string): (email: string) => boolean {
  const suffix = `+${login.toLowerCase()}@users.noreply.github.com`;
  return (email) => {
    if (!email.endsWith(suffix)) {
      return false;
    }
    const prefix = email.slice(0, email.length - suffix.length);
    return prefix.length > 0 && /^\d+$/.test(prefix);
  };
}

function exactAddress(address: string): (email: string) => boolean {
  const normalized = address.toLowerCase();
  return (email) => email === normalized;
}

export const AI_COAUTHOR_IDENTITIES: readonly AiCoauthorIdentity[] = [
  { tool: "Claude Code", match: exactAddress("noreply@anthropic.com") },
  { tool: "Cursor", match: exactAddress("cursoragent@cursor.com") },
  { tool: "GitHub Copilot", match: exactAddress("copilot@github.com") },
  { tool: "GitHub Copilot", match: githubBotAddress("copilot") },
  { tool: "Devin", match: githubBotAddress("devin-ai-integration[bot]") },
  { tool: "Google Jules", match: githubBotAddress("google-labs-jules[bot]") },
  { tool: "Codex", match: exactAddress("codex@openai.com") },
];

const ADDRESS = /<([^>]+)>\s*$/;

/**
 * Returns the tool named by a `Co-authored-by:` value, or undefined when the co-author is a
 * person. The value is the part after the colon, e.g. `Claude Opus 4.8 <noreply@anthropic.com>`.
 */
export function aiCoauthorTool(trailerValue: string): string | undefined {
  const match = ADDRESS.exec(trailerValue.trim());

  if (!match) {
    return undefined;
  }

  const email = (match[1] ?? "").trim().toLowerCase();

  for (const identity of AI_COAUTHOR_IDENTITIES) {
    if (identity.match(email)) {
      return identity.tool;
    }
  }

  return undefined;
}

/**
 * The display name a tool wrote, when it carries more than the tool name — Claude Code records
 * the model, which is the granularity Mesa's policy asks for and which nothing else supplies.
 */
export function coauthorDisplayName(trailerValue: string): string | undefined {
  const trimmed = trailerValue.trim();
  const index = trimmed.lastIndexOf("<");
  const name = index === -1 ? "" : trimmed.slice(0, index).trim();
  return name.length > 0 ? name : undefined;
}
