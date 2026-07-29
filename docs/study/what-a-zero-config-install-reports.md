# What a Zero-Config Install Actually Reports

The most common objection to a policy gate is that it will be noisy. This page
answers that with a measurement rather than an assurance.

**Result: on 56 recently merged human-authored pull requests, the default policy
reported nothing on 54 of them. The two findings it did produce were both
correct.** Zero false positives in this sample.

## Why this is a separate measurement

The [2,204-PR scan study](methodology.md) sampled _agent-authored_ pull requests
and measured boundary crossings. It says nothing about what happens to the human
pull requests that make up most of a repository's traffic — which is exactly what
a maintainer deciding whether to install this wants to know.

It also could not have answered the question when it ran: engine v0.4.0's agent
detection was inert, so every pull request looked human to it. Detection has
worked since [v0.5.0](../release-notes-v0.5.0.md).

## Method

Run on 2026-07-29 with engine **v0.6.0** and no configuration file, so the
built-in default policy applied.

1. Collect merged pull requests from `search/issues` with `is:pr is:merged
merged:<day>` for each day from 2026-07-22 to 2026-07-28, 60 per day.
2. Hydrate every repository through the GraphQL API and drop forks and archived
   repositories.
3. Take a seeded random sample of 90 of the remaining pull requests.
4. Scan each with `mergewarden scan <owner/repo#number> --format json`.
5. Split by whether the engine's own `agentDetected` flag fired, and inspect
   every finding on the human side by hand.

All 90 scans completed; none were partial.

**Do not add `stars:` to an issue search.** It is not a valid qualifier there, so
GitHub treats it as free text — `stars:>2000` matched the literal string and
returned only pull requests numbered 2000. The first version of this measurement
was built on that poisoned sample and had to be thrown away. Filter by stars
after hydration, never in the query.

## Sample composition

| Property                                          | Value    |
| ------------------------------------------------- | -------- |
| Pull requests scanned                             | 90       |
| Detected as agent-authored                        | 34 (38%) |
| Human-authored                                    | 56       |
| Repositories under 20 stars                       | 88 of 90 |
| Human PRs touching workflows or package manifests | 5        |

This is the recent-merge firehose, so it skews heavily to small repositories.
That is the population, not a sampling error — but it does mean this is not a
sample of "repositories that would install MergeWarden", which is unknown.

## Result on human pull requests

|                                         |                      |
| --------------------------------------- | -------------------- |
| Reported nothing (`pass`)               | **54 of 56 — 96.4%** |
| Produced a finding                      | 2                    |
| Findings judged incorrect on inspection | **0**                |

Both findings were `agent-control-plane/drift`. One pull request edited
`CLAUDE.md`; the other edited `.github/copilot-instructions.md`. Those are the
files that rule exists for: a human editing them still changes how every future
agent run behaves in that repository, and the rule's claim is that a human should
look at the change — not that an agent wrote it.

So the honest count is zero false positives here, with the caveat that "false
positive" for this tool means "a boundary crossing the maintainers consider
fine", which only the maintainers can decide. What this sample shows is that the
default policy is silent on ordinary human work.

## Result on agent pull requests

All 34 produced `agent/origin-detected` and `contract/missing`, and all 34
resolved to `warn`. **None blocked**, including under `mode: block`, because
`contract/missing` defaults to `warn` — see
[v0.6.0](../release-notes-v0.6.0.md) for why. Two also produced
`agent-control-plane/drift`.

That every agent pull request produces `contract/missing` is expected and is the
study's central finding restated: no coding agent declares its intended scope by
default. It is a disclosure-adoption signal, not an accusation about the change.

## Limits

- 90 pull requests over a 7-day window is enough to say the default policy is
  quiet on ordinary work; it is not enough to estimate a rate precisely.
- Agent detection is a heuristic over author, branch and body markers. The 38%
  figure is "matched the default signatures", not proof of authorship.
- Per this project's disclosure rule, aggregates only — no repository is named.
- Nothing here measures whether the findings are _useful_, only whether they are
  correct and rare on human work.
