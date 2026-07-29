import type { RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

/**
 * Triage rules answer one question: is there something here a maintainer normally checks by
 * hand before spending review time?
 *
 * Every rule in this file reports a **fact about the pull request**, never a judgement about
 * its quality. "No linked issue" is checkable and arguable; "low effort" is neither. That line
 * is the whole design: tools that score contributors on guessed signals end up closing real
 * contributions because a username contained two digits, and they cannot be argued with because
 * there is nothing to check.
 *
 * All of these default to `info`, so none of them moves the decision.
 */

const ISSUE_REFERENCE = /(^|[^\w`])#\d+\b/;
const CLOSING_KEYWORD =
  /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b\s*:?\s*(#\d+|https?:\/\/\S*\/issues\/\d+)/i;
const ISSUE_URL = /https?:\/\/\S*\/issues\/\d+/;

/** Removes HTML comments and Markdown headings so that leftover template text is not read as prose. */
function proseOf(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/^#{1,6}\s.*$/gm, " ")
    .replace(/^\s*[-*]\s*\[[ xX]\]\s*/gm, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type TriageConfig = RuleContext["input"]["config"]["triage"];
type TriageSeverityKey = {
  [K in keyof TriageConfig]: TriageConfig[K] extends string ? K : never;
}[keyof TriageConfig];

function severityOf(ctx: RuleContext, key: TriageSeverityKey): TriageConfig[TriageSeverityKey] {
  return ctx.input.config.triage[key];
}

export const triageNoLinkedIssueRule: Rule = {
  id: "triage/no-linked-issue",
  title: "No linked issue",
  run(ctx) {
    const severity = severityOf(ctx, "no_linked_issue");

    if (severity === "off") {
      return [];
    }

    const body = ctx.input.pr.body ?? "";

    if (CLOSING_KEYWORD.test(body) || ISSUE_REFERENCE.test(body) || ISSUE_URL.test(body)) {
      return [];
    }

    return [
      {
        ruleId: "triage/no-linked-issue",
        severity,
        title: "No linked issue",
        message: "The pull request body references no issue.",
        evidence: [
          { label: "body_length", value: String(body.length) },
          { label: "checked_for", value: "#number, issue URL, or a closing keyword" },
        ],
        remediation: [
          "If this change was discussed first, add the issue reference. If it was not, that is what this finding records.",
        ],
        tags: ["triage"],
        confidence: "high",
      },
    ];
  },
};

export const triageEmptyDescriptionRule: Rule = {
  id: "triage/empty-description",
  title: "Pull request describes itself in almost nothing",
  run(ctx) {
    const severity = severityOf(ctx, "empty_description");

    if (severity === "off") {
      return [];
    }

    const body = ctx.input.pr.body ?? "";
    const prose = proseOf(body);
    const threshold = ctx.input.config.triage.min_description_characters;

    if (prose.length >= threshold) {
      return [];
    }

    return [
      {
        ruleId: "triage/empty-description",
        severity,
        title: "Pull request describes itself in almost nothing",
        message: `The body carries ${prose.length} character(s) of prose, below the configured ${threshold}.`,
        evidence: [
          { label: "prose_characters", value: String(prose.length) },
          { label: "raw_characters", value: String(body.length) },
          { label: "threshold", value: String(threshold) },
          { label: "counted", value: "template comments, headings and checkboxes excluded" },
        ],
        remediation: ["Describe what the change does and how it was verified."],
        tags: ["triage"],
        confidence: "high",
      },
    ];
  },
};

export const triageTemplateUnusedRule: Rule = {
  id: "triage/template-unused",
  title: "Pull request template not followed",
  run(ctx) {
    const severity = severityOf(ctx, "template_unused");
    const template = ctx.input.repoDocs?.pullRequestTemplate;

    // `undefined` means the collector never established whether a template exists; `null` means
    // it confirmed there is none. Only the second is a fact, and neither is a finding.
    if (severity === "off" || template === undefined || template === null) {
      return [];
    }

    // Headings inside an HTML comment are instructions to the contributor, not sections the
    // contributor is meant to keep. Next.js's template is entirely comment — counting those
    // headings would report every pull request in the repository as ignoring the template.
    const visible = template.replace(/<!--[\s\S]*?-->/g, " ");
    const headings = [...visible.matchAll(/^#{1,6}\s*(.+?)\s*$/gm)]
      .map((match) => (match[1] ?? "").trim())
      .filter((heading) => heading.length > 0);

    // A template with no visible headings asks for no structure, so there is nothing to check.
    if (headings.length === 0) {
      return [];
    }

    const body = (ctx.input.pr.body ?? "").toLowerCase();
    const missing = headings.filter((heading) => !body.includes(heading.toLowerCase()));

    // A partially filled template is normal. Only a body that kept none of the structure is
    // evidence the template was replaced rather than completed.
    if (missing.length < headings.length) {
      return [];
    }

    return [
      {
        ruleId: "triage/template-unused",
        severity,
        title: "Pull request template not followed",
        message: `The repository ships a pull request template with ${headings.length} section(s); the body keeps none of them.`,
        evidence: [
          { label: "template_sections", value: headings.slice(0, 8).join(", ") },
          { label: "sections_present_in_body", value: "0" },
        ],
        remediation: [
          "Fill in the template rather than replacing it, so reviewers find the sections where they expect them.",
        ],
        tags: ["triage"],
        confidence: "medium",
      },
    ];
  },
};

export const triageOversizedChangeRule: Rule = {
  id: "triage/oversized-change",
  title: "Change is larger than the review threshold",
  run(ctx) {
    const severity = severityOf(ctx, "oversized_change");

    if (severity === "off") {
      return [];
    }

    const { filesChanged, additions, deletions } = ctx.input.changes.totals;
    const lines = additions + deletions;
    const maxFiles = ctx.input.config.triage.max_files;
    const maxLines = ctx.input.config.triage.max_lines;
    const overFiles = filesChanged > maxFiles;
    const overLines = lines > maxLines;

    if (!overFiles && !overLines) {
      return [];
    }

    const exceeded = [
      overFiles ? `${filesChanged} files (limit ${maxFiles})` : undefined,
      overLines ? `${lines} lines (limit ${maxLines})` : undefined,
    ].filter((part): part is string => part !== undefined);

    return [
      {
        ruleId: "triage/oversized-change",
        severity,
        title: "Change is larger than the review threshold",
        message: `The change exceeds the configured review size: ${exceeded.join(" and ")}.`,
        evidence: [
          { label: "files_changed", value: String(filesChanged) },
          { label: "lines_changed", value: String(lines) },
          { label: "limits", value: `${maxFiles} files, ${maxLines} lines` },
        ],
        remediation: [
          "Large changes are not wrong. This records that the change is past the size this repository chose to review in one pass.",
        ],
        tags: ["triage"],
        confidence: "high",
      },
    ];
  },
};

const UNVERIFIED_ASSOCIATIONS = new Set(["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]);

export const triageUnverifiedAuthorRule: Rule = {
  id: "triage/unverified-author",
  title: "Author has not landed a change here before",
  run(ctx) {
    const severity = severityOf(ctx, "unverified_author");
    const association = ctx.input.pr.authorAssociation;

    if (severity === "off" || association === undefined) {
      return [];
    }

    if (!UNVERIFIED_ASSOCIATIONS.has(association.toUpperCase())) {
      return [];
    }

    return [
      {
        ruleId: "triage/unverified-author",
        severity,
        title: "Author has not landed a change here before",
        message: `GitHub reports the author's association with this repository as ${association}.`,
        evidence: [{ label: "author_association", value: association }],
        remediation: [
          "This is context, not a problem. A first contribution is how every contributor starts; it is recorded because it is the case where the other findings on this pull request matter most.",
        ],
        tags: ["triage"],
        confidence: "high",
      },
    ];
  },
};

export const triageRules: Rule[] = [
  triageNoLinkedIssueRule,
  triageEmptyDescriptionRule,
  triageTemplateUnusedRule,
  triageOversizedChangeRule,
  triageUnverifiedAuthorRule,
];

export function collectTriageFindings(findings: RawFinding[]): RawFinding[] {
  return findings.filter((finding) => finding.ruleId.startsWith("triage/"));
}
