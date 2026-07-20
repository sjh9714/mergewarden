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
  ".cursor/**",
  ".github/copilot-instructions.md",
  ".mcp.json",
  "claude_desktop_config.json",
  ".codex/**",
];

export const DEFAULT_PACKAGE_SCRIPT_PATHS = ["package.json", "**/package.json"];
export const DEFAULT_LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

const SeveritySettingSchema = z.enum(["warn", "error"]);
const CheckSettingSchema = z.enum(["off", "warn", "error"]);

const AgentDetectionSchema = z
  .object({
    authors: z.array(NonEmptyStringSchema).default([]),
    labels: z.array(NonEmptyStringSchema).default([]),
    branch_patterns: z.array(NonEmptyStringSchema).default([]),
    body_patterns: z.array(NonEmptyStringSchema).default([]),
  })
  .strict();

const ContractConfigSchema = z
  .object({
    required_for: z.array(z.enum(["agent", "all"])).default(["agent"]),
    allow_missing_in_observe_mode: z.boolean().default(true),
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
      authors: [],
      labels: [],
      branch_patterns: [],
      body_patterns: [],
    }),
    contract: ContractConfigSchema.default({
      required_for: ["agent"],
      allow_missing_in_observe_mode: true,
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
