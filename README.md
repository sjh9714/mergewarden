# Agent Gate for AI PRs

[![Release](https://img.shields.io/github/v/release/sjh9714/Agent-Gate?label=release)](https://github.com/sjh9714/Agent-Gate/releases)
[![CI](https://github.com/sjh9714/Agent-Gate/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/Agent-Gate/actions/workflows/ci.yml)
[![Agent Gate](https://github.com/sjh9714/Agent-Gate/actions/workflows/agent-gate.yml/badge.svg)](https://github.com/sjh9714/Agent-Gate/actions/workflows/agent-gate.yml)
[![License](https://img.shields.io/github/license/sjh9714/Agent-Gate)](LICENSE)

> **AI agents can open PRs. Agent Gate shows when they cross the line.**

Agent Gate is a checkout-free policy gate that surfaces scope escapes, GitHub
Actions privilege escalation, agent-control-plane drift, and risky package
script changes before merge.

It does not execute pull-request code, load policy from the PR head, or call an
LLM at runtime. Every decision includes deterministic evidence that can be
replayed locally.

[Try a public PR](#try-it-in-60-seconds) · [Install the Action](#install-in-30-seconds) · [What it catches](#what-it-catches) · [Adopt safely](#adopt-safely) · [Documentation](docs/README.md)

## Try It in 60 Seconds

Scan any public GitHub pull request without installing the Action:

```bash
npx --yes @jinhyuk9714/agent-gate@0.3.1 scan owner/repository#123
```

A full pull-request URL works too:

```bash
npx --yes @jinhyuk9714/agent-gate@0.3.1 scan https://github.com/owner/repository/pull/123
```

Use `GH_TOKEN` or `GITHUB_TOKEN` for private repositories or higher API rate
limits. Agent Gate intentionally has no token command-line flag.

Example human output:

```text
Agent Gate: NEEDS REVIEW
Decision: warn
Analysis: complete
Findings: 0 error, 2 warning, 1 info

WARN workflow/permission-escalation
contents increased from read to write at workflow scope
Path: .github/workflows/release.yml

WARN agent-control-plane/drift
an instruction file that affects future agents changed
Path: AGENTS.md
```

The default output is concise. Use `--format json` or `--format markdown` for
the complete machine-readable report. See the [CLI reference](docs/cli.md).
The final v0.3.1 CLI recording will be added only after the published package is
verified; no simulated `npx` recording is used.

## Install in 30 Seconds

Create `.github/workflows/agent-gate.yml`:

```yaml
name: Agent Gate

on:
  pull_request:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled, ready_for_review]

permissions:
  contents: read
  pull-requests: read

jobs:
  agent-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/Agent-Gate@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

No checkout step is needed. For maximum supply-chain assurance, replace the
version tag with the full 40-character commit SHA shown on the v0.3.1 release.
Agent Gate does not publish or recommend a mutable `v0` tag.

The first run works without `agent-gate.yml`: a confirmed 404 on the PR base
branch selects the built-in warn policy. Authentication, rate-limit, and server
errors never fall back silently.

Verified checkout-free Action evidence is available in
[sandbox PR #14](https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/14).
It uses the earlier v0.2.6 release; the release checklist requires a fresh
v0.3.1 SHA-pinned proof before launch.

## What It Catches

| Boundary                   | Deterministic evidence                                              |
| -------------------------- | ------------------------------------------------------------------- |
| Declared PR scope          | Files outside `allowed_paths` or inside `blocked_paths`             |
| Workflow privilege         | Permission escalation, new write-all or OIDC access                 |
| Workflow supply chain      | Unpinned actions, reusable workflows, and containers                |
| Dangerous triggers         | `pull_request_target` use of attacker-controlled PR head refs       |
| Agentic workflow injection | Untrusted GitHub text flowing into registered agent prompts         |
| Agent control plane        | Changes to `AGENTS.md`, `.mcp.json`, `.codex/**`, and related files |
| Test evidence              | High-risk source changes without matching test-file changes         |
| Package execution          | Added or changed install/prepare lifecycle scripts                  |
| Analysis integrity         | Missing content, incomplete file lists, or report limits            |

Agent Gate evaluates changes rather than re-reporting every pre-existing
workflow condition. Findings show the rule, severity, path, canonical evidence,
and a stable finding ID.

## Minimal Policy

Add `agent-gate.yml` to the base branch when you are ready to tune behavior:

```yaml
version: 1
mode: warn

agent_detection:
  labels: [ai, agent, codex, claude]
  branch_patterns: ["codex/**", "claude/**", "ai/**"]

github_actions:
  checks:
    permission_escalation: error
    write_all: error
    id_token_write: warn
    pull_request_target_head: error
    unpinned_action: warn
    unpinned_reusable_workflow: warn
    unpinned_container: warn
    missing_permissions: warn
    unknown_write_permission: warn
    added_secret_reference: warn
    workflow_deleted: warn
    malformed_workflow: error

high_risk_paths:
  authentication:
    paths: ["src/auth/**"]
    require_tests: ["test/auth/**"]
    severity: error
```

For an agent-authored PR, the body can declare its intended scope:

```md
<!-- agent-gate-contract
version: 1
agent: codex
task: update session expiry handling
allowed_paths:
  - src/auth/**
  - test/auth/**
-->
```

The contract is an untrusted PR declaration, not proof that the task or author
is legitimate. The base-branch policy remains authoritative.

### Time-Bounded Waivers

After reviewing a finding, maintainers can waive that exact evidence from the
trusted base policy:

```yaml
waivers:
  - finding_id: agf_0123456789abcdef
    reason: Approved OIDC release workflow
    expires_at: "2026-09-30T00:00:00Z"
```

Waived findings remain visible. Expired waivers reactivate the original finding
and emit `policy/waiver-expired`. Analysis-integrity findings cannot be waived.

See the complete [configuration reference](docs/configuration.md).

## Adopt Safely

1. Start with `mode: observe` or `mode: warn` and `fail-on-block: false`.
2. Review findings and tune per-check severity.
3. Add narrow, expiring waivers only after human review.
4. Move stable policy to `mode: block`.
5. Set `fail-on-block: true` and require the check in branch protection.

Human report labels are deliberately distinct:

- `PASSED`: analysis completed with no active warning/error findings.
- `OBSERVED FINDINGS`: observe mode found evidence without changing the pass decision.
- `NEEDS REVIEW`: warn mode requires a human decision.
- `BLOCKED`: block mode rejected active policy findings.
- `ANALYSIS INCOMPLETE`: Agent Gate could not make a trustworthy decision and fails closed.

## Trust Boundary

The GitHub Action:

- reads PR metadata and file contents through GitHub APIs only
- loads configuration from the exact base commit
- never checks out or executes PR-controlled code
- never evaluates GitHub expressions from workflow YAML
- never calls an LLM during analysis
- limits API concurrency, content to 1 MiB per file side and 64 MiB per run,
  findings, and rendered report size
- records base/head SHAs, policy digest, analyzed file counts, and engine version

The pull-request files API has a 3,000-file maximum. Agent Gate compares the
authoritative PR file count with the collected list and fails closed instead of
presenting a partial pass.

Read the full [security model](docs/security-model.md) and
[evidence model](docs/evidence-model.md).

## Agent Gate Is Not a Workflow Linter

Workflow linters such as zizmor inspect workflow correctness and known
misconfigurations. LLM reviewers apply semantic judgment. Agent Gate is the
change-control layer between an AI-generated PR and merge: it asks whether the
PR crossed repository-specific boundaries and records why.

Use all three when appropriate; they solve different problems.

## Action Outputs

| Output                                         | Meaning                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `decision`                                     | `pass`, `warn`, or `block`                                          |
| `status`                                       | Human/machine status including `incomplete`                         |
| `analysis-complete`                            | Whether all required evidence was available                         |
| `error-count` / `warning-count` / `info-count` | Active finding counts                                               |
| `waived-count`                                 | Findings retained but excluded from the decision                    |
| `expected-file-count` / `analyzed-file-count`  | File-list completeness evidence                                     |
| `report-json` / `report-markdown`              | Generated report paths                                              |
| `risk-score`                                   | Deprecated v0.x compatibility output; not a calibrated risk measure |

Inputs and failure behavior are documented in the
[Action reference](docs/action-reference.md).

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

Every rule requires passing and failing fixtures, exact rule/severity/decision
assertions, and a Markdown snapshot for user-facing findings. Start with the
[contribution guide](CONTRIBUTING.md).

## Documentation

- [Documentation index](docs/README.md)
- [Getting started](docs/getting-started.md)
- [CLI reference](docs/cli.md)
- [Configuration](docs/configuration.md)
- [First report](docs/first-report.md)
- [Security model](docs/security-model.md)
- [Roadmap](docs/roadmap.md)

If Agent Gate catches a real boundary crossing in your repository, a GitHub
Star is a simple way to tell us the project is useful.

## License

[MIT](LICENSE)
