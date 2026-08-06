# AI-Agent PR Scan Study: Methodology

Data: combined runs of 2026-07-20/21, aggregated by
`tools/study/aggregate.mjs`. Every published number is reproducible from the
queries and commands on this page. For the narrative version of the results,
read [What 2,204 agent PRs showed](what-2204-agent-prs-showed.md).

## What We Measured

We scanned recently merged, AI-agent-authored pull requests on public GitHub
repositories with the MergeWarden engine (`tools/study/`, local build), using
only its built-in default policy. MergeWarden reads PR metadata and file
contents through GitHub APIs; it never checks out or executes PR code and
never calls an LLM.

Findings are deterministic review evidence ("this PR crossed a boundary that
deserves human eyes"), not vulnerabilities and not misconduct claims. We
publish aggregate statistics only and do not name repositories.

## Sampling

Two complementary samples:

1. **Firehose sample** (`tools/study/discover.mjs`): GitHub issue-search over
   recent `created:` windows for five cohorts: merged PRs authored by
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
the built-in default policy; in this study that is effectively all of them,
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

## Results (runs of 2026-07-20 and 2026-07-21)

Engine v0.4.0; 2,204 PRs scanned, 2,191 complete analyses (1 incomplete, 11
deleted head repositories, 1 other error). The dataset combines the recent-PR
firehose (~1,300 PRs, mostly repositories under 200 stars) with a
popular-repository probe (894 PRs, 856 of them on 10k+ star repositories).
All numbers below are reproduced by `tools/study/aggregate.mjs`.

- 153 PRs (7.0% of complete analyses) had at least one finding.
- 0 of 2,204 PRs declared a machine-readable scope contract.
- `agent-control-plane/drift`: 85 PRs (3.9%).
- 349 PRs touched workflow or package-manifest content. Among them:
  `workflow/dangerous-pattern` 22.1% (unpinned references 17.5%),
  `workflow/permission-escalation` 12.9%.
- `dependency/lifecycle-script-added`: 1 PR.
- Finding rates on 10k+ star repositories (36 of 844 complete, 4.3%) were
  roughly half the long-tail rate (8.6% on the mostly sub-200-star firehose),
  consistent with established projects having stronger guardrails, and with
  the long tail of small repositories being where agent PRs run with the
  least oversight.

Per-cohort finding rates varied (codex-branch 10.2%, cursor-branch 9.5%,
copilot 9.0%, claude-code-body 2.0%, devin 1.1%); cohort attribution is
heuristic, cohort populations differ in repository mix, and none of this
measures code quality, only boundary-crossing evidence under the default
policy.

### What these rates do and do not carry across engine versions

Engine v0.4.0's `agent_detection` defaults were empty arrays, so agent detection
never fired during this run and neither `agent/origin-detected` nor
`contract/missing` appears anywhere in the results. That was a defect, fixed in
[v0.5.0](../history/releases/release-notes-v0.5.0.md). It has a specific consequence for how these
numbers should be read.

**The per-rule boundary rates are unaffected.** `agent-control-plane/drift`,
`workflow/*` and `dependency/*` are not gated on agent detection; only
`contract/missing` is. This was verified rather than assumed: a 66-PR stratified
sample of this dataset was re-scanned under the current defaults and produced
**identical boundary findings on 66 of 66**. The 3.9%, 12.9%, 17.5% and 22.1%
figures reproduce on any engine version.

**The "at least one finding" rate does not carry across.** Because detection was
inert, 7.0% is precisely a boundary-crossing rate, which is what it was meant to
measure. Re-running the same corpus on v0.5.0 or later would add
`agent/origin-detected` to most of it and `contract/missing` to every pull request
detection matches, and since 0 of 2,204 declared a contract, that is nearly all of
them. A modern run would therefore report a headline rate approaching 100%, which
is a statement about disclosure adoption, not about boundary crossings. The same
applies to the 4.3% vs 8.6% star-band comparison and to the per-cohort rates above:
read them as boundary-crossing rates, and do not compare them to a v0.5.0+ run.

The `claude-code-body` cohort's low 2.0% rate is also partly an artifact of a
second defect found the same way: the v0.5.0 default body marker was the plain
string `Generated with Claude Code`, but Claude Code writes the product name inside
a Markdown link, so the marker matched 0 of 13 sampled pull requests from this
cohort. Fixed in v0.5.1, where the corrected marker matches 12 of the same 13.

## Related work

This study measures a different axis than most prior empirical work on agent
PRs, which has focused on volume, structure, and merge behavior rather than
policy-boundary crossings:

- Xu, Subramanian, and Karthik, _AI Agent Pull Requests on GitHub: Frequency,
  Structure, and Merge Conflict Rates_ (arXiv:2607.04697, 2026), use the
  AIDev-pop dataset (33,596 PRs across 2,807 repositories) to quantify how
  often agents submit concurrently to the same repository and the resulting
  conflict rates. Their focus is temporal overlap and merge conflicts; ours is
  whether a merged agent PR declared its scope and whether it crossed
  repository-defined boundaries. The two are complementary: their work shows
  agent PRs arrive in volume and collide, and this study shows that when they
  land, none declared a machine-checkable scope.

The broader context is the wave of AI-contribution policies now being adopted
across open source (Apache, the Linux Foundation, and the OpenSSF Technical
Advisory Council's foundation-wide policy, among many others). Those policies
establish disclosure and human-review expectations in prose; this study is
about the enforcement gap underneath them: what an automated, deterministic
check can and cannot verify about an agent PR before merge.
