// Phase 3: aggregate scan results into stats.json, a report skeleton, and an
// internal outreach dataset. Reads results.jsonl; never publishes repo names
// in the public report surfaces.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR, STAR_BANDS } from "./config.mjs";
import { ensureDataDir, readJsonl } from "./lib.mjs";

const RESULTS = join(DATA_DIR, "results.jsonl");
const STATS = join(DATA_DIR, "stats.json");
const REPORT = join(DATA_DIR, "report.md");
const OUTREACH = join(DATA_DIR, "outreach.csv");

function starBand(stars) {
  return STAR_BANDS.find((band) => stars >= band.min && stars <= band.max)?.key ?? "unknown";
}

function dangerousPatternKind(finding) {
  const labels = new Map(finding.evidence.map((item) => [item.label, item.value]));
  const pattern = labels.get("pattern") ?? labels.get("check") ?? "";
  if (/pull_request_target/i.test(pattern) || /pull_request_target/i.test(finding.message ?? "")) {
    return "workflow/dangerous-pattern:pull_request_target";
  }

  if (/unpinned/i.test(pattern) || /unpinned/i.test(finding.title ?? "")) {
    return "workflow/dangerous-pattern:unpinned";
  }

  return "workflow/dangerous-pattern:other";
}

function findingKeys(report) {
  const keys = new Set();
  for (const finding of report.findings) {
    keys.add(finding.ruleId);
    if (finding.ruleId === "workflow/dangerous-pattern") {
      keys.add(dangerousPatternKind(finding));
    }
  }

  return keys;
}

function rate(numerator, denominator) {
  return denominator === 0 ? null : Number(((numerator / denominator) * 100).toFixed(1));
}

function tally(records) {
  const complete = records.filter((r) => r.bucket === "ok" && r.report);
  const ruleCounts = new Map();
  const workflowTouching = complete.filter((r) => r.report.metadata.contentFileCount > 0);
  const contractDeclared = complete.filter((r) => r.report.summary.contractPresent);

  for (const record of complete) {
    for (const key of findingKeys(record.report)) {
      ruleCounts.set(key, (ruleCounts.get(key) ?? 0) + 1);
    }
  }

  const rules = {};
  for (const [ruleId, count] of [...ruleCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const workflowRule = ruleId.startsWith("workflow/");
    rules[ruleId] = {
      prsWithFinding: count,
      pctOfComplete: rate(count, complete.length),
      ...(workflowRule ? { pctOfWorkflowTouching: rate(count, workflowTouching.length) } : {}),
    };
  }

  return {
    scanned: records.length,
    complete: complete.length,
    buckets: Object.fromEntries([
      ...records.reduce((map, r) => map.set(r.bucket, (map.get(r.bucket) ?? 0) + 1), new Map()),
    ]),
    workflowTouching: workflowTouching.length,
    contractDeclared: contractDeclared.length,
    prsWithAnyFinding: complete.filter((r) => r.report.findings.length > 0).length,
    configSources: Object.fromEntries([
      ...complete.reduce(
        (map, r) =>
          map.set(
            r.report.metadata.configSource,
            (map.get(r.report.metadata.configSource) ?? 0) + 1,
          ),
        new Map(),
      ),
    ]),
    rules,
  };
}

function buildOutreach(records) {
  const byRepo = new Map();
  for (const record of records) {
    if (record.bucket !== "ok" || !record.report) {
      continue;
    }

    const entry = byRepo.get(record.repo) ?? {
      repo: record.repo,
      stars: record.stars,
      language: record.language,
      cohorts: new Set(),
      scanned: 0,
      withFindings: 0,
      rules: new Set(),
      examples: [],
    };

    for (const cohort of record.cohorts) {
      entry.cohorts.add(cohort);
    }

    entry.scanned += 1;
    if (record.report.findings.length > 0) {
      entry.withFindings += 1;
      for (const finding of record.report.findings) {
        entry.rules.add(finding.ruleId);
      }

      if (entry.examples.length < 3) {
        entry.examples.push(record.url);
      }
    }

    byRepo.set(record.repo, entry);
  }

  const rows = [...byRepo.values()]
    .sort((a, b) => b.withFindings - a.withFindings || b.stars - a.stars)
    .map((entry) =>
      [
        entry.repo,
        entry.stars,
        entry.language ?? "",
        [...entry.cohorts].join(";"),
        entry.scanned,
        entry.withFindings,
        [...entry.rules].join(";"),
        entry.examples.join(";"),
      ].join(","),
    );

  return [
    "repo,stars,language,cohorts,ai_prs_scanned,prs_with_findings,rules,example_urls",
    ...rows,
  ].join("\n");
}

function renderReport(stats) {
  const lines = [
    "# AI-Agent PR Scan Study (draft numbers)",
    "",
    "Internal draft. Public copies must keep aggregate numbers only and no repo names.",
    "",
    `- Scanned: ${stats.overall.scanned} PRs; complete analyses: ${stats.overall.complete}`,
    `- Error buckets: ${JSON.stringify(stats.overall.buckets)}`,
    `- PRs touching workflows/package manifests: ${stats.overall.workflowTouching}`,
    `- PRs declaring a machine-readable scope contract: ${stats.overall.contractDeclared}`,
    `- PRs with at least one finding: ${stats.overall.prsWithAnyFinding}`,
    "",
    "## Finding rates (share of complete analyses)",
    "",
    "| Rule | PRs | % of complete | % of workflow-touching |",
    "| --- | --- | --- | --- |",
  ];

  for (const [ruleId, data] of Object.entries(stats.overall.rules)) {
    lines.push(
      `| ${ruleId} | ${data.prsWithFinding} | ${data.pctOfComplete ?? ""} | ${data.pctOfWorkflowTouching ?? ""} |`,
    );
  }

  lines.push("", "## By cohort", "");
  for (const [cohort, data] of Object.entries(stats.byCohort)) {
    lines.push(
      `- ${cohort}: scanned=${data.scanned} complete=${data.complete} withFindings=${data.prsWithAnyFinding}`,
    );
  }

  lines.push("", "## By star band", "");
  for (const [band, data] of Object.entries(stats.byStarBand)) {
    lines.push(
      `- ${band}: scanned=${data.scanned} complete=${data.complete} withFindings=${data.prsWithAnyFinding}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  ensureDataDir();
  const records = readJsonl(RESULTS);
  const cohorts = [...new Set(records.flatMap((r) => r.cohorts))];
  const stats = {
    generatedFrom: RESULTS,
    engineVersions: [
      ...new Set(records.filter((r) => r.report).map((r) => r.report.metadata.engineVersion)),
    ],
    overall: tally(records),
    byCohort: Object.fromEntries(
      cohorts.map((cohort) => [cohort, tally(records.filter((r) => r.cohorts.includes(cohort)))]),
    ),
    byStarBand: Object.fromEntries(
      STAR_BANDS.map((band) => [
        band.key,
        tally(records.filter((r) => starBand(r.stars) === band.key)),
      ]),
    ),
  };

  writeFileSync(STATS, JSON.stringify(stats, null, 2));
  writeFileSync(REPORT, renderReport(stats));
  writeFileSync(OUTREACH, buildOutreach(records));
  process.stderr.write(`wrote ${STATS}, ${REPORT}, ${OUTREACH}\n`);
}

main();
