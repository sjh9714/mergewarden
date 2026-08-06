# Documentation

MergeWarden reads a pull request through the GitHub API and reports what it
finds. It does not check anything out, run anything, or close anything.

Find the line below that matches what you are trying to do.

## Getting it running

- **[Getting started](getting-started.md)** is the one to read first. It covers
  installing it, reading your first report, and tightening it once you trust it.
- [Configuration](configuration.md): policy, per-check severity, scope contracts,
  and waivers.
- [Action reference](action-reference.md): every input, output, and failure mode.
- [CLI reference](cli.md): scanning a pull request from your terminal.
- [Triage](triage.md): read a whole repository's open pull requests at once and
  see what each one is missing. Nothing is written back.
- [MCP server](../packages/mcp/README.md): check an agent's work against the
  scope you gave it, before a pull request exists.

## Deciding whether to trust it

- [Security model](security-model.md): what MergeWarden trusts, what it refuses
  to trust, and where it gives up rather than guess.
- [Evidence model](evidence-model.md): finding IDs and how a report reproduces,
  with a [worked example](evidence-snapshot-example.md).
- [What a checker can actually enforce](what-a-checker-can-enforce.md): real
  policy clauses mapped to what a program can and cannot decide.
- [Demo PRs](demo-prs.md): Action runs on real outside repositories, linked so
  you can read the output yourself.

## Wiring it up for a specific coding tool

- [Claude Code](integrations/claude-code.md)
- [GitHub Copilot coding agent](integrations/copilot.md)
- [Codex](integrations/codex.md)
- [Cursor background agents](integrations/cursor.md)

## What individual rules do

- [Commit trailers](rules/commit-trailers.md): required and forbidden disclosure
  trailers, and what a trailer cannot prove.
- [Agentic workflow injection](rules/agentic-workflow-injection.md): which
  untrusted text reaches which agent prompts.
- [Package lifecycle scripts](rules/package-lifecycle-scripts.md): install and
  prepare scripts added or changed.
- [Enforcing an AI-contribution policy](enforce-ai-contribution-policy.md): a
  copy-paste preset for the checkable clauses of a written policy.

## What we measured

We scan public repositories and publish what we find, including the results that
went against us.

- [What 2,204 agent pull requests showed](study/what-2204-agent-prs-showed.md)
- [What a zero-config install reports](study/what-a-zero-config-install-reports.md):
  it stayed silent on 44 of 46 merged human pull requests.
- [What AI disclosure actually looks like](study/what-ai-disclosure-looks-like.md),
  including a correction to an earlier claim of our own.
- [What pull request caps reach](study/what-pr-caps-reach.md): GitHub's
  per-contributor limit measured against six real queues.
- [Does triage help?](study/does-triage-help.md)
- [Methodology](study/methodology.md) lists every query, so you can rerun them.
- [GitHub's own agent-PR review guidance](github-review-guidance.md), mapped to
  what is decidable.

## About the project

- [Changelog](../CHANGELOG.md) covers every release. Per-release notes, migration
  guides, and verification records are kept in [history](history/README.md).
- [Roadmap](roadmap.md): direction, without date promises.
- [Governance](repository-governance.md) and
  [release checklist](release-checklist.md).
