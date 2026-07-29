import { z } from "zod";

import { NonEmptyStringSchema } from "../validation/schemas.js";

export const CONFIG_FILE_NAME = "mergewarden.yml";

export const DEFAULT_AGENT_CONTROL_PLANE_PATHS = [
  "AGENTS.md",
  "**/AGENTS.md",
  "AGENTS.override.md",
  "**/AGENTS.override.md",
  "CLAUDE.md",
  "**/CLAUDE.md",
  "GEMINI.md",
  "**/GEMINI.md",
  "QWEN.md",
  "**/QWEN.md",
  ".cursor/**",
  ".gemini/**",
  ".github/copilot-instructions.md",
  ".mcp.json",
  "claude_desktop_config.json",
  ".codex/**",
];

export const DEFAULT_PACKAGE_SCRIPT_PATHS = ["package.json", "**/package.json"];
export const DEFAULT_LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

/**
 * Bot accounts that coding agents really use to open pull requests.
 *
 * Every entry was verified individually by reading an actual pull request that account opened,
 * not taken from a vendor's documentation, and the public pull-request counts below were
 * measured on 2026-07-29 via `is:pr author:<account>`:
 *
 *   copilot-swe-agent[bot]      2,020,056   GitHub Copilot coding agent
 *   google-labs-jules[bot]        319,715   Google Jules
 *   devin-ai-integration[bot]     209,483   Devin
 *   kiro-agent[bot]                21,383   AWS Kiro
 *   codegen-sh[bot]                 7,968   Codegen
 *   opencode-agent[bot]             6,696   OpenCode
 *   tembo[bot]                      3,465   Tembo
 *   amazon-q-developer[bot]         2,263   Amazon Q Developer
 *   mentatbot[bot]                  2,184   Mentat
 *   factory-droid[bot]                604   Factory Droid
 *   ellipsis-dev[bot]                 396   Ellipsis
 *
 * The first two entries were the whole list until v0.7.0, which missed roughly 364,000 pull
 * requests of coverage — Google Jules alone opens more than Devin does. That gap was found by
 * checking whether pull requests the engine had classed as human really were human; see
 * docs/study/what-a-zero-config-install-reports.md.
 *
 * Author matching is exact and case-insensitive against a bot account name, so unlike a branch
 * glob it carries no false-positive risk, which is why low-volume agents are worth listing too.
 *
 * Deliberately excluded: dependabot, renovate, github-actions and similar automation. They open
 * pull requests but they are not coding agents working from a task description, and treating
 * them as such would demand a scope contract from a version bump.
 *
 * Review bots (CodeRabbit, Qodo, Greptile and the like) are excluded for a different reason:
 * they comment on pull requests rather than authoring them, so they never appear as an author.
 */
export const DEFAULT_AGENT_AUTHORS = [
  "copilot-swe-agent[bot]",
  "google-labs-jules[bot]",
  "devin-ai-integration[bot]",
  "kiro-agent[bot]",
  "codegen-sh[bot]",
  "opencode-agent[bot]",
  "tembo[bot]",
  "amazon-q-developer[bot]",
  "mentatbot[bot]",
  "factory-droid[bot]",
  "ellipsis-dev[bot]",
];
/**
 * Branch prefixes agents create when they run under a *human* account.
 *
 * This list stays short on purpose. The bot-authored agents above are matched by author, which
 * is exact; adding their branch prefixes as well would buy nothing and widen the surface for
 * false positives. These five are the agents that commonly run on a developer's own machine and
 * push to an ordinary remote, where the branch name is the only structural signal.
 *
 * `agent/**` was considered and rejected: it appears on human pull requests about agent features
 * as readily as on agent-authored ones, and this project's own branches would trip it.
 */
export const DEFAULT_AGENT_BRANCH_PATTERNS = [
  "codex/**",
  "claude/**",
  "cursor/**",
  "copilot/**",
  "devin/**",
];
/**
 * Body markers are matched as case-insensitive substrings, so they have to be the literal
 * text an agent really writes.
 *
 * Claude Code's footer is `🤖 Generated with [Claude Code](https://claude.com/claude-code)` —
 * the product name sits inside a Markdown link, so the plain string "Generated with Claude
 * Code" never occurs in a real pull-request body. It was the default until v0.5.1 and matched
 * 0 of 13 sampled Claude Code pull requests from the scan study; the bracketed form matches 12
 * of the same 13 (the remaining one had its footer edited out before merge). The plain form is
 * kept as a cheap fallback in case the footer is ever emitted without the link.
 *
 * The body marker matters more than it looks: Codex, Cursor, Copilot and Devin pull requests
 * are identified by branch or author, but Claude Code usually runs on a developer's own machine
 * and pushes to an ordinary branch name, so the footer is frequently the only signal there is.
 */
