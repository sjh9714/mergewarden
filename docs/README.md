# MergeWarden Documentation

MergeWarden is a checkout-free change-control layer for AI-generated pull
requests. Start with the shortest path for your task:

- [Start here](start-here.md): install, what the first pull request looks like,
  and what each finding means. One page.
- [Getting started](getting-started.md): install, first run, and safe rollout.
- [Triage](triage.md): read a repository's open pull requests and see what each is
  missing. No install, no write access, nothing is closed.
- [CLI reference](cli.md): scan a public or private GitHub pull request.
- [Action reference](action-reference.md): inputs, outputs, permissions, and failures.
- [MCP server](../packages/mcp/README.md): check an agent's changes against the
  scope it was given, before a pull request exists.
- [Configuration](configuration.md): policy, checks, contracts, and waivers.
- [Your first report](first-report.md): status labels and next actions.
- [Evidence model](evidence-model.md): finding IDs and reproducibility metadata.
- [Security model](security-model.md): trust boundaries and known limitations.
- [Enforce an AI-contribution policy](enforce-ai-contribution-policy.md): a
  copy-paste preset for the checkable clauses of your policy.
- [What pull request caps reach](study/what-pr-caps-reach.md): GitHub's new per-contributor
  limit measured against six real queues — it defers 2–13%, because the queues are dispersed.
- [Does triage help?](study/does-triage-help.md): the command measured against the 167
  repositories that installed a competing tool, with what counts as helping decided first.
- [What AI disclosure actually looks like](study/what-ai-disclosure-looks-like.md):
  the trailer coding tools write about themselves, measured across 1,029
  repositories — and a correction to an earlier claim about policy effects.
- [What 2,204 agent PRs showed](study/what-2204-agent-prs-showed.md): the scan
  study narrative; [methodology](study/methodology.md) has every query.
- [Demo PRs](demo-prs.md): verified external Action runs.
- [Gating Claude Code PRs](integrations/claude-code.md): detection, contracts,
  and CLAUDE.md wiring.
- [Gating Codex PRs](integrations/codex.md): detection, contracts, and
  AGENTS.md wiring.
- [Gating Cursor background agent PRs](integrations/cursor.md): detection,
  contracts, and project-rule wiring.
- [Roadmap](roadmap.md): current product direction without date promises.
- [Agentic workflow injection rule](rules/agentic-workflow-injection.md): exact
  sources, sinks, severity, and limits.
- [Package lifecycle rule](rules/package-lifecycle-scripts.md): install/prepare
  script change evidence.
- [Commit trailer rules](rules/commit-trailers.md): required and forbidden
  disclosure trailers, and what they cannot prove.
- [What a zero-config install reports](study/what-a-zero-config-install-reports.md):
  measured false-positive check — silent on 44 of 46 human pull requests.
- [GitHub's agent-PR review guidance](github-review-guidance.md): its five red
  flags mapped to what is decidable, with our measured rates.
- [What a checker can actually enforce](what-a-checker-can-enforce.md): real
  policy clauses mapped to what is decidable, and what MergeWarden covers.
- [v0.4.0 migration](migration-v0.4.0.md): the Agent Gate → MergeWarden rename.
- [v0.3.0 migration](migration-v0.3.0.md): compatibility changes.
- [v0.9.0 release notes](release-notes-v0.9.0.md): a missing contract is
  informational, and the Action comments only when there is something to say.
- [v0.7.0 release notes](release-notes-v0.7.0.md): nine missing coding-agent
  accounts, including Google Jules.
- [v0.6.0 release notes](release-notes-v0.6.0.md): a missing contract warns
  instead of blocking, and `contract.missing_severity`.
- [v0.5.1 release notes](release-notes-v0.5.1.md): the Claude Code body marker
  fix and the study's engine-version scope note.
- [v0.5.0 release notes](release-notes-v0.5.0.md): working agent-detection
  defaults, `mergewarden demo`, Gemini and Qwen control planes.
- [v0.4.1 release notes](release-notes-v0.4.1.md): commit trailer rules and a
  readable pull request comment.
- [v0.4.0 release notes](release-notes-v0.4.0.md): MergeWarden rename release.
- [v0.3.1 release notes](release-notes-v0.3.1.md): public CLI release summary.
- [v0.3.0 release notes](release-notes-v0.3.0.md): release summary.

Historical release and smoke records are preserved under [history](history/).
