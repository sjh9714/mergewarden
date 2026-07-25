import type { CommitContext, RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

export interface CommitTrailer {
  name: string;
  value: string;
}

const TRAILER_LINE = /^([A-Za-z][A-Za-z0-9-]*):[ \t]*(.*)$/;

function shortSha(sha: string): string {
  return sha.length > 12 ? sha.slice(0, 12) : sha;
}

function truncate(value: string, maxLength = 120): string {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3)}...`;
}

/**
 * Parses Git trailers from a commit message.
 *
 * Follows Git's own rule: trailers live in the final paragraph of the message, and that paragraph
 * counts as a trailer block only when every non-blank line in it is a `Key: value` pair (or an
 * indented continuation of one). A commit whose last paragraph is ordinary prose therefore yields
 * no trailers, which is what keeps a sentence like "Fixed by: rewriting the loop" out of the
 * results.
 */
export function parseCommitTrailers(message: string): CommitTrailer[] {
  const lines = message.replace(/\r\n/g, "\n").split("\n");

  let end = lines.length;
  while (end > 0 && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  if (end === 0) {
    return [];
  }

  let start = end;
  while (start > 0 && lines[start - 1]?.trim() !== "") {
    start -= 1;
  }

  // A commit message that is a single paragraph has no trailer block: the subject line is not a
  // trailer, even when it happens to contain a colon.
  if (start === 0) {
    return [];
  }

  const trailers: CommitTrailer[] = [];

  for (const line of lines.slice(start, end)) {
    if (/^[ \t]/.test(line)) {
      const previous = trailers.at(-1);

      if (!previous) {
        return [];
      }

      previous.value = `${previous.value} ${line.trim()}`.trim();
      continue;
    }

    const match = TRAILER_LINE.exec(line);

    if (!match) {
      return [];
    }

    trailers.push({ name: match[1] ?? "", value: (match[2] ?? "").trim() });
  }

  return trailers;
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${escaped}$`, "i");
}

function valueMatchesAny(value: string, patterns: string[]): string | undefined {
  for (const pattern of patterns) {
    if (wildcardToRegExp(pattern).test(value)) {
      return pattern;
    }
  }

  return undefined;
}

function hasTrailer(trailers: CommitTrailer[], name: string): boolean {
  const normalized = name.toLowerCase();
  return trailers.some((trailer) => trailer.name.toLowerCase() === normalized);
}

function presentTrailerNames(trailers: CommitTrailer[]): string {
  if (trailers.length === 0) {
    return "none";
  }

  const unique = [...new Set(trailers.map((trailer) => trailer.name))];
  return unique.join(", ");
}

interface TrailerScope {
  commits: CommitContext[];
  agentDetected: boolean;
}

function scope(ctx: RuleContext): TrailerScope | undefined {
  const config = ctx.input.config.commit_trailers;

  if (!config.enabled) {
    return undefined;
  }

  const commits = ctx.input.commits;

  // Undefined means the collector could not enumerate every commit. A partial list can only
  // under-report, so the rules stay inert rather than assert a conclusion from incomplete evidence.
  if (commits === undefined) {
    return undefined;
  }

  return { commits, agentDetected: ctx.helpers.getAgentOrigin().detected };
}

export const commitTrailerMissingRule: Rule = {
  id: "commit/trailer-missing",
  title: "Required commit trailer missing",
  run(ctx) {
    const active = scope(ctx);

    if (!active) {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const requirement of ctx.input.config.commit_trailers.required) {
      if (requirement.applies_to === "agent" && !active.agentDetected) {
        continue;
      }

      const expected = requirement.any_of.join(" or ");

      for (const commit of active.commits) {
        const trailers = parseCommitTrailers(commit.message);

        if (requirement.any_of.some((name) => hasTrailer(trailers, name))) {
          continue;
        }

        findings.push({
          ruleId: "commit/trailer-missing",
          severity: requirement.severity,
          title: "Required commit trailer missing",
          message: `Commit ${shortSha(commit.sha)} does not carry a ${expected} trailer.`,
          evidence: [
            { label: "commit", value: shortSha(commit.sha) },
            { label: "expected_trailer", value: expected },
            { label: "applies_to", value: requirement.applies_to },
            { label: "present_trailers", value: presentTrailerNames(trailers) },
            { label: "subject", value: truncate(commit.message.split("\n")[0] ?? "") },
          ],
          remediation: [
            `Add a "${requirement.any_of[0]}: <tool>" trailer to the commit message, then force-push the amended commit.`,
          ],
          tags: ["commit-trailer", "disclosure"],
          confidence: "high",
        });
      }
    }

    return findings;
  },
};

export const commitTrailerForbiddenRule: Rule = {
  id: "commit/trailer-forbidden",
  title: "Forbidden commit trailer present",
  run(ctx) {
    const active = scope(ctx);

    if (!active) {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const prohibition of ctx.input.config.commit_trailers.forbidden) {
      const normalized = prohibition.name.toLowerCase();

      for (const commit of active.commits) {
        for (const trailer of parseCommitTrailers(commit.message)) {
          if (trailer.name.toLowerCase() !== normalized) {
            continue;
          }

          const matchedPattern =
            prohibition.value_patterns.length === 0
              ? undefined
              : valueMatchesAny(trailer.value, prohibition.value_patterns);

          if (prohibition.value_patterns.length > 0 && matchedPattern === undefined) {
            continue;
          }

          const evidence = [
            { label: "commit", value: shortSha(commit.sha) },
            { label: "trailer", value: trailer.name },
            { label: "value", value: truncate(trailer.value) },
          ];

          if (matchedPattern !== undefined) {
            evidence.push({ label: "matched_pattern", value: matchedPattern });
          }

          findings.push({
            ruleId: "commit/trailer-forbidden",
            severity: prohibition.severity,
            title: "Forbidden commit trailer present",
            message: `Commit ${shortSha(commit.sha)} carries a ${trailer.name} trailer this repository does not accept.`,
            evidence,
            remediation: [
              `Remove the "${trailer.name}" trailer from the commit message, then force-push the amended commit.`,
            ],
            tags: ["commit-trailer", "attribution"],
            confidence: "high",
          });
        }
      }
    }

    return findings;
  },
};