export const DEFAULT_AGENT_BODY_PATTERNS = [
  "Generated with [Claude Code]",
  "Generated with Claude Code",
];

const SeveritySettingSchema = z.enum(["warn", "error"]);

/**
 * Severity for `contract/missing` only.
 *
 * This is the one rule that can sensibly be `info`, so it gets its own enum rather than
 * widening `SeveritySettingSchema` — every other rule fires on something a pull request did,
 * and none of them should be able to declare itself informational.
 */
const ContractMissingSeveritySchema = z.enum(["info", "warn", "error"]);
const CheckSettingSchema = z.enum(["off", "warn", "error"]);

const AgentDetectionSchema = z
  .object({
    authors: z.array(NonEmptyStringSchema).default(DEFAULT_AGENT_AUTHORS),
    labels: z.array(NonEmptyStringSchema).default([]),
    branch_patterns: z.array(NonEmptyStringSchema).default(DEFAULT_AGENT_BRANCH_PATTERNS),
    body_patterns: z.array(NonEmptyStringSchema).default(DEFAULT_AGENT_BODY_PATTERNS),
  })
  .strict();

const ContractConfigSchema = z
  .object({
    required_for: z.array(z.enum(["agent", "all"])).default(["agent"]),
    allow_missing_in_observe_mode: z.boolean().default(true),
    /**
     * Severity of `contract/missing` only — not of the other contract rules.
     *
     * Defaults to `info`, which is the end of a line this project has walked twice. v0.6.0
     * stopped this rule from *blocking*, because the scan study found 0 of 2,204 merged agent
     * pull requests declaring a scope and an `error` default would have rejected essentially
     * every agent pull request on the day `mode: block` was switched on. v0.9.0 stops it
     * *warning* for the same reason taken one step further: a rule that fires on 100% of a
     * population, for the absence of a convention nobody has adopted, carries no information.
     * Reported on every routine pull request it trains maintainers to ignore the comment, and
     * the findings that matter — permission escalation, control-plane drift — go with it.
     *
     * The principle is the one v0.6.0 established: speak about what a pull request did, not
     * about a convention it did not follow. A repository that actually asks contributors for a
     * declared scope opts in with `warn` or `error`.
     *
     * `contract/invalid`, `contract/out-of-scope` and `contract/blocked-path` stay `error`:
     * each of those fires on something the pull request actually did against its own
     * declaration.
     */
    missing_severity: ContractMissingSeveritySchema.default("info"),
  })
  .strict();

const HighRiskPathAreaSchema = z
  .object({
    paths: z.array(NonEmptyStringSchema).min(1),
    require_tests: z.array(NonEmptyStringSchema).default([]),
    severity: SeveritySettingSchema.default("error"),
  })
  .strict();

const AgentControlPlaneSchema = z
  .object({
    paths: z.array(NonEmptyStringSchema).default(DEFAULT_AGENT_CONTROL_PLANE_PATHS),
    severity: SeveritySettingSchema.default("error"),
  })
  .strict();

export const DEFAULT_GITHUB_ACTION_CHECKS = {
  permission_escalation: "error",
  write_all: "error",
  id_token_write: "warn",
  pull_request_target_head: "error",
  unpinned_action: "warn",
  unpinned_reusable_workflow: "warn",
  unpinned_container: "warn",
  missing_permissions: "warn",
  unknown_write_permission: "warn",
  added_secret_reference: "warn",
  workflow_deleted: "warn",
  malformed_workflow: "error",
  /**
   * A workflow that stops firing on an event it used to fire on.
   *
   * GitHub's own review guidance treats weakening CI as a blocker outright ("Confirm workflow
   * still runs on forks and pull requests"), but that instruction is aimed at a human deciding
   * one case. As a machine default `warn` is the honest setting: consolidating workflows and
   * retiring a `schedule` are ordinary, and the artifact cannot tell those apart from a pull
   * request quietly removing the check that would have gated it. Teams that want it enforced
   * set this to `error`.
   */
  trigger_removed: "warn",
} as const;

