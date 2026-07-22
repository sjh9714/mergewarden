# What 2,204 Merged AI-Agent PRs Actually Touched

_2026-07-22 · by the MergeWarden maintainer · every number below is
reproducible from the [study methodology](methodology.md)._

One of the pull requests we scanned was authored by a coding agent and, like
every PR in this dataset, it was merged. Along the way it edited a GitHub
Actions workflow and raised a job's `contents` permission from `read` to
`write` — the permission that controls pushes, tags, and releases. Nothing
about the diff suggests malice, and the escalation may well have been
needed. But nothing declared it either: no stated intent to touch CI, no
reviewer artifact saying the boundary move was deliberate. It simply merged.
We found that same pattern — silent, probably-benign, unverifiable — over
and over, and it is the motivation for this study.

## The question

AI coding agents — Devin, Copilot coding agent, Codex, Claude Code, Cursor —
now open and merge pull requests at scale. Every agent vendor knows, at the
moment of generation, exactly what the task was. Our question: **does any of
that intent survive into the PR in a form a machine could check?** And while
we're looking: how often do agent PRs cross boundaries that deserve human
eyes?

## How we measured

We scanned 2,204 recently merged, agent-authored PRs on public GitHub
repositories with [MergeWarden](https://github.com/sjh9714/mergewarden), a
checkout-free policy engine, using only its built-in default policy. The
engine reads PR metadata and file contents through the GitHub API — it never
executes PR code and never calls an LLM, so every finding is deterministic
and replayable.

Two samples, because the population is lopsided:

- A **firehose sample** (~1,300 PRs) from GitHub search over recent date
  windows — this approximates the real population of public agent PRs, which
  is dominated by small repositories.
- A **popular-repo probe** (894 PRs, 856 of them on repositories with 10k+
  stars) — because issue search cannot filter by stars, popular projects had
  to be sampled directly.

Findings are review evidence — "this PR crossed a boundary that deserves
human eyes" — not vulnerabilities and not misconduct claims. We publish
aggregates only and name no repositories. Cohort attribution (which agent
authored a PR) is heuristic and imperfect; the
[methodology](methodology.md) spells out every query, cap, and caveat.

## What we found

**0 of 2,204 PRs declared a machine-readable scope for the change.** Not a
low percentage — zero. Agent vendors emit rich task context at generation
time, and none of it reaches the PR as something a machine could verify. If
you want to know whether an agent PR stayed inside its intended task, there
is currently nothing to check it against.

**7.0% of complete analyses had at least one boundary finding** (153 of
2,191). The interesting structure is underneath that number:

- Of the **349 PRs that touched GitHub Actions workflows or package
  manifests**, 12.9% escalated workflow permissions and 17.5% introduced
  unpinned actions, reusable workflows, or containers. Workflow-touching
  agent PRs are where the risk concentrates.
- **3.9% changed agent control-plane files** — `AGENTS.md`, `CLAUDE.md`,
  `.mcp.json`, and similar. These files steer every future agent PR in the
  repository, which makes them a quiet privilege-escalation path: an agent
  that edits its own instructions today shapes what the next agent does
  tomorrow.
- Repositories with **10k+ stars showed a 4.3% finding rate — roughly half**
  the long-tail rate (8.6%). Established projects have guardrails. The long
  tail of small repositories, where most agent PRs actually land, is where
  agents run with the least oversight.

## Honest denominators, honest limits

Percentages hide choices, so ours are explicit: workflow-rule rates use PRs
that actually touched workflow or manifest content; control-plane rates use
all complete analyses; the contract statistic uses everything. Incomplete
analyses fail closed and are reported as their own bucket, never silently
dropped.

The default policy is deliberately conservative, and a "finding" is not an
accusation — most escalations we saw are probably benign, like the one in
the opening paragraph. That is exactly the point: nobody declared them,
nobody checked them, and benign-until-it-isn't is not a security posture.

## The missing primitive

The zero is the story. Agent PRs today are reviewed the way human PRs are —
by reading the diff — but agents differ from humans in one reviewable way:
their intent is machine-generated and could be machine-checkable. A PR-body
contract as small as this would close the loop:

```md
<!-- mergewarden-contract
version: 1
agent: codex
task: update session expiry handling
allowed_paths:
  - src/auth/**
  - test/auth/**
-->
```

The contract is an untrusted declaration — the base-branch policy stays
authoritative — but once it exists, "did the PR leave its declared scope"
becomes a deterministic check instead of a reviewer's guess. We would rather
see this become a vendor-neutral convention than a MergeWarden feature;
the format above is one concrete proposal.

## Reproduce it

Every query, date window, and aggregation script is published in the
[methodology](methodology.md). The scanner is MIT-licensed and runs against
any public PR without installing anything:

```bash
npx mergewarden scan owner/repo#123
```

If you maintain a repository that receives agent PRs and want the scan
results for your own recent PRs, open an issue — we are looking for
maintainers to help measure false-positive rates against real-world
judgment.
