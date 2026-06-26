# Agent Gate

[![Release](https://img.shields.io/github/v/release/sjh9714/Agent-Gate?include_prereleases&label=release)](https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.5)
[![CI](https://github.com/sjh9714/Agent-Gate/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/Agent-Gate/actions/workflows/ci.yml)
[![Agent Gate](https://github.com/sjh9714/Agent-Gate/actions/workflows/agent-gate.yml/badge.svg)](https://github.com/sjh9714/Agent-Gate/actions/workflows/agent-gate.yml)
[![License](https://img.shields.io/github/license/sjh9714/Agent-Gate)](LICENSE)

> Catch risky AI-generated PRs before merge — without checking out PR code.

Agent Gate is a GitHub Action that checks deterministic merge evidence: out-of-scope edits, GitHub Actions permission escalation, agent instruction drift, MCP config drift, missing test-file evidence, and package lifecycle script drift in `v0.2.4+`.

The Action uses no checkout of PR code, no runtime LLM calls, no repository script execution, and no policy loaded from an untrusted PR head. The same analyzer also powers local replay fixtures for deterministic demos.

[30-second install](#30-second-install) · [Example report](#real-report-example) · [Tune policy](#after-the-first-run-tune-policy) · [Action reference](#action-reference) · [Evidence model](docs/evidence-model.md)

Policy boundaries for AI PRs, backed by repeatable evidence.

## 30-Second Install

Download the observe-mode workflow template into your repository:

macOS/Linux:

```bash
mkdir -p .github/workflows \
  && curl -fsSL https://raw.githubusercontent.com/sjh9714/Agent-Gate/v0.2.5/templates/agent-gate-observe.yml \
  -o .github/workflows/agent-gate.yml
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .github/workflows | Out-Null
Invoke-WebRequest `
  -Uri https://raw.githubusercontent.com/sjh9714/Agent-Gate/v0.2.5/templates/agent-gate-observe.yml `
  -OutFile .github/workflows/agent-gate.yml
```

This downloads a tag-pinned workflow YAML file. It does not execute a remote
script. Commit the file and open a pull request; Agent Gate will run in warn
mode without requiring `agent-gate.yml` for the first run.

Next:

1. Commit `.github/workflows/agent-gate.yml`.
2. Open a pull request.
3. Read the Agent Gate job summary.

## Real Report Example

On a first run without `agent-gate.yml`, Agent Gate can still surface built-in
default-policy warnings. For example, package lifecycle script drift:

```text
Agent Gate: NEEDS HUMAN DECISION
Decision: warn
Why: package.json added a preinstall script.
Recommended next step: review the lifecycle script before merging.
Policy status: warning today; eligible to become a merge gate after tuning.

Finding ID: agf_...
Policy source: built-in default
```

New to the report? See `docs/first-report.md` for how to read decisions,
finding IDs, evidence snapshots, and policy source.

## What Runs Without `agent-gate.yml`?

| Check                              | First run without config    | With `agent-gate.yml` |
| ---------------------------------- | --------------------------- | --------------------- |
| Workflow permission escalation     | yes                         | configurable          |
| Dangerous workflow patterns        | yes                         | configurable          |
| Agent control-plane drift          | yes                         | configurable          |
| Package lifecycle script drift     | yes, warn by default        | configurable          |
| Agent detection                    | no                          | yes                   |
| PR-body contract required          | no                          | yes                   |
| Out-of-contract edits              | only when a contract exists | yes                   |
| High-risk paths and matching tests | no                          | yes                   |

## After The First Run: Tune Policy

The 30-second install is enough to start in warn mode. If the default
`agent-gate.yml` is confirmed absent on the PR base branch, Agent Gate uses its
built-in default policy and records `configSource: default` in report metadata.

After you see the first reports, tune repo-specific checks with a small
`agent-gate.yml`:

```yaml
version: 1
mode: warn

contract:
  required_for:
    - agent
  allow_missing_in_observe_mode: true

agent_detection:
  labels:
    - ai
    - agent
    - codex
  branch_patterns:
    - "codex/**"
    - "ai/**"

high_risk_paths:
  workflows:
    paths:
      - ".github/workflows/**"
    severity: error
```

For an AI-generated PR, add a small contract to the PR body:

```md
<!-- agent-gate-contract
version: 1
agent: codex
task: update auth session handling
allowed_paths:
  - src/auth/**
  - tests/auth/**
required_evidence:
  - matching auth tests changed
-->
```

Once tuned, Agent Gate can report contract-scope evidence too:

```text
Agent Gate: NEEDS HUMAN DECISION
Decision: warn
Why: .github/workflows/release.yml changed outside the allowed contract scope.
Recommended next step: review the workflow change before merging.
Policy status: warning today; eligible to become a merge gate after tuning.

Finding ID: agf_...
```

Read the first runs as observation, not proof of semantic correctness:

- `PASSED`: safe to observe
- `WARN`: needs human decision
- `BLOCKED`: must block once policy is enforced

## What It Catches

- Out-of-contract edits: agent PRs changing files outside their declared scope.
- Workflow permission escalation: Actions workflows gaining broader write access.
- Agent control-plane drift (`agent-control-plane/drift`): instruction or tool config changes that affect future agents.
- Missing test evidence: high-risk source changes without matching test file changes.
- MCP config drift: `.mcp.json` changes that alter which tools agents can call.
- Package lifecycle script drift: risky `package.json` lifecycle scripts added or changed in `v0.2.4+` ([rule guide](docs/rules/package-lifecycle-scripts.md)).

## What Agent Gate Does Not Do

Agent Gate does not:

- prove that a PR is semantically correct
- replace human code review
- run an LLM reviewer at CI time
- execute PR-controlled code
- prove that matching tests are meaningful

## When To Use Agent Gate

Use Agent Gate when:

- AI agents open pull requests in your repository
- you want policy-boundary evidence before merge
- you want CI checks that do not execute PR-controlled code
- you want to start in warn mode before enforcing gates

Recommended rollout:

1. Start with `mode: warn` and `fail-on-block: false`.
2. Review reports for false positives and noisy rules.
3. Tune `agent-gate.yml`.
4. Promote stable findings to `mode: block`.
5. Set `fail-on-block: true` when the check should block merges.

## Agent Gate vs LLM Reviewers

LLM reviewers help with judgment. Agent Gate verifies deterministic merge evidence.

Agent Gate does not try to find every semantic bug or replace code review. It checks policy boundaries that should be explainable and repeatable in CI:

- did the PR stay inside its declared scope?
- did workflow permissions escalate?
- did agent control-plane files drift?
- did high-risk code change without matching test-file evidence?
- did MCP config changes get surfaced?
- did package lifecycle scripts change? (`v0.2.4+`)

Use your LLM reviewer for judgment. Use Agent Gate for deterministic merge evidence.

## Why Deterministic?

AI agents can produce useful pull requests, but tests and LLM review do not always surface policy-boundary changes:

- a workflow quietly gains write permissions
- an agent edits files outside the declared task scope
- `.mcp.json` changes which tools future agents can call
- `AGENTS.md` changes future agent behavior
- risky source changes land without matching test-file evidence
- `package.json` adds a `preinstall`, `install`, `postinstall`, or `prepare` script

Agent Gate focuses on these repeatable boundary checks.

## Replay Demo

Human-readable output for demos:

```bash
pnpm --filter agent-gate build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

Example output:

```text
Agent Gate: BLOCKED

ERROR workflow/permission-escalation
contents permission increased from read to write.
Path: .github/workflows/release.yml

ERROR workflow/dangerous-pattern
.github/workflows/release.yml contains a dangerous GitHub Actions workflow pattern.
Path: .github/workflows/release.yml
```

Machine-readable JSON report:

```bash
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation --format json
```

Expected result: Agent Gate reports a blocked PR with `workflow/permission-escalation` and `workflow/dangerous-pattern` findings.

Additional unsafe-pr-zoo demos:

- `agent-control-plane-drift`: blocks `AGENTS.md` changes because they can change future agent behavior.
- `out-of-scope-agent-edit`: blocks a payment webhook edit outside the PR contract's `allowed_paths`.
- `missing-test-evidence`: blocks an auth logic change without matching auth test changes.
- `mcp-config-drift`: blocks `.mcp.json` changes because MCP config can change which tools an agent can call.
- `package-lifecycle-script-added`: warns on a new risky package lifecycle script in `v0.2.4+`.

```bash
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/agent-control-plane-drift
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/out-of-scope-agent-edit
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/missing-test-evidence
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/mcp-config-drift
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/package-lifecycle-script-added
```

## Action Reference

Use the root action with `sjh9714/Agent-Gate@v0.2.5`. No checkout step is required.

### Inputs

| Input             | Default                  | Description                                                                                                                             |
| ----------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `config`          | `agent-gate.yml`         | Optional policy config path on the PR base branch. In `v0.2.3+`, built-in defaults are used when the default path is confirmed missing. |
| `github-token`    | `${{ github.token }}`    | Token used for API-only pull request reads.                                                                                             |
| `mode`            | config value             | Override policy mode: `observe`, `warn`, or `block`.                                                                                    |
| `comment`         | `false`                  | Create or update a marked PR report comment.                                                                                            |
| `fail-on-block`   | `true`                   | Exit with code 1 when the decision is `block`.                                                                                          |
| `report-json`     | `agent-gate-report.json` | Path to write the JSON report.                                                                                                          |
| `report-markdown` | `agent-gate-report.md`   | Path to write the Markdown report.                                                                                                      |

### Outputs

| Output            | Description                                 |
| ----------------- | ------------------------------------------- |
| `decision`        | Final decision: `pass`, `warn`, or `block`. |
| `risk-score`      | Risk score from 0 to 100.                   |
| `report-json`     | Path to the JSON report.                    |
| `report-markdown` | Path to the Markdown report.                |

`mode` controls rollout behavior. `decision` is the analyzer result. Start with `mode: warn` and `fail-on-block: false`, tune the findings, then move to `mode: block` when the rule signal is precise enough.

### Permissions And Comments

The minimal permissions are:

```yaml
permissions:
  contents: read
  pull-requests: read
```

To let Agent Gate create or update a PR report comment, add `issues: write` and set `comment: true`. On fork pull requests, GitHub may still provide a read-only token, so comment failures are reported as warnings instead of failing the action.

```yaml
permissions:
  contents: read
  pull-requests: read
  issues: write

with:
  comment: true
```

### Policy Config

Create `agent-gate.yml` in the repository root:

```yaml
version: 1
mode: warn

contract:
  required_for:
    - agent
  allow_missing_in_observe_mode: true

agent_detection:
  authors:
    - github-copilot[bot]
  labels:
    - ai
    - agent
    - codex
  branch_patterns:
    - "codex/**"
    - "ai/**"

high_risk_paths:
  workflows:
    paths:
      - ".github/workflows/**"
    severity: error
```

Teams can add auth, payments, infra, and agent-control-plane paths as their policy matures.

Current `agent-gate.yml` support is intentionally narrow: agent detection, PR-body contracts, high-risk paths with matching test-file evidence, agent-control-plane paths, GitHub Actions workflow rules, and package lifecycle script checks. File-based contracts, risk budgets, dependency additions, lockfile mismatch, claim-vs-CI evidence, reviewer requirements, and rollback-plan requirements are planned areas and are rejected today instead of being accepted as no-op settings.

Starting in `v0.2.4`, package lifecycle script checks are enabled by default in warning mode. They inspect configured `package.json` paths for added or changed `preinstall`, `install`, `postinstall`, and `prepare` scripts. See `docs/rules/package-lifecycle-scripts.md` for triage guidance. Dependency additions and lockfile mismatch checks remain future work.

```yaml
package_scripts:
  enabled: true
  severity: warn
```

Starting in `v0.2.3`, if the default `agent-gate.yml` is confirmed absent on the PR base branch, Agent Gate can use its built-in default policy and record `configSource: default` in report metadata. That released default policy gives repository-agnostic first signals for GitHub Actions workflow checks, agent-control-plane drift, and pinned-action warnings.

In `v0.2.4+`, the built-in default policy also includes warning-mode package lifecycle script drift checks. Repository-specific checks such as agent detection, required PR contracts, high-risk source paths, and matching test-file evidence still require `agent-gate.yml`.

## Status And Roadmap

Agent Gate is pre-release. The latest prerelease is `v0.2.5`.

Use `sjh9714/Agent-Gate@v0.2.5` or a pinned commit SHA for installs. `@main` tracks active development and may change.

See `CHANGELOG.md` for release history and `docs/evidence-model.md` for the current evidence model. Latest external install smoke evidence is recorded in `docs/external-install-smoke-v0.2.4.md`.

See `docs/repository-governance.md` for recommended branch protection and release safety settings. Feedback on AI-generated PR safety policies is welcome in [#27](https://github.com/sjh9714/Agent-Gate/issues/27).

## Packages

- `packages/core`: pure analysis engine, built-in deterministic rules, and JSON/Markdown report renderers.
- `packages/cli`: `agent-gate replay <fixture-dir>` for deterministic local fixture demos.
- `packages/action`: Node 24 GitHub Action package that reads pull request data through GitHub APIs and calls the core analyzer.

## Action Package

External users should prefer the root action with `sjh9714/Agent-Gate@<ref>`. The package-local action remains at `packages/action/action.yml` for this repository's own development workflow. Both use REST APIs only: they load `agent-gate.yml` from the PR base ref when present, fall back to built-in defaults only when the default file is confirmed absent, read changed-file metadata and file contents from the API, run `@agent-gate/core`, write JSON/Markdown reports, set action outputs, write the job summary, and optionally upsert one marked PR report comment. They do not checkout the pull request or execute repository scripts.

## Self-Dogfooding

Agent Gate runs against this repository's pull requests through `.github/workflows/agent-gate.yml`. The workflow uses `sjh9714/Agent-Gate/packages/action@main`, so pull requests do not execute Action code from their own branches while the action itself is under development. It starts in non-blocking `warn` mode while the project tunes early policy.

## Local Development

Prerequisites:

- Node.js 20+
- pnpm 11.5.0

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Principle

Agent Gate must not call LLMs at runtime, execute PR-controlled code, or load policy from an untrusted PR head. The core analysis package must remain independent from GitHub APIs.
