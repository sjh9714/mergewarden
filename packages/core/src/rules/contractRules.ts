import { scopePathsForFile } from "../path/scopePaths.js";
import type { RawFinding, Severity } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

function baseFinding(
  ruleId: string,
  severity: Severity,
  title: string,
  message: string,
): RawFinding {
  return {
    ruleId,
    severity,
    title,
    message,
    evidence: [],
    remediation: [],
    tags: ["contract", "agent-pr"],
    confidence: "high",
  };
}

function contractRequired(ctx: RuleContext): boolean {
  const requiredFor = ctx.input.config.contract.required_for;

  if (requiredFor.includes("all")) {
    return true;
  }

  return requiredFor.includes("agent") && ctx.helpers.getAgentOrigin().detected;
}

export const contractInvalidRule: Rule = {
  id: "contract/invalid",
  title: "Invalid agent contract",
  run(ctx) {
    if (ctx.input.contract.kind !== "invalid") {
      return [];
    }

    const finding = baseFinding(
      "contract/invalid",
      "error",
      "Invalid agent contract",
      "This PR contains an agent-gate contract, but it could not be parsed.",
    );

    finding.evidence.push({ label: "parser_message", value: ctx.input.contract.message });
    finding.remediation.push("Fix the agent-gate contract block in the PR body.");

    return [finding];
  },
};

export const contractMissingRule: Rule = {
  id: "contract/missing",
  title: "Missing agent contract",
  run(ctx) {
    if (ctx.input.contract.kind !== "missing" || !contractRequired(ctx)) {
      return [];
    }

    const severity =
      ctx.input.config.mode === "observe" && ctx.input.config.contract.allow_missing_in_observe_mode
        ? "warn"
        : "error";

    const finding = baseFinding(
      "contract/missing",
      severity,
      "Missing agent contract",
      "Agent-generated PRs must include an agent-gate contract.",
    );

    finding.evidence.push({
      label: "required_for",
      value: ctx.input.config.contract.required_for.join(", "),
    });
    finding.remediation.push("Add an agent-gate contract block to the PR body.");

    return [finding];
  },
};

export const contractOutOfScopeRule: Rule = {
  id: "contract/out-of-scope",
  title: "File changed outside contract scope",
  run(ctx) {
    if (ctx.input.contract.kind !== "valid") {
      return [];
    }

    const contract = ctx.input.contract.contract;

    return ctx.helpers
      .changedFiles()
      .map((file) => ({
        file,
        outOfScopePaths: scopePathsForFile(file).filter(
          (path) => !ctx.helpers.matchesAny(path, contract.allowed_paths),
        ),
      }))
      .filter(({ outOfScopePaths }) => outOfScopePaths.length > 0)
      .map(({ file, outOfScopePaths }) => {
        const finding = baseFinding(
          "contract/out-of-scope",
          "error",
          "File changed outside contract scope",
          `${file.path} changed outside the allowed contract scope.`,
        );

        finding.path = file.path;
        finding.evidence.push({ label: "changed_file", value: file.path });
        if (file.previousPath) {
          finding.evidence.push({ label: "previous_path", value: file.previousPath });
        }
        finding.evidence.push(
          { label: "out_of_scope_paths", value: outOfScopePaths.join(", ") },
          { label: "allowed_paths", value: contract.allowed_paths.join(", ") },
        );
        finding.remediation.push("Remove the out-of-scope change or update the contract.");

        return finding;
      });
  },
};

export const contractBlockedPathRule: Rule = {
  id: "contract/blocked-path",
  title: "File changed in blocked contract path",
  run(ctx) {
    if (ctx.input.contract.kind !== "valid" || !ctx.input.contract.contract.blocked_paths) {
      return [];
    }

    const contract = ctx.input.contract.contract;
    const blockedPaths = contract.blocked_paths ?? [];

    return ctx.helpers
      .changedFiles()
      .map((file) => ({
        file,
        patterns: [
          ...new Set(
            scopePathsForFile(file).flatMap((path) =>
              ctx.helpers.findMatchingPatterns(path, blockedPaths),
            ),
          ),
        ],
      }))
      .filter(({ patterns }) => patterns.length > 0)
      .map(({ file, patterns }) => {
        const finding = baseFinding(
          "contract/blocked-path",
          "error",
          "File changed in blocked contract path",
          `${file.path} matches blocked contract paths.`,
        );

        finding.path = file.path;
        finding.evidence.push({ label: "changed_file", value: file.path });
        if (file.previousPath) {
          finding.evidence.push({ label: "previous_path", value: file.previousPath });
        }
        finding.evidence.push({ label: "blocked_patterns", value: patterns.join(", ") });
        finding.remediation.push("Remove the blocked-path change from this PR.");

        return finding;
      });
  },
};
