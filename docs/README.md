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
- [Demo PRs](demo-prs.md): verified external Action runs.
- [Gating Claude Code PRs](integrations/claude-code.md): detection, contracts,
  and CLAUDE.md wiring.
- [Gating Codex PRs](integrations/codex.md): detection, contracts, and
  AGENTS.md wiring.
- [Roadmap](roadmap.md): current product direction without date promises.
- [Agentic workflow injection rule](rules/agentic-workflow-injection.md): exact
  sources, sinks, severity, and limits.
- [Package lifecycle rule](rules/package-lifecycle-scripts.md): install/prepare
  script change evidence.
- [v0.4.0 migration](migration-v0.4.0.md): the Agent Gate → MergeWarden rename.
- [v0.3.0 migration](migration-v0.3.0.md): compatibility changes.
- [v0.3.1 release notes](release-notes-v0.3.1.md): public CLI release summary.
- [v0.3.0 release notes](release-notes-v0.3.0.md): release summary.

Historical release and smoke records are preserved under [history](history/).
