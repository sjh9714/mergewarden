# MergeWarden Documentation

MergeWarden is a checkout-free change-control layer for AI-generated pull
requests. Start with the shortest path for your task:

- [Getting started](getting-started.md): install, first run, and safe rollout.
- [CLI reference](cli.md): scan a public or private GitHub pull request.
- [Action reference](action-reference.md): inputs, outputs, permissions, and failures.
- [Configuration](configuration.md): policy, checks, contracts, and waivers.
- [Your first report](first-report.md): status labels and next actions.
- [Evidence model](evidence-model.md): finding IDs and reproducibility metadata.
- [Security model](security-model.md): trust boundaries and known limitations.
- [Enforce an AI-contribution policy](enforce-ai-contribution-policy.md): a
  copy-paste preset for the checkable clauses of your policy.
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
- [What a checker can actually enforce](what-a-checker-can-enforce.md): real
  policy clauses mapped to what is decidable, and what MergeWarden covers.
- [v0.4.0 migration](migration-v0.4.0.md): the Agent Gate → MergeWarden rename.
- [v0.3.0 migration](migration-v0.3.0.md): compatibility changes.
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