const GitHubActionsChecksSchema = z
  .object({
    permission_escalation: CheckSettingSchema.default(
      DEFAULT_GITHUB_ACTION_CHECKS.permission_escalation,
    ),
    write_all: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.write_all),
    id_token_write: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.id_token_write),
    pull_request_target_head: CheckSettingSchema.default(
      DEFAULT_GITHUB_ACTION_CHECKS.pull_request_target_head,
    ),
    unpinned_action: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.unpinned_action),
    unpinned_reusable_workflow: CheckSettingSchema.default(
      DEFAULT_GITHUB_ACTION_CHECKS.unpinned_reusable_workflow,
    ),
    unpinned_container: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.unpinned_container),
    missing_permissions: CheckSettingSchema.default(
      DEFAULT_GITHUB_ACTION_CHECKS.missing_permissions,
    ),
    unknown_write_permission: CheckSettingSchema.default(
      DEFAULT_GITHUB_ACTION_CHECKS.unknown_write_permission,
    ),
    added_secret_reference: CheckSettingSchema.default(
      DEFAULT_GITHUB_ACTION_CHECKS.added_secret_reference,
    ),
    workflow_deleted: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.workflow_deleted),
    malformed_workflow: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.malformed_workflow),
    trigger_removed: CheckSettingSchema.default(DEFAULT_GITHUB_ACTION_CHECKS.trigger_removed),
  })
  .strict();

function legacyChecks(config: {
  block_permission_escalation: boolean;
  block_pull_request_target_checkout: boolean;
  require_pinned_actions: "off" | "warn" | "error";
  severity: "warn" | "error";
}) {
  return GitHubActionsChecksSchema.parse({
    ...DEFAULT_GITHUB_ACTION_CHECKS,
    permission_escalation: config.block_permission_escalation ? config.severity : "off",
    write_all: config.severity,
    id_token_write: config.severity,
    pull_request_target_head: config.block_pull_request_target_checkout ? config.severity : "off",
    unpinned_action: config.require_pinned_actions,
    unpinned_reusable_workflow: config.require_pinned_actions,
    unpinned_container: config.require_pinned_actions,
    malformed_workflow: config.severity,
    trigger_removed: DEFAULT_GITHUB_ACTION_CHECKS.trigger_removed,
  });
}

function hasLegacyAndGranularChecks(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Object.hasOwn(record, "checks") &&
    [
      "block_permission_escalation",
      "block_pull_request_target_checkout",
      "require_pinned_actions",
      "severity",
    ].some((key) => Object.hasOwn(record, key))
  );
}

const GitHubActionsConfigObjectSchema = z
  .object({
    paths: z
      .array(NonEmptyStringSchema)
      .default([".github/workflows/*.yml", ".github/workflows/*.yaml"]),
    block_permission_escalation: z.boolean().default(true),
    block_pull_request_target_checkout: z.boolean().default(true),
    require_pinned_actions: z.enum(["off", "warn", "error"]).default("warn"),
    severity: SeveritySettingSchema.default("error"),
    checks: GitHubActionsChecksSchema.optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    checks: value.checks ?? legacyChecks(value),
  }));

const GitHubActionsConfigSchema = z.preprocess((value) => {
  if (!hasLegacyAndGranularChecks(value)) {
    return value;
  }

  return {
    ...(value as Record<string, unknown>),
    __legacy_checks_mixing_is_not_allowed: true,
  };
}, GitHubActionsConfigObjectSchema);

const WaiverSchema = z
  .object({
    finding_id: z.string().regex(/^agf_[0-9a-f]{16}$/),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(
        (value) =>
          [...value].every((character) => {
            const codePoint = character.codePointAt(0) ?? 0;
            return (
              codePoint > 31 &&
              !(codePoint >= 127 && codePoint <= 159) &&
              !(codePoint >= 0x202a && codePoint <= 0x202e) &&
              !(codePoint >= 0x2066 && codePoint <= 0x2069)
            );
          }),
        {
          message: "waiver reason must not contain control characters",
        },
      ),
    expires_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const AgenticActionSchema = z
  .object({
    uses: NonEmptyStringSchema,
    prompt_inputs: z.array(NonEmptyStringSchema).min(1),
  })
  .strict();

const AgenticWorkflowsSchema = z
  .object({
    enabled: z.boolean().default(true),
    severity: SeveritySettingSchema.default("warn"),
    privileged_severity: SeveritySettingSchema.default("error"),
    additional_actions: z.array(AgenticActionSchema).default([]),
  })
  .strict();

const CommitTrailerRequirementSchema = z
  .object({
    any_of: z.array(NonEmptyStringSchema).min(1),
    applies_to: z.enum(["agent", "all"]).default("agent"),
    severity: SeveritySettingSchema.default("warn"),
  })
  .strict();

const CommitTrailerProhibitionSchema = z
  .object({
    name: NonEmptyStringSchema,
    value_patterns: z.array(NonEmptyStringSchema).default([]),
    severity: SeveritySettingSchema.default("error"),
  })
  .strict();

/**
 * Severity for `commit/ai-assistance-disclosed`, plus `off`.
 *
 * `info` by default: the rule records a disclosure a tool wrote about itself, not something the
 * pull request did wrong, so it must not move the decision. Repositories whose policy requires
 * disclosure can raise it; `off` removes it entirely.
 */
const AiDisclosureSettingSchema = z.enum(["off", "info", "warn", "error"]);

/**
 * Severity for a triage rule, plus `off`.
 *
 * `info` throughout by default. Triage rules report a fact a maintainer would otherwise check
 * by hand — they do not judge the change, and they must not move the decision until a
 * repository decides one of them should.
 */
const TriageSettingSchema = z.enum(["off", "info", "warn", "error"]);

const TriageConfigSchema = z
  .object({
    // `off` by default, unlike its siblings. Most pull requests in most repositories reference
    // no issue, so at `info` this rule would attach a finding to nearly every report — the
    // noise v0.9.0 removed. It is what `mergewarden triage` turns on to rank many open pull
    // requests against each other, which is a different question from gating one of them.
    no_linked_issue: TriageSettingSchema.default("off"),
    empty_description: TriageSettingSchema.default("info"),
    template_unused: TriageSettingSchema.default("info"),
    oversized_change: TriageSettingSchema.default("info"),
    // Deliberately `info` and deliberately not raised by default. A first contribution is how
    // every contributor starts, and defaulting it to a warning turns the tool into something
    // that greets newcomers with a complaint.
    unverified_author: TriageSettingSchema.default("info"),
    min_description_characters: z.number().int().min(0).default(80),
    max_files: z.number().int().min(1).default(50),
    max_lines: z.number().int().min(1).default(1500),
  })
  .strict();

const CommitTrailersConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    required: z.array(CommitTrailerRequirementSchema).default([]),
    forbidden: z.array(CommitTrailerProhibitionSchema).default([]),
    ai_disclosure: AiDisclosureSettingSchema.default("info"),
  })
  .strict();

const PackageScriptsConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    paths: z.array(NonEmptyStringSchema).default(DEFAULT_PACKAGE_SCRIPT_PATHS),
    lifecycle_scripts: z.array(NonEmptyStringSchema).default(DEFAULT_LIFECYCLE_SCRIPTS),
    severity: SeveritySettingSchema.default("warn"),
  })
  .strict();

export const MergeWardenConfigSchema = z
  .object({
    version: z.literal(1),
    mode: z.enum(["observe", "warn", "block"]).default("warn"),
    agent_detection: AgentDetectionSchema.default({
      authors: DEFAULT_AGENT_AUTHORS,
      labels: [],
      branch_patterns: DEFAULT_AGENT_BRANCH_PATTERNS,
      body_patterns: DEFAULT_AGENT_BODY_PATTERNS,
    }),
    contract: ContractConfigSchema.default({
      required_for: ["agent"],
      allow_missing_in_observe_mode: true,
      missing_severity: "info",
    }),
    high_risk_paths: z.record(z.string(), HighRiskPathAreaSchema).default({}),
    agent_control_plane: AgentControlPlaneSchema.default({
      paths: DEFAULT_AGENT_CONTROL_PLANE_PATHS,
      severity: "error",
    }),
    github_actions: GitHubActionsConfigSchema.default({
      paths: [".github/workflows/*.yml", ".github/workflows/*.yaml"],
      block_permission_escalation: true,
      block_pull_request_target_checkout: true,
      require_pinned_actions: "warn",
      severity: "error",
      checks: { ...DEFAULT_GITHUB_ACTION_CHECKS },
    }),
    agentic_workflows: AgenticWorkflowsSchema.default({
      enabled: true,
      severity: "warn",
      privileged_severity: "error",
      additional_actions: [],
    }),
    waivers: z.array(WaiverSchema).default([]),
    package_scripts: PackageScriptsConfigSchema.default({
      enabled: true,
      paths: DEFAULT_PACKAGE_SCRIPT_PATHS,
      lifecycle_scripts: DEFAULT_LIFECYCLE_SCRIPTS,
      severity: "warn",
    }),
    triage: TriageConfigSchema.default({
      no_linked_issue: "off",
      empty_description: "info",
      template_unused: "info",
      oversized_change: "info",
      unverified_author: "info",
      min_description_characters: 80,
      max_files: 50,
      max_lines: 1500,
    }),
    commit_trailers: CommitTrailersConfigSchema.default({
      enabled: true,
      required: [],
      forbidden: [],
      ai_disclosure: "info",
    }),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    for (const [index, waiver] of value.waivers.entries()) {
      if (seen.has(waiver.finding_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["waivers", index, "finding_id"],
          message: `duplicate waiver for ${waiver.finding_id}`,
        });
      }

      seen.add(waiver.finding_id);
    }
  });

export type MergeWardenConfig = z.infer<typeof MergeWardenConfigSchema>;
