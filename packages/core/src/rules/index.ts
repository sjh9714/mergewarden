import { findMatchingPatterns, matchesAny } from "../path/match.js";
import type { AnalysisInput } from "../types.js";
import { agentControlPlaneDriftRule } from "./agentControlPlane.js";
import { agenticWorkflowInjectionRule } from "./agenticWorkflowInjection.js";
import { agentOriginRule, detectAgentOrigin, type AgentOriginResult } from "./agentOrigin.js";
import {
  contractBlockedPathRule,
  contractInvalidRule,
  contractMissingRule,
  contractOutOfScopeRule,
} from "./contractRules.js";
import { contentUnavailableRule } from "./contentUnavailable.js";
import { highRiskPathRule } from "./highRiskPath.js";
import { packageScriptDriftRule } from "./packageScripts.js";
import { missingTestEvidenceRule } from "./testEvidence.js";
import type { Rule, RuleContext } from "./types.js";
import { workflowDangerousPatternRule } from "./workflowDangerousPattern.js";
import { workflowPermissionEscalationRule } from "./workflowPermissions.js";

export const builtInRules: Rule[] = [
  agentOriginRule,
  contractInvalidRule,
  contractMissingRule,
  contractOutOfScopeRule,
  contractBlockedPathRule,
  highRiskPathRule,
  agentControlPlaneDriftRule,
  missingTestEvidenceRule,
  contentUnavailableRule,
  packageScriptDriftRule,
  workflowPermissionEscalationRule,
  workflowDangerousPatternRule,
  agenticWorkflowInjectionRule,
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
