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

export const DEFAULT_PACKAGE_SCRIPT_PATHS = ["package.json", "**/package.json"];
export const DEFAULT_LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

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

const PackageScriptsConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    paths: z.array(NonEmptyStringSchema).default(DEFAULT_PACKAGE_SCRIPT_PATHS),
    lifecycle_scripts: z.array(NonEmptyStringSchema).default(DEFAULT_LIFECYCLE_SCRIPTS),
    severity: SeveritySettingSchema.default("warn"),
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
    }),
    package_scripts: PackageScriptsConfigSchema.default({
      enabled: true,
      paths: DEFAULT_PACKAGE_SCRIPT_PATHS,
      lifecycle_scripts: DEFAULT_LIFECYCLE_SCRIPTS,
      severity: "warn",
    }),
  })
  .strict();

export type AgentGateConfig = z.infer<typeof AgentGateConfigSchema>;
