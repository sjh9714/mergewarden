# Enforce Your AI-Contribution Policy

Dozens of projects have adopted AI-contribution policies in the Apache / Linux
Foundation / OpenSSF / Bitcoin Core / ripgrep / uv lineage. Almost all of them
are prose in `CONTRIBUTING.md`, an honor system. Three of their clauses are
actually machine-checkable, and the
[`ai-contribution-policy.yml`](../templates/ai-contribution-policy.yml) preset
enforces exactly those, deterministically, with no LLM and no checkout of PR
code.

| Policy clause (typical wording)                  | What the preset does                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| "No autonomous-agent PRs"                        | Detects agent PRs by branch/author and requires them to declare scope in a `mergewarden-contract`   |
| "Don't touch the files that steer future agents" | Flags drift in `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `.cursor/**`, and similar control-plane files |
| "Don't quietly escalate CI permissions"          | Differential workflow checks: permission escalation, unpinned actions, added secret references      |

The honor-system clauses ("you could have written it yourself", "explain in
your own words") stay in your prose policy; this preset does not try to
replace them. It automates only the part a cheap, replayable check can verify.

## 30-second setup

1. Copy [`templates/ai-contribution-policy.yml`](../templates/ai-contribution-policy.yml)
   to the base of your default branch as `mergewarden.yml`.
2. Copy [`templates/mergewarden-observe.yml`](../templates/mergewarden-observe.yml)
   to `.github/workflows/mergewarden.yml`.
3. Open a pull request. Findings appear as a check in `warn` mode; nothing is
   blocked yet.

That's it. To see it run first, scan any public PR without installing anything:

```bash
npx mergewarden scan owner/repo#123
```

## Tuning

- Start in `warn`. Review findings, then tune per-check severity in
  `mergewarden.yml`. See the [configuration reference](configuration.md).
- Add narrow, expiring [waivers](configuration.md) only after human review.
- When a policy is stable, set `mode: block` and `fail-on-block: true`, and
  require the check in branch protection. See [Adopt Safely](../README.md#adopt-safely).

## Why declared scope matters

A [scan of 2,204 merged agent PRs](study/what-2204-agent-prs-showed.md) found
that **none** declared a machine-checkable scope. Repo-level policy files say
what a project allows; a per-PR contract says what a specific change intended
to touch, which turns "did it stay in scope" into a deterministic check instead
of a reviewer's guess:

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

The contract is an untrusted declaration; the base-branch policy stays
authoritative.
