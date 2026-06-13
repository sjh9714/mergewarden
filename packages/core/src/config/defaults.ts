import { AgentGateConfigSchema, type AgentGateConfig } from "./schema.js";

export const DEFAULT_CONFIG: AgentGateConfig = AgentGateConfigSchema.parse({ version: 1 });
