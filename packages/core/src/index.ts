export { analyze } from "./analyze.js";
export { DEFAULT_CONFIG } from "./config/defaults.js";
export { parseConfig } from "./config/load.js";
export {
  AgentGateConfigSchema,
  CONFIG_FILE_NAME,
  DEFAULT_AGENT_CONTROL_PLANE_PATHS,
  DEFAULT_LIFECYCLE_SCRIPTS,
  DEFAULT_PACKAGE_SCRIPT_PATHS,
} from "./config/schema.js";
export { parseContractFromPrBody } from "./contract/parsePrBody.js";
export { AgentContractSchema } from "./contract/schema.js";
export { findMatchingPatterns, matchesAny } from "./path/match.js";
export { normalizePath } from "./path/normalizePath.js";
export { renderJsonReport } from "./report/json.js";
export { renderMarkdownReport } from "./report/markdown.js";
export { renderPlainTextReportSummary } from "./report/plainText.js";
export { detectAgentOrigin } from "./rules/agentOrigin.js";
export { AGENT_GATE_VERSION } from "./version.js";
export type { AgentOriginResult, AgentOriginSignal } from "./rules/agentOrigin.js";
export type { Rule, RuleContext } from "./rules/index.js";
export type { AgentGateConfig } from "./config/schema.js";
export type { AgentContract, ParseContractResult } from "./contract/schema.js";
export type {
  AnalysisInput,
  AnalysisResult,
  ChangeSet,
  CheckEvidence,
  ConfigSource,
  Decision,
  Evidence,
  EvidenceSnapshot,
  FileChange,
  Finding,
  PullRequestContext,
  RawFinding,
  RepoContext,
  ReviewEvidence,
  Severity,
} from "./types.js";
