# AI-Agent PR Scan Study: Methodology

Status: draft — numbers land here only after `tools/study/aggregate.mjs`
produces them from the full run. Every published number must be reproducible
from the queries and commands on this page.

## What We Measured

We scanned recently merged, AI-agent-authored pull requests on public GitHub
repositories with the MergeWarden engine (`tools/study/`, local build), using
only its built-in default policy. MergeWarden reads PR metadata and file
contents through GitHub APIs; it never checks out or executes PR code and
never calls an LLM.

Findings are deterministic review evidence — "this PR crossed a boundary that
deserves human eyes" — not vulnerabilities and not misconduct claims. We
publish aggregate statistics only and do not name repositories.

## Sampling

Two complementary samples:

1. **Firehose sample** (`tools/study/discover.mjs`): GitHub issue-search over
   recent `created:` windows for five cohorts — merged PRs authored by
   `devin-ai-integration[bot]`, by `copilot-swe-agent[bot]`, with `head:codex`
   branches, with "Generated with Claude Code" PR bodies, and with
   `head:cursor` branches (dependabot/renovate excluded). This approximates
   the real population of public agent PRs, which is dominated by small
   repositories.
2. **Popular-repo probe** (`tools/study/discover-popular.mjs`): the most
   recently pushed repositories with 2,000+ stars (repository search, sliced
   by star ranges), whose recent merged PRs we listed directly and classified
   locally by agent author, branch prefix (`codex/`, `claude/`, `cursor/`,
   `copilot/`, `devin/`), or body marker. Issue search cannot filter by
   repository stars, so this probe is how the study reaches popular projects.

Per-repository caps prevent any single project from dominating either sample.
Cohort attribution comes from these discovery signals, not from the scan
itself; branch- and body-based signals are heuristics with imperfect
precision.

## Scanning

Each PR: `mergewarden scan owner/repo#N --format json` (engine version
recorded per result). Scans of repositories without a `mergewarden.yml` use
the built-in default policy — in this study that is effectively all of them,
which means:

- Contract rules only apply to PRs that voluntarily declare a
  `mergewarden-contract` block; the contract-declaration rate is itself a
  reported statistic.
- Test-evidence and agent-origin rules are inert under the default policy and
  are not reported.
- Workflow findings are differential: they report only what the PR changed,
  not pre-existing conditions.

Incomplete analyses (MergeWarden fails closed on missing file lists or
content) and collection errors are reported as explicit buckets, never
silently dropped.

## Honest Denominators

- Workflow-rule rates use two denominators: all complete analyses, and PRs
  that actually touched workflow or package-manifest content
  (`contentFileCount > 0`).
- Contract-rule rates use PRs with a declared contract.
- Control-plane and package-lifecycle rates use all complete analyses.

## Reproducing

```bash
pnpm install && pnpm build
node tools/study/discover-popular.mjs 600
node tools/study/discover.mjs
node tools/study/hydrate-repos.mjs
node tools/study/scan.mjs
node tools/study/aggregate.mjs
```

Exact search queries, date windows, and per-window result totals are recorded
in the run's `windows-done.jsonl`; scan results are append-only JSONL keyed by
`owner/repo#number`. Rate limits are honored (search 30/min, core 5,000/h).

## Results (run of 2026-07-20)

Engine v0.4.0; 1,609 PRs scanned, 1,605 complete analyses (1 incomplete, 3
deleted head repositories). 299 PRs were on repositories with 200+ stars (261
on 10k+). All numbers below are reproduced by `tools/study/aggregate.mjs`.

- 124 PRs (7.7% of complete analyses) had at least one finding.
- 0 of 1,609 PRs declared a machine-readable scope contract.
- `agent-control-plane/drift`: 71 PRs (4.4%).
- 281 PRs touched workflow or package-manifest content. Among them:
  `workflow/dangerous-pattern` 22.4% (unpinned references 18.1%),
  `workflow/permission-escalation` 12.1%.
- `dependency/lifecycle-script-added`: 1 PR.
- Finding rates on 10k+ star repositories (7 of 258, 2.7%) were roughly 3x
  lower than the overall rate — consistent with established projects having
  stronger guardrails, and with the long tail of small repositories being
  where agent PRs run with the least oversight.

Per-cohort finding rates varied (codex-branch 10.2%, cursor-branch 9.5%,
copilot 9.0%, claude-code-body 2.0%, devin 1.1%); cohort attribution is
heuristic, cohort populations differ in repository mix, and none of this
measures code quality — only boundary-crossing evidence under the default
policy.
