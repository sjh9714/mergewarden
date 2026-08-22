# Documentation

MergeWarden orders recent external pull requests by missing review context, then
checks security boundaries in one PR. Start with the public queue.

## First use

- [Public review queue and PR scan](https://sjh9714.github.io/mergewarden/)
- [Triage CLI](triage.md)
- [Getting started](getting-started.md)
- [CLI reference](cli.md)
- [Action reference](action-reference.md)
- [Configuration](configuration.md)

## Trust and evidence

- [Security model](security-model.md)
- [Evidence model](evidence-model.md)
- [Worked evidence example](evidence-snapshot-example.md)
- [What a checker can actually enforce](what-a-checker-can-enforce.md)
- [Public demo PRs](demo-prs.md)

## Coding-tool integrations

- [Claude Code](integrations/claude-code.md)
- [GitHub Copilot coding agent](integrations/copilot.md)
- [Codex](integrations/codex.md)
- [Cursor background agents](integrations/cursor.md)

## Rule references

- [Commit trailers](rules/commit-trailers.md)
- [Agentic workflow injection](rules/agentic-workflow-injection.md)
- [Package lifecycle scripts](rules/package-lifecycle-scripts.md)
- [Enforcing an AI-contribution policy](enforce-ai-contribution-policy.md)

## Research

- [What 2,204 agent pull requests showed](study/what-2204-agent-prs-showed.md)
- [Who reviews the steering files](study/who-reviews-the-steering-files.md)
- [What a zero-config install reports](study/what-a-zero-config-install-reports.md)
- [What AI disclosure actually looks like](study/what-ai-disclosure-looks-like.md)
- [What pull request caps reach](study/what-pr-caps-reach.md)
- [Methodology](study/methodology.md)
- [GitHub agent-PR review guidance](github-review-guidance.md)

## Advanced interface

- [MCP server](../packages/mcp/README.md) checks agent work before a PR exists.

## Project operations

- [Roadmap](roadmap.md)
- [Changelog](../CHANGELOG.md)
- [Release history](history/README.md)
- [Governance](repository-governance.md)
- [Release checklist](release-checklist.md)
