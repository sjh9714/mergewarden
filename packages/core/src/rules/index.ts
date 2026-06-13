import { findMatchingPatterns, matchesAny } from "../path/match.js";
import type { AnalysisInput } from "../types.js";
import { agentControlPlaneDriftRule } from "./agentControlPlane.js";
import { agentOriginRule, detectAgentOrigin, type AgentOriginResult } from "./agentOrigin.js";
import {
  contractBlockedPathRule,
  contractInvalidRule,
  contractMissingRule,
  contractOutOfScopeRule,
} from "./contractRules.js";
import { highRiskPathRule } from "./highRiskPath.js";
import { missingTestEvidenceRule } from "./testEvidence.js";
import type { Rule, RuleContext } from "./types.js";

export const builtInRules: Rule[] = [
  agentOriginRule,
  contractInvalidRule,
  contractMissingRule,
  contractOutOfScopeRule,
  contractBlockedPathRule,
  highRiskPathRule,
  agentControlPlaneDriftRule,
  missingTestEvidenceRule,
];

export function createRuleContext(input: AnalysisInput): RuleContext {
  let cachedAgentOrigin: AgentOriginResult | undefined;

  return {
    input,
    helpers: {
      getAgentOrigin() {
        cachedAgentOrigin ??= detectAgentOrigin(input);
        return cachedAgentOrigin;
      },
      changedFiles() {
        return input.changes.files;
      },
      matchesAny,
      findMatchingPatterns,
    },
  };
}

export type { Rule, RuleContext } from "./types.js";
