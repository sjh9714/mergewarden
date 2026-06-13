import { z } from "zod";

import { NonEmptyStringSchema } from "../validation/schemas.js";

export const CONFIG_FILE_NAME = "agent-gate.yml";

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

const SeveritySettingSchema = z.enum(["warn", "error"]);

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
    sources: z.array(z.enum(["pr_body", "file"])).default(["pr_body"]),
    allow_missing_in_observe_mode: z.boolean().default(true),
  })
  .strict();

const RiskBudgetConfigSchema = z
  .object({
    max_files_changed_for_agent: z.number().int().positive().default(20),
    max_lines_changed_for_agent: z.number().int().positive().default(800),
  })
  .strict();

const HighRiskPathAreaSchema = z
  .object({
    paths: z.array(NonEmptyStringSchema).min(1),
    require_tests: z.array(NonEmptyStringSchema).default([]),
    require_reviewers: z.array(NonEmptyStringSchema).default([]),
    require_rollback_plan: z.boolean().default(false),
    severity: SeveritySettingSchema.default("error"),
  })
  .strict();

const AgentControlPlaneSchema = z
  .object({
    paths: z.array(NonEmptyStringSchema).default(DEFAULT_AGENT_CONTROL_PLANE_PATHS),
    require_reviewers: z.array(NonEmptyStringSchema).default([]),
    severity: SeveritySettingSchema.default("error"),
  })
  .strict();

const GitHubActionsConfigSchema = z
  .object({
    paths: z
      .array(NonEmptyStringSchema)
      .default([".github/workflows/*.yml", ".github/workflows/*.yaml"]),
    block_permission_escalation: z.boolean().default(true),
    block_pull_request_target_checkout: z.boolean().default(true),
    require_pinned_actions: z.enum(["off", "warn", "error"]).default("warn"),
    severity: SeveritySettingSchema.default("error"),
  })
  .strict();

const DependenciesConfigSchema = z
  .object({
    package_managers: z
      .array(z.enum(["npm", "pnpm", "yarn", "bun"]))
      .default(["npm", "pnpm", "yarn"]),
    block_lifecycle_script_changes: z.boolean().default(true),
    require_lockfile_update: z.boolean().default(true),
    severity: SeveritySettingSchema.default("warn"),
  })
  .strict();

const ClaimVsCiEvidenceSchema = z
  .object({
    enabled: z.boolean().default(true),
    phrases: z
      .array(NonEmptyStringSchema)
      .default(["tests passed", "all tests pass", "ci passed", "verified"]),
    required_checks: z.array(NonEmptyStringSchema).default(["test", "lint"]),
  })
  .strict();

const EvidenceConfigSchema = z
  .object({
    claim_vs_ci: ClaimVsCiEvidenceSchema.default({
      enabled: true,
      phrases: ["tests passed", "all tests pass", "ci passed", "verified"],
      required_checks: ["test", "lint"],
    }),
  })
  .strict();

export const AgentGateConfigSchema = z
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
      sources: ["pr_body"],
      allow_missing_in_observe_mode: true,
    }),
    risk_budget: RiskBudgetConfigSchema.default({
      max_files_changed_for_agent: 20,
      max_lines_changed_for_agent: 800,
    }),
    high_risk_paths: z.record(z.string(), HighRiskPathAreaSchema).default({}),
    agent_control_plane: AgentControlPlaneSchema.default({
      paths: DEFAULT_AGENT_CONTROL_PLANE_PATHS,
      require_reviewers: [],
      severity: "error",
    }),
    github_actions: GitHubActionsConfigSchema.default({
      paths: [".github/workflows/*.yml", ".github/workflows/*.yaml"],
      block_permission_escalation: true,
      block_pull_request_target_checkout: true,
      require_pinned_actions: "warn",
      severity: "error",
    }),
    dependencies: DependenciesConfigSchema.default({
      package_managers: ["npm", "pnpm", "yarn"],
      block_lifecycle_script_changes: true,
      require_lockfile_update: true,
      severity: "warn",
    }),
    evidence: EvidenceConfigSchema.default({
      claim_vs_ci: {
        enabled: true,
        phrases: ["tests passed", "all tests pass", "ci passed", "verified"],
        required_checks: ["test", "lint"],
      },
    }),
  })
  .strict();

export type AgentGateConfig = z.infer<typeof AgentGateConfigSchema>;
