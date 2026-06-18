import { findMatchingPatterns } from "../path/match.js";
import type { AnalysisInput, RawFinding } from "../types.js";
import type { Rule } from "./types.js";

export interface AgentOriginSignal {
  kind: "author" | "label" | "branch" | "body";
  value: string;
  matched: string;
}

export interface AgentOriginResult {
  detected: boolean;
  signals: AgentOriginSignal[];
}

function lower(value: string): string {
  return value.toLowerCase();
}

function truncateEvidence(value: string, maxLength = 160): string {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3)}...`;
}

function bodySignals(input: AnalysisInput): AgentOriginSignal[] {
  const signals: AgentOriginSignal[] = [];
  const title = input.pr.title;
  const body = input.pr.body;

  for (const pattern of input.config.agent_detection.body_patterns) {
    const normalizedPattern = lower(pattern);

    if (lower(title).includes(normalizedPattern)) {
      signals.push({ kind: "body", value: title, matched: pattern });
    }

    if (body && lower(body).includes(normalizedPattern)) {
      signals.push({ kind: "body", value: body, matched: pattern });
    }
  }

  return signals;
}

export function detectAgentOrigin(input: AnalysisInput): AgentOriginResult {
  const signals: AgentOriginSignal[] = [];

  for (const author of input.config.agent_detection.authors) {
    if (input.pr.author === author) {
      signals.push({ kind: "author", value: input.pr.author, matched: author });
    }
  }

  for (const label of input.pr.labels) {
    const matched = input.config.agent_detection.labels.find(
      (configuredLabel) => lower(configuredLabel) === lower(label),
    );

    if (matched) {
      signals.push({ kind: "label", value: label, matched });
    }
  }

  for (const pattern of findMatchingPatterns(
    input.pr.branchName,
    input.config.agent_detection.branch_patterns,
  )) {
    signals.push({ kind: "branch", value: input.pr.branchName, matched: pattern });
  }

  signals.push(...bodySignals(input));

  return {
    detected: signals.length > 0,
    signals,
  };
}

export const agentOriginRule: Rule = {
  id: "agent/origin-detected",
  title: "Agent origin detected",
  run(ctx) {
    const origin = ctx.helpers.getAgentOrigin();

    if (!origin.detected) {
      return [];
    }

    const finding: RawFinding = {
      ruleId: "agent/origin-detected",
      severity: "info",
      title: "Agent origin detected",
      message: "This PR appears to be agent-generated.",
      evidence: origin.signals.map((signal) => ({
        label: signal.kind,
        value: `${signal.kind} matched "${signal.matched}" in "${truncateEvidence(signal.value)}"`,
      })),
      remediation: [],
      tags: ["agent-pr", "origin"],
      confidence: "high",
    };

    return [finding];
  },
};
