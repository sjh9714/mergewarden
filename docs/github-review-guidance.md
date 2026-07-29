# GitHub's Agent-PR Review Guidance, and What a Checker Can Do About It

In May 2026 GitHub published
[Agent pull requests are everywhere. Here's how to review them](https://github.blog/ai-and-ml/generative-ai/agent-pull-requests-are-everywhere-heres-how-to-review-them/),
naming five red flags a reviewer should look for. It is the most authoritative
statement of the problem this project exists for.

It also does something worth noticing: **for four of the five red flags it gives
no indication of how often the problem actually occurs.** It tells you what to
look for, not how much of it is out there.

This page maps its five red flags to two questions we can answer:

1. Is the check decidable from the pull request alone, without running code?
2. How often did it fire across the [2,204 merged agent pull requests](study/methodology.md) we scanned?

## Summary

| GitHub's red flag               | Decidable? | MergeWarden   | Measured rate               |
| ------------------------------- | ---------- | ------------- | --------------------------- |
| 1. CI gaming                    | Partly     | Partly        | see below                   |
| 2. Code reuse blindness         | **No**     | Not attempted | —                           |
| 3. Hallucinated correctness     | **No**     | Not attempted | —                           |
| 4. Agentic ghosting             | Partly     | `contract/*`  | 0 of 2,204 declared a scope |
| 5. Untrusted input in workflows | **Yes**    | `workflow/*`  | 12.9% escalated permissions |

Two of the five are not mechanically decidable at all, and this project does not
pretend otherwise. That is the same line drawn in
[what a checker can actually enforce](what-a-checker-can-enforce.md).

## 1. CI gaming

> Any change that weakens CI is a blocker. Full stop.

GitHub lists four checks under this. They are not equally decidable:

| GitHub's check                                             | Decidable | Rule                                              |
| ---------------------------------------------------------- | --------- | ------------------------------------------------- |
| "Confirm workflow still runs on forks and pull requests"   | yes       | `workflow/trigger-removed`                        |
| Workflow deleted outright                                  | yes       | `workflow/dangerous-pattern` (`workflow_deleted`) |
| "Verify no tests were removed, renamed, or marked skipped" | partly    | **not implemented**                               |
| "Check if coverage thresholds changed"                     | weakly    | **not implemented**                               |
| "Ensure CI steps aren't newly gated behind conditions"     | yes       | **not implemented**                               |

`workflow/trigger-removed` was added in v0.8.0 specifically because this is
GitHub's first red flag and it was the one we covered least. It compares the
`on:` block at the base commit against the head and reports any event that
stopped firing — the pull request that removes `pull_request` from a workflow
stops the check that would have gated it.

It defaults to `warn` rather than `error`. GitHub's guidance says blocker, but
that instruction is aimed at a human judging one case; consolidating workflows
and retiring a `schedule` are ordinary, and the artifact cannot distinguish them
from a quiet removal. Set `github_actions.checks.trigger_removed: error` to
enforce it.

**What is still missing, honestly:** test removal, skip markers, and newly-gated
steps. Test removal is decidable and worth doing; skip markers are
language-specific pattern matching, and coverage thresholds live in a different
config file in every ecosystem. Nothing here is claimed until it is measured
against real pull requests — that discipline is why the default agent-detection
list was wrong twice before it was right.

## 2. Code reuse blindness

> For every new helper or utility in an agent pull request, do a quick search.

Not decidable. Determining that a new utility duplicates an existing one is a
semantic judgment over the whole repository, and a checker that reads the pull
request through an API cannot make it. GitHub cites a January 2026 study finding
agent code carries more redundancy per change; we have nothing to add and
attempt nothing here.

## 3. Hallucinated correctness

> Trace critical paths end-to-end. Require a new test that fails on the
> pre-change behavior.

Not decidable. "Does this code do what it claims" is the thing no deterministic
checker can answer, and it is why this project never calls an LLM at analysis
time: a judge that can be argued with is not a gate.

The nearest decidable neighbour is _evidence_, not correctness:
`evidence/missing-test-change` reports a configured high-risk path changing with
no matching test-file change. That is a statement about what the diff contains,
not about whether the tests are any good. It is also inert until
`high_risk_paths` is configured, because the paths that matter are per-repository.

## 4. Agentic ghosting

> Request clear implementation plans before investing review time on large pull
> requests lacking structure.

Partly decidable, and this is the gap the project was built around. "Is the plan
clear" is a judgment. "Did the pull request declare what it intended to change,
and did it stay inside that" is mechanical — _once something declares it_.

That is the whole finding of the scan study: **0 of 2,204** merged agent pull
requests declared their intended scope in any machine-checkable form. The agent
knew its task; none of that intent survived into the pull request. So the check
GitHub wants is possible, but only after a convention exists — which is what the
`mergewarden-contract` block and `contract/out-of-scope` are for.

## 5. Untrusted input in workflows

> Sanitize user input before prompt interpolation. Use least-privilege token
> permissions. Separate analysis from execution. Never execute model output as
> shell commands.

The most decidable of the five, and the one with measurements:

| GitHub's check                       | Rule                               | Measured                                           |
| ------------------------------------ | ---------------------------------- | -------------------------------------------------- |
| Untrusted input into prompts         | `workflow/agentic-untrusted-input` | —                                                  |
| Least-privilege token permissions    | `workflow/permission-escalation`   | **12.9%** of workflow-touching agent PRs escalated |
| Pinned, non-attacker-controlled refs | `workflow/dangerous-pattern`       | **17.5%** introduced unpinned actions              |
| Separate analysis from execution     | —                                  | not attempted                                      |
| Never execute model output as shell  | —                                  | not attempted                                      |

Rates are of the 349 pull requests that touched workflows or package manifests.
The last two are code-shape judgments about a script's behaviour and are not
attempted.

## What this adds to GitHub's post

Frequencies, and a line between the checks a machine can make and the ones it
cannot. GitHub's advice is sound and none of it is disputed here — the point is
that three of its five red flags are partly or wholly mechanical, and a reviewer
should not be spending attention on those by hand.

The other two are exactly where reviewer attention should go, and no tool,
including this one, should claim to take them.
