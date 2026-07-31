# MergeWarden v0.7.0 Release Notes

The default agent-author list had two entries. It should have had eleven.

`agent_detection.authors` shipped `devin-ai-integration[bot]` and
`copilot-swe-agent[bot]`. Nine other coding agents open pull requests from their
own bot accounts and none of them were recognised — together roughly **364,000
public pull requests** the defaults could not see.

**Google Jules alone opens more pull requests than Devin does.**

| Account                     | Public PRs | In v0.6.0 |
| --------------------------- | ---------- | --------- |
| `copilot-swe-agent[bot]`    | 2,020,056  | yes       |
| `google-labs-jules[bot]`    | 319,715    | **no**    |
| `devin-ai-integration[bot]` | 209,483    | yes       |
| `kiro-agent[bot]`           | 21,383     | **no**    |
| `codegen-sh[bot]`           | 7,968      | **no**    |
| `opencode-agent[bot]`       | 6,696      | **no**    |
| `tembo[bot]`                | 3,465      | **no**    |
| `amazon-q-developer[bot]`   | 2,263      | **no**    |
| `mentatbot[bot]`            | 2,184      | **no**    |
| `factory-droid[bot]`        | 604        | **no**    |
| `ellipsis-dev[bot]`         | 396        | **no**    |

Counts measured 2026-07-29 with `is:pr author:<account>`.

## How it was found

Not by reading vendor documentation — by auditing our own measurement.

The [false-positive check](study/what-a-zero-config-install-reports.md) split its
sample using the engine's own `agentDetected` flag, then measured how quiet the
engine was on the human side. That is circular: any pull request wrongly called
human lands in the quiet bucket and improves the score.

Re-checking the author of every pull request on the human side turned up one
opened by `kiro-agent[bot]`, whose body says outright _"This pull request was
created by @kiro-agent on behalf of…"_. One miss prompted the audit that found
the rest.

Every account here was verified by reading a pull request it actually opened,
the same discipline that produced the v0.5.1 body-marker fix. Nothing was added
on the strength of a vendor's claim.

## What is deliberately excluded

**Automation** — dependabot, renovate, `github-actions` and similar. They open
pull requests, but not from a task description, and demanding a declared scope
contract from a version bump would be wrong. A regression test pins this
direction too.

**Review bots** — CodeRabbit, Qodo, Greptile and the like comment on pull
requests rather than authoring them, so they never appear as an author at all.

The branch pattern `agent/**` was considered and rejected. It appears on human
pull requests about agent features as readily as on agent-authored ones, and
this project's own branches would trip it. Branch patterns stay limited to the
five agents that commonly run under a _human_ account, where the branch name is
the only structural signal; the bot-authored agents are matched by author, which
is exact and carries no false-positive risk.

## Breaking

No API breaks, but **default behaviour changes**, which is why this is a minor
bump: pull requests from those nine accounts now produce `agent/origin-detected`
and, without a declared contract, `contract/missing`. Since
[v0.6.0](release-notes-v0.6.0.md) that is a `warn`, not a block, so nothing that
merged before will start being rejected.

To opt out, set the key explicitly:

```yaml
agent_detection:
  authors: ["devin-ai-integration[bot]", "copilot-swe-agent[bot]"]
```

## Also in this release

The false-positive measurement is corrected. Its "human" sample of 56 contained
nine automation bots and one undetected coding agent, so the honest denominator
is 46 and the figure is **44 of 46 reporting nothing (95.7%)**, not 96.4%. Both
findings were re-confirmed correct, so the zero-false-positive result stands —
what changed is the population it was measured over, and the page now says so.

## Upgrading

```yaml
- uses: sjh9714/mergewarden@v0.7.0
```

No configuration change required.
