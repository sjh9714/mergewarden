import type { RawFinding } from "../types.js";
import type { Rule, RuleContext } from "./types.js";

type PackageScripts = Record<string, string>;

interface ParsePackageJsonResult {
  scripts: PackageScripts;
  parseError?: string;
}

function isPackageManifest(ctx: RuleContext, path: string): boolean {
  return ctx.helpers.matchesAny(path, ctx.input.config.package_scripts.paths);
}

function parsePackageJson(content: string | null | undefined): ParsePackageJsonResult {
  if (content == null) {
    return { scripts: {} };
  }

  try {
    const parsed = JSON.parse(content) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { scripts: {}, parseError: "package.json root is not an object" };
    }

    const scripts = (parsed as { scripts?: unknown }).scripts;

    if (scripts === undefined) {
      return { scripts: {} };
    }

    if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
      return { scripts: {}, parseError: "package.json scripts is not an object" };
    }

    return {
      scripts: Object.fromEntries(
        Object.entries(scripts)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string")
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    };
  } catch (error) {
    return {
      scripts: {},
      parseError: error instanceof Error ? error.message : "package.json parse failed",
    };
  }
}

function parseErrorFinding(
  filePath: string,
  severity: RawFinding["severity"],
  error: string,
): RawFinding {
  return {
    ruleId: "dependency/package-script-drift",
    severity,
    title: "Package script drift could not be analyzed",
    message: `${filePath} could not be parsed as package JSON.`,
    path: filePath,
    evidence: [
      { label: "changed_file", value: filePath },
      { label: "change", value: "parse-error" },
      { label: "parse_error", value: error },
    ],
    remediation: ["Fix package.json so lifecycle script drift can be inspected."],
    tags: ["dependency", "package-script", "parse-error"],
    confidence: "medium",
  };
}

function scriptFinding(options: {
  ruleId: "dependency/lifecycle-script-added" | "dependency/package-script-drift";
  severity: RawFinding["severity"];
  filePath: string;
  script: string;
  change: "added" | "changed";
  before?: string;
  after: string;
}): RawFinding {
  const evidence = [
    { label: "changed_file", value: options.filePath },
    { label: "script", value: options.script },
    { label: "change", value: options.change },
  ];

  if (options.before !== undefined) {
    evidence.push({ label: "before", value: options.before });
  }

  evidence.push({ label: "after", value: options.after });

  return {
    ruleId: options.ruleId,
    severity: options.severity,
    title:
      options.ruleId === "dependency/lifecycle-script-added"
        ? "Package lifecycle script added"
        : "Package lifecycle script changed",
    message: `${options.script} script ${options.change} in ${options.filePath}.`,
    path: options.filePath,
    evidence,
    remediation: ["Review lifecycle script changes before merging."],
    tags: ["dependency", "package-script", options.script],
    confidence: "high",
  };
}

export const packageScriptDriftRule: Rule = {
  id: "dependency/package-script-drift",
  title: "Package lifecycle script drift",
  run(ctx) {
    const config = ctx.input.config.package_scripts;

    if (!config.enabled) {
      return [];
    }

    const findings: RawFinding[] = [];

    for (const file of ctx.helpers.changedFiles()) {
      if (!isPackageManifest(ctx, file.path) || file.status === "removed") {
        continue;
      }

      if (file.status !== "added" && file.baseContent == null) {
        continue;
      }

      if (file.headContent == null) {
        continue;
      }

      const base = parsePackageJson(file.baseContent);
      const head = parsePackageJson(file.headContent);

      if (base.parseError) {
        findings.push(parseErrorFinding(file.path, config.severity, base.parseError));
        continue;
      }

      if (head.parseError) {
        findings.push(parseErrorFinding(file.path, config.severity, head.parseError));
        continue;
      }

      for (const script of config.lifecycle_scripts) {
        const before = base.scripts[script];
        const after = head.scripts[script];

        if (after === undefined) {
          continue;
        }

        if (before === undefined) {
          findings.push(
            scriptFinding({
              ruleId: "dependency/lifecycle-script-added",
              severity: config.severity,
              filePath: file.path,
              script,
              change: "added",
              after,
            }),
          );
          continue;
        }

        if (before !== after) {
          findings.push(
            scriptFinding({
              ruleId: "dependency/package-script-drift",
              severity: config.severity,
              filePath: file.path,
              script,
              change: "changed",
              before,
              after,
            }),
          );
        }
      }
    }

    return findings;
  },
};
