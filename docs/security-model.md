# Security Model

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It is
designed to inspect pull request metadata and changed-file content without
executing PR-controlled code.

## Trusted Inputs

- Base branch `agent-gate.yml`.
- Action code from the workflow-pinned ref, such as `@main`, a release tag, or
  a pinned commit SHA.
- GitHub pull request metadata from REST APIs.
- GitHub changed-file metadata from REST APIs.

## Untrusted Inputs

- Pull request title and body.
- Pull request branch files.
- Pull request branch `agent-gate.yml`.
- PR body contract blocks.
- Changed file contents.
- Workflow YAML from the pull request branch.
- Agent control-plane changes, including `AGENTS.md`, `CLAUDE.md`, MCP config,
  and similar files.

## Runtime Guarantees

- The Agent Gate workflow does not checkout PR code.
- The Action does not execute PR branch code.
- The Action does not install packages from the target PR.
- Runtime analysis does not call LLMs.
- Runtime analysis does not execute MCP servers.
- Analysis is API-only and uses deterministic core rules.

## Base-Branch Policy

The Action loads `agent-gate.yml` from the PR base ref. This prevents a pull
request from weakening its own policy by changing policy files on the PR branch.
Changes to policy and agent-control-plane files are still analyzed as ordinary
pull request content.

## Self-Dogfooding

This repository's Agent Gate workflow uses
`sjh9714/Agent-Gate/packages/action@main`. That keeps self-dogfooding
checkout-free and avoids running Action code from the pull request branch while
the Action package itself is under development.

## PR Comments

When `comment: true`, Agent Gate upserts a marked PR report comment through
GitHub issue comment APIs. Repositories should grant `issues: write` for that
behavior. If the token is read-only, such as on some fork pull requests, comment
failures are reported as warnings and do not fail the Action.

## Known Limitations

- CODEOWNERS and reviewer evidence are not implemented yet.
- Package and dependency drift rules are not implemented yet.
- File-based PR contracts are not implemented yet; contracts are parsed from
  PR body comment blocks.
- Risk budgets, claim-vs-CI evidence, reviewer requirements, and rollback-plan
  requirements are not implemented yet.
- GitHub Actions job-level permission escalation comparison is limited.
- Test evidence checks only detect matching test file changes; they do not prove
  semantic coverage.
- Comment upsert depends on GitHub token permissions.
- Agent Gate is pre-release, so APIs and rule names may change before `v0.1.0`.
