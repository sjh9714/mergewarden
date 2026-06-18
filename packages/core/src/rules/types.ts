import type { FileChange, RawFinding, AnalysisInput } from "../types.js";
import type { AgentOriginResult } from "./agentOrigin.js";

export interface Rule {
  id: string;
  title: string;
  run(ctx: RuleContext): RawFinding[] | Promise<RawFinding[]>;
}

export interface RuleContext {
  input: AnalysisInput;
  helpers: {
    getAgentOrigin(): AgentOriginResult;
    changedFiles(): FileChange[];
    matchesAny(path: string, patterns: string[]): boolean;
    findMatchingPatterns(path: string, patterns: string[]): string[];
  };
}
